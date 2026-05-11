import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import type {
  AIAnalysisInput,
  AIAnalysisOutput,
  PatentSummaryInput,
  ComparisonInput,
  ComparisonOutput,
  ConceptExtraction,
  KeywordStrategy,
  ScoredPatent,
  NovelElementDecompositionInput,
  NovelElementDecompositionOutput,
  CoverageAnalysisInput,
  CoverageAnalysisOutput,
  ExaminerSimulationInput,
  GapClaimDraftInput,
  IDSAnalysisInput,
  ExaminerPrediction,
  GapGroundedClaimDraft,
  IDSEntry,
  NPLReference,
  NovelElement,
} from '@priovex/types';
import type { AIProvider, BatchCoverageRef, RetryConfig } from './interface';
import { withRetry } from './interface';
import type { CoverageCell } from '@priovex/types';
import {
  SYSTEM_PROMPT_PATENT_EXPERT,
  buildConceptExtractionPrompt,
  buildKeywordStrategyPrompt,
  buildPatentComparisonPrompt,
  buildFullReportPrompt,
  buildNovelElementDecompositionPrompt,
  buildCoverageAnalysisPrompt,
  buildCoverageMatrixBatchPrompt,
  buildNPLAnalysisPrompt,
  buildExaminerSimulationPrompt,
  buildGapGroundedClaimDraftingPrompt,
  buildIDSAnalysisPrompt,
} from './prompts';

// =============================================================================
// Model tier configuration — override via env vars for easy upgrades
//
// Free-tier quota summary (as of 2025):
//   gemini-2.5-flash      → 5 RPM, 250K TPM, 20 RPD  ← quality reasoning
//   gemini-2.5-flash-lite → 10 RPM, 250K TPM, 20 RPD  ← medium tasks
//   gemini-3.1-flash-lite → 15 RPM, 250K TPM, 500 RPD ← set GEMINI_VOLUME_MODEL=gemini-3.1-flash-lite
//
// Set in Railway env to upgrade volume model without code changes.
// =============================================================================

const QUALITY_MODEL = process.env.GEMINI_QUALITY_MODEL ?? 'gemini-2.5-flash';
const VOLUME_MODEL  = process.env.GEMINI_VOLUME_MODEL  ?? 'gemini-2.5-flash-lite';

// RPM-derived call spacing: quality 5 RPM → 13s gap; volume 10 RPM → 7s gap
// Override when volume model has higher RPM (e.g. gemini-3.1-flash-lite at 15 RPM → 5s)
const QUALITY_CALL_GAP_MS = 13_000;
const VOLUME_CALL_GAP_MS  = parseInt(process.env.GEMINI_VOLUME_CALL_GAP_MS ?? '7000');

const MAX_TOKENS        = 8192;
const MAX_TOKENS_REPORT = 16000;

const RETRY_CONFIG: RetryConfig = {
  maxRetries:     4,
  initialDelayMs: 2_000,
  maxDelayMs:     60_000,
  backoffFactor:  2,
};

// =============================================================================
// Error classification helpers
// =============================================================================

type GeminiErrorKind = 'quota_exceeded' | 'rate_limit' | 'api_unavailable' | 'json_parse' | 'unknown';

function classifyGeminiError(err: unknown): { kind: GeminiErrorKind; message: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('Quota')) {
    return { kind: 'quota_exceeded', message: `Gemini quota exhausted (daily/minute limit reached). Model: ${VOLUME_MODEL}. Error: ${msg.slice(0, 200)}` };
  }
  if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit') || msg.includes('Rate limit')) {
    return { kind: 'rate_limit', message: `Gemini rate limit hit. Will retry with 70s delay. Error: ${msg.slice(0, 200)}` };
  }
  if (msg.includes('500') || msg.includes('503') || msg.includes('Internal Server Error') || msg.includes('Service Unavailable')) {
    return { kind: 'api_unavailable', message: `Gemini API transient error (${msg.slice(0, 80)}). Retrying...` };
  }
  if (msg.includes('parse') || msg.includes('JSON') || msg.includes('Unexpected token')) {
    return { kind: 'json_parse', message: `Gemini returned malformed JSON. Raw response may be truncated or contain markdown. Error: ${msg.slice(0, 200)}` };
  }
  return { kind: 'unknown', message: msg };
}

// =============================================================================
// GeminiProvider
// =============================================================================

export class GeminiProvider implements AIProvider {
  readonly name         = 'Google Gemini';
  readonly model        = QUALITY_MODEL;
  readonly providerType = 'gemini' as const;

