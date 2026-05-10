export interface RawPatent {
  publicationNumber: string;
  title: string;
  abstract: string;
  claims?: string;
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

export interface ScoredPatent extends RawPatent {
  relevanceScore: number;        // 0–100
  similarityScore: number;       // 0–100
  noveltyImpact: 'blocking' | 'strong' | 'moderate' | 'weak' | 'minimal';
  similarities: string[];
  differences: string[];
  analysis: string;
  rank: number;
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
