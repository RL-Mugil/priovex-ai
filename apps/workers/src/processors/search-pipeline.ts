import type { Job } from 'bullmq';
import type { SearchJobData, SearchJobResult, RawPatent, ScoredPatent, ConceptExtraction, KeywordStrategy } from '@priovex/types';
import { prisma } from '@priovex/database';
import { SearchStatus, LogLevel } from '@priovex/database';
import { createProviderWithFallback } from '@priovex/ai-providers';
import {
  searchByKeywords,
  searchByCPCCodes,
  extractCPCCodes,
  getTimelineAnalysis,
  getAssigneeAnalysis,
  deduplicatePatents,
} from '@priovex/bigquery';
import {
  generateMarkdownReport,
  generateHTMLReport,
  generatePDFReport,
} from '@priovex/report-generator';
import { uploadReport } from '../storage';

const STEP_DEFINITIONS = [
  { step: 1, name: 'Extracting Invention Concepts', status: SearchStatus.EXTRACTING },
  { step: 2, name: 'Building Keyword Strategy', status: SearchStatus.KEYWORD_STRATEGY },
  { step: 3, name: 'Broad Patent Search', status: SearchStatus.BROAD_SEARCH },
  { step: 4, name: 'CPC Code Identification', status: SearchStatus.CPC_IDENTIFICATION },
  { step: 5, name: 'Deep CPC Search', status: SearchStatus.DEEP_CPC_SEARCH },
  { step: 6, name: 'Timeline Analysis', status: SearchStatus.TIMELINE_ANALYSIS },
  { step: 7, name: 'AI Patentability Analysis', status: SearchStatus.AI_ANALYSIS },
];

