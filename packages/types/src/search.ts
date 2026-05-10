export type SearchDepth = 'quick' | 'standard' | 'thorough';
export type ReportStyle = 'legal' | 'technical' | 'investor' | 'concise' | 'comprehensive';
export type AIProvider = 'claude' | 'openai' | 'gemini';
export type Jurisdiction = 'US' | 'EP' | 'WO' | 'CN' | 'JP' | 'KR' | 'GB' | 'DE' | 'FR';
export type SearchType = 'patentability' | 'invalidity' | 'fto' | 'novelty' | 'examiner_style';

export type SearchStatus =
  | 'queued'
  | 'extracting'
  | 'novel-elements'
  | 'keyword-strategy'
  | 'broad-search'
  | 'cpc-identification'
  | 'deep-cpc-search'
  | 'npl-search'
  | 'claims-retrieval'
  | 'timeline-analysis'
  | 'ai-scoring'
  | 'coverage-analysis'
  | 'ids-generation'
  | 'examiner-simulation'
  | 'generating-report'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SearchInput {
  title: string;
  description: string;
  technicalField: string;
  problemSolved: string;
  keyInnovations: string[];
  claimsDraft?: string;
  jurisdictions: Jurisdiction[];
  depth: SearchDepth;
  searchType?: SearchType;
  aiProvider: AIProvider;
  reportStyle: ReportStyle;
  uploadedDocumentIds?: string[];
  confidentialMode?: boolean;
}

export interface SearchProgress {
  searchId: string;
  status: SearchStatus;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  stepDescription: string;
  progressPercent: number;
  patentsFound: number;
  patentsAnalyzed: number;
  nplFound: number;
  estimatedMinutesRemaining: number;
  logs: ProgressLog[];
  startedAt: string;
  updatedAt: string;
}

export interface ProgressLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface KeywordStrategy {
  primaryKeywords: string[];
  synonyms: string[];
  adjacentTerms: string[];
  semanticVariants: string[];
  technicalTerms: string[];
  cpcHints: string[];
  searchQueries: string[];
  nplQueries: string[];       // NPL-optimized search strings
  claimsTerms: string[];      // Claims-language terms for USPTO EFTS
}

export interface ConceptExtraction {
  coreConcepts: string[];
  technicalEntities: string[];
  problemDomain: string;
  solutionApproach: string;
  keyFeatures: string[];
  embeddings?: number[];
}
