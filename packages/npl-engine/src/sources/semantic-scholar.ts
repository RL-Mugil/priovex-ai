import type { NPLReference } from '@priovex/types';

const SS_API = 'https://api.semanticscholar.org/graph/v1/paper/search';
const FIELDS = 'title,abstract,year,authors,citationCount,url,externalIds,fieldsOfStudy';
const TIMEOUT_MS = 15_000;

interface SSAuthor {
  name: string;
}

interface SSPaper {
  paperId: string;
  title?: string;
  abstract?: string;
  year?: number;
  authors?: SSAuthor[];
  citationCount?: number;
  url?: string;
  externalIds?: { DOI?: string; ArXiv?: string };
  fieldsOfStudy?: string[];
}

interface SSResponse {
  data?: SSPaper[];
  total?: number;
}

function sanitize(s: string): string {
  return s.replace(/[^\w\s\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export async function searchSemanticScholar(
  query: string,
  limit = 15,
  yearFrom = 2010
): Promise<NPLReference[]> {
  const safe = sanitize(query);
  if (!safe) return [];

  const params = new URLSearchParams({
    query: safe,
    fields: FIELDS,
    limit: String(Math.min(limit, 100)),
    year: `${yearFrom}-`,
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${SS_API}?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PrioVex-NPL-Engine/2.0' },
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const json = (await res.json()) as SSResponse;
    const papers = json.data ?? [];

    return papers
      .filter((p) => p.title && p.abstract)
      .map((p): NPLReference => ({
        id: `ss:${p.paperId}`,
        source: 'semantic_scholar',
        title: p.title ?? '',
        authors: (p.authors ?? []).map((a) => a.name),
        abstract: p.abstract ?? '',
        publicationDate: p.year ? `${p.year}-01-01` : '',
        url: p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
        doi: p.externalIds?.DOI,
        arxivId: p.externalIds?.ArXiv,
        relevanceScore: 0,
        citationCount: p.citationCount,
        categories: p.fieldsOfStudy ?? [],
      }));
  } catch {
    return [];
  }
}
