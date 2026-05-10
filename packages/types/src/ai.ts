import type { ScoredPatent, NPLReference, NovelElement, CoverageMatrix, IDSEntry, ExaminerPrediction, GapGroundedClaimDraft } from './patent';
import type { PatentabilityAssessment, ClaimStrategy, SearchStatistics } from './report';
import type { ConceptExtraction, KeywordStrategy, ReportStyle, SearchType } from './search';

export interface AIAnalysisInput {
  inventionTitle: string;
  inventionDescription: string;
  technicalField: string;
  keyInnovations: string[];
  candidatePatents: ScoredPatent[];
  nplReferences?: NPLReference[];
  novelElements?: NovelElement[];
  reportStyle: ReportStyle;
  searchType?: SearchType;
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

export interface NovelElementDecompositionInput {
  inventionTitle: string;
  inventionDescription: string;
  technicalField: string;
  problemSolved: string;
  keyInnovations: string[];
  claimsDraft?: string;
}

export interface NovelElementDecompositionOutput {
  elements: NovelElement[];
  systemClaimDraft: string;
  methodClaimDraft: string;
  searchConcepts: Array<{
    concept: string;
    keywords: string[];
  }>;
}

export interface CoverageAnalysisInput {
  inventionDescription: string;
  novelElements: NovelElement[];
  reference: {
    id: string;
    number: string;
    title: string;
    abstract: string;
    claims?: string;
    type: 'patent' | 'npl';
  };
}

export interface CoverageAnalysisOutput {
  referenceId: string;
  cells: Record<string, {   // elementId → coverage cell
    state: 'fully_covered' | 'partially_covered' | 'implied' | 'not_covered' | 'ambiguous';
    reasoning: string;
    confidenceScore: number;
    evidence: string;
    claimCitation?: string;
  }>;
}

export interface ExaminerSimulationInput {
  inventionTitle: string;
  inventionDescription: string;
  technicalField: string;
  novelElements: NovelElement[];
  topPatents: ScoredPatent[];
  cpcCodes: string[];
}

export interface IDSAnalysisInput {
  inventionDescription: string;
  patents: ScoredPatent[];
  nplReferences: NPLReference[];
}

export interface GapClaimDraftInput {
  inventionTitle: string;
  inventionDescription: string;
  technicalField: string;
  novelElements: NovelElement[];
  coverageMatrix: CoverageMatrix;
  topPatents: ScoredPatent[];
  nplReferences: NPLReference[];
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
  novelElements?: NovelElement[];
}

export interface ComparisonOutput {
  similarityScore: number;
  similarities: string[];
  differences: string[];
  noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
  analysis: string;
}