  private genAI: GoogleGenerativeAI;
  private totalTokensUsed = 0;

  // Per-model call counters for logging (does not enforce limits — just informs)
  private callCount: Record<string, number> = {};

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // ==========================================================================
  // Internal chat — routes to the specified model tier
  // ==========================================================================

  private async chat(
    userMessage: string,
    maxTokens = MAX_TOKENS,
    model = QUALITY_MODEL,
  ): Promise<{ text: string; tokens: number }> {
    this.callCount[model] = (this.callCount[model] ?? 0) + 1;
    const callNum = this.callCount[model];

    return withRetry(async () => {
      const genModel = this.genAI.getGenerativeModel({
        model,
        systemInstruction: SYSTEM_PROMPT_PATENT_EXPERT,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: maxTokens,
          temperature: 0.3,
        },
      });

      const result = await genModel.generateContent(userMessage);
      const text   = result.response.text();
      const tokens = result.response.usageMetadata?.totalTokenCount ?? 0;
      this.totalTokensUsed += tokens;

      console.log(`[Gemini] ${model} call #${callNum} — ${tokens} tokens used (session total: ${this.totalTokensUsed})`);
      return { text, tokens };
    }, RETRY_CONFIG, `Gemini/${model} call #${callNum}`);
  }

  // ==========================================================================
  // JSON parsing with detailed error classification
  // ==========================================================================

  private parseJSON<T>(text: string, context = 'response'): T {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(clean) as T; } catch { /* fall through */ }
    const match = clean.match(/^[\s\S]*?([\[{][\s\S]*[\]}])/);
    const candidate = match ? match[1] : clean;
    try { return JSON.parse(candidate) as T; } catch { /* fall through */ }
    const { message } = classifyGeminiError(new Error(`JSON parse failed for ${context}`));
    throw new Error(`${message} — snippet: ${clean.slice(0, 300)}`);
  }

  // ==========================================================================
  // QUALITY TIER — Step 1: Concept Extraction
  // ==========================================================================

  async extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction> {
    const prompt = buildConceptExtractionPrompt(inventionTitle, inventionDescription, technicalField, keyInnovations);
    const { text } = await this.chat(prompt, MAX_TOKENS, QUALITY_MODEL);
    return this.parseJSON<ConceptExtraction>(text, 'concept extraction');
  }

  // ==========================================================================
  // QUALITY TIER — Step 2: Novel Element Decomposition
  // ==========================================================================

  async decomposeNovelElements(input: NovelElementDecompositionInput): Promise<NovelElementDecompositionOutput> {
    const prompt = buildNovelElementDecompositionPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.problemSolved, input.keyInnovations, input.claimsDraft
    );
    const { text } = await this.chat(prompt, MAX_TOKENS, QUALITY_MODEL);
    return this.parseJSON<NovelElementDecompositionOutput>(text, 'novel element decomposition');
  }

  // ==========================================================================
  // VOLUME TIER — Step 3: Keyword Strategy (routine, many synonyms)
  // ==========================================================================

  async buildKeywordStrategy(concepts: ConceptExtraction, technicalField: string): Promise<KeywordStrategy> {
    const prompt = buildKeywordStrategyPrompt(JSON.stringify(concepts), technicalField);
    const { text } = await this.chat(prompt, MAX_TOKENS, VOLUME_MODEL);
    return this.parseJSON<KeywordStrategy>(text, 'keyword strategy');
  }

  // ==========================================================================
  // VOLUME TIER — Patent comparison (called ~15× per search in step 10)
  // Uses VOLUME_MODEL to spread RPD load; shorter call gap possible
  // ==========================================================================

  async compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput> {
    const prompt = buildPatentComparisonPrompt(
      input.inventionDescription,
      input.patent.title,
      input.patent.abstract,
      input.patent.claims
    );
    const { text } = await this.chat(prompt, MAX_TOKENS, VOLUME_MODEL);
    return this.parseJSON<ComparisonOutput>(text, `patent comparison: ${input.patent.publicationNumber}`);
  }

  // ==========================================================================
  // VOLUME TIER — NPL analysis (called ~6× per search in step 10)
  // ==========================================================================

  async analyzeNPLReference(
    inventionDescription: string, nplTitle: string, nplAbstract: string, nplSource: string
  ) {
    const prompt = buildNPLAnalysisPrompt(inventionDescription, nplTitle, nplAbstract, nplSource);
    const { text } = await this.chat(prompt, MAX_TOKENS, VOLUME_MODEL);
    return this.parseJSON<{
      similarityScore: number; similarities: string[]; differences: string[];
      noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
      analysis: string; anticipationRisk: number; obviousnessRisk: number;
      isSuitable103Combination: boolean; disclosureNote: string;
    }>(text, `NPL analysis: ${nplTitle.slice(0, 60)}`);
  }

  // ==========================================================================
  // VOLUME TIER — Coverage matrix (large batch, many references)
  // ==========================================================================

  async analyzeCoverageForReference(input: CoverageAnalysisInput): Promise<CoverageAnalysisOutput> {
    const elements = input.novelElements.map((e) => ({ id: e.id, label: e.label, claimLanguage: e.claimLanguage }));
    const prompt = buildCoverageAnalysisPrompt(input.inventionDescription, elements, input.reference);
    const { text } = await this.chat(prompt, MAX_TOKENS, VOLUME_MODEL);
    return this.parseJSON<CoverageAnalysisOutput>(text, `coverage analysis: ${input.reference.id}`);
  }

  async analyzeCoverageMatrix(
    inventionDescription: string,
    novelElements: NovelElement[],
    references: BatchCoverageRef[]
  ): Promise<Record<string, Record<string, CoverageCell>>> {
    const prompt = buildCoverageMatrixBatchPrompt(inventionDescription, novelElements, references);
    const { text } = await this.chat(prompt, MAX_TOKENS_REPORT, VOLUME_MODEL);

    let raw: Record<string, Record<string, { state: string; reasoning: string; confidenceScore: number; evidence: string }>> = {};
    try {
      raw = this.parseJSON(text, 'coverage matrix batch');
    } catch (err) {
      const { message } = classifyGeminiError(err);
      console.warn(`[Gemini] Coverage matrix parse failed: ${message}`);
      return {};
    }

    const validStates = new Set<CoverageCell['state']>(['fully_covered', 'partially_covered', 'implied', 'not_covered', 'ambiguous']);
    const stateAliases: Record<string, CoverageCell['state']> = {
      covered: 'fully_covered', partial: 'partially_covered', unknown: 'ambiguous',
    };
    const result: Record<string, Record<string, CoverageCell>> = {};

    for (const [elementId, refs] of Object.entries(raw)) {
      result[elementId] = {};
      for (const [refId, cell] of Object.entries(refs)) {
        const rawState = cell.state as string;
        const state: CoverageCell['state'] = validStates.has(rawState as CoverageCell['state'])
          ? rawState as CoverageCell['state']
          : (stateAliases[rawState] ?? 'ambiguous');
        result[elementId][refId] = {
          state,
          reasoning:       cell.reasoning       ?? '',
          confidenceScore: cell.confidenceScore ?? 50,
          evidence:        cell.evidence        ?? '',
          claimCitation:   undefined,
          figureReferences: [],
        };
      }
    }
    return result;
  }

  // ==========================================================================
  // QUALITY TIER — Step 10: Full Report (executive summary + patentability)
  // ==========================================================================

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    const scoredPatents: ScoredPatent[] = [];

    // Score top 15 candidates using VOLUME_MODEL — this is the high-call loop
    const candidates = input.candidatePatents.slice(0, 15);
    console.log(`[Gemini] Scoring ${candidates.length} patents with ${VOLUME_MODEL} (${VOLUME_CALL_GAP_MS / 1000}s gap between calls)`);

    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      try {
        const result = await this.compareInventionToPatent({
          inventionDescription: `${input.inventionTitle}: ${input.inventionDescription}`,
          patent: {
            publicationNumber: p.publicationNumber,
            title: p.title,
            abstract: p.abstract,
            claims: p.claims,
          },
        });
        scoredPatents.push({ ...p, ...result, rank: scoredPatents.length + 1 });
      } catch (err) {
        const { kind, message } = classifyGeminiError(err);
        console.warn(`[Gemini] Patent ${p.publicationNumber} scoring skipped [${kind}]: ${message.slice(0, 120)}`);
      }
      if (i < candidates.length - 1) {
        await new Promise((r) => setTimeout(r, VOLUME_CALL_GAP_MS));
      }
    }

    scoredPatents.sort((a, b) => b.similarityScore - a.similarityScore);
    scoredPatents.forEach((p, idx) => { p.rank = idx + 1; });

    const topPatentsStr = scoredPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (Similarity: ${p.similarityScore}%)\n` +
      `   Assignee: ${p.assignees[0] ?? 'N/A'} | Filed: ${p.filingDate}\n` +
      `   Impact: ${p.noveltyImpact} | Key similarity: ${p.similarities[0] ?? 'N/A'}`
    ).join('\n\n');

    const nplSummary      = buildNPLSummary(input.nplReferences ?? []);
    const coverageSummary = input.novelElements && input.novelElements.length > 0
      ? buildCoverageSummary(input.novelElements)
      : undefined;

    // Final synthesis uses QUALITY_MODEL — one call, highest quality needed
    console.log(`[Gemini] Generating final report synthesis with ${QUALITY_MODEL}`);
    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle,
      input.inventionDescription,
      input.technicalField,
      input.keyInnovations,
      topPatentsStr,
      input.reportStyle,
      nplSummary,
      coverageSummary
    );

    const { text } = await this.chat(reportPrompt, MAX_TOKENS_REPORT, QUALITY_MODEL);

    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text, 'full report synthesis');

    const costUsd = (this.totalTokensUsed / 1_000_000) * 0.15;
    console.log(`[Gemini] Session complete — quality model (${QUALITY_MODEL}): ${this.callCount[QUALITY_MODEL] ?? 0} calls | volume model (${VOLUME_MODEL}): ${this.callCount[VOLUME_MODEL] ?? 0} calls | total tokens: ${this.totalTokensUsed}`);

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: this.totalTokensUsed,
      costUsd,
      model: QUALITY_MODEL,
      provider: 'gemini',
    };
  }

  // ==========================================================================
  // QUALITY TIER — Step 13: Examiner Simulation (legal reasoning quality)
  // ==========================================================================

  async simulateExaminer(input: ExaminerSimulationInput): Promise<ExaminerPrediction> {
    const prompt = buildExaminerSimulationPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.novelElements.map((e) => ({ id: e.id, claimLanguage: e.claimLanguage })),
      input.topPatents.slice(0, 8).map((p) => p.publicationNumber),
      input.topPatents.slice(0, 8).map((p) => p.title),
      input.cpcCodes
    );
    const { text } = await this.chat(prompt, MAX_TOKENS, QUALITY_MODEL);
    return this.parseJSON<ExaminerPrediction>(text, 'examiner simulation');
  }

  // ==========================================================================
  // QUALITY TIER — Step 13: Gap-Grounded Claim Drafting
  // ==========================================================================

  async generateGapGroundedClaims(input: GapClaimDraftInput): Promise<GapGroundedClaimDraft> {
    const topPatentsStr = input.topPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (impact: ${p.noveltyImpact})`
    ).join('\n');
    const prompt = buildGapGroundedClaimDraftingPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.novelElements, buildCoverageSummary(input.novelElements), topPatentsStr
    );
    const { text } = await this.chat(prompt, MAX_TOKENS, QUALITY_MODEL);
    return this.parseJSON<GapGroundedClaimDraft>(text, 'gap-grounded claim draft');
  }

  // ==========================================================================
  // VOLUME TIER — IDS analysis
  // ==========================================================================

  async generateIDSAnalysis(input: IDSAnalysisInput): Promise<IDSEntry[]> {
    const refs = [
      ...input.patents.slice(0, 15).map((p) => ({
        id: p.publicationNumber, type: 'patent' as const,
        number: p.publicationNumber, title: p.title, abstract: p.abstract,
      })),
      ...input.nplReferences.slice(0, 10).map((n) => ({
        id: n.id, type: 'npl' as const, title: n.title, abstract: n.abstract,
      })),
    ];
    if (refs.length === 0) return [];
    const prompt = buildIDSAnalysisPrompt(input.inventionDescription, refs);
    const { text } = await this.chat(prompt, MAX_TOKENS, VOLUME_MODEL);
    return this.parseJSON<IDSEntry[]>(text, 'IDS analysis');
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  async summarizePatent(input: PatentSummaryInput): Promise<string> {
    const genModel = this.genAI.getGenerativeModel({ model: VOLUME_MODEL });
    const result = await genModel.generateContent(
      `Summarize in 2-3 sentences:\nTitle: ${input.title}\nAbstract: ${input.abstract}`
    );
    return result.response.text().trim();
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildNPLSummary(nplRefs: NPLReference[]): string {
  if (nplRefs.length === 0) return '';
  return nplRefs.slice(0, 5).map((r, i) =>
    `NPL ${i + 1}: "${r.title}" (${r.source}, score: ${r.relevanceScore}) — ${r.abstract.slice(0, 150)}...`
  ).join('\n');
}

function buildCoverageSummary(elements: NovelElement[]): string {
  return elements.map((e) =>
    `Element [${e.label}] "${e.claimLanguage.slice(0, 80)}..." — Coverage: pending analysis`
  ).join('\n');
}
