import type { RawPatent, TimelineEntry, AssigneeAnalysis, Jurisdiction } from '@priovex/types';
import { getBigQueryClient, MAX_BYTES_BILLED } from './client';
import {
  buildKeywordSearchQuery,
  buildCPCSearchQuery,
  buildCPCExtractionQuery,
  buildTimelineQuery,
  buildAssigneeAnalysisQuery,
} from './query-builder';

export interface QueryResult {
  patents: RawPatent[];
  bytesProcessed: bigint;
  totalRows: number;
}

interface BigQueryMetadata {
  statistics?: {
    totalBytesProcessed?: string | number;
  };
}

async function runQuery<T>(sql: string): Promise<{ rows: T[]; bytesProcessed: bigint }> {
  const bq = getBigQueryClient();

  const [job] = await bq.createQueryJob({
    query: sql,
    maximumBytesBilled: MAX_BYTES_BILLED.toString(),
    useLegacySql: false,
  });

  const [rows, , metadata] = await job.getQueryResults({ autoPaginate: true });
  const bytesProcessed = BigInt((metadata as BigQueryMetadata)?.statistics?.totalBytesProcessed ?? '0');

  return { rows: rows as T[], bytesProcessed };
}

function mapRowToPatent(row: Record<string, unknown>): RawPatent {
  return {
    publicationNumber: String(row.publication_number ?? ''),
    title: String(row.title ?? 'Untitled'),
    abstract: String(row.abstract ?? ''),
    filingDate: String(row.filing_date ?? ''),
    grantDate: row.grant_date ? String(row.grant_date) : undefined,
    priorityDate: row.priority_date ? String(row.priority_date) : undefined,
    assignees: Array.isArray(row.assignees)
      ? row.assignees.map(String).filter(Boolean)
      : [],
    inventors: Array.isArray(row.inventors)
      ? row.inventors.map(String).filter(Boolean)
      : [],
    cpcCodes: Array.isArray(row.cpc_codes)
      ? row.cpc_codes.map(String).filter(Boolean)
      : [],
    ipcCodes: Array.isArray(row.ipc_codes)
      ? row.ipc_codes.map(String).filter(Boolean)
      : [],
    countryCode: String(row.country_code ?? ''),
    familyId: row.family_id ? String(row.family_id) : undefined,
    citationCount: row.citation_count ? Number(row.citation_count) : undefined,
    url: `https://patents.google.com/patent/${row.publication_number}`,
  };
}

export async function searchByKeywords(
  keywords: string[],
  jurisdictions: Jurisdiction[],
  limit = 100,
  includeClaims = false
): Promise<QueryResult> {
  const sql = buildKeywordSearchQuery({ keywords, jurisdictions, limit, includeClaims });

  try {
    const { rows, bytesProcessed } = await runQuery<Record<string, unknown>>(sql);
    const patents = rows.map(mapRowToPatent);

    return { patents, bytesProcessed, totalRows: patents.length };
  } catch (err) {
    console.error('[BigQuery] Keyword search failed:', err);
    throw new Error(`BigQuery keyword search failed: ${(err as Error).message}`);
  }
}

export async function searchByCPCCodes(
  cpcCodes: string[],
  jurisdictions: Jurisdiction[],
  limit = 150
): Promise<QueryResult> {
  if (!cpcCodes.length) return { patents: [], bytesProcessed: 0n, totalRows: 0 };

  const sql = buildCPCSearchQuery({ cpcCodes, jurisdictions, limit });

  try {
    const { rows, bytesProcessed } = await runQuery<Record<string, unknown>>(sql);
    const patents = rows.map(mapRowToPatent);

    return { patents, bytesProcessed, totalRows: patents.length };
  } catch (err) {
    console.error('[BigQuery] CPC search failed:', err);
    throw new Error(`BigQuery CPC search failed: ${(err as Error).message}`);
  }
}

export async function extractCPCCodes(
  publicationNumbers: string[]
): Promise<Map<string, string[]>> {
  if (!publicationNumbers.length) return new Map();

  const sql = buildCPCExtractionQuery(publicationNumbers);
  const { rows } = await runQuery<Record<string, unknown>>(sql);

  const result = new Map<string, string[]>();
  for (const row of rows) {
    const num = String(row.publication_number);
    const codes = Array.isArray(row.cpc_codes) ? row.cpc_codes.map(String) : [];
    result.set(num, codes);
  }

  return result;
}

export async function getTimelineAnalysis(
  keywords: string[],
  cpcCodes: string[],
  jurisdictions: Jurisdiction[]
): Promise<TimelineEntry[]> {
  const sql = buildTimelineQuery({ keywords, cpcCodes, jurisdictions, yearFrom: 2000 });

  try {
    const { rows } = await runQuery<Record<string, unknown>>(sql);

    return rows.map((row) => ({
      year: Number(row.year),
      filingCount: Number(row.filing_count),
      grantCount: 0,
      topAssignees: Array.isArray(row.top_assignees)
        ? row.top_assignees.map(String).filter(Boolean)
        : [],
      emergingTechnologies: [],
    }));
  } catch (err) {
    console.error('[BigQuery] Timeline analysis failed:', err);
    return [];
  }
}

export async function getAssigneeAnalysis(
  keywords: string[],
  cpcCodes: string[],
  jurisdictions: Jurisdiction[]
): Promise<AssigneeAnalysis[]> {
  const sql = buildAssigneeAnalysisQuery(keywords, cpcCodes, jurisdictions);

  try {
    const { rows } = await runQuery<Record<string, unknown>>(sql);

    return rows.map((row) => {
      const latestFiling = Number(row.latest_filing ?? 0);
      const earliestFiling = Number(row.earliest_filing ?? 0);
      const span = latestFiling - earliestFiling;

      return {
        name: String(row.assignee_name),
        patentCount: Number(row.patent_count),
        filingTrend: span > 0 && latestFiling > 20200101 ? 'increasing' : 'stable',
        dominantCPCs: [],
        recentFilings: 0,
      };
    });
  } catch (err) {
    console.error('[BigQuery] Assignee analysis failed:', err);
    return [];
  }
}

export function deduplicatePatents(patents: RawPatent[]): RawPatent[] {
  const seen = new Set<string>();
  return patents.filter((p) => {
    const key = p.familyId ?? p.publicationNumber;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
