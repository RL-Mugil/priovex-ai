// ============================================================
// PATENT TYPES
// ============================================================

export interface RawPatent {
  publicationNumber: string;
  title: string;
  abstract: string;
  claims?: string;
  fullClaims?: StructuredClaim[];
  description?: string;
  filingDate: string;
  grantDate?: string;
  priorityDate?: string;
  assignees: string[];
  inventors: string[];
  cpcCodes: string[];
  ipcCodes: string[];
  countryCode: string;
  familyId?: string;
  citationCount?: number;
  url: string;
}

export interface StructuredClaim {
  sequence: number;
  text: string;
  dependentOn: number | null;
  isIndependent: boolean;
}

export interface ScoredPatent extends RawPatent {
  relevanceScore: number;
  similarityScore: number;
  noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
  similarities: string[];
  differences: string[];
  analysis: string;
  rank: number;
  elementCoverage?: ElementCoverage[];
}

export interface ElementCoverage {
  elementId: string;
  elementLabel: string;
  state: CoverageState;
  reasoning: string;
  confidenceScore: number;
  evidence: string;
  claimCitation?: string;
}

export interface CPCCode {
  code: string;
  description: string;
  level: 'section' | 'class' | 'subclass' | 'group' | 'subgroup';
  patentCount?: number;
}

export interface TimelineEntry {
  year: number;
  filingCount: number;
  grantCount: number;
  topAssignees: string[];
  emergingTechnologies: string[];
}

export interface AssigneeAnalysis {
  name: string;
  patentCount: number;
  filingTrend: 'increasing' | 'stable' | 'decreasing';
  dominantCPCs: string[];
  recentFilings: number;
}

// ============================================================
// NOVEL ELEMENT DECOMPOSITION
// ============================================================

export interface NovelElement {
  id: string;                  // "elem_a", "elem_b", etc.
  label: string;               // "a", "b", "c"
  component: string;           // "distributed inference engine"
  function: string;            // "dynamically allocate AI models"
  technicalPurpose: string;    // why this element matters
  interaction: string;         // how it interacts with other elements
  noveltyWeight: number;       // 0–100, estimated novelty contribution
  searchKeywords: string[];    // derived search terms for this element
  cpcMapping: string[];        // likely CPC codes for this element
  claimLanguage: string;       // Full claim-like sentence: "A [X] configured to [Y]..."
}

// ============================================================
// COVERAGE MATRIX
// ============================================================

export type CoverageState =
  | 'fully_covered'
  | 'partially_covered'
  | 'implied'
  | 'not_covered'
  | 'ambiguous';

export interface CoverageCell {
  state: CoverageState;
  reasoning: string;
  confidenceScore: number;      // 0–100
  evidence: string;             // direct quote or paragraph from reference
  claimCitation?: string;       // e.g., "Claim 1, limitation b"
  figureReferences?: string[];  // e.g., ["FIG. 3", "FIG. 5"]
}

export interface CoverageReference {
  id: string;
  number: string;               // Patent number or NPL ID
  title: string;
  type: 'patent' | 'npl';
  assignee?: string;
  date?: string;
}

export interface CoverageMatrix {
  elements: NovelElement[];
  references: CoverageReference[];
  cells: Record<string, Record<string, CoverageCell>>; // elementId → refId → cell
  generatedAt: string;
}

// ============================================================
// NPL REFERENCES
// ============================================================

export type NPLSource =
  | 'arxiv'
  | 'semantic_scholar'
  | 'ieee'
  | 'google_scholar'
  | 'pubmed'
  | 'patents_view'
  | 'uspto_efts'
  | 'other';

export interface NPLReference {
  id: string;
  source: NPLSource;
  title: string;
  authors: string[];
  abstract: string;
  publicationDate: string;
  url: string;
  doi?: string;
  arxivId?: string;
  relevanceScore: number;       // 0–100
  bm25Score?: number;
  categories?: string[];
  citationCount?: number;
  relevantExtracts?: string[];
  noveltyImpact?: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
  similarities?: string[];
  differences?: string[];
  analysis?: string;
  elementCoverage?: ElementCoverage[];
}

// ============================================================
// IDS ENTRIES
// ============================================================

export interface IDSEntry {
  id: string;
  type: 'patent' | 'npl';
  patentNumber?: string;         // e.g., "US10123456"
  title: string;
  assignee?: string;
  authors?: string[];
  publicationDate: string;
  country?: string;
  url?: string;
  doi?: string;
  source?: string;               // "USPTO", "arXiv", "IEEE", etc.
  relevanceScore: number;        // 0–100
  risk102: number;               // anticipation risk 0–100
  risk103: number;               // obviousness risk 0–100
  examinerCitationProbability: number; // 0–100
  disclosureReason: string;      // why this must be disclosed
}

// ============================================================
// EXAMINER SIMULATION
// ============================================================

export interface ExaminerPrediction {
  likelyRejectionBasis: string[];          // e.g., ["102(a)(1)", "103"]
  predictedCitedReferences: string[];      // patent numbers likely cited
  cpcClassesLikelySearched: string[];
  closestArtCluster: string;               // description of where closest art lives
  likelyObjectionPathways: string[];
  enablementRisks: string[];
  section112Risks: string[];
  firstOfficeActionScenario: {
    predictedReferences: string[];
    rejectionBasis: string;
    mappedClaims: number[];
    responseStrategy: string;
    estimatedAllowanceChance: number;      // 0–100
  };
  examinersLikelySearch: string;           // narrative of what the examiner will do
}

// ============================================================
// GAP-GROUNDED CLAIM DRAFTS
// ============================================================

export interface GapGroundedClaimDraft {
  independentClaims: DraftClaim[];
  dependentClaims: DraftClaim[];
  narrowAroundGuidance: NarrowAroundEntry[];
  dependentClaimOpportunities: DependentClaimOpportunity[];
  prosecutionNotes: string;
}

export interface DraftClaim {
  number: number;
  text: string;
  type: 'system' | 'method' | 'apparatus' | 'cmu';
  rationale: string;            // why this claim angle is strong
  gapBasis: string;             // which element gaps support this claim
  vulnerabilities: string[];    // known prior art risks
}

export interface NarrowAroundEntry {
  referenceNumber: string;
  overlappingElement: string;
  distinguishingFeature: string;
  suggestedLanguage: string;
}

export interface DependentClaimOpportunity {
  feature: string;
  basis: string;                // "Novel, not in any prior art" | "Specific embodiment novel"
  suggestedText: string;
}
