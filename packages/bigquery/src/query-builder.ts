import type { Jurisdiction } from '@priovex/types';
import { PATENTS_TABLE } from './client';

export interface KeywordQueryOptions {
  keywords: string[];
  jurisdictions: Jurisdiction[];
  limit: number;
  offset?: number;
  dateFrom?: string;
}

export interface CPCQueryOptions {
  cpcCodes: string[];
  jurisdictions: Jurisdiction[];
  limit: number;
  offset?: number;
}

export interface TimelineQueryOptions {
  keywords: string[];
  cpcCodes: string[];
  jurisdictions: Jurisdiction[];
  yearFrom?: number;
}

function sanitizeKeyword(kw: string): string {
  // Remove SQL injection vectors — only allow alphanumeric, spaces, hyphens
  return kw.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().toLowerCase().slice(0, 100);
}

function buildCountryFilter(jurisdictions: Jurisdiction[]): string {
  if (!jurisdictions.length) return '';
  const codes = jurisdictions
    .map((j) => {
      if (j === 'WO') return "'WO'";
      if (j === 'EP') return "'EP'";
      return `'${j}'`;
    })
    .join(', ');
  return `AND country_code IN (${codes})`;
}

export function buildKeywordSearchQuery(opts: KeywordQueryOptions): string {
  const { keywords, jurisdictions, limit, offset = 0 } = opts;

  const conditions = keywords
    .filter((kw) => kw.trim())
    .slice(0, 5) // Max 5 keyword conditions per query
    .map((kw) => {
      const safe = sanitizeKeyword(kw);
      return `(
        LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%${safe}%'
        OR LOWER(abstract_localized[SAFE_OFFSET(0)].text) LIKE '%${safe}%'
      )`;
    })
    .join('\n      OR ');

  const countryFilter = buildCountryFilter(jurisdictions);

  return `
    SELECT
      publication_number,
      title_localized[SAFE_OFFSET(0)].text AS title,
      abstract_localized[SAFE_OFFSET(0)].text AS abstract,
      filing_date,
      grant_date,
      priority_date,
      ARRAY(SELECT name FROM UNNEST(assignee_harmonized) LIMIT 3) AS assignees,
      ARRAY(SELECT name FROM UNNEST(inventor_harmonized) LIMIT 5) AS inventors,
      ARRAY(SELECT code FROM UNNEST(cpc) LIMIT 10) AS cpc_codes,
      ARRAY(SELECT code FROM UNNEST(ipc) LIMIT 5) AS ipc_codes,
      country_code,
      family_id
    FROM \`${PATENTS_TABLE}\`
    WHERE (
      ${conditions}
    )
    ${countryFilter}
    AND title_localized[SAFE_OFFSET(0)].text IS NOT NULL
    AND abstract_localized[SAFE_OFFSET(0)].text IS NOT NULL
    ORDER BY filing_date DESC
    LIMIT ${Math.min(limit, 200)}
    OFFSET ${offset}
  `;
}

export function buildCPCSearchQuery(opts: CPCQueryOptions): string {
  const { cpcCodes, jurisdictions, limit, offset = 0 } = opts;

  const cpcConditions = cpcCodes
    .slice(0, 10)
    .map((code) => `'${code.replace(/[^A-Z0-9\/]/g, '')}'`)
    .join(', ');

  const countryFilter = buildCountryFilter(jurisdictions);

  return `
    SELECT
      publication_number,
      title_localized[SAFE_OFFSET(0)].text AS title,
      abstract_localized[SAFE_OFFSET(0)].text AS abstract,
      filing_date,
      grant_date,
      priority_date,
      ARRAY(SELECT name FROM UNNEST(assignee_harmonized) LIMIT 3) AS assignees,
      ARRAY(SELECT name FROM UNNEST(inventor_harmonized) LIMIT 5) AS inventors,
      ARRAY(SELECT code FROM UNNEST(cpc) LIMIT 10) AS cpc_codes,
      ARRAY(SELECT code FROM UNNEST(ipc) LIMIT 5) AS ipc_codes,
      country_code,
      family_id,
      citation_count
    FROM \`${PATENTS_TABLE}\`
    WHERE EXISTS (
      SELECT 1 FROM UNNEST(cpc) AS cpc_entry
      WHERE cpc_entry.code IN (${cpcConditions})
    )
    ${countryFilter}
    AND title_localized[SAFE_OFFSET(0)].text IS NOT NULL
    ORDER BY citation_count DESC, filing_date DESC
    LIMIT ${Math.min(limit, 200)}
    OFFSET ${offset}
  `;
}

export function buildCPCExtractionQuery(patentNumbers: string[]): string {
  const numbers = patentNumbers
    .map((n) => `'${n.replace(/[^A-Z0-9\-]/g, '')}'`)
    .slice(0, 50)
    .join(', ');

  return `
    SELECT
      publication_number,
      ARRAY(SELECT code FROM UNNEST(cpc) LIMIT 20) AS cpc_codes,
      ARRAY(SELECT code FROM UNNEST(ipc) LIMIT 10) AS ipc_codes
    FROM \`${PATENTS_TABLE}\`
    WHERE publication_number IN (${numbers})
  `;
}

export function buildTimelineQuery(opts: TimelineQueryOptions): string {
  const { keywords, cpcCodes, jurisdictions, yearFrom = 2000 } = opts;

  const conditions = keywords
    .slice(0, 3)
    .map((kw) => {
      const safe = sanitizeKeyword(kw);
      return `LOWER(abstract_localized[SAFE_OFFSET(0)].text) LIKE '%${safe}%'`;
    })
    .join(' OR ');

  const cpcConditions = cpcCodes.length
    ? `OR EXISTS (SELECT 1 FROM UNNEST(cpc) AS c WHERE c.code IN (${cpcCodes.map((c) => `'${c}'`).join(', ')}))`
    : '';

  const countryFilter = buildCountryFilter(jurisdictions);

  return `
    SELECT
      EXTRACT(YEAR FROM PARSE_DATE('%Y%m%d', filing_date)) AS year,
      COUNT(*) AS filing_count,
      ARRAY_AGG(DISTINCT assignee_harmonized[SAFE_OFFSET(0)].name IGNORE NULLS LIMIT 5) AS top_assignees
    FROM \`${PATENTS_TABLE}\`
    WHERE (${conditions} ${cpcConditions})
    ${countryFilter}
    AND filing_date IS NOT NULL
    AND CAST(filing_date AS INT64) >= ${yearFrom}0101
    GROUP BY year
    ORDER BY year ASC
  `;
}

export function buildAssigneeAnalysisQuery(
  keywords: string[],
  cpcCodes: string[],
  jurisdictions: Jurisdiction[]
): string {
  const conditions = keywords
    .slice(0, 3)
    .map((kw) => {
      const safe = sanitizeKeyword(kw);
      return `LOWER(abstract_localized[SAFE_OFFSET(0)].text) LIKE '%${safe}%'`;
    })
    .join(' OR ');

  const countryFilter = buildCountryFilter(jurisdictions);

  return `
    SELECT
      assignee_harmonized[SAFE_OFFSET(0)].name AS assignee_name,
      COUNT(*) AS patent_count,
      MAX(CAST(filing_date AS INT64)) AS latest_filing,
      MIN(CAST(filing_date AS INT64)) AS earliest_filing
    FROM \`${PATENTS_TABLE}\`
    WHERE (${conditions})
    ${countryFilter}
    AND assignee_harmonized[SAFE_OFFSET(0)].name IS NOT NULL
    GROUP BY assignee_name
    ORDER BY patent_count DESC
    LIMIT 20
  `;
}
