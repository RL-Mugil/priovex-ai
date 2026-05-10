import type { NPLReference, KeywordStrategy, StructuredClaim } from '@priovex/types';
import { searchArXiv, searchArXivClaims } from './sources/arxiv';
import { searchSemanticScholar } from './sources/semantic-scholar';
import { searchUSPTOGranted, searchUSPTOApplications } from './sources/uspto-efts';
import { fetchClaimsBatch } from './sources/patentsview-claims';
import { scoreNPLReferences, deduplicateNPL, filterByMinScore } from './scorer';

export { fetchClaimsBatch, fetchFullClaims } from './sources/patentsview-claims';
export { fetchEPOClaimsBatch, searchEPOByKeywords, searchEPOByCPC } from './sources/epo-ops';
export { scoreNPLReferences, deduplicateNPL } from './scorer';

export interface NPLSearchOptions {
  keywords: KeywordStrategy;
  maxPerSource?: number;
  minScore?: number;
  yearFrom?: number;
}

export interface NPLSearchResult {
  references: NPLReference[];
  stats: {
    arxivFound: number;
    semanticScholarFound: number;
    usptoEftsFound: number;
    totalBeforeDedup: number;
    totalAfterDedup: number;
    totalAfterFilter: number;
    sourcesSearched: string[];
  };
}

export async function runNPLSearch(opts: NPLSearchOptions): Promise<NPLSearchResult> {
  const {
    keywords,
    maxPerSource = 20,
    minScore = 15,
    yearFrom = 2010,
  } = opts;

  const primaryQuery  = keywords.primaryKeywords.slice(0, 5).join(' ');
  const synonymQuery  = keywords.synonyms.slice(0, 5).join(' ');
  const nplQuery      = keywords.nplQueries?.[0] ?? primaryQuery;
  const claimsTerms   = keywords.claimsTerms ?? [];

  const sourcesSearched: string[] = [];

  // Run all source searches in parallel
  const [
    arxivPrimary,
    arxivClaims,
    semanticScholarPrimary,
    semanticScholarSynonym,
    usptoGranted,
    usptoApps,
  ] = await Promise.allSettled([
    searchArXiv(keywords.primaryKeywords.slice(0, 5), maxPerSource).then((r) => {
      sourcesSearched.push('arXiv');
      return r;
    }),
    claimsTerms.length >= 2
      ? searchArXivClaims(claimsTerms[0], claimsTerms[1], Math.floor(maxPerSource / 2)).then((r) => {
          return r;
        })
      : Promise.resolve([] as NPLReference[]),
    searchSemanticScholar(primaryQuery, maxPerSource, yearFrom).then((r) => {
      sourcesSearched.push('Semantic Scholar');
      return r;
    }),
    searchSemanticScholar(nplQuery, Math.floor(maxPerSource / 2), yearFrom),
    searchUSPTOGranted(primaryQuery, maxPerSource).then((r) => {
      sourcesSearched.push('USPTO EFTS (Grants)');
      return r;
    }),
    searchUSPTOApplications(synonymQuery, Math.floor(maxPerSource / 2)).then((r) => {
      sourcesSearched.push('USPTO EFTS (Applications)');
      return r;
    }),
  ]);

  function unwrap<T>(result: PromiseSettledResult<T[]>): T[] {
    return result.status === 'fulfilled' ? result.value : [];
  }

  const allRefs: NPLReference[] = [
    ...unwrap(arxivPrimary),
    ...unwrap(arxivClaims),
    ...unwrap(semanticScholarPrimary),
    ...unwrap(semanticScholarSynonym),
    ...unwrap(usptoGranted),
    ...unwrap(usptoApps),
  ];

  const arxivCount  = unwrap(arxivPrimary).length + unwrap(arxivClaims).length;
  const ssCount     = unwrap(semanticScholarPrimary).length + unwrap(semanticScholarSynonym).length;
  const eftsCount   = unwrap(usptoGranted).length + unwrap(usptoApps).length;
  const totalBefore = allRefs.length;

  // Deduplicate by source ID, arxiv ID, or DOI
  const deduped = deduplicateNPL(allRefs);
  const totalAfterDedup = deduped.length;

  // Score with BM25 + citation + recency signals
  const scored = scoreNPLReferences(
    deduped,
    keywords.primaryKeywords,
    keywords.synonyms
  );

  // Filter by minimum relevance
  const filtered = filterByMinScore(scored, minScore);

  return {
    references: filtered,
    stats: {
      arxivFound: arxivCount,
      semanticScholarFound: ssCount,
      usptoEftsFound: eftsCount,
      totalBeforeDedup: totalBefore,
      totalAfterDedup,
      totalAfterFilter: filtered.length,
      sourcesSearched: [...new Set(sourcesSearched)],
    },
  };
}

export async function enrichPatentsWithClaims(
  patentNumbers: string[]
): Promise<Map<string, StructuredClaim[]>> {
  return fetchClaimsBatch(patentNumbers);
}
