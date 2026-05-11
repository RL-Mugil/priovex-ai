import type {
  AIAnalysisInput,
  AIAnalysisOutput,
  PatentSummaryInput,
  ComparisonInput,
  ComparisonOutput,
  ConceptExtraction,
  KeywordStrategy,
  NovelElementDecompositionInput,
  NovelElementDecompositionOutput,
  CoverageAnalysisInput,
  CoverageAnalysisOutput,
  ExaminerSimulationInput,
  GapClaimDraftInput,
  IDSAnalysisInput,
  NovelElement,
} from '@priovex/types';
import type {
  ExaminerPrediction,
  GapGroundedClaimDraft,
  IDSEntry,
  CoverageCell,
  AIProvider as AIProviderType,
} from '@priovex/types';

export type BatchCoverageRef = {
  id: string;
  number: string;
  title: string;
  abstract: string;
  claims?: string;
  type: 'patent' | 'npl';
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly providerType: AIProviderType;

  // Core pipeline methods
  extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction>;

  decomposeNovelElements(
    input: NovelElementDecompositionInput
  ): Promise<NovelElementDecompositionOutput>;

  buildKeywordStrategy(
    concepts: ConceptExtraction,
    technicalField: string
  ): Promise<KeywordStrategy>;

  compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput>;

  analyzeCoverageForReference(input: CoverageAnalysisInput): Promise<CoverageAnalysisOutput>;

  analyzeNPLReference(
    inventionDescription: string,
    nplTitle: string,
    nplAbstract: string,
    nplSource: string
  ): Promise<{
    similarityScore: number;
    similarities: string[];
    differences: string[];
    noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
    analysis: string;
    anticipationRisk: number;
    obviousnessRisk: number;
    isSuitable103Combination: boolean;
    disclosureNote: string;
  }>;

  simulateExaminer(input: ExaminerSimulationInput): Promise<ExaminerPrediction>;

  generateGapGroundedClaims(input: GapClaimDraftInput): Promise<GapGroundedClaimDraft>;

  generateIDSAnalysis(input: IDSAnalysisInput): Promise<IDSEntry[]>;

  generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput>;

  summarizePatent(input: PatentSummaryInput): Promise<string>;

  // Optional — providers that support it implement for cost savings
  setSessionContext?(
    inventionTitle: string,
    inventionDescription: string,
    novelElements: NovelElement[]
  ): void;

  analyzeCoverageMatrix?(
    inventionDescription: string,
    novelElements: NovelElement[],
    references: BatchCoverageRef[]
  ): Promise<Record<string, Record<string, CoverageCell>>>;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context = 'AI call'
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt > config.maxRetries) break;

      // 429 rate-limit: sleep 70s to clear the 1-minute window before retrying
      const msg = lastError.message;
      const isRateLimit =
        msg.includes('rate_limit_error') ||
        msg.startsWith('429') ||
        msg.includes('[429') ||               // Google SDK: "[429 Too Many Requests]"
        msg.includes('Too Many Requests') ||
        msg.includes('RESOURCE_EXHAUSTED') || // Google Gemini quota exhausted
        msg.includes('rate limit') ||
        msg.includes('Rate limit');
      const retryDelay = isRateLimit ? 70_000 : delay;

      console.warn(
        `[AI] ${context} failed (attempt ${attempt}/${config.maxRetries + 1}): ${msg.slice(0, 180)}. Retrying in ${Math.round(retryDelay / 1000)}s...`
      );

      await new Promise((r) => setTimeout(r, retryDelay));
      if (!isRateLimit) delay = Math.min(delay * config.backoffFactor, config.maxDelayMs);
    }
  }

  throw new Error(`[AI] ${context} failed after ${config.maxRetries + 1} attempts: ${lastError?.message}`);
}

/** Pause between sequential AI calls to stay under rate limits (5 RPM = 12s/req). */
export const AI_RATE_DELAY_MS = 13_000;
