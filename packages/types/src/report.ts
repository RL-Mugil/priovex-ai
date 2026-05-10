import type { ScoredPatent, TimelineEntry, AssigneeAnalysis, CPCCode } from './patent';
import type { AIProvider, ReportStyle, KeywordStrategy, ConceptExtraction } from './search';

export type NoveltyRating = 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'MEDIUM-LOW' | 'LOW';
export type PatentabilityVerdict = 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'REFINE_FIRST' | 'UNLIKELY';

export interface PatentabilityAssessment {
  overallVerdict: PatentabilityVerdict;
  noveltyRating: NoveltyRating;
  noveltyAnalysis: string;
  obviousnessRating: NoveltyRating;
  obviousnessAnalysis: string;
  patentabilityScore: number;   // 0–100
  keyRisks: string[];
  keyOpportunities: string[];
  whiteSpaceAreas: string[];
  recommendedClaimScope: 'broad' | 'moderate' | 'narrow';
}

export interface ClaimStrategy {
  independentClaimSuggestion: string;
  dependentClaimSuggestions: string[];
  claimingApproach: string;
  elementsToEmphasize: string[];
  elementsToAvoid: string[];
  prosecutionStrategy: string;
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
}

export interface PatentReport {
  id: string;
  searchId: string;
  generatedAt: string;
  inventionTitle: string;
  inventionDescription: string;
  reportStyle: ReportStyle;

  executiveSummary: string;
  patentabilityAssessment: PatentabilityAssessment;
  claimStrategy: ClaimStrategy;

  conceptExtraction: ConceptExtraction;
  keywordStrategy: KeywordStrategy;

  topPriorArt: ScoredPatent[];
  allRelevantPatents: ScoredPatent[];
  cpcCodesAnalyzed: CPCCode[];
  timelineAnalysis: TimelineEntry[];
  assigneeAnalysis: AssigneeAnalysis[];

  statistics: SearchStatistics;
  idsReferences: string[];       // For USPTO Information Disclosure Statement

  markdownContent: string;
  htmlContent?: string;
  pdfStorageUrl?: string;
  jsonStorageUrl?: string;
}
