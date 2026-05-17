import type {
  ScoredPatent,
  TimelineEntry,
  AssigneeAnalysis,
  CPCCode,
  NovelElement,
  NPLReference,
  CoverageMatrix,
  IDSEntry,
  ExaminerPrediction,
  GapGroundedClaimDraft,
} from './patent';
import type { AIProvider, ReportStyle, KeywordStrategy, ConceptExtraction, SearchType } from './search';

export type NoveltyRating = 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'MEDIUM-LOW' | 'LOW';
export type PatentabilityVerdict = 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'REFINE_FIRST' | 'UNLIKELY';

export interface PatentabilityAssessment {
  overallVerdict: PatentabilityVerdict;
  noveltyRating: NoveltyRating;
  noveltyAnalysis: string;
  obviousnessRating: NoveltyRating;
  obviousnessAnalysis: string;
  patentabilityScore: number;
  keyRisks: string[];
  keyOpportunities: string[];
  whiteSpaceAreas: string[];
  recommendedClaimScope: 'broad' | 'moderate' | 'narrow';
  featureCoverageObservations: string[];  // Per-element coverage summary
}

export interface ClaimStrategy {
  independentClaimSuggestion: string;
  dependentClaimSuggestions: string[];
  claimingApproach: string;
  elementsToEmphasize: string[];
  elementsToAvoid?: string[];
  prosecutionStrategy: string;
}

export interface ClientSummary {
  isPatentable: boolean;
  confidence: 'high' | 'medium' | 'low';
  plainVerdict: string;
  reason: string;
  mainRisk: string;
  nextStep: string;
}

export interface SearchStatistics {
  totalPatentsReviewed: number;
  relevantPatentsFound: number;
  topPriorArtSelected: number;
  keywordsSearched: string[];
  cpcCodesSearched: string[];
  jurisdictionsCovered: string[];
  bigQueryBytesProcessed: number;
  searchDurationSeconds: number;
  aiProvider: AIProvider;
  aiTokensUsed: number;
  aiCostUsd: number;
  // NPL stats
  nplSourcesSearched: string[];
  nplReferencesFound: number;
  nplReferencesAnalyzed: number;
  // Coverage stats
  novelElementsDecomposed: number;
  coverageMatrixSize: string;     // e.g., "8 elements × 15 references"
  // IDS stats
  idsEntriesGenerated: number;
}

export interface PatentReport {
  id: string;
  searchId: string;
  generatedAt: string;
  inventionTitle: string;
  inventionDescription: string;
  reportStyle: ReportStyle;
  searchType: SearchType;

  executiveSummary: string;
  patentabilityAssessment: PatentabilityAssessment;
  claimStrategy: ClaimStrategy;
  clientSummary?: ClientSummary;

  // v2 — Intelligence layers
  novelElements: NovelElement[];
  nplReferences: NPLReference[];
  coverageMatrix: CoverageMatrix;
  idsEntries: IDSEntry[];
  examinerPrediction: ExaminerPrediction;
  gapClaimDraft: GapGroundedClaimDraft;

  conceptExtraction: ConceptExtraction;
  keywordStrategy: KeywordStrategy;

  topPriorArt: ScoredPatent[];
  allRelevantPatents: ScoredPatent[];
  cpcCodesAnalyzed: CPCCode[];
  timelineAnalysis: TimelineEntry[];
  assigneeAnalysis: AssigneeAnalysis[];

  statistics: SearchStatistics;
  idsReferences: string[];

  // Dual reports
  markdownContent: string;           // Internal technical report
  htmlContent?: string;
  clientReportContent: string;       // Clean client supplementary report
  clientReportHtml?: string;
  pdfStorageUrl?: string;
  clientPdfStorageUrl?: string;
  jsonStorageUrl?: string;
}
