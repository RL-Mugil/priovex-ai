'use client';

import { formatBytes } from '@/lib/utils';

interface Statistics {
  totalPatentsReviewed?: number;
  relevantPatentsFound?: number;
  topPriorArtSelected?: number;
  keywordsSearched?: string[];
  cpcCodesSearched?: string[];
  jurisdictionsCovered?: string[];
  bigQueryBytesProcessed?: number;
  searchDurationSeconds?: number;
  aiProvider?: string;
  aiTokensUsed?: number;
  aiCostUsd?: number;
  nplSourcesSearched?: string[];
  nplReferencesFound?: number;
  nplReferencesAnalyzed?: number;
  novelElementsDecomposed?: number;
  coverageMatrixSize?: string;
  idsEntriesGenerated?: number;
}

interface SearchStatisticsProps {
  statistics: Statistics | null;
  search?: { depth?: string; aiProvider?: string; jurisdictions?: string[] } | null;
}

export function SearchStatistics({ statistics, search }: SearchStatisticsProps) {
  if (!statistics) return null;

  const duration = statistics.searchDurationSeconds;
  const durationLabel = duration
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : '—';

  const bqGb = statistics.bigQueryBytesProcessed
    ? (statistics.bigQueryBytesProcessed / 1e9).toFixed(1)
    : null;

  const aiCost = statistics.aiCostUsd != null
    ? `$${statistics.aiCostUsd.toFixed(4)}`
    : '—';

  const rows: Array<{ label: string; value: string | number }> = [
    { label: 'Patents reviewed', value: statistics.totalPatentsReviewed?.toLocaleString() ?? '—' },
    { label: 'Relevant patents', value: statistics.relevantPatentsFound ?? '—' },
    { label: 'NPL references', value: statistics.nplReferencesFound ?? '—' },
    { label: 'NPL analyzed', value: statistics.nplReferencesAnalyzed ?? '—' },
    { label: 'Novel elements', value: statistics.novelElementsDecomposed ?? '—' },
    { label: 'Coverage matrix', value: statistics.coverageMatrixSize ?? '—' },
    { label: 'IDS entries', value: statistics.idsEntriesGenerated ?? '—' },
    { label: 'BigQuery data', value: bqGb ? `${bqGb} GB` : '—' },
    { label: 'Search duration', value: durationLabel },
    { label: 'AI provider', value: statistics.aiProvider ?? search?.aiProvider ?? '—' },
    { label: 'AI tokens', value: statistics.aiTokensUsed?.toLocaleString() ?? '—' },
    { label: 'AI cost', value: aiCost },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h2 className="font-semibold text-slate-900">Search Statistics</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
        {rows.map(({ label, value }) => (
          <div key={label} className="bg-white px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {statistics.keywordsSearched && statistics.keywordsSearched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Keywords Searched</p>
          <div className="flex flex-wrap gap-1.5">
            {statistics.keywordsSearched.map((kw) => (
              <span key={kw} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {statistics.cpcCodesSearched && statistics.cpcCodesSearched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">CPC Codes Searched</p>
          <div className="flex flex-wrap gap-1.5">
            {statistics.cpcCodesSearched.map((c) => (
              <span key={c} className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{c}</span>
            ))}
          </div>
        </div>
      )}

      {statistics.nplSourcesSearched && statistics.nplSourcesSearched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">NPL Sources</p>
          <div className="flex flex-wrap gap-1.5">
            {statistics.nplSourcesSearched.map((s) => (
              <span key={s} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
