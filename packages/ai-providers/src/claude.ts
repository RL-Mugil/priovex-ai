import Anthropic from '@anthropic-ai/sdk';
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
  CoverageCell,
} from '@priovex/types';
import type { AIProvider, BatchCoverageRef } from './interface';
import { withRetry, AI_RATE_DELAY_MS } from './interface';
import {
  SYSTEM_PROMPT_PATENT_EXPERT,
  buildConceptExtractionPrompt,
  buildNovelElementDecompositionPrompt,
  buildKeywordStrategyPrompt,
  buildPatentComparisonPrompt,
  buildCoverageAnalysisPrompt,
  buildCoverageMatrixBatchPrompt,
  buildNPLAnalysisPrompt,
  buildExaminerSimulationPrompt,
  buildGapGroundedClaimDraftingPrompt,
  buildIDSAnalysisPrompt,
  buildFullReportPrompt,
} from './prompts';

const CLAUDE_MODEL       = 'claude-sonnet-4-6';
const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS         = 8192;
const MAX_TOKENS_REPORT  = 16000;

// Pricing per million tokens (USD)
const SONNET_INPUT  = 3.00;
const SONNET_OUTPUT = 15.00;
const HAIKU_INPUT   = 0.80;
const HAIKU_OUTPUT  = 4.00;
const CACHE_READ_FACTOR = 0.10;   // cache reads = 10% of input price
const CACHE_WRITE_FACTOR = 1.25;  // cache writes = 125% of input price

export class ClaudeProvider implements AIProvider {
  readonly name         = 'Anthropic Claude';
  readonly model        = CLAUDE_MODEL;
  readonly providerType = 'claude' as const;

  private client: Anthropic;
  private totalTokensUsed  = 0;
  private estimatedCostUsd = 0;

  // Cached system content — set once per pipeline run after step 2.
  // Combines system prompt + invention context so all subsequent calls
  // get a ~90% discount on those input tokens via Anthropic prompt caching.
  private cachedSystemContent: string = SYSTEM_PROMPT_PATENT_EXPERT;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  // ==========================================================================
  // Session context — called from pipeline after novel elements decomposed
  // ==========================================================================

  setSessionContext(
    inventionTitle: string,
    inventionDescription: string,
    novelElements: NovelElement[]
  ): void {
    const elementsStr = novelElements.length > 0
      ? '\n\n## NOVEL ELEMENTS (claim-like language):\n' +
        novelElements.map((e) => `[${e.id}] (${e.label}) ${e.claimLanguage}`).join('\n')
      : '';

    // Build the cacheable block: system prompt + invention context
    // Target ≥1024 tokens so Anthropic activates caching
    this.cachedSystemContent =
      SYSTEM_PROMPT_PATENT_EXPERT +
      '\n\n## ACTIVE INVENTION CONTEXT\n' +
      `Title: ${inventionTitle}\n` +
      `Description: ${inventionDescription.slice(0, 1200)}` +
      elementsStr;
  }

  // ==========================================================================
  // Internal chat — uses cached system block + optional Haiku model
  // ==========================================================================

