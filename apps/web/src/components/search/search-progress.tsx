'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, Brain, BarChart3, FileText, Database,
  Layers, Globe, Cpu, ClipboardList, Users, Grid3X3,
  Tag, BookOpen, Microscope, StopCircle, ShieldAlert,
} from 'lucide-react';
import { cn, humanizeStatus, getStatusColor } from '@/lib/utils';

interface LogEntry {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface SearchData {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  patentsFound: number;
  patentsAnalyzed: number;
  nplFound?: number;
  errorMessage?: string | null;
  progressLogs: LogEntry[];
}

const STEPS = [
  { name: 'Extracting Invention Concepts', icon: Brain },
  { name: 'Decomposing Novel Elements',    icon: Layers },
  { name: 'Building Keyword Strategy',     icon: Search },
  { name: 'Broad Patent Search',           icon: Database },
  { name: 'CPC Code Identification',       icon: Cpu },
  { name: 'Deep CPC Search',               icon: Database },
  { name: 'NPL Intelligence Search',       icon: Globe },
  { name: 'Full Claims Retrieval',         icon: FileText },
  { name: 'Timeline & Assignee Analysis',  icon: BarChart3 },
  { name: 'AI Relevance Scoring',          icon: Brain },
  { name: 'Freedom-to-Operate Analysis',   icon: ShieldAlert },
  { name: 'Feature Coverage Matrix',       icon: Grid3X3 },
  { name: 'IDS Generation',               icon: ClipboardList },
  { name: 'Examiner Simulation',           icon: Users },
  { name: 'Generating Dual Reports',       icon: FileText },
];

// ─── extract structured panels from log metadata ──────────────────────────────

function extractPanels(logs: LogEntry[]) {
  const panels: {
    keywords?: { primaryKeywords: string[]; synonyms: string[]; cpcHints: string[] };
    patentBatches?: Array<{ batch: number; keywords: string[]; found: number; samples: Array<{ title: string; pub: string; year?: string }> }>;
    cpcCodes?: string[];
    nplResults?: { sources: Record<string, number>; total: number; topTitles: Array<{ title: string; source: string; score: number }> };
    topPatents?: { verdict: string; score: number; patents: Array<{ pub: string; title: string; similarity: number; impact: string; assignee: string; year?: string }> };
  } = {};

  for (const log of logs) {
    const m = log.metadata as any;
    if (!m?.type) continue;
    if (m.type === 'KEYWORD_STRATEGY') panels.keywords = { primaryKeywords: m.primaryKeywords ?? [], synonyms: m.synonyms ?? [], cpcHints: m.cpcHints ?? [] };
    if (m.type === 'PATENT_BATCH') {
      panels.patentBatches = panels.patentBatches ?? [];
      panels.patentBatches.push({ batch: m.batch, keywords: m.keywords ?? [], found: m.found ?? 0, samples: m.samples ?? [] });
    }
    if (m.type === 'CPC_CODES') panels.cpcCodes = m.codes ?? [];
    if (m.type === 'NPL_RESULTS') panels.nplResults = { sources: m.sources ?? {}, total: m.total ?? 0, topTitles: m.topTitles ?? [] };
    if (m.type === 'TOP_PATENTS') panels.topPatents = { verdict: m.verdict, score: m.score, patents: m.patents ?? [] };
  }

  return panels;
}

const IMPACT_COLOR: Record<string, string> = {
  blocking: 'text-red-600 bg-red-50',
  strong: 'text-orange-600 bg-orange-50',
  moderate: 'text-amber-600 bg-amber-50',
  weak: 'text-green-600 bg-green-50',
  minimal: 'text-emerald-600 bg-emerald-50',
};

// ─── component ────────────────────────────────────────────────────────────────

export function SearchProgress({ searchId, initialSearch }: { searchId: string; initialSearch: SearchData }) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchData>(initialSearch);
  const [logs, setLogs] = useState<LogEntry[]>(initialSearch.progressLogs);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(search.status);
  const isActive   = !isTerminal;

