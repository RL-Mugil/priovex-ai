import type {
  AIAnalysisInput,
  AIAnalysisOutput,
  PatentSummaryInput,
  ComparisonInput,
  ComparisonOutput,
  ConceptExtraction,
  KeywordStrategy,
} from '@priovex/types';

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction>;

  buildKeywordStrategy(
    concepts: ConceptExtraction,
    technicalField: string
  ): Promise<KeywordStrategy>;

  compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput>;

  generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput>;

  summarizePatent(input: PatentSummaryInput): Promise<string>;
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

      console.warn(
        `[AI] ${context} failed (attempt ${attempt}/${config.maxRetries + 1}): ${lastError.message}. Retrying in ${delay}ms...`
      );

      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * config.backoffFactor, config.maxDelayMs);
    }
  }

  throw new Error(`[AI] ${context} failed after ${config.maxRetries + 1} attempts: ${lastError?.message}`);
}