  private async chat(
    userMessage: string,
    maxTokens = MAX_TOKENS,
    useHaiku = false
  ): Promise<{ text: string; tokens: number }> {
    const model = useHaiku ? CLAUDE_HAIKU_MODEL : CLAUDE_MODEL;

    return withRetry(async () => {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        // Array form enables prompt caching on the system block
        system: [
          {
            type: 'text',
            text: this.cachedSystemContent,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('');

      const usage = response.usage as any;
      const inputTokens       = usage.input_tokens ?? 0;
      const outputTokens      = usage.output_tokens ?? 0;
      const cacheReadTokens   = usage.cache_read_input_tokens ?? 0;
      const cacheWriteTokens  = usage.cache_creation_input_tokens ?? 0;
      const normalInputTokens = inputTokens - cacheReadTokens - cacheWriteTokens;

      const inRate  = useHaiku ? HAIKU_INPUT  : SONNET_INPUT;
      const outRate = useHaiku ? HAIKU_OUTPUT : SONNET_OUTPUT;

      this.estimatedCostUsd +=
        (normalInputTokens  / 1_000_000) * inRate +
        (cacheReadTokens    / 1_000_000) * inRate * CACHE_READ_FACTOR +
        (cacheWriteTokens   / 1_000_000) * inRate * CACHE_WRITE_FACTOR +
        (outputTokens       / 1_000_000) * outRate;

      this.totalTokensUsed += inputTokens + outputTokens;
      return { text, tokens: inputTokens + outputTokens };
    }, undefined, `Claude ${useHaiku ? 'Haiku' : 'Sonnet'}`);
  }

  private parseJSON<T>(text: string): T {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try { return JSON.parse(clean) as T; } catch { /* fall through */ }

    const match = clean.match(/^[\s\S]*?([\[{][\s\S]*[\]}])/);
    const candidate = match ? match[1] : clean;

    try { return JSON.parse(candidate) as T; } catch { /* fall through */ }

    const repaired = repairTruncatedJSON(candidate);
    try { return JSON.parse(repaired) as T; } catch { /* fall through */ }

    throw new Error(`Failed to parse Claude JSON response (${clean.length} chars): ${clean.slice(0, 300)}`);
  }

  // ==========================================================================
  // STEP 1 — Concept Extraction
  // ==========================================================================

  async extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction> {
    const prompt = buildConceptExtractionPrompt(
      inventionTitle, inventionDescription, technicalField, keyInnovations
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<ConceptExtraction>(text);
  }

  // ==========================================================================
  // STEP 2 — Novel Element Decomposition
  // ==========================================================================

  async decomposeNovelElements(
    input: NovelElementDecompositionInput
  ): Promise<NovelElementDecompositionOutput> {
    const prompt = buildNovelElementDecompositionPrompt(
      input.inventionTitle,
      input.inventionDescription,
      input.technicalField,
      input.problemSolved,
      input.keyInnovations,
      input.claimsDraft
    );
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<NovelElementDecompositionOutput>(text);
  }

  // ==========================================================================
  // STEP 3 — Keyword Strategy
  // ==========================================================================

  async buildKeywordStrategy(
    concepts: ConceptExtraction,
    technicalField: string
  ): Promise<KeywordStrategy> {
    const conceptsStr = JSON.stringify(concepts, null, 2);
    const prompt = buildKeywordStrategyPrompt(conceptsStr, technicalField);
    const { text } = await this.chat(prompt);
    return this.parseJSON<KeywordStrategy>(text);
  }

  // ==========================================================================
  // Patent comparison (step 10)
  // ==========================================================================

  async compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput> {
    const prompt = buildPatentComparisonPrompt(
      input.inventionDescription,
      input.patent.title,
      input.patent.abstract,
      input.patent.claims
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<ComparisonOutput>(text);
  }

  // ==========================================================================
  // Coverage analysis — per reference (kept for fallback / other providers)
  // ==========================================================================

  async analyzeCoverageForReference(
    input: CoverageAnalysisInput
  ): Promise<CoverageAnalysisOutput> {
    const elements = input.novelElements.map((e) => ({
      id: e.id,
      label: e.label,
      claimLanguage: e.claimLanguage,
    }));

    const prompt = buildCoverageAnalysisPrompt(
      input.inventionDescription,
      elements,
      input.reference
    );
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<CoverageAnalysisOutput>(text);
  }

  // ==========================================================================
  // Coverage matrix batch — ALL references in ONE call (step 11 fast path)
  // Replaces 6 serial calls + 130s of delays with a single Sonnet call.
  // ==========================================================================

  async analyzeCoverageMatrix(
    inventionDescription: string,
    novelElements: NovelElement[],
    references: BatchCoverageRef[]
  ): Promise<Record<string, Record<string, CoverageCell>>> {
    const elements = novelElements.map((e) => ({
      id: e.id,
      label: e.label,
      claimLanguage: e.claimLanguage,
    }));

    const prompt = buildCoverageMatrixBatchPrompt(inventionDescription, elements, references);
    const { text } = await this.chat(prompt, MAX_TOKENS_REPORT);

    const raw = this.parseJSON<Record<string, Record<string, {
      state: string;
      reasoning: string;
      confidenceScore: number;
      evidence?: string;
    }>>>(text);

    // Normalize to CoverageCell shape
    const result: Record<string, Record<string, CoverageCell>> = {};
    for (const [elementId, refs] of Object.entries(raw)) {
      result[elementId] = {};
      for (const [refId, cell] of Object.entries(refs)) {
        result[elementId][refId] = {
          state: cell.state as CoverageCell['state'],
          reasoning: cell.reasoning ?? '',
          confidenceScore: cell.confidenceScore ?? 50,
          evidence: cell.evidence ?? '',
          claimCitation: undefined,
          figureReferences: [],
        };
      }
    }
    return result;
  }

  // ==========================================================================
  // NPL reference analysis — uses Haiku (~20x cheaper than Sonnet)
  // ==========================================================================

  async analyzeNPLReference(
    inventionDescription: string,
    nplTitle: string,
    nplAbstract: string,
    nplSource: string
  ) {
    const prompt = buildNPLAnalysisPrompt(inventionDescription, nplTitle, nplAbstract, nplSource);
    // Haiku handles factual similarity comparison perfectly and costs ~20x less
    const { text } = await this.chat(prompt, 1024, true);
    return this.parseJSON<{
      similarityScore: number;
      similarities: string[];
      differences: string[];
      noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
      analysis: string;
      anticipationRisk: number;
      obviousnessRisk: number;
      isSuitable103Combination: boolean;
      disclosureNote: string;
    }>(text);
  }

  // ==========================================================================
  // Examiner simulation (step 13)
  // ==========================================================================

  async simulateExaminer(input: ExaminerSimulationInput): Promise<ExaminerPrediction> {
    const prompt = buildExaminerSimulationPrompt(
      input.inventionTitle,
      input.inventionDescription,
      input.technicalField,
      input.novelElements.map((e) => ({ id: e.id, claimLanguage: e.claimLanguage })),
      input.topPatents.slice(0, 8).map((p) => p.publicationNumber),
      input.topPatents.slice(0, 8).map((p) => p.title),
      input.cpcCodes
    );
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<ExaminerPrediction>(text);
  }

  // ==========================================================================
  // Gap-grounded claim drafting (step 13b)
  // ==========================================================================

  async generateGapGroundedClaims(input: GapClaimDraftInput): Promise<GapGroundedClaimDraft> {
    const coverageSummary = buildCoverageSummary(input.novelElements, input.coverageMatrix);

    const topPatentsStr = input.topPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (impact: ${p.noveltyImpact})`
    ).join('\n');

    const prompt = buildGapGroundedClaimDraftingPrompt(
      input.inventionTitle,
      input.inventionDescription,
      input.technicalField,
      input.novelElements,
      coverageSummary,
      topPatentsStr
    );
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<GapGroundedClaimDraft>(text);
  }

  // ==========================================================================
  // IDS analysis — kept for interface compliance but no longer called by pipeline
  // (pipeline uses template-based IDS directly — zero cost, same quality)
  // ==========================================================================

  async generateIDSAnalysis(input: IDSAnalysisInput): Promise<IDSEntry[]> {
    const refs = [
      ...input.patents.slice(0, 15).map((p) => ({
        id: p.publicationNumber,
        type: 'patent' as const,
        number: p.publicationNumber,
        title: p.title,
        abstract: p.abstract,
        noveltyImpact: p.noveltyImpact,
      })),
      ...input.nplReferences.slice(0, 10).map((n) => ({
        id: n.id,
        type: 'npl' as const,
        title: n.title,
        abstract: n.abstract,
      })),
    ];

    if (refs.length === 0) return [];

    const prompt = buildIDSAnalysisPrompt(input.inventionDescription, refs);
    const { text } = await this.chat(prompt, MAX_TOKENS);

    const rawAnalysis = this.parseJSON<Array<{
      id: string;
      relevanceScore: number;
      risk102: number;
      risk103: number;
      examinerCitationProbability: number;
      disclosureReason: string;
    }>>(text);

    return rawAnalysis.map((analysis) => {
      const patent = input.patents.find((p) => p.publicationNumber === analysis.id);
      const npl    = input.nplReferences.find((n) => n.id === analysis.id);

      if (patent) {
        return {
          id: analysis.id, type: 'patent' as const,
          patentNumber: patent.publicationNumber, title: patent.title,
          assignee: patent.assignees[0], publicationDate: patent.grantDate ?? patent.filingDate,
          country: patent.countryCode, url: patent.url, source: 'BigQuery/PatentsView',
          relevanceScore: analysis.relevanceScore, risk102: analysis.risk102,
          risk103: analysis.risk103, examinerCitationProbability: analysis.examinerCitationProbability,
          disclosureReason: analysis.disclosureReason,
        };
      }
      if (npl) {
        return {
          id: analysis.id, type: 'npl' as const,
          title: npl.title, authors: npl.authors, publicationDate: npl.publicationDate,
          url: npl.url, doi: npl.doi, source: npl.source,
          relevanceScore: analysis.relevanceScore, risk102: analysis.risk102,
          risk103: analysis.risk103, examinerCitationProbability: analysis.examinerCitationProbability,
          disclosureReason: analysis.disclosureReason,
        };
      }
      return {
        id: analysis.id, type: 'patent' as const, title: 'Unknown Reference',
        publicationDate: '', relevanceScore: analysis.relevanceScore,
        risk102: analysis.risk102, risk103: analysis.risk103,
        examinerCitationProbability: analysis.examinerCitationProbability,
        disclosureReason: analysis.disclosureReason,
      };
    });
  }

  // ==========================================================================
  // Full report generation (step 10 + 14)
  // ==========================================================================

  async summarizePatent(input: PatentSummaryInput): Promise<string> {
    const { text } = await this.chat(
      `Summarize this patent in 2-3 sentences for a prior art search context:\n\nTitle: ${input.title}\nAbstract: ${input.abstract}`
    );
    return text.trim();
  }

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    const scoredPatents: ScoredPatent[] = [];

    // Score top 8 candidate patents sequentially — 5 RPM org limit
    const candidates = input.candidatePatents.slice(0, 8);

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
        console.warn(`[Claude] Skipping patent ${p.publicationNumber}: ${(err as Error).message.slice(0, 80)}`);
      }
      if (i < candidates.length - 1) {
        await new Promise((r) => setTimeout(r, AI_RATE_DELAY_MS));
      }
    }

    scoredPatents.sort((a, b) => b.similarityScore - a.similarityScore);
    scoredPatents.forEach((p, idx) => { p.rank = idx + 1; });

    const topPatentsStr = scoredPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (Similarity: ${p.similarityScore}%)\n` +
      `   Assignee: ${p.assignees[0] ?? 'N/A'} | Filed: ${p.filingDate}\n` +
      `   Impact: ${p.noveltyImpact} | Key similarity: ${p.similarities[0] ?? 'N/A'}`
    ).join('\n\n');

    const nplSummary     = buildNPLSummary(input.nplReferences ?? []);
    const coverageSummary = input.novelElements && input.novelElements.length > 0
      ? buildCoverageSummary(input.novelElements, undefined)
      : undefined;

    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle, input.inventionDescription,
      input.technicalField ?? 'Technology', input.keyInnovations,
      topPatentsStr, input.reportStyle, nplSummary, coverageSummary
    );

    const { text } = await this.chat(reportPrompt, MAX_TOKENS_REPORT);

    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text);

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: this.totalTokensUsed,
      costUsd: this.estimatedCostUsd,
      model: CLAUDE_MODEL,
      provider: 'claude',
    };
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

function buildCoverageSummary(
  elements: NovelElement[],
  coverageMatrix: import('@priovex/types').CoverageMatrix | undefined
): string {
  if (!coverageMatrix) {
    return elements.map((e) =>
      `Element [${e.label}] "${e.claimLanguage.slice(0, 80)}..." — Coverage: pending analysis`
    ).join('\n');
  }

  return elements.map((e) => {
    const cells       = coverageMatrix.cells[e.id] ?? {};
    const allStates   = Object.values(cells).map((c) => c.state);
    const notCovered  = allStates.filter((s) => s === 'not_covered').length;
    const fullCovered = allStates.filter((s) => s === 'fully_covered').length;
    const total       = allStates.length;

    const summary = total === 0
      ? 'not analyzed'
      : notCovered === total ? 'NOT COVERED in any reference'
      : fullCovered === total ? 'FULLY COVERED in all references'
      : `partially covered (${fullCovered}/${total} references cover it fully)`;

    return `Element [${e.label}] "${e.claimLanguage.slice(0, 80)}..." — ${summary}`;
  }).join('\n');
}

function repairTruncatedJSON(s: string): string {
  let inString = false;
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && inString) { i += 2; continue; }
    if (s[i] === '"') inString = !inString;
    i++;
  }
  let result = inString ? s + '"' : s;

  const stack: string[] = [];
  inString = false;
  for (let j = 0; j < result.length; j++) {
    if (result[j] === '\\' && inString) { j++; continue; }
    if (result[j] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (result[j] === '{') stack.push('}');
    else if (result[j] === '[') stack.push(']');
    else if (result[j] === '}' || result[j] === ']') stack.pop();
  }

  result = result.replace(/,\s*$/, '');
  return result + stack.reverse().join('');
}
