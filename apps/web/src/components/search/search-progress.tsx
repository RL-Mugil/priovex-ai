'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, CheckCircle2, XCircle, Clock,
  Search, Brain, BarChart3, FileText, Database
} from 'lucide-react';
import { cn, humanizeStatus, getStatusColor } from '@/lib/utils';

interface SearchData {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  patentsFound: number;
  patentsAnalyzed: number;
  errorMessage?: string | null;
  progressLogs: Array<{
    id: string;
    level: string;
    message: string;
    timestamp: string;
  }>;
}

const STEP_ICONS = [Search, Database, Database, Brain, Brain, BarChart3, Brain, FileText];

export function SearchProgress({
  searchId,
  initialSearch,
}: {
  searchId: string;
  initialSearch: SearchData;
}) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchData>(initialSearch);
  const [logs, setLogs] = useState(initialSearch.progressLogs);

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(search.status);

  useEffect(() => {
    if (isTerminal) return;

    const es = new EventSource(`/api/searches/${searchId}/progress`);

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'state' && payload.data) {
          setSearch(payload.data);
          if (payload.data.progressLogs) {
            setLogs(payload.data.progressLogs);
          }
          if (payload.data.status === 'COMPLETED') {
            es.close();
            router.refresh();
          }
        }
      } catch {}
    };

    es.onerror = () => es.close();

    return () => es.close();
  }, [searchId, isTerminal, router]);

  const steps = [
    'Extracting Concepts',
    'Keyword Strategy',
    'Broad Search',
    'CPC Identification',
    'Deep CPC Search',
    'Timeline Analysis',
    'AI Analysis',
    'Report Generation',
  ];

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {search.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : search.status === 'FAILED' ? (
              <XCircle className="w-6 h-6 text-red-500" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            )}
            <span className={cn('text-sm font-medium px-3 py-1 rounded-full', getStatusColor(search.status))}>
              {humanizeStatus(search.status)}
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{search.progressPercent}%</div>
            <div className="text-xs text-slate-400">complete</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
          <motion.div
            className="h-2 bg-blue-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${search.progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-slate-900">{search.patentsFound.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Patents Found</div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{search.patentsAnalyzed.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Analyzed</div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{search.currentStep}/{search.totalSteps}</div>
            <div className="text-xs text-slate-500">Steps Done</div>
          </div>
        </div>

        {search.status === 'FAILED' && search.errorMessage && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {search.errorMessage}
          </div>
        )}
      </div>

      {/* Step pipeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Search Pipeline</h3>
        <div className="space-y-3">
          {steps.map((stepName, idx) => {
            const stepNum = idx + 1;
            const isComplete = search.currentStep > stepNum;
            const isActive = search.currentStep === stepNum;
            const StepIcon = STEP_ICONS[idx] ?? Search;

            return (
              <div key={stepName} className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isActive ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'
              )}>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                  isComplete ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-slate-200'
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <span className={cn(
                    'text-sm font-medium',
                    isComplete ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-slate-400'
                  )}>
                    {stepNum}. {stepName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live logs */}
      <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs">
        <div className="flex items-center gap-2 mb-3 text-slate-400">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live Logs
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {logs.slice(0, 20).map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex gap-2',
                  log.level === 'SUCCESS' ? 'text-green-400' :
                  log.level === 'ERROR' ? 'text-red-400' :
                  log.level === 'WARN' ? 'text-amber-400' :
                  'text-slate-300'
                )}
              >
                <span className="text-slate-500 flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span>{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
