export type SearchDepth = 'quick' | 'standard' | 'thorough';
export type ReportStyle = 'legal' | 'technical' | 'investor' | 'concise' | 'comprehensive';
export type AIProvider = 'claude' | 'openai' | 'gemini';
export type Jurisdiction = 'US' | 'EP' | 'WO' | 'CN' | 'JP' | 'KR' | 'GB' | 'DE' | 'FR';

export type SearchStatus =
  | 'queued'
  | 'extracting'
  | 'keyword-strategy'
  | 'broad-search'
  | 'cpc-identification'
  | 'deep-cpc-search'
  | 'timeline-analysis'
  | 'ai-analysis'
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
  aiProvider: AIProvider;
  reportStyle: ReportStyle;
  uploadedDocumentIds?: string[];
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
}

export interface ConceptExtraction {
  coreConceptss: string[];
  technicalEntities: string[];
  problemDomain: string;
  solutionApproach: string;
  keyFeatures: string[];
  embeddings?: number[];
}
