import type { NPLReference } from '@priovex/types';

const EFTS_GRANTS = 'https://efts.uspto.gov/LATEST/search-grants';
const EFTS_APPS   = 'https://efts.uspto.gov/LATEST/search-applications';
const TIMEOUT_MS  = 15_000;

interface EFTSHit {
  _id: string;
  _source?: {
    patent_title?: string[];
    patent_abstract?: string[];
    assignee_organization?: string[];
    filing_date?: string;
    issue_date?: string;
    patent_number?: string;
  };
}

interface EFTSResponse {
  hits?: {
    hits?: EFTSHit[];
    total?: { value: number };
  };
}

function sanitize(s: string): string {
  return s.replace(/[^\w\s\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
}

async function fetchEFTS(url: string, query: string, rows = 15): Promise<NPLReference[]> {
  const safe = sanitize(query);
  if (!safe) return [];

  const params = new URLSearchParams({
    query: safe,
    rows: String(rows),
    dateRangeField: 'issue_date',
    startdt: '2010-01-01',
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${url}?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PrioVex-NPL-Engine/2.0' },
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const json = (await res.json()) as EFTSResponse;
    const hits = json.hits?.hits ?? [];

    return hits.map((hit): NPLReference => {
      const src = hit._source ?? {};
      const title = src.patent_title?.[0] ?? 'Untitled Patent';
      const abstract = src.patent_abstract?.[0] ?? '';
      const patentNum = src.patent_number ?? hit._id;
      const date = src.issue_date ?? src.filing_date ?? '';
      const assignee = src.assignee_organization?.[0] ?? '';

      return {
        id: `efts:${patentNum}`,
        source: 'uspto_efts',
        title,
        authors: assignee ? [assignee] : [],
        abstract,
        publicationDate: date,
        url: `https://ppubs.uspto.gov/pubwebapp/external.html?q=${patentNum}&type=USPAT`,
        relevanceScore: 0,
      };
    });
  } catch {
    return [];
  }
}

export async function searchUSPTOGranted(query: string, rows = 15): Promise<NPLReference[]> {
  return fetchEFTS(EFTS_GRANTS, query, rows);
}

export async function searchUSPTOApplications(query: string, rows = 15): Promise<NPLReference[]> {
  return fetchEFTS(EFTS_APPS, query, rows);
}
