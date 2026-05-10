import type { NPLReference } from '@priovex/types';

const ARXIV_API = 'http://export.arxiv.org/api/query';
const TIMEOUT_MS = 15_000;

function encodeQuery(terms: string[]): string {
  return terms
    .map((t) => t.replace(/[^a-zA-Z0-9\s]/g, '').trim())
    .filter(Boolean)
    .join('+');
}

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractAll(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/<[^>]+>/g, '').trim());
  }
  return results;
}

function parseEntry(entry: string): NPLReference | null {
  const id = extractText(entry, 'id');
  const title = extractText(entry, 'title');
  const summary = extractText(entry, 'summary');
  const published = extractText(entry, 'published');

  if (!title || !id) return null;

  const arxivId = id.split('/abs/').pop()?.split('v')[0] ?? id;
  const authors = extractAll(entry, 'name');
  const categories = extractAll(entry, 'category')
    .map((c) => {
      const m = c.match(/term="([^"]+)"/);
      return m ? m[1] : c;
    })
    .filter(Boolean);

  return {
    id: `arxiv:${arxivId}`,
    source: 'arxiv',
    title: title.replace(/\n/g, ' ').trim(),
    authors,
    abstract: summary.replace(/\n/g, ' ').trim(),
    publicationDate: published ? published.split('T')[0] : '',
    url: `https://arxiv.org/abs/${arxivId}`,
    arxivId,
    relevanceScore: 0,
    categories,
  };
}

export async function searchArXiv(
  primaryTerms: string[],
  maxResults = 15
): Promise<NPLReference[]> {
  const query = encodeQuery(primaryTerms);
  if (!query) return [];

  const url = `${ARXIV_API}?search_query=all:${query}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const xml = await res.text();

    const entries: string[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xml)) !== null) {
      entries.push(match[1]);
    }

    return entries.map(parseEntry).filter((r): r is NPLReference => r !== null);
  } catch {
    return [];
  }
}

export async function searchArXivClaims(
  term1: string,
  term2: string,
  maxResults = 10
): Promise<NPLReference[]> {
  const t1 = encodeQuery([term1]);
  const t2 = encodeQuery([term2]);
  if (!t1 || !t2) return [];

  const url = `${ARXIV_API}?search_query=all:${t1}+AND+all:${t2}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const xml = await res.text();
    const entries: string[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xml)) !== null) {
      entries.push(match[1]);
    }

    return entries.map(parseEntry).filter((r): r is NPLReference => r !== null);
  } catch {
    return [];
  }
}
