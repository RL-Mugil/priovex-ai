import type { Job } from 'bullmq';
import type {
  SearchJobData,
  SearchJobResult,
  RawPatent,
  ScoredPatent,
  ConceptExtraction,
  KeywordStrategy,
  PatentReport,
  NovelElement,
  NPLReference,
  CoverageMatrix,
  IDSEntry,
  ExaminerPrediction,
  GapGroundedClaimDraft,
  StructuredClaim,
} from '@priovex/types';
import { prisma } from '@priovex/database';
import { LogLevel, ReportStyle, type Prisma } from '@priovex/database';

// Extended status values — Prisma enum will include these after migration + regeneration
const SearchStatus = {
  QUEUED: 'QUEUED',
  EXTRACTING: 'EXTRACTING',
  NOVEL_ELEMENTS: 'NOVEL_ELEMENTS',
  KEYWORD_STRATEGY: 'KEYWORD_STRATEGY',
  BROAD_SEARCH: 'BROAD_SEARCH',
  CPC_IDENTIFICATION: 'CPC_IDENTIFICATION',
  DEEP_CPC_SEARCH: 'DEEP_CPC_SEARCH',
  NPL_SEARCH: 'NPL_SEARCH',
  CLAIMS_RETRIEVAL: 'CLAIMS_RETRIEVAL',
  TIMELINE_ANALYSIS: 'TIMELINE_ANALYSIS',
  AI_SCORING: 'AI_SCORING',
  COVERAGE_ANALYSIS: 'COVERAGE_ANALYSIS',
  IDS_GENERATION: 'IDS_GENERATION',
  EXAMINER_SIMULATION: 'EXAMINER_SIMULATION',
  GENERATING_REPORT: 'GENERATING_REPORT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
import { createProviderWithFallback, getAvailableProviders } from '@priovex/ai-providers';
import {
  searchByKeywords,
  searchByCPCCodes,
  extractCPCCodes,
  getTimelineAnalysis,
  getAssigneeAnalysis,
  deduplicatePatents,
} from '@priovex/bigquery';
import {
  runNPLSearch,
  enrichPatentsWithClaims,
  fetchEPOClaimsBatch,
  searchEPOByKeywords,
  searchEPOByCPC,
} from '@priovex/npl-engine';
import {
  generateMarkdownReport,
  generateHTMLReport,
  generatePDFReport,
  generateClientReport,
  generateIDSMarkdown,
  generateIDSCSV,
} from '@priovex/report-generator';
import { AI_RATE_DELAY_MS } from '@priovex/ai-providers';
import { uploadReport } from '../storage';

// =============================================================================
// STEP DEFINITIONS (14-step pipeline)
// =============================================================================

const STEP_DEFINITIONS = [
  { step: 1,  name: 'Extracting Invention Concepts',       status: SearchStatus.EXTRACTING,          pct: 5  },
  { step: 2,  name: 'Decomposing Novel Elements',          status: SearchStatus.NOVEL_ELEMENTS,      pct: 10 },
  { step: 3,  name: 'Building Keyword Strategy',           status: SearchStatus.KEYWORD_STRATEGY,    pct: 15 },
  { step: 4,  name: 'Broad Patent Search',                 status: SearchStatus.BROAD_SEARCH,        pct: 25 },
  { step: 5,  name: 'CPC Code Identification',             status: SearchStatus.CPC_IDENTIFICATION,  pct: 33 },
  { step: 6,  name: 'Deep CPC Search',                     status: SearchStatus.DEEP_CPC_SEARCH,     pct: 42 },
  { step: 7,  name: 'NPL Intelligence Search',             status: SearchStatus.NPL_SEARCH,          pct: 52 },
  { step: 8,  name: 'Full Claims Retrieval',               status: SearchStatus.CLAIMS_RETRIEVAL,    pct: 58 },
  { step: 9,  name: 'Timeline & Assignee Analysis',        status: SearchStatus.TIMELINE_ANALYSIS,   pct: 63 },
  { step: 10, name: 'AI Relevance Scoring',                status: SearchStatus.AI_SCORING,          pct: 70 },
  { step: 11, name: 'Feature Coverage Matrix',             status: SearchStatus.COVERAGE_ANALYSIS,   pct: 77 },
  { step: 12, name: 'IDS Generation',                      status: SearchStatus.IDS_GENERATION,      pct: 82 },
  { step: 13, name: 'Examiner Simulation',                 status: SearchStatus.EXAMINER_SIMULATION, pct: 87 },
  { step: 14, name: 'Generating Dual Reports',             status: SearchStatus.GENERATING_REPORT,   pct: 93 },
];

// =============================================================================
// PIPELINE
// =============================================================================

export async function runSearchPipeline(
  job: Job<SearchJobData, SearchJobResult>
): Promise<SearchJobResult> {
  const { searchId, userId, input } = job.data;
  const startTime = Date.now();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function updateProgress(step: number, patentsFound = 0, nplFound = 0) {
    const stepDef = STEP_DEFINITIONS[step - 1];
    if (!stepDef) return;

    await job.updateProgress(stepDef.pct);

    await prisma.search.update({
      where: { id: searchId },
      data: {
        status: stepDef.status as any,
        currentStep: step,
        progressPercent: stepDef.pct,
        patentsFound,
        nplFound,      // will be resolved after prisma generate
        startedAt: step === 1 ? new Date() : undefined,
        updatedAt: new Date(),
      } as any,
    });
  }

  async function log(level: LogLevel, message: string, metadata?: Prisma.InputJsonValue) {
    await prisma.progressLog.create({
      data: { searchId, level, message, metadata: metadata ?? undefined },
    });
    console.log(`[Search:${searchId}] [${level}] ${message}`);
  }

  async function checkCancellation(): Promise<void> {
    const search = await prisma.search.findUnique({
      where: { id: searchId },
      select: { cancelRequested: true },
    });
    if (search?.cancelRequested) {
      throw new Error('SEARCH_CANCELLED');
    }
  }

  // -------------------------------------------------------------------------
  // Outer-scope accumulators — updated at each step, read by the catch block
  // to generate a partial report when the user cancels mid-run.
  // -------------------------------------------------------------------------
  let _accPatents:        RawPatent[]      = [];
  let _accNPL:            NPLReference[]   = [];
  let _accTopCPCs:        string[]         = [];
  let _accNovelElements:  NovelElement[]   = [];
  let _accKeywords:       string[]         = [];
  let _accBytesProcessed: bigint           = 0n;
  let _accAiModel:        string           = input.aiProvider;
  let _accCurrentPct:     number           = 0;

  try {
    await log(LogLevel.INFO, 'Enterprise search pipeline v2 started (14 steps)');

    // Check available providers before attempting to create one
    const availableProviders = getAvailableProviders();
    await log(LogLevel.INFO, `Configured AI providers: [${availableProviders.join(', ')}]`);

    if (!availableProviders.includes(input.aiProvider)) {
      await log(LogLevel.WARN,
        `Requested provider '${input.aiProvider}' is NOT configured — API key missing. ` +
        `Set ${input.aiProvider === 'gemini' ? 'GOOGLE_GEMINI_API_KEY' : input.aiProvider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} in apps/workers/.env. ` +
        `Falling back to: ${availableProviders[0] ?? 'none'}`
      );
    }

    const aiProvider = await createProviderWithFallback(input.aiProvider);
    _accAiModel = aiProvider.model;

    // Wire AI model-switch events into the live progress log (visible in web UI)
    aiProvider.setProgressLogger?.((level, message) => {
      log(level as LogLevel, message).catch(() => {});
    });

    if (aiProvider.providerType !== input.aiProvider) {
      await log(LogLevel.WARN,
        `Provider fallback active: requested '${input.aiProvider}', running with '${aiProvider.providerType}' (${aiProvider.name} / ${aiProvider.model})`
      );
    } else {
      await log(LogLevel.INFO, `AI provider: ${aiProvider.name} (${aiProvider.model})`);
    }

    // =========================================================================
    // STEP 1 — Concept Extraction
    // =========================================================================
    await updateProgress(1);
    _accCurrentPct = 5;
    await log(LogLevel.INFO, 'Step 1: Extracting invention concepts...');

    const concepts: ConceptExtraction = await aiProvider.extractConcepts(
      input.title,
      input.description,
      input.technicalField,
      input.keyInnovations
    );

    await log(LogLevel.SUCCESS, `Extracted ${concepts.keyFeatures.length} key features, ${concepts.coreConcepts.length} core concepts`);
    await checkCancellation();

    // =========================================================================
    // STEP 2 — Novel Element Decomposition
    // =========================================================================
    await updateProgress(2);
    _accCurrentPct = 10;
    await log(LogLevel.INFO, 'Step 2: Decomposing invention into claim-like novel elements...');

    let novelElements: NovelElement[] = [];
    let systemClaimDraft = '';
    let methodClaimDraft = '';

    try {
      const decomposition = await aiProvider.decomposeNovelElements({
        inventionTitle: input.title,
        inventionDescription: input.description,
        technicalField: input.technicalField,
        problemSolved: input.problemSolved,
        keyInnovations: input.keyInnovations,
        claimsDraft: input.claimsDraft,
      });
      novelElements     = decomposition.elements;
      systemClaimDraft  = decomposition.systemClaimDraft;
      methodClaimDraft  = decomposition.methodClaimDraft;
      _accNovelElements = novelElements;

      await log(LogLevel.SUCCESS, `Decomposed ${novelElements.length} novel elements (avg novelty weight: ${
        Math.round(novelElements.reduce((s, e) => s + e.noveltyWeight, 0) / novelElements.length)
      }%)`);
    } catch (err) {
      await log(LogLevel.WARN, `Novel element decomposition failed, continuing: ${(err as Error).message}`);
    }

    // Activate prompt caching: cache system prompt + invention context for all
    // subsequent AI calls in this pipeline run (~90% discount on re-used tokens)
    aiProvider.setSessionContext?.(input.title, input.description, novelElements);

    await checkCancellation();

    // =========================================================================
    // STEP 3 — Keyword Strategy
    // =========================================================================
    await updateProgress(3);
    _accCurrentPct = 15;
    await log(LogLevel.INFO, 'Step 3: Building comprehensive keyword search strategy...');

    const keywordStrategy: KeywordStrategy = await aiProvider.buildKeywordStrategy(
      concepts,
      input.technicalField
    );

    // Enrich with novel-element-derived keywords
    if (novelElements.length > 0) {
      const elementKeywords = novelElements.flatMap((e) => e.searchKeywords).slice(0, 20);
      keywordStrategy.primaryKeywords = [...new Set([...keywordStrategy.primaryKeywords, ...elementKeywords.slice(0, 5)])];
    }

    await log(LogLevel.SUCCESS, `Strategy: ${keywordStrategy.primaryKeywords.length} primary, ${keywordStrategy.synonyms.length} synonyms, ${keywordStrategy.cpcHints.length} CPC hints, ${keywordStrategy.nplQueries?.length ?? 0} NPL queries`, {
      type: 'KEYWORD_STRATEGY',
      primaryKeywords: keywordStrategy.primaryKeywords,
      synonyms: keywordStrategy.synonyms.slice(0, 10),
      cpcHints: keywordStrategy.cpcHints,
      nplQueries: keywordStrategy.nplQueries?.slice(0, 5) ?? [],
    });
    await checkCancellation();

    // =========================================================================
    // STEP 4 — Broad Patent Search (BigQuery → EPO OPS fallback)
    // =========================================================================
    await updateProgress(4);
    _accCurrentPct = 25;
    await log(LogLevel.INFO, 'Step 4: Running broad patent search (BigQuery)...');

    const allKeywords = [
      ...keywordStrategy.primaryKeywords,
      ...keywordStrategy.synonyms.slice(0, 15),
    ];
    _accKeywords = allKeywords;

    let broadResults: RawPatent[] = [];
    let totalBytesProcessed = 0n;
    let bigQueryQuotaHit = false;

    const batchSize = 3;
    for (let i = 0; i < Math.min(allKeywords.length, 12); i += batchSize) {
      const batch = allKeywords.slice(i, i + batchSize);
      try {
        const includeClaims = (input.depth as string).toLowerCase() === 'thorough';
        const result = await searchByKeywords(batch, input.jurisdictions, 100, includeClaims);
        broadResults.push(...result.patents);
        totalBytesProcessed += result.bytesProcessed;
        const batchNum = Math.floor(i / batchSize) + 1;
        await log(LogLevel.INFO, `[BigQuery] Keyword batch ${batchNum}: ${result.patents.length} patents found`, {
          type: 'PATENT_BATCH',
          source: 'bigquery',
          batch: batchNum,
          keywords: batch,
          found: result.patents.length,
          samples: result.patents.slice(0, 4).map((p) => ({ title: p.title, pub: p.publicationNumber, year: p.filingDate?.slice(0, 4) })),
        });
      } catch (err) {
        const msg = (err as Error).message;
        bigQueryQuotaHit = true;
        await log(LogLevel.WARN, `[BigQuery] Search failed — switching to EPO OPS. Reason: ${msg.slice(0, 120)}`);
        break;
      }
      await checkCancellation();
    }

    // EPO OPS fallback when BigQuery quota is hit
    if (bigQueryQuotaHit) {
      const epoCredentials = !!process.env.EPO_OPS_KEY;
      if (!epoCredentials) {
        await log(LogLevel.WARN, '[EPO OPS] Credentials not configured — cannot use as fallback. Search will continue with 0 patents.');
      } else {
        await log(LogLevel.INFO, `[EPO OPS] Searching EPO database with ${Math.min(allKeywords.length, 10)} keywords (up to 100 results)...`);
        try {
          const epoResult = await searchEPOByKeywords(allKeywords.slice(0, 10), 100);
          const epCount = epoResult.patents.filter(p => p.countryCode === 'EP').length;
          const woCount = epoResult.patents.filter(p => p.countryCode === 'WO').length;
          const otherCount = epoResult.patents.length - epCount - woCount;
          broadResults.push(...epoResult.patents);
          await log(LogLevel.SUCCESS, `[EPO OPS] Keyword search: ${epoResult.patents.length} patents found (EP: ${epCount}, WO: ${woCount}, other: ${otherCount}) — total in EPO DB matching query: ${epoResult.total}`, {
            type: 'EPO_SEARCH',
            source: 'epo-ops',
            found: epoResult.patents.length,
            totalInDB: epoResult.total,
            breakdown: { EP: epCount, WO: woCount, other: otherCount },
            samples: epoResult.patents.slice(0, 5).map(p => ({ title: p.title, pub: p.publicationNumber, assignee: p.assignees[0] ?? 'Unknown', year: p.filingDate?.slice(0, 4) })),
          });
        } catch (err) {
          await log(LogLevel.WARN, `[EPO OPS] Keyword search failed: ${(err as Error).message}`);
        }
      }
    }

    broadResults = deduplicatePatents(broadResults);
    _accPatents = broadResults;
    _accBytesProcessed = totalBytesProcessed;
    const step4Source = bigQueryQuotaHit ? 'EPO OPS' : 'BigQuery';
    await log(LogLevel.SUCCESS, `Broad search complete [source: ${step4Source}]: ${broadResults.length} unique patents`);
    await prisma.search.update({ where: { id: searchId }, data: { patentsFound: broadResults.length } });

    // =========================================================================
    // STEP 5 — CPC Code Identification
    // =========================================================================
    await updateProgress(5, broadResults.length);
    _accCurrentPct = 33;
    await log(LogLevel.INFO, 'Step 5: Extracting and ranking CPC codes...');

    const topPatentNumbers = broadResults.slice(0, 50).map((p) => p.publicationNumber);
    const cpcMap = await extractCPCCodes(topPatentNumbers);

    const cpcFrequency = new Map<string, number>();
    for (const codes of cpcMap.values()) {
      for (const code of codes) {
        const subgroup = code.split('/')[0];
        cpcFrequency.set(subgroup, (cpcFrequency.get(subgroup) ?? 0) + 1);
      }
    }

    for (const hint of keywordStrategy.cpcHints) {
      cpcFrequency.set(hint, (cpcFrequency.get(hint) ?? 0) + 5);
    }

    // Also weight novel-element-derived CPCs
    for (const element of novelElements) {
      for (const cpc of element.cpcMapping) {
        cpcFrequency.set(cpc, (cpcFrequency.get(cpc) ?? 0) + 3);
      }
    }

    const topCPCs = [...cpcFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([code]) => code);

    _accTopCPCs = topCPCs;
    await log(LogLevel.SUCCESS, `Identified ${topCPCs.length} CPC codes: ${topCPCs.slice(0, 5).join(', ')}`, {
      type: 'CPC_CODES',
      codes: topCPCs,
    });
    await checkCancellation();

    // =========================================================================
    // STEP 6 — Deep CPC Search
    // =========================================================================
    await updateProgress(6, broadResults.length);
    _accCurrentPct = 42;
    await log(LogLevel.INFO, `Step 6: Deep CPC search across ${topCPCs.length} classifications...`);

    let cpcResults: RawPatent[] = [];

    if (input.depth !== 'quick') {
      let cpcQuotaHit = bigQueryQuotaHit; // skip BigQuery CPC if BQ already failed in Step 4

      if (!cpcQuotaHit) {
        // Try BigQuery CPC search first
        try {
          const result = await searchByCPCCodes(topCPCs, input.jurisdictions, 150);
          cpcResults = result.patents;
          totalBytesProcessed += result.bytesProcessed;
          const usCount  = result.patents.filter(p => p.countryCode === 'US').length;
          const epCount  = result.patents.filter(p => p.countryCode === 'EP').length;
          const woCount  = result.patents.filter(p => p.countryCode === 'WO').length;
          await log(LogLevel.SUCCESS, `[BigQuery] CPC search: ${result.patents.length} patents (US: ${usCount}, EP: ${epCount}, WO: ${woCount})`, {
            type: 'CPC_SEARCH',
            source: 'bigquery',
            found: result.patents.length,
            breakdown: { US: usCount, EP: epCount, WO: woCount },
            cpcCodes: topCPCs.slice(0, 5),
          });
        } catch (err) {
          const msg = (err as Error).message;
          cpcQuotaHit = true;
          await log(LogLevel.WARN, `[BigQuery] CPC search failed — switching to EPO OPS. Reason: ${msg.slice(0, 120)}`);
        }
      } else {
        await log(LogLevel.INFO, `[BigQuery] Skipping CPC search — BigQuery unavailable (already failed in Step 4), using EPO OPS`);
      }

      // EPO OPS fallback for CPC search
      if (cpcQuotaHit && process.env.EPO_OPS_KEY) {
        await log(LogLevel.INFO, `[EPO OPS] CPC search using top ${Math.min(topCPCs.length, 5)} codes: ${topCPCs.slice(0, 5).join(', ')}`);
        try {
          const epoResult = await searchEPOByCPC(topCPCs, 100);
          const epCount   = epoResult.patents.filter(p => p.countryCode === 'EP').length;
          const woCount   = epoResult.patents.filter(p => p.countryCode === 'WO').length;
          const otherCount = epoResult.patents.length - epCount - woCount;
          cpcResults = epoResult.patents;
          await log(LogLevel.SUCCESS, `[EPO OPS] CPC search: ${epoResult.patents.length} patents found (EP: ${epCount}, WO: ${woCount}, other: ${otherCount}) — total in EPO DB: ${epoResult.total}`, {
            type: 'EPO_CPC_SEARCH',
            source: 'epo-ops',
            found: epoResult.patents.length,
            totalInDB: epoResult.total,
            breakdown: { EP: epCount, WO: woCount, other: otherCount },
            cpcCodes: topCPCs.slice(0, 5),
            samples: epoResult.patents.slice(0, 5).map(p => ({ title: p.title, pub: p.publicationNumber, assignee: p.assignees[0] ?? 'Unknown', year: p.filingDate?.slice(0, 4) })),
          });
        } catch (err) {
          await log(LogLevel.WARN, `[EPO OPS] CPC search failed: ${(err as Error).message}`);
        }
      } else if (cpcQuotaHit && !process.env.EPO_OPS_KEY) {
        await log(LogLevel.WARN, '[EPO OPS] Credentials not configured — skipping CPC fallback');
      }
    }

    const allPatents = deduplicatePatents([...broadResults, ...cpcResults]);
    _accPatents = allPatents;
    _accBytesProcessed = totalBytesProcessed;

    const newFromCPC = cpcResults.length;
    await log(LogLevel.INFO, `Merge complete: ${allPatents.length} unique patents total (+${newFromCPC} from CPC search)`);
    await prisma.search.update({ where: { id: searchId }, data: { patentsFound: allPatents.length } });
    await checkCancellation();

    // =========================================================================
    // STEP 7 — NPL Intelligence Search
    // =========================================================================
    await updateProgress(7, allPatents.length);
    _accCurrentPct = 52;
    await log(LogLevel.INFO, 'Step 7: Running NPL intelligence search (arXiv, Semantic Scholar, USPTO EFTS)...');

    let nplReferences: NPLReference[] = [];
    let nplStats = {
      arxivFound: 0, semanticScholarFound: 0, usptoEftsFound: 0,
      totalBeforeDedup: 0, totalAfterDedup: 0, totalAfterFilter: 0,
      sourcesSearched: [] as string[],
    };

    try {
      const nplResult = await runNPLSearch({
        keywords: keywordStrategy,
        maxPerSource: input.depth === 'thorough' ? 25 : 15,
        minScore: 15,
        yearFrom: 2005,
      });
      nplReferences = nplResult.references;
      nplStats      = nplResult.stats;
      _accNPL       = nplReferences;

      await log(LogLevel.SUCCESS, `NPL search: ${nplReferences.length} references found (arXiv: ${nplStats.arxivFound}, SS: ${nplStats.semanticScholarFound}, EFTS: ${nplStats.usptoEftsFound})`, {
        type: 'NPL_RESULTS',
        sources: { arxiv: nplStats.arxivFound, semanticScholar: nplStats.semanticScholarFound, efts: nplStats.usptoEftsFound },
        total: nplReferences.length,
        topTitles: nplReferences.slice(0, 6).map((n) => ({ title: n.title, source: n.source, score: n.relevanceScore })),
      });
      await prisma.search.update({ where: { id: searchId }, data: { nplFound: nplReferences.length } as any });
    } catch (err) {
      await log(LogLevel.WARN, `NPL search failed: ${(err as Error).message}`);
    }

    await checkCancellation();

    // =========================================================================
    // STEP 8 — Full Claims Retrieval via PatentsView
    // =========================================================================
    await updateProgress(8, allPatents.length, nplReferences.length);
    _accCurrentPct = 58;
    await log(LogLevel.INFO, 'Step 8: Retrieving full claim text (PatentsView + EPO OPS)...');

    const top30 = allPatents.slice(0, 30);

    // 8a — US patents via PatentsView
    const usPatentNums = top30.map((p) => p.publicationNumber).filter((n) => n.startsWith('US'));
    try {
      const claimsMap: Map<string, StructuredClaim[]> = await enrichPatentsWithClaims(usPatentNums);
      let enriched = 0;
      for (const patent of allPatents) {
        const claims = claimsMap.get(patent.publicationNumber);
        if (claims && claims.length > 0) {
          patent.fullClaims = claims;
          patent.claims = claims.slice(0, 3).map((c) => c.text).join('\n\n');
          enriched++;
        }
      }
      await log(LogLevel.SUCCESS, `PatentsView: claims retrieved for ${enriched}/${usPatentNums.length} US patents`);
    } catch (err) {
      await log(LogLevel.WARN, `PatentsView claims retrieval failed: ${(err as Error).message}`);
    }

    // 8b — EP/WO patents via EPO OPS (if credentials configured)
    if (process.env.EPO_OPS_KEY) {
      const epWoNums = top30
        .filter((p) => !p.claims)  // skip already-enriched
        .map((p) => p.publicationNumber)
        .filter((n) => n.startsWith('EP') || n.startsWith('WO'))
        .slice(0, 10);  // cap at 10 — 300ms each = 3s max

      if (epWoNums.length > 0) {
        try {
          const epoMap = await fetchEPOClaimsBatch(epWoNums);
          let epoEnriched = 0;
          for (const patent of allPatents) {
            const claims = epoMap.get(patent.publicationNumber);
            if (claims) {
              patent.claims = claims;
              epoEnriched++;
            }
          }
          await log(LogLevel.SUCCESS, `EPO OPS: claims retrieved for ${epoEnriched}/${epWoNums.length} EP/WO patents`);
        } catch (err) {
          await log(LogLevel.WARN, `EPO OPS claims retrieval failed: ${(err as Error).message}`);
        }
      }
    }

    await checkCancellation();

    // =========================================================================
    // STEP 9 — Timeline & Assignee Analysis
    // =========================================================================
    await updateProgress(9, allPatents.length, nplReferences.length);
    _accCurrentPct = 63;
    await log(LogLevel.INFO, 'Step 9: Analyzing technology timeline and competitor landscape...');

    const [timelineData, assigneeData] = await Promise.allSettled([
      getTimelineAnalysis(keywordStrategy.primaryKeywords.slice(0, 3), topCPCs.slice(0, 5), input.jurisdictions),
      getAssigneeAnalysis(keywordStrategy.primaryKeywords.slice(0, 3), topCPCs.slice(0, 5), input.jurisdictions),
    ]);

    const timeline  = timelineData.status === 'fulfilled' ? timelineData.value : [];
    const assignees = assigneeData.status === 'fulfilled' ? assigneeData.value : [];

    await log(LogLevel.SUCCESS, `Timeline: ${timeline.length} years analyzed | Assignees: ${assignees.length} identified`);
    await checkCancellation();

    // =========================================================================
    // STEP 10 — AI Relevance Scoring
    // =========================================================================
    await updateProgress(10, allPatents.length, nplReferences.length);
    _accCurrentPct = 70;
    await log(LogLevel.INFO, `Step 10: AI relevance scoring via ${aiProvider.name}...`);
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.AI_SCORING as any } });

    const calculateInitialScore = (patent: RawPatent): number => {
      let score = 25;
      const text = `${patent.title} ${patent.abstract}`.toLowerCase();

      keywordStrategy.primaryKeywords.forEach((kw) => {
        if (text.includes(kw.toLowerCase())) score += 15;
      });
      keywordStrategy.synonyms.slice(0, 10).forEach((kw) => {
        if (text.includes(kw.toLowerCase())) score += 5;
      });

      const matchedCPCs = patent.cpcCodes.filter((c) =>
        keywordStrategy.cpcHints.some((hint) => c.startsWith(hint.trim()))
      );
      score += Math.min(matchedCPCs.length * 8, 30);

      if (patent.citationCount && patent.citationCount > 0) {
        score += Math.min(Math.floor(patent.citationCount / 5), 10);
      }

      return Math.min(score, 98);
    };

    const candidatePatents: ScoredPatent[] = allPatents
      .map((p) => ({
        ...p,
        relevanceScore: calculateInitialScore(p),
        similarityScore: calculateInitialScore(p),
        noveltyImpact: 'moderate' as const,
        similarities: [],
        differences: [],
        analysis: '',
        rank: 1,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 30)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    let aiOutput = await (async () => {
      try {
        return await aiProvider.generateFullReport({
          inventionTitle: input.title,
          inventionDescription: input.description,
          technicalField: input.technicalField,
          keyInnovations: input.keyInnovations,
          candidatePatents,
          nplReferences: nplReferences.slice(0, 15),
          novelElements,
          reportStyle: input.reportStyle,
          searchType: input.searchType,
        });
      } catch (err) {
        await log(LogLevel.WARN, `AI full report generation failed, using pre-scored candidates: ${(err as Error).message}`);
        // Fallback: use pre-scored candidates without deep AI analysis
        return {
          executiveSummary: `Prior art search completed. ${candidatePatents.length} candidate patents identified and scored by keyword relevance. Manual review recommended.`,
          scoredPatents: candidatePatents,
          patentabilityAssessment: {
            patentabilityScore: 65,
            noveltyRating: 'MEDIUM' as const,
            noveltyAnalysis: 'Full AI analysis unavailable — manual review required.',
            obviousnessRating: 'MEDIUM' as const,
            obviousnessAnalysis: 'Full AI analysis unavailable — manual review required.',
            overallVerdict: 'PROCEED_WITH_CAUTION' as const,
            keyRisks: ['Full AI analysis unavailable — manual review required'],
            keyOpportunities: input.keyInnovations.slice(0, 3),
            whiteSpaceAreas: [],
            recommendedClaimScope: 'moderate' as const,
            featureCoverageObservations: [],
          },
          claimStrategy: {
            independentClaimSuggestion: `A system for ${input.title}`,
            dependentClaimSuggestions: [],
            claimingApproach: 'Manual claim drafting recommended based on prior art identified.',
            elementsToEmphasize: input.keyInnovations.slice(0, 3),
            elementsToAvoid: [],
            prosecutionStrategy: 'Manual claim drafting recommended based on prior art identified.',
          },
          tokensUsed: 0,
          costUsd: 0,
          model: aiProvider.model,
          provider: 'claude' as const,
        };
      }
    })();

    // Relevance breakdown by novelty impact
    const impactCounts = { blocking: 0, strong: 0, moderate: 0, weak: 0, minimal: 0 };
    for (const p of aiOutput.scoredPatents) {
      impactCounts[p.noveltyImpact] = (impactCounts[p.noveltyImpact] ?? 0) + 1;
    }
    const highRisk    = impactCounts.blocking + impactCounts.strong;
    const moderate    = impactCounts.moderate;
    const lowRisk     = impactCounts.weak + impactCounts.minimal;
    const totalScored = aiOutput.scoredPatents.length;
    const totalInput  = allPatents.length;
    const filtered    = totalInput - totalScored;

    await log(LogLevel.SUCCESS,
      `AI scoring complete [${aiOutput.model}] — ${totalInput} analyzed → ${totalScored} scored, ${filtered} filtered out | Verdict: ${aiOutput.patentabilityAssessment.overallVerdict} (score: ${aiOutput.patentabilityAssessment.patentabilityScore})`,
      {
        type: 'TOP_PATENTS',
        verdict: aiOutput.patentabilityAssessment.overallVerdict,
        score: aiOutput.patentabilityAssessment.patentabilityScore,
        tokensUsed: aiOutput.tokensUsed,
        costUsd: aiOutput.costUsd,
        totalAnalyzed: totalInput,
        totalScored,
        filteredOut: filtered,
        impactBreakdown: {
          blocking: impactCounts.blocking,
          strong:   impactCounts.strong,
          moderate: impactCounts.moderate,
          weak:     impactCounts.weak,
          minimal:  impactCounts.minimal,
          highRisk,
          lowRisk,
        },
        patents: aiOutput.scoredPatents.slice(0, 6).map((p) => ({
          pub:        p.publicationNumber,
          title:      p.title,
          similarity: p.similarityScore,
          impact:     p.noveltyImpact,
          assignee:   p.assignees[0] ?? 'Unknown',
          year:       p.filingDate?.slice(0, 4),
        })),
      }
    );
    await log(LogLevel.INFO,
      `Relevance breakdown: ${highRisk} high-risk (blocking/strong), ${moderate} moderate, ${lowRisk} low-risk (weak/minimal) out of ${totalScored} patents scored`
    );
    await prisma.search.update({ where: { id: searchId }, data: { patentsAnalyzed: totalScored } });

    // Analyze top NPL references sequentially — parallel calls hit 5 RPM limit
    let analyzedNPL = nplReferences;
    const topNPL = nplReferences.slice(0, 6); // max 6 to stay within time budget

    if (topNPL.length > 0) {
      const nplScored: NPLReference[] = [];
      for (let i = 0; i < topNPL.length; i++) {
        const n = topNPL[i];
        try {
          const analysis = await aiProvider.analyzeNPLReference(
            `${input.title}: ${input.description}`,
            n.title,
            n.abstract,
            n.source
          );
          nplScored.push({
            ...n,
            similarityScore: analysis.similarityScore,
            noveltyImpact: analysis.noveltyImpact,
            similarities: analysis.similarities,
            differences: analysis.differences,
            analysis: analysis.analysis,
          } as NPLReference);
        } catch (err) {
          console.warn(`[NPL] Skipping ${n.title.slice(0, 60)}: ${(err as Error).message.slice(0, 80)}`);
          nplScored.push(n);
        }
        if (i < topNPL.length - 1) {
          await new Promise((r) => setTimeout(r, AI_RATE_DELAY_MS));
        }
      }

      analyzedNPL = [...nplScored, ...nplReferences.slice(6)];
      await log(LogLevel.SUCCESS, `NPL analysis complete: ${nplScored.length} references scored`);
    }

    await checkCancellation();

    // =========================================================================
    // STEP 11 — Feature Coverage Matrix
    // =========================================================================
    await updateProgress(11, allPatents.length, analyzedNPL.length);
    await log(LogLevel.INFO, `Step 11: Building feature coverage matrix (${novelElements.length} elements × references)...`);
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.COVERAGE_ANALYSIS as any } });

    let coverageMatrix: CoverageMatrix = {
      elements: novelElements,
      references: [],
      cells: {},
      generatedAt: new Date().toISOString(),
    };

    if (novelElements.length > 0) {
      // Build reference list: top 8 patents + top 4 NPL
      const matrixRefs = [
        ...aiOutput.scoredPatents.slice(0, 8).map((p) => ({
          id: p.publicationNumber,
          number: p.publicationNumber,
          title: p.title,
          type: 'patent' as const,
          assignee: p.assignees[0],
          date: p.filingDate,
        })),
        ...analyzedNPL.slice(0, 4).map((n) => ({
          id: n.id,
          number: n.id,
          title: n.title,
          type: 'npl' as const,
          date: n.publicationDate,
        })),
      ];

      coverageMatrix.references = matrixRefs;

      // Build references data for the batch call
      const batchRefs = matrixRefs.map((ref) => {
        const patent = aiOutput.scoredPatents.find((p) => p.publicationNumber === ref.number);
        const npl    = analyzedNPL.find((n) => n.id === ref.id);
        return {
          id: ref.id,
          number: ref.number,
          title: ref.title,
          abstract: (patent?.abstract ?? npl?.abstract ?? '').slice(0, 500),
          claims: patent?.claims?.slice(0, 500),
          type: ref.type,
        };
      });

      if (aiProvider.analyzeCoverageMatrix) {
        // One-shot batch: ALL references in a single Sonnet call.
        // Replaces 6 serial calls + ~130s of delays → 1 call + 0s delays.
        try {
          const cells = await aiProvider.analyzeCoverageMatrix(
            `${input.title}: ${input.description}`,
            novelElements,
            batchRefs
          );
          coverageMatrix.cells = cells;
          const totalCells = Object.values(cells).flatMap((r) => Object.values(r)).length;
          await log(LogLevel.SUCCESS, `Coverage matrix (batch): ${totalCells} cells in 1 API call`);
        } catch (err) {
          await log(LogLevel.WARN, `Batch coverage failed, skipping matrix: ${(err as Error).message}`);
        }
      } else {
        // Fallback: per-reference serial calls for non-Claude providers
        for (let i = 0; i < batchRefs.length; i++) {
          const ref = batchRefs[i];
          try {
            const coverage = await aiProvider.analyzeCoverageForReference({
              inventionDescription: `${input.title}: ${input.description}`,
              novelElements,
              reference: ref,
            });
            for (const [elementId, cell] of Object.entries(coverage.cells)) {
              if (!coverageMatrix.cells[elementId]) coverageMatrix.cells[elementId] = {};
              coverageMatrix.cells[elementId][ref.id] = cell;
            }
          } catch { /* skip failed reference */ }
          await checkCancellation();
          if (i < batchRefs.length - 1) {
            await new Promise((r) => setTimeout(r, AI_RATE_DELAY_MS * 2));
          }
        }
        const totalCells = Object.values(coverageMatrix.cells).flatMap((r) => Object.values(r)).length;
        await log(LogLevel.SUCCESS, `Coverage matrix: ${totalCells} cells (${novelElements.length} × ${matrixRefs.length})`);
      }
    } else {
      await log(LogLevel.INFO, 'Skipping coverage matrix — no novel elements decomposed');
    }

    await checkCancellation();

    // =========================================================================
    // STEP 12 — IDS Generation (template-based — zero AI cost)
    // AI call removed: scoring is metadata reformatting, not AI reasoning.
    // =========================================================================
    await updateProgress(12, allPatents.length, analyzedNPL.length);
    await log(LogLevel.INFO, 'Step 12: Building IDS table from scored prior art...');
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.IDS_GENERATION as any } });

    const noveltyToRisk: Record<string, number> = {
      blocking: 90, strong: 70, moderate: 45, weak: 20, minimal: 10,
    };

    const idsEntries: IDSEntry[] = [
      ...aiOutput.scoredPatents.slice(0, 20).map((p) => ({
        id: p.publicationNumber,
        type: 'patent' as const,
        patentNumber: p.publicationNumber,
        title: p.title,
        assignee: p.assignees[0],
        publicationDate: p.grantDate ?? p.filingDate,
        country: p.countryCode,
        url: p.url,
        source: 'BigQuery/PatentsView',
        relevanceScore: p.similarityScore,
        risk102: noveltyToRisk[p.noveltyImpact] ?? 30,
        risk103: p.similarityScore,
        examinerCitationProbability: Math.round(p.similarityScore * 0.9),
        disclosureReason: `Discloses ${p.similarities[0] ?? 'related features'} relevant to the claimed invention`,
      })),
      ...analyzedNPL.slice(0, 10).map((n) => ({
        id: n.id,
        type: 'npl' as const,
        title: n.title,
        authors: n.authors,
        publicationDate: n.publicationDate,
        url: n.url,
        doi: n.doi,
        source: n.source,
        relevanceScore: n.relevanceScore ?? 50,
        risk102: n.noveltyImpact === 'blocking' ? 85 : n.noveltyImpact === 'strong' ? 65 : 25,
        risk103: n.relevanceScore ?? 50,
        examinerCitationProbability: Math.round((n.relevanceScore ?? 50) * 0.8),
        disclosureReason: n.similarities?.[0]
          ? `Discloses "${n.similarities[0]}" potentially relevant under 35 USC 102/103`
          : 'Non-patent literature relevant to the technical field of the claimed invention',
      })),
    ];

    await log(LogLevel.SUCCESS, `IDS built: ${idsEntries.length} references (${idsEntries.filter((e) => e.type === 'patent').length} patents, ${idsEntries.filter((e) => e.type === 'npl').length} NPL) — no API cost`);

    await checkCancellation();

    // =========================================================================
    // STEP 13 — Examiner Simulation
    // =========================================================================
    await updateProgress(13, allPatents.length, analyzedNPL.length);
    await log(LogLevel.INFO, 'Step 13: Simulating USPTO examiner behavior...');
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.EXAMINER_SIMULATION as any } });

    let examinerPrediction: ExaminerPrediction = {
      likelyRejectionBasis: ['103'],
      predictedCitedReferences: aiOutput.scoredPatents.slice(0, 3).map((p) => p.publicationNumber),
      cpcClassesLikelySearched: topCPCs.slice(0, 5),
      closestArtCluster: 'See top prior art references',
      likelyObjectionPathways: [],
      enablementRisks: [],
      section112Risks: [],
      firstOfficeActionScenario: {
        predictedReferences: aiOutput.scoredPatents.slice(0, 2).map((p) => p.publicationNumber),
        rejectionBasis: 'Claims 1-N rejected under 35 USC 103',
        mappedClaims: [1, 2, 3],
        responseStrategy: 'Emphasize novel combination not taught or suggested by cited references',
        estimatedAllowanceChance: aiOutput.patentabilityAssessment.patentabilityScore,
      },
      examinersLikelySearch: `The examiner will likely search ${topCPCs.slice(0, 3).join(', ')} using keywords ${keywordStrategy.primaryKeywords.slice(0, 4).join(', ')}`,
    };

    if (novelElements.length > 0 && input.depth !== 'quick') {
      try {
        examinerPrediction = await aiProvider.simulateExaminer({
          inventionTitle: input.title,
          inventionDescription: input.description,
          technicalField: input.technicalField,
          novelElements,
          topPatents: aiOutput.scoredPatents.slice(0, 8),
          cpcCodes: topCPCs,
        });
        await log(LogLevel.SUCCESS, `Examiner simulation complete | Allowance chance: ${examinerPrediction.firstOfficeActionScenario.estimatedAllowanceChance}%`);
      } catch (err) {
        await log(LogLevel.WARN, `Examiner simulation failed, using defaults: ${(err as Error).message}`);
      }
    }

    // Gap-grounded claim drafting
    let gapClaimDraft: GapGroundedClaimDraft = {
      independentClaims: [],
      dependentClaims: [],
      narrowAroundGuidance: [],
      dependentClaimOpportunities: [],
      prosecutionNotes: aiOutput.claimStrategy.prosecutionStrategy,
    };

    if (novelElements.length > 0) {
      try {
        gapClaimDraft = await aiProvider.generateGapGroundedClaims({
          inventionTitle: input.title,
          inventionDescription: input.description,
          technicalField: input.technicalField,
          novelElements,
          coverageMatrix,
          topPatents: aiOutput.scoredPatents.slice(0, 10),
          nplReferences: analyzedNPL.slice(0, 5),
        });
        await log(LogLevel.SUCCESS, `Gap-grounded claims: ${gapClaimDraft.independentClaims.length} independent, ${gapClaimDraft.dependentClaims.length} dependent`);
      } catch (err) {
        await log(LogLevel.WARN, `Gap-grounded claim drafting failed: ${(err as Error).message}`);
      }
    }

    await checkCancellation();

    // =========================================================================
    // STEP 14 — Generate Dual Reports
    // =========================================================================
    await updateProgress(14, allPatents.length, analyzedNPL.length);
    await log(LogLevel.INFO, 'Step 14: Generating dual reports (internal + client)...');
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.GENERATING_REPORT as any } });

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    const reportData: PatentReport = {
      id: `report_${searchId}`,
      searchId,
      generatedAt: new Date().toISOString(),
      inventionTitle: input.title,
      inventionDescription: input.description,
      reportStyle: input.reportStyle,
      searchType: input.searchType ?? 'patentability',

      executiveSummary: aiOutput.executiveSummary,
      patentabilityAssessment: aiOutput.patentabilityAssessment,
      claimStrategy: aiOutput.claimStrategy,

      // v2 intelligence layers
      novelElements,
      nplReferences: analyzedNPL,
      coverageMatrix,
      idsEntries,
      examinerPrediction,
      gapClaimDraft,

      conceptExtraction: concepts,
      keywordStrategy,

      topPriorArt: aiOutput.scoredPatents.slice(0, 10),
      allRelevantPatents: aiOutput.scoredPatents,
      cpcCodesAnalyzed: topCPCs.map((code) => ({
        code,
        description: code,
        level: 'subgroup' as const,
      })),
      timelineAnalysis: timeline,
      assigneeAnalysis: assignees,

      statistics: {
        totalPatentsReviewed: allPatents.length,
        relevantPatentsFound: aiOutput.scoredPatents.length,
        topPriorArtSelected: 10,
        keywordsSearched: allKeywords,
        cpcCodesSearched: topCPCs,
        jurisdictionsCovered: input.jurisdictions,
        bigQueryBytesProcessed: Number(totalBytesProcessed),
        searchDurationSeconds: durationSeconds,
        aiProvider: input.aiProvider,
        aiTokensUsed: aiOutput.tokensUsed,
        aiCostUsd: aiOutput.costUsd,
        nplSourcesSearched: nplStats.sourcesSearched,
        nplReferencesFound: nplStats.totalAfterFilter,
        nplReferencesAnalyzed: Math.min(analyzedNPL.length, 10),
        novelElementsDecomposed: novelElements.length,
        coverageMatrixSize: `${novelElements.length} elements × ${coverageMatrix.references.length} references`,
        idsEntriesGenerated: idsEntries.length,
      },

      idsReferences: aiOutput.scoredPatents.slice(0, 20).map((p) => p.publicationNumber),

      markdownContent: '',
      clientReportContent: '',
    };

    // Generate internal technical report
    reportData.markdownContent = generateMarkdownReport(reportData);
    reportData.htmlContent     = generateHTMLReport(reportData);

    // Generate client-facing supplementary report
    reportData.clientReportContent = generateClientReport(reportData);

    // Generate IDS documents
    const idsMarkdown = generateIDSMarkdown(reportData);
    const idsCSV      = generateIDSCSV(idsEntries);

    // Upload all documents to storage in parallel
    const uploads = await Promise.allSettled([
      uploadReport(searchId, 'internal-report.md', Buffer.from(reportData.markdownContent), 'text/markdown'),
      uploadReport(searchId, 'internal-report.html', Buffer.from(reportData.htmlContent ?? ''), 'text/html'),
      uploadReport(searchId, 'client-report.md', Buffer.from(reportData.clientReportContent), 'text/markdown'),
      uploadReport(searchId, 'ids.md', Buffer.from(idsMarkdown), 'text/markdown'),
      uploadReport(searchId, 'ids.csv', Buffer.from(idsCSV), 'text/csv'),
    ]);

    let pdfStorageUrl: string | undefined;
    let clientPdfStorageUrl: string | undefined;

    try {
      const pdfBuffer = await generatePDFReport(reportData);
      pdfStorageUrl = await uploadReport(searchId, 'internal-report.pdf', pdfBuffer, 'application/pdf');
      await log(LogLevel.SUCCESS, `Internal PDF generated (${Math.round(pdfBuffer.length / 1024)}KB)`);
    } catch (err) {
      await log(LogLevel.WARN, `Internal PDF generation failed: ${(err as Error).message}`);
    }

    const mdUrl         = uploads[0];
    const clientReportStorageUrl = uploads[2].status === 'fulfilled' ? uploads[2].value : undefined;

    // Persist full report to database
    const savedReport = await prisma.report.create({
      data: {
        searchId,
        userId,
        inventionTitle: input.title,
        reportStyle: input.reportStyle.toUpperCase() as ReportStyle,
        // searchType added in v2 migration — cast until prisma is regenerated
        ...({ searchType: (input.searchType ?? 'patentability').toUpperCase().replace('-', '_') } as any),

        patentabilityScore: aiOutput.patentabilityAssessment.patentabilityScore,
        noveltyRating: aiOutput.patentabilityAssessment.noveltyRating,
        obviousnessRating: aiOutput.patentabilityAssessment.obviousnessRating,
        overallVerdict: aiOutput.patentabilityAssessment.overallVerdict,
        executiveSummary: aiOutput.executiveSummary,
        patentabilityData: aiOutput.patentabilityAssessment as any,
        claimStrategyData: aiOutput.claimStrategy as any,

        // v2 intelligence layers
        novelElementsData: novelElements as any,
        coverageMatrixData: coverageMatrix as any,
        idsEntriesData: idsEntries as any,
        examinerSimulationData: examinerPrediction as any,
        gapClaimDraftData: gapClaimDraft as any,
        nplReferencesData: analyzedNPL as any,
        nplStatisticsData: nplStats as any,

        conceptData: concepts as any,
        keywordData: keywordStrategy as any,
        topPriorArtData: aiOutput.scoredPatents.slice(0, 10) as any,
        timelineData: timeline as any,
        assigneeData: assignees as any,
        statisticsData: reportData.statistics as any,
        idsReferences: reportData.idsReferences,

        markdownContent: reportData.markdownContent,
        htmlContent: reportData.htmlContent,
        clientReportContent: reportData.clientReportContent,

        pdfStorageUrl,
        clientPdfStorageUrl,
        markdownStorageUrl: mdUrl.status === 'fulfilled' ? mdUrl.value : undefined,
        clientReportStorageUrl,
        disclaimerVersion: 'v2',

        aiProvider: input.aiProvider.toUpperCase() as any,
        aiModel: aiOutput.model,
        aiTokensUsed: aiOutput.tokensUsed,
        aiCostUsd: aiOutput.costUsd,
        bqBytesProcessed: totalBytesProcessed,
      },
    });

    // Mark search as completed
    await prisma.search.update({
      where: { id: searchId },
      data: {
        status: SearchStatus.COMPLETED,
        progressPercent: 100,
        completedAt: new Date(),
        durationSeconds,
      },
    });

    await log(LogLevel.SUCCESS,
      `Search completed in ${Math.round(durationSeconds / 60)}m ${durationSeconds % 60}s | ` +
      `${allPatents.length} patents | ${analyzedNPL.length} NPL | ` +
      `${novelElements.length} elements | ${idsEntries.length} IDS entries`
    );

    return {
      searchId,
      reportId: savedReport.id,
      status: 'completed',
      durationSeconds,
    };

  } catch (err) {
    const error = err as Error;
    const isCancelled = error.message === 'SEARCH_CANCELLED';
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    console.error(`[Pipeline:${searchId}] ${isCancelled ? 'CANCELLED' : 'FAILED'}: ${error.message}`);

    // ------------------------------------------------------------------
    // Partial report — generate when user cancels with data already found
    // ------------------------------------------------------------------
    if (isCancelled && (_accPatents.length > 0 || _accNPL.length > 0)) {
      try {
        const patentList = _accPatents
          .slice(0, 30)
          .map((p, i) =>
            `${i + 1}. **${p.publicationNumber}** — ${p.title} (${p.filingDate?.slice(0, 4) ?? 'N/A'})\n   Assignee: ${p.assignees[0] ?? 'Unknown'} | Country: ${p.countryCode}`
          )
          .join('\n');

        const nplList = _accNPL
          .slice(0, 10)
          .map((n, i) => `${i + 1}. **${n.title}** (${n.source}, ${n.publicationDate ?? 'N/A'})`)
          .join('\n');

        const partialMarkdown = [
          `# PARTIAL PRIOR ART SEARCH REPORT`,
          ``,
          `> **Note:** This search was cancelled at ~${_accCurrentPct}% completion. The report below reflects data collected up to the point of cancellation.`,
          ``,
          `## Invention`,
          `**Title:** ${input.title}`,
          `**Technical Field:** ${input.technicalField}`,
          ``,
          `## Search Statistics (Partial)`,
          `- Patents found: ${_accPatents.length}`,
          `- NPL references found: ${_accNPL.length}`,
          `- CPC codes identified: ${_accTopCPCs.slice(0, 8).join(', ') || 'None yet'}`,
          `- Keywords searched: ${_accKeywords.slice(0, 10).join(', ') || 'None yet'}`,
          `- BigQuery data processed: ${(_accBytesProcessed / 1_000_000n).toString()} MB`,
          `- Duration before cancel: ${Math.round(durationSeconds / 60)}m ${durationSeconds % 60}s`,
          ``,
          ...(patentList ? [`## Patents Found (Top 30 of ${_accPatents.length})`, ``, patentList, ``] : []),
          ...(nplList ? [`## Non-Patent Literature Found (Top 10 of ${_accNPL.length})`, ``, nplList, ``] : []),
          ...((_accNovelElements.length > 0) ? [
            `## Novel Elements Identified (${_accNovelElements.length})`,
            ``,
            ..._accNovelElements.map((e, i) => `${i + 1}. **${e.label ?? e.id}** — ${e.component}: ${e.function}`),
            ``,
          ] : []),
          `## Recommendation`,
          `A full AI analysis, coverage matrix, IDS, and examiner simulation were not completed because the search was cancelled.`,
          `Please restart the search to obtain the complete report.`,
        ].join('\n');

        const savedPartialReport = await prisma.report.create({
          data: {
            searchId,
            userId,
            inventionTitle: input.title,
            reportStyle: input.reportStyle.toUpperCase() as ReportStyle,
            ...({ searchType: (input.searchType ?? 'patentability').toUpperCase().replace('-', '_') } as any),
            executiveSummary: `Partial report — search cancelled at ${_accCurrentPct}% with ${_accPatents.length} patents and ${_accNPL.length} NPL references collected.`,
            patentabilityScore: null,
            markdownContent: partialMarkdown,
            topPriorArtData: _accPatents.slice(0, 10) as any,
            keywordData: { primaryKeywords: _accKeywords } as any,
            novelElementsData: _accNovelElements as any,
            nplReferencesData: _accNPL as any,
            statisticsData: {
              totalPatentsReviewed: _accPatents.length,
              nplReferencesFound: _accNPL.length,
              keywordsSearched: _accKeywords,
              cpcCodesSearched: _accTopCPCs,
              bigQueryBytesProcessed: Number(_accBytesProcessed),
              searchDurationSeconds: durationSeconds,
              aiProvider: input.aiProvider,
              partial: true,
              cancelledAtPercent: _accCurrentPct,
            } as any,
            idsReferences: [],
            aiProvider: input.aiProvider.toUpperCase() as any,
            aiModel: _accAiModel,
            aiTokensUsed: 0,
            aiCostUsd: 0,
            bqBytesProcessed: _accBytesProcessed,
            disclaimerVersion: 'v2-partial',
          },
        });

        console.log(`[Pipeline:${searchId}] Partial report saved: ${savedPartialReport.id}`);

        await Promise.allSettled([
          prisma.search.update({
            where: { id: searchId },
            data: {
              status: SearchStatus.CANCELLED as any,
              completedAt: new Date(),
              durationSeconds,
            } as any,
          }),
          prisma.progressLog.create({
            data: {
              searchId,
              level: LogLevel.WARN,
              message: `Search cancelled — partial report saved with ${_accPatents.length} patents and ${_accNPL.length} NPL references`,
            },
          }),
        ]);

        throw error; // re-throw SEARCH_CANCELLED so BullMQ marks job failed
      } catch (partialErr) {
        // If the inner block re-threw SEARCH_CANCELLED, propagate it directly (skip duplicate DB update)
        if ((partialErr as Error).message === 'SEARCH_CANCELLED') throw partialErr;
        // Otherwise partial report save itself failed — log and fall through to normal handling
        console.error(`[Pipeline:${searchId}] Partial report save failed:`, (partialErr as Error).message);
      }
    }

    // Normal FAILED / CANCELLED (no data) path
    try {
      await prisma.search.update({
        where: { id: searchId },
        data: {
          status: (isCancelled ? SearchStatus.CANCELLED : SearchStatus.FAILED) as any,
          errorMessage: isCancelled ? undefined : error.message.slice(0, 500),
          completedAt: new Date(),
          durationSeconds,
        } as any,
      });
    } catch (updateErr) {
      console.error(`[Pipeline:${searchId}] DB status update failed:`, (updateErr as Error).message);
    }

    try {
      await prisma.progressLog.create({
        data: {
          searchId,
          level: isCancelled ? LogLevel.WARN : LogLevel.ERROR,
          message: isCancelled ? 'Search cancelled by user (no data collected)' : `Search failed: ${error.message.slice(0, 500)}`,
        },
      });
    } catch { /* ignore log failure */ }

    throw error;
  }
}
