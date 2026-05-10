'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Plus, RefreshCw, Trash2, StopCircle,
  CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
  ChevronRight, BarChart3, FileText,
} from 'lucide-react';
import { cn, getStatusColor, humanizeStatus, formatRelativeTime } from '@/lib/utils';

interface SearchRow {
  id: string;
  title: string;
  technicalField: string;
  status: string;
  depth: string;
  aiProvider: string;
  progressPercent: number;
  currentStep: number;
  totalSteps: number;
  patentsFound: number;
  patentsAnalyzed: number;
  nplFound: number;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  report: { id: string; patentabilityScore: number | null; overallVerdict: string | null } | null;
}

const ACTIVE_STATUSES = new Set([
  'QUEUED', 'EXTRACTING', 'NOVEL_ELEMENTS', 'KEYWORD_STRATEGY',
  'BROAD_SEARCH', 'CPC_IDENTIFICATION', 'DEEP_CPC_SEARCH',
  'NPL_SEARCH', 'CLAIMS_RETRIEVAL', 'TIMELINE_ANALYSIS',
  'AI_SCORING', 'COVERAGE_ANALYSIS', 'IDS_GENERATION',
  'EXAMINER_SIMULATION', 'GENERATING_REPORT',
]);

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'QUEUED',    label: 'Queued' },
  { key: 'EXTRACTING', label: 'Running' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'FAILED',    label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const VERDICT_BADGE: Record<string, string> = {
  PROCEED: 'bg-green-100 text-green-700',
  PROCEED_WITH_CAUTION: 'bg-amber-100 text-amber-700',
  REFINE_FIRST: 'bg-orange-100 text-orange-700',
  UNLIKELY: 'bg-red-100 text-red-700',
};

export function SearchesManager({
  initialSearches,
  statusCounts,
  currentStatus,
  currentQ,
}: {
  initialSearches: SearchRow[];
  statusCounts: Record<string, number>;
  currentStatus: string;
  currentQ: string;
}) {
  const router = useRouter();
  const [searches, setSearches] = useState<SearchRow[]>(initialSearches);
  const [q, setQ] = useState(currentQ);
  const [pending, startTransition] = useTransition();
  const [actionPending, setActionPending] = useState<Record<string, string>>({});  // id → action

  function navigate(params: { status?: string; q?: string }) {
    const sp = new URLSearchParams();
    if (params.status && params.status !== 'all') sp.set('status', params.status);
    if (params.q) sp.set('q', params.q);
    startTransition(() => router.push(`/dashboard/searches?${sp.toString()}`));
  }

  async function cancelSearch(id: string) {
    setActionPending((p) => ({ ...p, [id]: 'cancel' }));
    try {
      await fetch(`/api/searches/${id}/cancel`, { method: 'POST' });
      setSearches((prev) => prev.map((s) => s.id === id ? { ...s, status: 'CANCELLED' } : s));
    } finally {
      setActionPending((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function retrySearch(id: string) {
    setActionPending((p) => ({ ...p, [id]: 'retry' }));
    try {
      const res = await fetch(`/api/searches/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        const { searchId } = await res.json() as { searchId: string };
        router.push(`/dashboard/search/${searchId}`);
      }
    } finally {
      setActionPending((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function deleteSearch(id: string) {
    if (!confirm('Permanently delete this search and its report?')) return;
    setActionPending((p) => ({ ...p, [id]: 'delete' }));
    try {
      await fetch(`/api/searches/${id}`, { method: 'DELETE' });
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setActionPending((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function deleteAll() {
    const finished = searches.filter((s) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(s.status));
    if (!finished.length) return;
    if (!confirm(`Delete all ${finished.length} finished searches and their reports?`)) return;
    await Promise.all(finished.map((s) => fetch(`/api/searches/${s.id}`, { method: 'DELETE' })));
    setSearches((prev) => prev.filter((s) => ACTIVE_STATUSES.has(s.status)));
  }

  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate({ status: currentStatus, q }); }}
            placeholder="Search by title…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Link
          href="/dashboard/search/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> New Search
        </Link>
        <button
          onClick={deleteAll}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-2 rounded-lg transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" /> Clear Finished
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap bg-slate-100 p-1 rounded-xl">
        {STATUS_TABS.map((tab) => {
          // count: all running tabs are grouped into EXTRACTING
          const count = tab.key === 'all'
            ? totalAll
            : tab.key === 'EXTRACTING'
              ? Object.entries(statusCounts).filter(([k]) => ACTIVE_STATUSES.has(k) && k !== 'QUEUED').reduce((a, [, v]) => a + v, 0) + (statusCounts['QUEUED'] ?? 0)
              : (statusCounts[tab.key] ?? 0);

          const isActive = (currentStatus || 'all') === tab.key || (tab.key === 'EXTRACTING' && ACTIVE_STATUSES.has(currentStatus) && currentStatus !== 'QUEUED');

          return (
            <button
              key={tab.key}
              onClick={() => navigate({ status: tab.key, q })}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {searches.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No searches found</p>
            <Link
              href="/dashboard/search/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500"
            >
              <Plus className="w-4 h-4" /> Start a Search
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {searches.map((s) => {
              const isRunning = ACTIVE_STATUSES.has(s.status);
              const isFailed  = s.status === 'FAILED' || s.status === 'CANCELLED';
              const action    = actionPending[s.id];

              return (
                <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
                  {/* Status icon */}
                  <div className="shrink-0">
                    {s.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : s.status === 'FAILED' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : s.status === 'CANCELLED' ? (
                      <AlertTriangle className="w-5 h-5 text-slate-400" />
                    ) : isRunning ? (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/search/${s.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600 truncate max-w-sm transition-colors"
                      >
                        {s.title}
                      </Link>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', getStatusColor(s.status))}>
                        {humanizeStatus(s.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{s.technicalField}</span>
                      <span>·</span>
                      <span>{s.depth.toLowerCase()} depth</span>
                      <span>·</span>
                      <span>{s.aiProvider}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(s.createdAt)}</span>
                    </div>

                    {/* Progress bar for running searches */}
                    {isRunning && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 bg-blue-500 rounded-full transition-all"
                            style={{ width: `${s.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{s.currentStep}/{s.totalSteps} steps</span>
                      </div>
                    )}

                    {/* Error message */}
                    {isFailed && s.errorMessage && (
                      <p className="mt-1 text-xs text-red-500 truncate">{s.errorMessage}</p>
                    )}
                  </div>

                  {/* Stats + verdict */}
                  <div className="hidden lg:flex items-center gap-4 shrink-0 text-sm">
                    {s.patentsFound > 0 && (
                      <div className="text-right">
                        <div className="font-medium text-slate-800">{s.patentsFound.toLocaleString()}</div>
                        <div className="text-xs text-slate-400">patents</div>
                      </div>
                    )}
                    {s.report?.patentabilityScore != null && (
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{s.report.patentabilityScore}/100</div>
                        {s.report.overallVerdict && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', VERDICT_BADGE[s.report.overallVerdict] ?? 'bg-slate-100 text-slate-600')}>
                            {s.report.overallVerdict.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    )}
                    {s.durationSeconds && (
                      <div className="text-right text-xs text-slate-400">
                        {Math.round(s.durationSeconds / 60)}m
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isRunning && (
                      <button
                        onClick={() => cancelSearch(s.id)}
                        disabled={!!action}
                        title="Cancel search"
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {action === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                      </button>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => retrySearch(s.id)}
                        disabled={!!action}
                        title="Retry search"
                        className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {action === 'retry' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => deleteSearch(s.id)}
                      disabled={!!action}
                      title="Delete search"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {action === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/dashboard/search/${s.id}`}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
