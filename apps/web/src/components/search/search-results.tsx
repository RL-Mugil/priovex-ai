'use client';

import Link from 'next/link';
import { Download, FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn, getVerdictColor } from '@/lib/utils';

interface Report {
  id: string;
  patentabilityScore: number | null;
  overallVerdict: string | null;
  noveltyRating: string | null;
  obviousnessRating: string | null;
  pdfStorageUrl: string | null;
  markdownStorageUrl: string | null;
  generatedAt: string;
}

interface Search {
  id: string;
  title: string;
  description: string;
  aiProvider: string;
  depth: string;
  patentsFound: number;
  patentsAnalyzed: number;
  durationSeconds: number | null;
  report: Report | null;
}

export function SearchResults({ search }: { search: Search }) {
  const report = search.report;

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
          {report.pdfStorageUrl && (
            <a
              href={`/api/reports/${report.id}?format=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF Report
            </a>
          )}
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

      {/* Full report link */}
      <Link
        href={`/dashboard/reports/${report.id}`}
        className="block bg-blue-600 hover:bg-blue-500 text-white text-center py-4 rounded-xl font-semibold transition-colors"
      >
        View Full Report →
      </Link>
    </div>
  );
}