  useEffect(() => {
    if (isTerminal) return;
    const es = new EventSource(`/api/searches/${searchId}/progress`);
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'state' && payload.data) {
          setSearch(payload.data);
          if (payload.data.progressLogs?.length) setLogs(payload.data.progressLogs);
          if (payload.data.status === 'COMPLETED') { es.close(); router.refresh(); }
        }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [searchId, isTerminal, router]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await fetch(`/api/searches/${searchId}/cancel`, { method: 'POST' });
      setSearch((s) => ({ ...s, status: 'CANCELLED' }));
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  }, [searchId]);

  const panels = extractPanels(logs);
  const totalPatentsFromBatches = (panels.patentBatches ?? []).reduce((s, b) => s + b.found, 0);

  return (
    <div className="space-y-5">
      {/* ── Status header ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {search.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : search.status === 'FAILED' ? (
              <XCircle className="w-6 h-6 text-red-500" />
            ) : search.status === 'CANCELLED' ? (
              <AlertTriangle className="w-6 h-6 text-slate-400" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            )}
            <span className={cn('text-sm font-medium px-3 py-1 rounded-full', getStatusColor(search.status))}>
              {humanizeStatus(search.status)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isActive && !showCancelConfirm && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                <StopCircle className="w-4 h-4" /> Cancel
              </button>
            )}
            {showCancelConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Stop this search?</span>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-500 disabled:opacity-60"
                >
                  {cancelling ? 'Stopping…' : 'Yes, stop'}
                </button>
                <button onClick={() => setShowCancelConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700">
                  Keep running
                </button>
              </div>
            )}
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">{search.progressPercent}%</div>
              <div className="text-xs text-slate-400">complete</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-5">
          <motion.div
            className="h-2 bg-blue-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${search.progressPercent}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: 'Patents Found', value: Math.max(search.patentsFound, totalPatentsFromBatches).toLocaleString() },
            { label: 'Analyzed by AI', value: search.patentsAnalyzed.toLocaleString() },
            { label: 'NPL References', value: (search.nplFound ?? 0).toLocaleString() },
            { label: 'Steps Done', value: `${search.currentStep}/${search.totalSteps}` },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3">
              <div className="text-xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {search.status === 'FAILED' && search.errorMessage && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {search.errorMessage}
          </div>
        )}
      </div>

      {/* ── Live Intelligence Panels ───────────────────────────────────────── */}
      <AnimatePresence>
        {/* Keywords panel */}
        {panels.keywords && (
          <motion.div
            key="keywords"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-slate-900 text-sm">Search Keywords Extracted</h3>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Primary ({panels.keywords.primaryKeywords.length})</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {panels.keywords.primaryKeywords.map((kw) => (
                    <span key={kw} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
              </div>
              {panels.keywords.synonyms.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Synonyms</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {panels.keywords.synonyms.map((kw) => (
                      <span key={kw} className="text-xs bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {panels.keywords.cpcHints.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">CPC Hints</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {panels.keywords.cpcHints.map((c) => (
                      <span key={c} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-mono">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Patent batches panel */}
        {panels.patentBatches && panels.patentBatches.length > 0 && (
          <motion.div
            key="patent-batches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold text-slate-900 text-sm">BigQuery Patent Search — Live</h3>
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                {totalPatentsFromBatches.toLocaleString()} patents found
              </span>
            </div>
            <div className="space-y-3">
              {panels.patentBatches.map((b) => (
                <div key={b.batch} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-wrap gap-1">
                      {b.keywords.map((kw) => (
                        <span key={kw} className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{kw}</span>
                      ))}
                    </div>
                    <span className="text-xs font-medium text-slate-600 shrink-0 ml-2">{b.found} results</span>
                  </div>
                  {b.samples.length > 0 && (
                    <ul className="space-y-1">
                      {b.samples.map((s) => (
                        <li key={s.pub} className="text-xs text-slate-600 flex gap-2">
                          <span className="font-mono text-slate-400 shrink-0">{s.pub}</span>
                          <span className="truncate">{s.title}</span>
                          {s.year && <span className="text-slate-300 shrink-0">{s.year}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CPC codes panel */}
        {panels.cpcCodes && panels.cpcCodes.length > 0 && (
          <motion.div
            key="cpc-codes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-slate-900 text-sm">CPC Classification Codes Identified</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {panels.cpcCodes.map((c) => (
                <span key={c} className="text-xs font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded">{c}</span>
              ))}
            </div>
          </motion.div>
        )}

        {/* NPL panel */}
        {panels.nplResults && (
          <motion.div
            key="npl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-500" />
                <h3 className="font-semibold text-slate-900 text-sm">Non-Patent Literature Found</h3>
              </div>
              <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                {panels.nplResults.total} references
              </span>
            </div>
            <div className="flex gap-3 mb-3">
              {Object.entries(panels.nplResults.sources).map(([src, count]) => (
                count > 0 && (
                  <div key={src} className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                    <div className="text-lg font-bold text-slate-900">{count}</div>
                    <div className="text-xs text-slate-500 capitalize">{src.replace(/([A-Z])/g, ' $1').trim()}</div>
                  </div>
                )
              ))}
            </div>
            {panels.nplResults.topTitles.length > 0 && (
              <ul className="space-y-1.5">
                {panels.nplResults.topTitles.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                    <span className="flex-1 truncate">{n.title}</span>
                    <span className="text-slate-400 shrink-0">{n.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {/* Top patents panel */}
        {panels.topPatents && (
          <motion.div
            key="top-patents"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Microscope className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-slate-900 text-sm">AI Preliminary Patentability Assessment</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                  Score: {panels.topPatents.score}/100
                </span>
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  {(panels.topPatents.verdict ?? '').replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {panels.topPatents.patents.map((p) => (
                <div key={p.pub} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-slate-400">{p.pub}</span>
                      <span className="text-xs text-slate-400">{p.assignee}</span>
                      {p.year && <span className="text-xs text-slate-300">{p.year}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-700">{p.similarity}%</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium capitalize', IMPACT_COLOR[p.impact] ?? 'text-slate-600 bg-slate-100')}>
                      {p.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 14-step pipeline ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4 text-sm">Search Pipeline</h3>
        <div className="grid grid-cols-2 gap-2">
          {STEPS.map(({ name, icon: Icon }, idx) => {
            const stepNum   = idx + 1;
            const isComplete = search.currentStep > stepNum;
            const isCurrent  = search.currentStep === stepNum;
            return (
              <div key={name} className={cn(
                'flex items-center gap-2.5 p-2.5 rounded-xl transition-colors',
                isCurrent  ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'
              )}>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                  isComplete ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-slate-200'
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  ) : (
                    <Icon className="w-3 h-3 text-slate-400" />
                  )}
                </div>
                <span className={cn(
                  'text-xs font-medium truncate',
                  isComplete ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-slate-400'
                )}>
                  {stepNum}. {name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Live logs ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs">
        <div className="flex items-center gap-2 mb-3 text-slate-400">
          {isActive
            ? <><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live Logs</>
            : <><div className="w-2 h-2 rounded-full bg-slate-600" /> Log History</>
          }
          <span className="ml-auto text-slate-600">{logs.length} entries</span>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto scroll-smooth" id="log-scroll">
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                'flex gap-2',
                log.level === 'SUCCESS' ? 'text-green-400' :
                log.level === 'ERROR'   ? 'text-red-400'   :
                log.level === 'WARN'    ? 'text-amber-400'  :
                'text-slate-300'
              )}
            >
              <span className="text-slate-600 shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-slate-500 shrink-0">
                {log.level === 'SUCCESS' ? '✓' : log.level === 'ERROR' ? '✗' : log.level === 'WARN' ? '!' : '·'}
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