export async function runSearchPipeline(
  job: Job<SearchJobData, SearchJobResult>
): Promise<SearchJobResult> {
  const { searchId, userId, input } = job.data;
  const startTime = Date.now();

  async function updateProgress(step: number, percent: number, patentsFound = 0) {
    const stepDef = STEP_DEFINITIONS[step - 1];
    if (!stepDef) return;

    await job.updateProgress(percent);

    await prisma.search.update({
      where: { id: searchId },
      data: {
        status: stepDef.status,
        currentStep: step,
        progressPercent: percent,
        patentsFound,
        startedAt: step === 1 ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async function log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    await prisma.progressLog.create({
      data: {
        searchId,
        level,
        message,
        metadata: metadata ?? undefined,
      },
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

  try {
    await log(LogLevel.INFO, 'Search pipeline started');

    // ─── STEP 1: Concept Extraction ─────────────────────────────────────────
    await updateProgress(1, 5);
    await log(LogLevel.INFO, 'Step 1: Extracting invention concepts via AI...');

    const aiProvider = await createProviderWithFallback(input.aiProvider);
    await log(LogLevel.INFO, `Using AI provider: ${aiProvider.name} (${aiProvider.model})`);

    const concepts: ConceptExtraction = await aiProvider.extractConcepts(
      input.title,
      input.description,
      input.technicalField,
      input.keyInnovations
    );

    await log(LogLevel.SUCCESS, `Extracted ${concepts.keyFeatures.length} key features, ${concepts.technicalEntities.length} technical entities`);
    await checkCancellation();

    // ─── STEP 2: Keyword Strategy ─────────────────────────────────────────
    await updateProgress(2, 15);
    await log(LogLevel.INFO, 'Step 2: Building keyword search strategy...');

    const keywordStrategy: KeywordStrategy = await aiProvider.buildKeywordStrategy(
      concepts,
      input.technicalField
    );

    await log(LogLevel.SUCCESS, `Built ${keywordStrategy.searchQueries.length} search queries, ${keywordStrategy.cpcHints.length} CPC hints`);
    await checkCancellation();

    // ─── STEP 3: Broad Keyword Search ────────────────────────────────────
    await updateProgress(3, 25);
    await log(LogLevel.INFO, 'Step 3: Running broad BigQuery patent search...');

    const allKeywords = [
      ...keywordStrategy.primaryKeywords,
      ...keywordStrategy.synonyms.slice(0, 5),
    ];

    let broadResults: RawPatent[] = [];
    let totalBytesProcessed = 0n;

    // Run keyword searches in batches
    const batchSize = 3;
    for (let i = 0; i < Math.min(allKeywords.length, 9); i += batchSize) {
      const batch = allKeywords.slice(i, i + batchSize);
      try {
        const result = await searchByKeywords(batch, input.jurisdictions, 100);
        broadResults.push(...result.patents);
        totalBytesProcessed += result.bytesProcessed;
        await log(LogLevel.INFO, `Keyword batch ${Math.floor(i / batchSize) + 1}: found ${result.patents.length} patents`);
      } catch (err) {
        await log(LogLevel.WARN, `Keyword batch failed: ${(err as Error).message}`);
      }
      await checkCancellation();
    }

    broadResults = deduplicatePatents(broadResults);
    await log(LogLevel.SUCCESS, `Broad search found ${broadResults.length} unique patents`);
    await prisma.search.update({ where: { id: searchId }, data: { patentsFound: broadResults.length } });

    // ─── STEP 4: CPC Identification ──────────────────────────────────────
    await updateProgress(4, 40);
    await log(LogLevel.INFO, 'Step 4: Extracting CPC codes from found patents...');

    const topPatentNumbers = broadResults.slice(0, 50).map((p) => p.publicationNumber);
    const cpcMap = await extractCPCCodes(topPatentNumbers);

    // Aggregate CPC codes by frequency
    const cpcFrequency = new Map<string, number>();
    for (const codes of cpcMap.values()) {
      for (const code of codes) {
        // Use subgroup level (e.g., G06F21/31 → G06F21)
        const subgroup = code.split('/')[0];
        cpcFrequency.set(subgroup, (cpcFrequency.get(subgroup) ?? 0) + 1);
      }
    }

    // Add AI-suggested CPC hints
    for (const hint of keywordStrategy.cpcHints) {
      cpcFrequency.set(hint, (cpcFrequency.get(hint) ?? 0) + 5); // Weight AI suggestions
    }

    const topCPCs = [...cpcFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([code]) => code);

    await log(LogLevel.SUCCESS, `Identified ${topCPCs.length} primary CPC codes: ${topCPCs.slice(0, 5).join(', ')}`);
    await checkCancellation();

    // ─── STEP 5: Deep CPC Search ─────────────────────────────────────────
    await updateProgress(5, 55);
    await log(LogLevel.INFO, `Step 5: Deep CPC search across ${topCPCs.length} classifications...`);

    let cpcResults: RawPatent[] = [];

    if (input.depth !== 'quick') {
      try {
        const result = await searchByCPCCodes(topCPCs, input.jurisdictions, 150);
        cpcResults = result.patents;
        totalBytesProcessed += result.bytesProcessed;
        await log(LogLevel.SUCCESS, `CPC deep search found ${cpcResults.length} patents`);
      } catch (err) {
        await log(LogLevel.WARN, `CPC search failed, continuing: ${(err as Error).message}`);
      }
    }

    // Merge and deduplicate all results
    const allPatents = deduplicatePatents([...broadResults, ...cpcResults]);
    await log(LogLevel.INFO, `Total unique patents after deduplication: ${allPatents.length}`);

    await prisma.search.update({
      where: { id: searchId },
      data: { patentsFound: allPatents.length },
    });
    await checkCancellation();

    // ─── STEP 6: Timeline Analysis ───────────────────────────────────────
    await updateProgress(6, 68);
    await log(LogLevel.INFO, 'Step 6: Analyzing technology timeline and competitor landscape...');

    const [timelineData, assigneeData] = await Promise.allSettled([
      getTimelineAnalysis(keywordStrategy.primaryKeywords.slice(0, 3), topCPCs.slice(0, 5), input.jurisdictions),
      getAssigneeAnalysis(keywordStrategy.primaryKeywords.slice(0, 3), topCPCs.slice(0, 5), input.jurisdictions),
    ]);

    const timeline = timelineData.status === 'fulfilled' ? timelineData.value : [];
    const assignees = assigneeData.status === 'fulfilled' ? assigneeData.value : [];

    await log(LogLevel.SUCCESS, `Timeline: ${timeline.length} years analyzed, ${assignees.length} assignees identified`);
    await checkCancellation();

    // ─── STEP 7: AI Analysis & Report Generation ─────────────────────────
    await updateProgress(7, 78);
    await log(LogLevel.INFO, `Step 7: AI patentability analysis using ${aiProvider.name}...`);
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.AI_ANALYSIS } });

    // Score and rank all patents (top 30 for AI analysis)
    const candidatePatents: ScoredPatent[] = allPatents.slice(0, 30).map((p) => ({
      ...p,
      relevanceScore: 50,
      similarityScore: 50,
      noveltyImpact: 'moderate' as const,
      similarities: [],
      differences: [],
      analysis: '',
      rank: 1,
    }));

    const aiOutput = await aiProvider.generateFullReport({
      inventionTitle: input.title,
      inventionDescription: input.description,
      technicalField: input.technicalField,
      keyInnovations: input.keyInnovations,
      candidatePatents,
      reportStyle: input.reportStyle,
    });

    await log(LogLevel.SUCCESS, `AI analysis complete: ${aiOutput.tokensUsed.toLocaleString()} tokens, verdict: ${aiOutput.patentabilityAssessment.overallVerdict}`);
    await prisma.search.update({ where: { id: searchId }, data: { patentsAnalyzed: aiOutput.scoredPatents.length } });
    await checkCancellation();

    // ─── REPORT GENERATION ───────────────────────────────────────────────
    await prisma.search.update({ where: { id: searchId }, data: { status: SearchStatus.GENERATING_REPORT } });
    await log(LogLevel.INFO, 'Generating report documents...');

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    const reportData = {
      id: `report_${searchId}`,
      searchId,
      generatedAt: new Date().toISOString(),
      inventionTitle: input.title,
      inventionDescription: input.description,
      reportStyle: input.reportStyle,
      executiveSummary: aiOutput.executiveSummary,
      patentabilityAssessment: aiOutput.patentabilityAssessment,
      claimStrategy: aiOutput.claimStrategy,
      conceptExtraction: concepts,
      keywordStrategy,
      topPriorArt: aiOutput.scoredPatents.slice(0, 10),
      allRelevantPatents: aiOutput.scoredPatents,
      cpcCodesAnalyzed: topCPCs.map((code) => ({ code, description: code, level: 'subgroup' as const })),
      timelineAnalysis: timeline,
      assigneeAnalysis: assignees,
      statistics: {
        totalPatentsReviewed: allPatents.length,
        relevantPatentsFound: aiOutput.scoredPatents.length,
        topPriorArtSelected: 10,
        keywordsSearched: allKeywords,
        cpcCodesSearched: topCPCs,
        jurisdictionsCovered: input.jurisdictions,
        bigQueryBytesProcessed: totalBytesProcessed,
        searchDurationSeconds: durationSeconds,
        aiProvider: input.aiProvider,
        aiTokensUsed: aiOutput.tokensUsed,
        aiCostUsd: aiOutput.costUsd,
      },
      idsReferences: aiOutput.scoredPatents
        .slice(0, 20)
        .map((p) => p.publicationNumber),
      markdownContent: '',
      htmlContent: '',
    };

    // Generate markdown
    reportData.markdownContent = generateMarkdownReport(reportData as any);
    reportData.htmlContent = generateHTMLReport(reportData as any);

    // Upload markdown & HTML to storage
    const [mdUrl, htmlUrl] = await Promise.allSettled([
      uploadReport(searchId, 'report.md', Buffer.from(reportData.markdownContent), 'text/markdown'),
      uploadReport(searchId, 'report.html', Buffer.from(reportData.htmlContent), 'text/html'),
    ]);

    // Generate and upload PDF
    let pdfStorageUrl: string | undefined;
    try {
      const pdfBuffer = await generatePDFReport(reportData as any);
      pdfStorageUrl = await uploadReport(searchId, 'report.pdf', pdfBuffer, 'application/pdf');
      await log(LogLevel.SUCCESS, `PDF report generated (${Math.round(pdfBuffer.length / 1024)}KB)`);
    } catch (err) {
      await log(LogLevel.WARN, `PDF generation failed: ${(err as Error).message}`);
    }

    // Persist report to database
    const savedReport = await prisma.report.create({
      data: {
        searchId,
        userId,
        inventionTitle: input.title,
        reportStyle: input.reportStyle as any,
        patentabilityScore: aiOutput.patentabilityAssessment.patentabilityScore,
        noveltyRating: aiOutput.patentabilityAssessment.noveltyRating,
        obviousnessRating: aiOutput.patentabilityAssessment.obviousnessRating,
        overallVerdict: aiOutput.patentabilityAssessment.overallVerdict,
        executiveSummary: aiOutput.executiveSummary,
        patentabilityData: aiOutput.patentabilityAssessment as any,
        claimStrategyData: aiOutput.claimStrategy as any,
        conceptData: concepts as any,
        keywordData: keywordStrategy as any,
        topPriorArtData: aiOutput.scoredPatents.slice(0, 10) as any,
        timelineData: timeline as any,
        assigneeData: assignees as any,
        statisticsData: reportData.statistics as any,
        idsReferences: reportData.idsReferences,
        markdownContent: reportData.markdownContent,
        htmlContent: reportData.htmlContent,
        pdfStorageUrl: pdfStorageUrl ?? undefined,
        markdownStorageUrl: mdUrl.status === 'fulfilled' ? mdUrl.value : undefined,
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

    await log(LogLevel.SUCCESS, `Search completed in ${Math.round(durationSeconds / 60)}m ${durationSeconds % 60}s`);

    return {
      searchId,
      reportId: savedReport.id,
      status: 'completed',
      durationSeconds,
    };
  } catch (err) {
    const error = err as Error;
    const isCancelled = error.message === 'SEARCH_CANCELLED';

    await prisma.search.update({
      where: { id: searchId },
      data: {
        status: isCancelled ? SearchStatus.CANCELLED : SearchStatus.FAILED,
        errorMessage: error.message,
        completedAt: new Date(),
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
      },
    }).catch(() => {});

    await prisma.progressLog.create({
      data: {
        searchId,
        level: isCancelled ? LogLevel.WARN : LogLevel.ERROR,
        message: isCancelled ? 'Search cancelled by user' : `Search failed: ${error.message}`,
      },
    }).catch(() => {});

    throw error;
  }
}
