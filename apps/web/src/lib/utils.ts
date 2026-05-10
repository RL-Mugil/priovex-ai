import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    QUEUED: 'text-slate-500 bg-slate-100',
    EXTRACTING: 'text-blue-600 bg-blue-50',
    NOVEL_ELEMENTS: 'text-blue-600 bg-blue-50',
    KEYWORD_STRATEGY: 'text-blue-600 bg-blue-50',
    BROAD_SEARCH: 'text-purple-600 bg-purple-50',
    CPC_IDENTIFICATION: 'text-indigo-600 bg-indigo-50',
    DEEP_CPC_SEARCH: 'text-indigo-600 bg-indigo-50',
    NPL_SEARCH: 'text-violet-600 bg-violet-50',
    CLAIMS_RETRIEVAL: 'text-violet-600 bg-violet-50',
    TIMELINE_ANALYSIS: 'text-cyan-600 bg-cyan-50',
    AI_SCORING: 'text-amber-600 bg-amber-50',
    COVERAGE_ANALYSIS: 'text-amber-600 bg-amber-50',
    IDS_GENERATION: 'text-orange-600 bg-orange-50',
    EXAMINER_SIMULATION: 'text-orange-600 bg-orange-50',
    GENERATING_REPORT: 'text-orange-600 bg-orange-50',
    COMPLETED: 'text-green-600 bg-green-50',
    FAILED: 'text-red-600 bg-red-50',
    CANCELLED: 'text-slate-500 bg-slate-100',
  };
  return colors[status] ?? 'text-slate-500 bg-slate-100';
}

export function getVerdictColor(verdict: string): string {
  const colors: Record<string, string> = {
    PROCEED: 'text-green-700 bg-green-50 border-green-200',
    PROCEED_WITH_CAUTION: 'text-amber-700 bg-amber-50 border-amber-200',
    REFINE_FIRST: 'text-orange-700 bg-orange-50 border-orange-200',
    UNLIKELY: 'text-red-700 bg-red-50 border-red-200',
  };
  return colors[verdict] ?? 'text-slate-700 bg-slate-50 border-slate-200';
}

export function humanizeStatus(status: string): string {
  const labels: Record<string, string> = {
    QUEUED: 'Queued',
    EXTRACTING: 'Extracting Concepts',
    NOVEL_ELEMENTS: 'Decomposing Novel Elements',
    KEYWORD_STRATEGY: 'Building Keyword Strategy',
    BROAD_SEARCH: 'Broad Patent Search',
    CPC_IDENTIFICATION: 'CPC Code Identification',
    DEEP_CPC_SEARCH: 'Deep CPC Search',
    NPL_SEARCH: 'NPL Intelligence Search',
    CLAIMS_RETRIEVAL: 'Full Claims Retrieval',
    TIMELINE_ANALYSIS: 'Timeline & Assignee Analysis',
    AI_SCORING: 'AI Relevance Scoring',
    COVERAGE_ANALYSIS: 'Feature Coverage Matrix',
    IDS_GENERATION: 'IDS Generation',
    EXAMINER_SIMULATION: 'Examiner Simulation',
    GENERATING_REPORT: 'Generating Dual Reports',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] ?? status;
}
