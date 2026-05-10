'use client';

import { useState, useCallback } from 'react';
import { Search, RefreshCw, XCircle, ExternalLink, Check } from 'lucide-react';
import { formatRelativeTime, getStatusColor, humanizeStatus } from '@/lib/utils';

interface AdminSearch {
  id: string;
  title: string;
  status: string;
  depth: string;
  searchType: string;
  progressPercent: number;
  patentsFound: number;
  nplFound: number;
  createdAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  user: { id: string; name: string; email: string };
}

interface Props {
  initialSearches: AdminSearch[];
  initialTotal: number;
  initialSearch?: string;
}

const STATUSES = [
  'QUEUED', 'EXTRACTING', 'NOVEL_ELEMENTS', 'KEYWORD_STRATEGY', 'BROAD_SEARCH',
  'CPC_IDENTIFICATION', 'DEEP_CPC_SEARCH', 'NPL_SEARCH', 'CLAIMS_RETRIEVAL',
  'TIMELINE_ANALYSIS', 'AI_SCORING', 'COVERAGE_ANALYSIS', 'IDS_GENERATION',
  'EXAMINER_SIMULATION', 'GENERATING_REPORT', 'COMPLETED', 'FAILED', 'CANCELLED',
];

export function SearchesTable({ initialSearches, initialTotal, initialSearch = '' }: Props) {
  const [searches, setSearches] = useState<AdminSearch[]>(initialSearches);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const fetchSearches = useCallback(async (p = 1, s = search, st = statusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), search: s, status: st });
    try {
      const res = await fetch(`/api/admin/searches?${params}`);
      const data = await res.json() as { searches: AdminSearch[]; total: number };
      setSearches(data.searches);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function cancelSearch(id: string, title: string) {
    setCancelling(id);
    try {
      const res = await fetch(`/api/admin/searches/${id}/cancel`, { method: 'POST' });
      if (!res.ok) { showToast((await res.json()).error ?? 'Cancel failed'); return; }
      setSearches((prev) => prev.map((s) => s.id === id ? { ...s, status: 'CANCELLED' } : s));
      showToast(`Cancelled: ${title.slice(0, 40)}`);
    } finally {
      setCancelling(null);
    }
  }

  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'];
  const pages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg z-50 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Search by title or user email…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchSearches(1, search, statusFilter); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); fetchSearches(1, search, e.target.value); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
        </select>
        <button onClick={() => fetchSearches(1, search, statusFilter)}
          className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <p className="text-sm text-slate-500">{total} search{total !== 1 ? 'es' : ''} found</p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Search</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Results</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Started</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {searches.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="font-medium text-slate-900 truncate">{s.title}</p>
                    <p className="text-xs text-slate-400">{s.depth} · {s.searchType}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{s.user.name}</p>
                    <p className="text-xs text-slate-400">{s.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(s.status)}`}>
                      {humanizeStatus(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!terminal.includes(s.status) ? (
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${s.progressPercent}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{s.progressPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}m` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.patentsFound > 0 ? `${s.patentsFound}P` : '—'}
                    {s.nplFound > 0 ? ` · ${s.nplFound}NPL` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatRelativeTime(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`/dashboard/search/${s.id}`} target="_blank" rel="noreferrer"
                        title="View search"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {!terminal.includes(s.status) && (
                        <button
                          onClick={() => cancelSearch(s.id, s.title)}
                          disabled={cancelling === s.id}
                          title="Cancel search"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                          <XCircle className={`w-4 h-4 ${cancelling === s.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {searches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No searches found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => fetchSearches(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">Previous</button>
              <button onClick={() => fetchSearches(page + 1)} disabled={page >= pages}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
