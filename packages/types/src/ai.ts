import type { ScoredPatent } from './patent';
import type { PatentabilityAssessment, ClaimStrategy, SearchStatistics } from './report';
import type { ConceptExtraction, KeywordStrategy, ReportStyle } from './search';

export interface AIAnalysisInput {
  inventionTitle: string;
  inventionDescription: string;
  technicalField: string;
  keyInnovations: string[];
  candidatePatents: ScoredPatent[];
  reportStyle: ReportStyle;
}

export interface AIAnalysisOutput {
  executiveSummary: string;
  scoredPatents: ScoredPatent[];
  patentabilityAssessment: PatentabilityAssessment;
  claimStrategy: ClaimStrategy;
  tokensUsed: number;
  costUsd: number;
  model: string;
  provider: string;
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface PatentSummaryInput {
  publicationNumber: string;
  title: string;
  abstract: string;
  claims?: string;
}

export interface ComparisonInput {
  inventionDescription: string;
  patent: PatentSummaryInput;
}

export interface ComparisonOutput {
  similarityScore: number;
  similarities: string[];
  differences: string[];
  noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
  analysis: string;
}
