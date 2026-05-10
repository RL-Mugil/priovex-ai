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
import { withRetry, AI_RATE_DELAY_MS } from './interface';
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

const GEMINI_MODEL       = 'gemini-2.0-flash';
const MAX_TOKENS         = 8192;
const MAX_TOKENS_REPORT  = 16000;

export class GeminiProvider implements AIProvider {
  readonly name = 'Google Gemini';
  readonly model = GEMINI_MODEL;
  readonly providerType = 'gemini' as const;

  private genAI: GoogleGenerativeAI;
  private totalTokensUsed = 0;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async chat(userMessage: string, maxTokens = MAX_TOKENS): Promise<{ text: string; tokens: number }> {
    return withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_MODEL,
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

      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      const tokens = result.response.usageMetadata?.totalTokenCount ?? 0;
      this.totalTokensUsed += tokens;
      return { text, tokens };
    }, undefined, 'Gemini chat');
  }

  private parseJSON<T>(text: string): T {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(clean) as T; } catch { /* fall through */ }
    const match = clean.match(/^[\s\S]*?([\[{][\s\S]*[\]}])/);
    const candidate = match ? match[1] : clean;
    try { return JSON.parse(candidate) as T; } catch { /* fall through */ }
    throw new Error(`Failed to parse Gemini JSON response (${clean.length} chars): ${clean.slice(0, 300)}`);
  }

  async extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction> {
    const prompt = buildConceptExtractionPrompt(inventionTitle, inventionDescription, technicalField, keyInnovations);
    const { text } = await this.chat(prompt);
    return this.parseJSON<ConceptExtraction>(text);
  }

  async buildKeywordStrategy(concepts: ConceptExtraction, technicalField: string): Promise<KeywordStrategy> {
    const prompt = buildKeywordStrategyPrompt(JSON.stringify(concepts), technicalField);
    const { text } = await this.chat(prompt);
    return this.parseJSON<KeywordStrategy>(text);
  }

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

  async summarizePatent(input: PatentSummaryInput): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(
      `Summarize in 2-3 sentences:\nTitle: ${input.title}\nAbstract: ${input.abstract}`
    );
    return result.response.text().trim();
  }

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    const scoredPatents: ScoredPatent[] = [];

    // Score top 15 candidates sequentially — avoids provider RPM limits
    const candidates = input.candidatePatents.slice(0, 15);

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
        console.warn(`[Gemini] Skipping patent ${p.publicationNumber}: ${(err as Error).message.slice(0, 80)}`);
      }
      if (i < candidates.length - 1) {
        await new Promise((r) => setTimeout(r, AI_RATE_DELAY_MS));
      }
    }

    scoredPatents.sort((a, b) => b.similarityScore - a.similarityScore);
    scoredPatents.forEach((p, idx) => { p.rank = idx + 1; });

    const topPatentsStr = scoredPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (Similarity: ${p.similarityScore}%)
   Assignee: ${p.assignees[0] ?? 'N/A'} | Filed: ${p.filingDate}
   Impact: ${p.noveltyImpact}
   Key similarity: ${p.similarities[0] ?? 'N/A'}`
    ).join('\n\n');

    const nplSummary = buildNPLSummary(input.nplReferences ?? []);
    const coverageSummary = input.novelElements && input.novelElements.length > 0
      ? buildCoverageSummary(input.novelElements)
      : undefined;

    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle,
      input.inventionDescription,
      input.technicalField ?? 'Technology',
      input.keyInnovations,
      topPatentsStr,
      input.reportStyle,
      nplSummary,
      coverageSummary
    );

    const { text } = await this.chat(reportPrompt, MAX_TOKENS_REPORT);

    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text);

    const costUsd = (this.totalTokensUsed / 1_000_000) * 0.15;

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: this.totalTokensUsed,
      costUsd,
      model: GEMINI_MODEL,
      provider: 'gemini',
    };
  }

  async decomposeNovelElements(input: NovelElementDecompositionInput): Promise<NovelElementDecompositionOutput> {
    const prompt = buildNovelElementDecompositionPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.problemSolved, input.keyInnovations, input.claimsDraft
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<NovelElementDecompositionOutput>(text);
  }

  async analyzeCoverageForReference(input: CoverageAnalysisInput): Promise<CoverageAnalysisOutput> {
    const elements = input.novelElements.map((e) => ({ id: e.id, label: e.label, claimLanguage: e.claimLanguage }));
    const prompt = buildCoverageAnalysisPrompt(input.inventionDescription, elements, input.reference);
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<CoverageAnalysisOutput>(text);
  }

  async analyzeNPLReference(
    inventionDescription: string, nplTitle: string, nplAbstract: string, nplSource: string
  ) {
    const prompt = buildNPLAnalysisPrompt(inventionDescription, nplTitle, nplAbstract, nplSource);
    const { text } = await this.chat(prompt);
    return this.parseJSON<{
      similarityScore: number; similarities: string[]; differences: string[];
      noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
      analysis: string; anticipationRisk: number; obviousnessRisk: number;
      isSuitable103Combination: boolean; disclosureNote: string;
    }>(text);
  }

  async simulateExaminer(input: ExaminerSimulationInput): Promise<ExaminerPrediction> {
    const prompt = buildExaminerSimulationPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.novelElements.map((e) => ({ id: e.id, claimLanguage: e.claimLanguage })),
      input.topPatents.slice(0, 8).map((p) => p.publicationNumber),
      input.topPatents.slice(0, 8).map((p) => p.title),
      input.cpcCodes
    );
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<ExaminerPrediction>(text);
  }

  async generateGapGroundedClaims(input: GapClaimDraftInput): Promise<GapGroundedClaimDraft> {
    const topPatentsStr = input.topPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (impact: ${p.noveltyImpact})`
    ).join('\n');
    const prompt = buildGapGroundedClaimDraftingPrompt(
      input.inventionTitle, input.inventionDescription, input.technicalField,
      input.novelElements, buildCoverageSummary(input.novelElements), topPatentsStr
    );
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<GapGroundedClaimDraft>(text);
  }

  async analyzeCoverageMatrix(
    inventionDescription: string,
    novelElements: NovelElement[],
    references: BatchCoverageRef[]
  ): Promise<Record<string, Record<string, CoverageCell>>> {
    const prompt = buildCoverageMatrixBatchPrompt(inventionDescription, novelElements, references);
    const { text } = await this.chat(prompt, MAX_TOKENS_REPORT);

    let raw: Record<string, Record<string, { state: string; reasoning: string; confidenceScore: number; evidence: string }>> = {};
    try {
      raw = this.parseJSON(text);
    } catch {
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
    const { text } = await this.chat(prompt, MAX_TOKENS);
    return this.parseJSON<IDSEntry[]>(text);
  }
}

// =============================================================================
// Helpers (mirrors claude.ts)
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
