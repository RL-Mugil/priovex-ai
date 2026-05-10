import type { StructuredClaim } from '@priovex/types';

const PV_BASE    = 'https://search.patentsview.org/api/v1';
const TIMEOUT_MS = 20_000;

interface PVClaimRow {
  claim_sequence: number;
  claim_text: string;
  dependent_on: number | null;
}

interface PVResponse {
  claims?: PVClaimRow[];
  total_hits?: number;
}

interface PVPatentRow {
  patent_id: string;
  patent_title?: string;
  patent_abstract?: string;
  patent_date?: string;
  assignee_organization?: string;
  cpc_group?: string;
}

interface PVSearchResponse {
  patents?: PVPatentRow[];
  total_hits?: number;
}

function stripUS(num: string): string {
  // PatentsView uses numeric IDs without country prefix
  return num.replace(/^US/i, '').replace(/[^0-9]/g, '');
}

export async function fetchFullClaims(patentNumber: string): Promise<StructuredClaim[]> {
  const id = stripUS(patentNumber);
  if (!id) return [];

  const filter = JSON.stringify({ _eq: { patent_id: id } });
  const fields = JSON.stringify(['claim_sequence', 'claim_text', 'dependent_on']);
  const opts   = JSON.stringify({ size: 50 });

  const url = `${PV_BASE}/claim/?q=${encodeURIComponent(filter)}&f=${encodeURIComponent(fields)}&s=[{"claim_sequence":"asc"}]&o=${encodeURIComponent(opts)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const json = (await res.json()) as PVResponse;
    const rows = json.claims ?? [];

    return rows.map((r) => ({
      sequence: r.claim_sequence,
      text: r.claim_text,
      dependentOn: r.dependent_on ?? null,
      isIndependent: r.dependent_on === null,
    }));
  } catch {
    return [];
  }
}

export async function fetchClaimsBatch(patentNumbers: string[]): Promise<Map<string, StructuredClaim[]>> {
  const result = new Map<string, StructuredClaim[]>();

  // Fetch in parallel with concurrency cap
  const CONCURRENCY = 5;
  for (let i = 0; i < patentNumbers.length; i += CONCURRENCY) {
    const batch = patentNumbers.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((num) => fetchFullClaims(num).then((claims) => ({ num, claims })))
    );
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value.claims.length > 0) {
        result.set(r.value.num, r.value.claims);
      }
    }
  }

  return result;
}

export async function searchPatentsView(
  query: string,
  cpcCode: string,
  limit = 15
): Promise<Array<{ id: string; title: string; abstract: string; date: string; assignee: string }>> {
  const filter = JSON.stringify({
    _and: [
      { _begins: { cpc_group: cpcCode.slice(0, 6) } },
      { _text_any: { patent_abstract: query } },
    ],
  });

  const fields = JSON.stringify([
    'patent_id', 'patent_title', 'patent_abstract',
    'patent_date', 'assignee_organization', 'cpc_group',
  ]);

  const opts = JSON.stringify({ size: limit });

  const url = `${PV_BASE}/patent/?q=${encodeURIComponent(filter)}&f=${encodeURIComponent(fields)}&s=[{"patent_date":"desc"}]&o=${encodeURIComponent(opts)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const json = (await res.json()) as PVSearchResponse;
    return (json.patents ?? []).map((p) => ({
      id: `US${p.patent_id}`,
      title: p.patent_title ?? '',
      abstract: p.patent_abstract ?? '',
      date: p.patent_date ?? '',
      assignee: p.assignee_organization ?? '',
    }));
  } catch {
    return [];
  }
}
