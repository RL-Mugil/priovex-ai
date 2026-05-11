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
import type { AIProvider, BatchCoverageRef } from './interface';
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
import { GeminiModelPool, classifyError, type ModelTier } from './gemini-pool';

const MAX_TOKENS        = 8192;
const MAX_TOKENS_REPORT = 16000;

// Minimum gap between sequential calls (ms) — respects the slowest tier's RPM.
// Volume calls on standard tier (15 RPM) can use 5s; quality (5 RPM) needs 13s.
// The pool picks the best model, so we use a moderate default that works for any tier.
const CALL_GAP_MS = parseInt(process.env.GEMINI_CALL_GAP_MS ?? '5000');

export class GeminiProvider implements AIProvider {
  readonly name         = 'Google Gemini';
  readonly model        = 'gemini-2.5-flash';   // primary quality model
  readonly providerType = 'gemini' as const;

  private genAI:          GoogleGenerativeAI;
  private pool:           GeminiModelPool;
  private totalTokens     = 0;
  private progressLogger?: (level: string, message: string) => void;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.pool  = new GeminiModelPool();

    // Wire pool switch events to the progress logger
    this.pool.setOnSwitch((ev) => {
      const reasonStr =
        ev.reason === 'initial'        ? 'started on'  :
        ev.reason === 'rate_limit'     ? 'rate-limited → switched to' :
        ev.reason === 'quota_exceeded' ? 'quota exhausted → switched to' :
        ev.reason === 'api_error'      ? 'API error → switched to' :
                                         'error → switched to';

      if (ev.reason === 'initial') {
        this.plog('INFO', `[AI] Using ${ev.toModel} for ${ev.task}`);
      } else {
        this.plog('WARN',
          `[AI] ${ev.fromModel} ${reasonStr} ${ev.toModel} during "${ev.task}"`
        );
      }
    });
  }

  // Called by the pipeline to route log messages into the search progress DB
  setProgressLogger(fn: (level: string, message: string) => void): void {
    this.progressLogger = fn;
  }

  private plog(level: string, message: string): void {
    console.log(`[Gemini] ${message}`);
    this.progressLogger?.(level, message);
  }

  // ==========================================================================
  // Core chat — tries models in pool order, fails over on rate-limit/API errors
  // ==========================================================================

  private async chat(
    prompt:       string,
    maxTokens:    number,
    tier:         ModelTier,
    taskLabel:    string,
  ): Promise<{ text: string; tokens: number; modelUsed: string }> {
    const candidates = this.pool.getModelsForTier(tier, prompt.length);

    if (candidates.length === 0) {
      throw new Error(
        `[Gemini] All models rate-limited or unavailable for task "${taskLabel}". ` +
        `Pool state: ${this.pool.getSummary()}`
      );
    }

    let firstModel = true;
    for (const model of candidates) {
      if (firstModel) {
        this.pool.emitSwitch('', model.id, 'initial', taskLabel);
        firstModel = false;
      }

      this.pool.recordCall(model.id);
      const isGemma = model.id.startsWith('gemma-');

      try {
        const genModel = this.genAI.getGenerativeModel({
          model:            model.id,
          systemInstruction: SYSTEM_PROMPT_PATENT_EXPERT,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
          generationConfig: {
            // Gemma models don't reliably honour responseMimeType — parse manually
            ...(isGemma ? {} : { responseMimeType: 'application/json' }),
            maxOutputTokens: maxTokens,
            temperature:     0.3,
          },
        });

        const result  = await genModel.generateContent(prompt);
        const text    = result.response.text();
        const tokens  = result.response.usageMetadata?.totalTokenCount ?? 0;
        this.totalTokens += tokens;

        this.plog('INFO',
          `[AI] ${model.displayName} ✓ "${taskLabel}" — ${tokens} tokens ` +
          `(session total: ${this.totalTokens})`
        );
        return { text, tokens, modelUsed: model.displayName };

      } catch (err) {
        const { kind, userMessage } = classifyError(err);
        this.pool.markError(model.id, kind);

        const nextCandidates = this.pool.getModelsForTier(tier, prompt.length);
        const nextModel      = nextCandidates[0];

        if (nextModel) {
          this.pool.emitSwitch(model.id, nextModel.id, kind, taskLabel);
          this.plog('WARN', `[AI] ${userMessage} — trying ${nextModel.displayName} next`);
          // continue to next iteration
        } else {
          this.plog('WARN', `[AI] ${userMessage} — no models remaining in pool`);
          throw new Error(
            `[Gemini] All models exhausted for "${taskLabel}". Last error: ${userMessage}`
          );
        }
      }
    }

    throw new Error(`[Gemini] All models in pool failed for task "${taskLabel}"`);
  }

  // ==========================================================================
  // JSON parsing — handles markdown fences and partial JSON
  // ==========================================================================

  private parseJSON<T>(text: string, context: string): T {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(clean) as T; } catch { /* fall through */ }
    const match = clean.match(/^[\s\S]*?([\[{][\s\S]*[\]}])/);
    const candidate = match ? match[1] : clean;
    try { return JSON.parse(candidate) as T; } catch { /* fall through */ }
    throw new Error(
      `[Gemini] JSON parse failed for "${context}". ` +
      `Response snippet (${clean.length} chars): ${clean.slice(0, 300)}`
    );
  }

  // ==========================================================================
  // QUALITY TIER — Step 1: Concept Extraction
  // ==========================================================================

  async extractConcepts(
    inventionTitle: string, inventionDescription: string,
    technicalField: string, keyInnovations: string[]
  ): Promise<ConceptExtraction> {
    const prompt = buildConceptExtractionPrompt(inventionTitle, inventionDescription, technicalField, keyInnovations);
    const { text } = await this.chat(prompt, MAX_TOKENS, 'quality', 'concept extraction');
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
    const { text } = await this.chat(prompt, MAX_TOKENS, 'quality', 'novel element decomposition');
    return this.parseJSON<NovelElementDecompositionOutput>(text, 'novel element decomposition');
  }

  // ==========================================================================
  // STANDARD TIER — Step 3: Keyword Strategy
  // ==========================================================================

  async buildKeywordStrategy(concepts: ConceptExtraction, technicalField: string): Promise<KeywordStrategy> {
    const prompt = buildKeywordStrategyPrompt(JSON.stringify(concepts), technicalField);
    const { text } = await this.chat(prompt, MAX_TOKENS, 'standard', 'keyword strategy');
    return this.parseJSON<KeywordStrategy>(text, 'keyword strategy');
  }

  // ==========================================================================
  // STANDARD TIER — Patent comparison (called ~15× per search)
  // ==========================================================================

  async compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput> {
    const prompt = buildPatentComparisonPrompt(
      input.inventionDescription, input.patent.title,
      input.patent.abstract, input.patent.claims
    );
    const { text } = await this.chat(
      prompt, MAX_TOKENS, 'standard',
      `patent comparison: ${input.patent.publicationNumber ?? 'unknown'}`
    );
    return this.parseJSON<ComparisonOutput>(text, `patent comparison: ${input.patent.publicationNumber}`);
  }

  // ==========================================================================
  // STANDARD TIER — NPL analysis (called ~6× per search)
  // ==========================================================================

  async analyzeNPLReference(
    inventionDescription: string, nplTitle: string, nplAbstract: string, nplSource: string
  ) {
    const prompt = buildNPLAnalysisPrompt(inventionDescription, nplTitle, nplAbstract, nplSource);
    const { text } = await this.chat(
      prompt, MAX_TOKENS, 'standard',
      `NPL: ${nplTitle.slice(0, 50)}`
    );
    return this.parseJSON<{
      similarityScore: number; similarities: string[]; differences: string[];
      noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
      analysis: string; anticipationRisk: number; obviousnessRisk: number;
      isSuitable103Combination: boolean; disclosureNote: string;
    }>(text, `NPL analysis: ${nplTitle.slice(0, 50)}`);
  }

  // ==========================================================================
  // STANDARD TIER — Coverage per-reference (fallback from batch)
  // ==========================================================================

  async analyzeCoverageForReference(input: CoverageAnalysisInput): Promise<CoverageAnalysisOutput> {
    const elements = input.novelElements.map(e => ({ id: e.id, label: e.label, claimLanguage: e.claimLanguage }));
    const prompt   = buildCoverageAnalysisPrompt(input.inventionDescription, elements, input.reference);
    const { text } = await this.chat(
      prompt, MAX_TOKENS, 'standard',
      `coverage: ${input.reference.id}`
    );
    return this.parseJSON<CoverageAnalysisOutput>(text, `coverage: ${input.reference.id}`);
  }

  // ==========================================================================
  // FALLBACK TIER — Coverage matrix batch (large context, use fallback or better)
  // ==========================================================================

  async analyzeCoverageMatrix(
    inventionDescription: string, novelElements: NovelElement[], references: BatchCoverageRef[]
  ): Promise<Record<string, Record<string, CoverageCell>>> {
    const prompt   = buildCoverageMatrixBatchPrompt(inventionDescription, novelElements, references);
    const { text } = await this.chat(prompt, MAX_TOKENS_REPORT, 'fallback', 'coverage matrix batch');

    let raw: Record<string, Record<string, { state: string; reasoning: string; confidenceScore: number; evidence: string }>> = {};
    try {
      raw = this.parseJSON(text, 'coverage matrix batch');
    } catch (err) {
      this.plog('WARN', `[AI] Coverage matrix parse failed — returning empty matrix. ${(err as Error).message.slice(0, 120)}`);
      return {};
    }

    const validStates  = new Set<CoverageCell['state']>(['fully_covered', 'partially_covered', 'implied', 'not_covered', 'ambiguous']);
    const stateAliases: Record<string, CoverageCell['state']> = { covered: 'fully_covered', partial: 'partially_covered', unknown: 'ambiguous' };
    const result: Record<string, Record<string, CoverageCell>> = {};

    for (const [elementId, refs] of Object.entries(raw)) {
      result[elementId] = {};
      for (const [refId, cell] of Object.entries(refs)) {
        const rawState = cell.state as string;
        const state: CoverageCell['state'] = validStates.has(rawState as CoverageCell['state'])
          ? rawState as CoverageCell['state']
          : (stateAliases[rawState] ?? 'ambiguous');
        result[elementId][refId] = {
          state, reasoning: cell.reasoning ?? '', confidenceScore: cell.confidenceScore ?? 50,
          evidence: cell.evidence ?? '', claimCitation: undefined, figureReferences: [],
        };
      }
    }
    return result;
  }

  // ==========================================================================
  // QUALITY TIER — Step 10: Full report (scoring uses STANDARD, synthesis uses QUALITY)
  // ==========================================================================

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    const candidates = input.candidatePatents.slice(0, 15);
    const scoredPatents: ScoredPatent[] = [];

    this.plog('INFO',
      `[AI] Scoring ${candidates.length} patents with STANDARD tier (${CALL_GAP_MS / 1000}s gap between calls)`
    );

    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      try {
        const result = await this.compareInventionToPatent({
          inventionDescription: `${input.inventionTitle}: ${input.inventionDescription}`,
          patent: { publicationNumber: p.publicationNumber, title: p.title, abstract: p.abstract, claims: p.claims },
        });
        scoredPatents.push({ ...p, ...result, rank: scoredPatents.length + 1 });
      } catch (err) {
        this.plog('WARN',
          `[AI] Patent ${p.publicationNumber} skipped — ${(err as Error).message.slice(0, 100)}`
        );
      }
      if (i < candidates.length - 1) {
        await new Promise(r => setTimeout(r, CALL_GAP_MS));
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
    const coverageSummary = input.novelElements?.length
      ? buildCoverageSummary(input.novelElements)
      : undefined;

    this.plog('INFO', `[AI] Generating final report synthesis with QUALITY tier`);

    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.keyInnovations, topPatentsStr, input.reportStyle, nplSummary, coverageSummary
    );

    const { text } = await this.chat(reportPrompt, MAX_TOKENS_REPORT, 'quality', 'full report synthesis');
    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text, 'full report synthesis');

    const summary = this.pool.getSummary();
    this.plog('INFO',
      `[AI] Gemini session complete — models used: ${summary} | total tokens: ${this.totalTokens}`
    );

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: this.totalTokens,
      costUsd: (this.totalTokens / 1_000_000) * 0.15,
      model: `gemini-pool (${summary})`,
      provider: 'gemini',
    };
  }

  // ==========================================================================
  // QUALITY TIER — Examiner simulation (legal reasoning)
  // ==========================================================================

  async simulateExaminer(input: ExaminerSimulationInput): Promise<ExaminerPrediction> {
    const prompt = buildExaminerSimulationPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.novelElements.map(e => ({ id: e.id, claimLanguage: e.claimLanguage })),
      input.topPatents.slice(0, 8).map(p => p.publicationNumber),
      input.topPatents.slice(0, 8).map(p => p.title),
      input.cpcCodes
    );
    const { text } = await this.chat(prompt, MAX_TOKENS, 'quality', 'examiner simulation');
    return this.parseJSON<ExaminerPrediction>(text, 'examiner simulation');
  }

  // ==========================================================================
  // QUALITY TIER — Gap-grounded claim drafting
  // ==========================================================================

  async generateGapGroundedClaims(input: GapClaimDraftInput): Promise<GapGroundedClaimDraft> {
    const topPatentsStr = input.topPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (impact: ${p.noveltyImpact})`
    ).join('\n');
    const prompt = buildGapGroundedClaimDraftingPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.novelElements, buildCoverageSummary(input.novelElements), topPatentsStr
    );
    const { text } = await this.chat(prompt, MAX_TOKENS, 'quality', 'gap claim drafting');
    return this.parseJSON<GapGroundedClaimDraft>(text, 'gap claim drafting');
  }

  // ==========================================================================
  // STANDARD TIER — IDS analysis
  // ==========================================================================

  async generateIDSAnalysis(input: IDSAnalysisInput): Promise<IDSEntry[]> {
    const refs = [
      ...input.patents.slice(0, 15).map(p => ({
        id: p.publicationNumber, type: 'patent' as const, number: p.publicationNumber, title: p.title, abstract: p.abstract,
      })),
      ...input.nplReferences.slice(0, 10).map(n => ({
        id: n.id, type: 'npl' as const, title: n.title, abstract: n.abstract,
      })),
    ];
    if (!refs.length) return [];
    const prompt   = buildIDSAnalysisPrompt(input.inventionDescription, refs);
    const { text } = await this.chat(prompt, MAX_TOKENS, 'standard', 'IDS analysis');
    return this.parseJSON<IDSEntry[]>(text, 'IDS analysis');
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  async summarizePatent(input: PatentSummaryInput): Promise<string> {
    const candidates = this.pool.getModelsForTier('standard');
    const modelId    = candidates[0]?.id ?? 'gemini-2.5-flash';
    const genModel   = this.genAI.getGenerativeModel({ model: modelId });
    const result     = await genModel.generateContent(
      `Summarize in 2-3 sentences:\nTitle: ${input.title}\nAbstract: ${input.abstract}`
    );
    return result.response.text().trim();
  }

  // Expose pool call counts for reporting/statistics
  getModelCallCounts(): Record<string, number> {
    return this.pool.getCallCounts();
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildNPLSummary(nplRefs: NPLReference[]): string {
  if (!nplRefs.length) return '';
  return nplRefs.slice(0, 5).map((r, i) =>
    `NPL ${i + 1}: "${r.title}" (${r.source}, score: ${r.relevanceScore}) — ${r.abstract.slice(0, 150)}...`
  ).join('\n');
}

function buildCoverageSummary(elements: NovelElement[]): string {
  return elements.map(e =>
    `Element [${e.label}] "${e.claimLanguage.slice(0, 80)}..." — Coverage: pending analysis`
  ).join('\n');
}
