'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, FileText, ExternalLink, RefreshCw, Trash2, AlertTriangle, Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn, getVerdictColor } from '@/lib/utils';

interface Report {
  id: string;
  patentabilityScore: number | null;
  overallVerdict: string | null;
  noveltyRating: string | null;
  obviousnessRating: string | null;
  executiveSummary: string | null;
  pdfStorageUrl: string | null;
  markdownStorageUrl: string | null;
  generatedAt: string;
}

interface Search {
  id: string;
  title: string;
  description: string;
  status: string;
  aiProvider: string;
  depth: string;
  patentsFound: number;
  patentsAnalyzed: number;
  durationSeconds: number | null;
  errorMessage?: string | null;
  report: Report | null;
}

export function SearchResults({ search }: { search: Search }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const report = search.report;

  async function handleShare() {
    if (!report) return;
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000); return;
    }
    setSharing(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiryDays: 30 }) });
      const data = await res.json() as { shareUrl?: string };
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
        await navigator.clipboard.writeText(data.shareUrl);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }
    } finally { setSharing(false); }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/searches/${search.id}/retry`, { method: 'POST' });
      if (res.ok) {
        const { searchId } = await res.json() as { searchId: string };
        router.push(`/dashboard/search/${searchId}`);
      }
    } finally { setRetrying(false); }
  }

  async function handleDelete() {
    if (!confirm('Delete this search and its report permanently?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/searches/${search.id}`, { method: 'DELETE' });
      router.push('/dashboard/searches');
    } finally { setDeleting(false); }
  }

  if (search.status === 'FAILED' || search.status === 'CANCELLED') {
    const isCancelled = search.status === 'CANCELLED';
    return (
      <div className="space-y-4">
        <div className={cn(
          'rounded-2xl border p-6 text-center',
          isCancelled ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
        )}>
          <AlertTriangle className={cn('w-10 h-10 mx-auto mb-3', isCancelled ? 'text-amber-400' : 'text-red-400')} />
          <h3 className={cn('font-semibold mb-1', isCancelled ? 'text-amber-800' : 'text-red-800')}>
            {isCancelled ? 'Search Cancelled' : 'Search Failed'}
          </h3>
          {isCancelled && report && (
            <p className="text-sm text-amber-700 mb-1">
              A partial report was saved with {search.patentsFound} patents found before cancellation.
            </p>
          )}
          {isCancelled && report?.executiveSummary && (
            <p className="text-xs text-amber-600 mt-1 max-w-md mx-auto">{report.executiveSummary}</p>
          )}
          {search.errorMessage && !isCancelled && (
            <p className="text-sm text-red-600 mb-4 max-w-lg mx-auto">{search.errorMessage}</p>
          )}
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {isCancelled && report && (
              <>
                <a
                  href={`/api/reports/${report.id}?format=pdf`}
                  download
                  className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-500"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
                <a
                  href={`/api/reports/${report.id}?format=markdown`}
                  download={`partial-report-${search.id}.md`}
                  className="flex items-center gap-2 bg-white border border-amber-300 text-amber-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-50"
                >
                  <FileText className="w-4 h-4" />
                  Download Markdown
                </a>
              </>
            )}
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
            >
              <RefreshCw className={cn('w-4 h-4', retrying && 'animate-spin')} />
              {retrying ? 'Starting…' : 'Retry Search'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                'flex items-center gap-2 border px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60',
                isCancelled ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-red-300 text-red-600 hover:bg-red-50'
              )}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No report available for this search.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verdict card */}
      <div className={cn(
        'rounded-2xl border p-6',
        getVerdictColor(report.overallVerdict ?? 'PROCEED_WITH_CAUTION')
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">Patentability Verdict</h2>
            <p className="text-3xl font-bold">
              {(report.overallVerdict ?? '').replace(/_/g, ' ')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black">{report.patentabilityScore ?? '—'}</div>
            <div className="text-sm opacity-70">/ 100</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-xs font-medium opacity-70 mb-1">Novelty (35 USC 102)</div>
            <div className="font-bold">{report.noveltyRating ?? '—'}</div>
          </div>
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-xs font-medium opacity-70 mb-1">Non-Obviousness (35 USC 103)</div>
            <div className="font-bold">{report.obviousnessRating ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Patents Found', value: search.patentsFound.toLocaleString() },
          { label: 'Patents Analyzed', value: search.patentsAnalyzed.toLocaleString() },
          { label: 'Search Duration', value: search.durationSeconds ? `${Math.round(search.durationSeconds / 60)}m` : '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Downloads */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Download Report</h3>
        <div className="grid grid-cols-3 gap-3">
          <a
            href={`/api/reports/${report.id}?format=pdf`}
            download
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF Report
          </a>
          <a
            href={`/api/reports/${report.id}?format=markdown`}
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            Markdown
          </a>
          <a
            href={`/api/reports/${report.id}?format=json`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            JSON Data
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/dashboard/reports/${report.id}`}
          className="flex-1 block bg-blue-600 hover:bg-blue-500 text-white text-center py-3.5 rounded-xl font-semibold transition-colors"
        >
          View Full Report →
        </Link>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-3 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors text-sm disabled:opacity-50"
          title={shareUrl ? 'Copy share link' : 'Share report'}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : shareUrl ? <Copy className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          {sharing ? 'Sharing…' : copied ? 'Copied!' : shareUrl ? 'Copy link' : 'Share'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 border border-slate-200 text-slate-500 px-4 py-3 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-sm disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
