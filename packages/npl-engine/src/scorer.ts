import type { NPLReference } from '@priovex/types';

// BM25 parameters
const K1 = 1.5;
const B  = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function buildTermFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

function bm25Score(
  queryTerms: string[],
  docTokens: string[],
  avgDocLen: number,
  idf: Map<string, number>
): number {
  const tf = buildTermFreq(docTokens);
  const dl = docTokens.length;
  let score = 0;

  for (const term of queryTerms) {
    const freq = tf.get(term) ?? 0;
    if (freq === 0) continue;
    const termIdf = idf.get(term) ?? 1;
    score += termIdf * ((freq * (K1 + 1)) / (freq + K1 * (1 - B + B * (dl / avgDocLen))));
  }

  return score;
}

function computeIDF(queryTerms: string[], docs: string[][]): Map<string, number> {
  const N = docs.length;
  const idf = new Map<string, number>();

  for (const term of queryTerms) {
    const containing = docs.filter((doc) => doc.includes(term)).length;
    idf.set(term, Math.log((N - containing + 0.5) / (containing + 0.5) + 1));
  }

  return idf;
}

export function scoreNPLReferences(
  refs: NPLReference[],
  queryTerms: string[],
  primaryKeywords: string[]
): NPLReference[] {
  if (refs.length === 0) return [];

  const allQueryTokens = tokenize([...queryTerms, ...primaryKeywords].join(' '));
  const uniqueQueryTerms = [...new Set(allQueryTokens)];

  const docs = refs.map((r) =>
    tokenize(`${r.title} ${r.abstract}`)
  );

  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / docs.length;
  const idf = computeIDF(uniqueQueryTerms, docs);

  const scores = docs.map((docTokens) =>
    bm25Score(uniqueQueryTerms, docTokens, avgLen, idf)
  );

  const maxScore = Math.max(...scores, 1);

  return refs.map((ref, i) => {
    const normalizedBm25 = Math.round((scores[i] / maxScore) * 75); // BM25 contributes up to 75

    // Citation boost (up to 15 points)
    const citationBoost = ref.citationCount
      ? Math.min(Math.floor(Math.log(ref.citationCount + 1) * 5), 15)
      : 0;

    // Recency boost for recent papers (up to 10 points)
    const year = ref.publicationDate ? parseInt(ref.publicationDate.slice(0, 4)) : 0;
    const recencyBoost = year >= 2020 ? 10 : year >= 2015 ? 5 : 0;

    const finalScore = Math.min(normalizedBm25 + citationBoost + recencyBoost, 100);

    return {
      ...ref,
      relevanceScore: finalScore,
      bm25Score: scores[i],
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function deduplicateNPL(refs: NPLReference[]): NPLReference[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = r.arxivId ?? r.doi ?? r.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterByMinScore(refs: NPLReference[], minScore = 20): NPLReference[] {
  return refs.filter((r) => r.relevanceScore >= minScore);
}
