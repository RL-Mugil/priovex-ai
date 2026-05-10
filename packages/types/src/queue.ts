import type { SearchInput } from './search';
import type { AIProvider } from './search';

export interface SearchJobData {
  searchId: string;
  userId: string;
  organizationId?: string;
  input: SearchInput;
  retryCount: number;
  createdAt: string;
}

export interface SearchJobResult {
  searchId: string;
  reportId: string;
  status: 'completed' | 'failed';
  durationSeconds: number;
  error?: string;
}

export interface ReportJobData {
  searchId: string;
  reportId: string;
  format: 'pdf' | 'json' | 'html';
  userId: string;
}
