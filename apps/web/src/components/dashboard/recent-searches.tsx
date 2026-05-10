import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn, getStatusColor, humanizeStatus, formatRelativeTime } from '@/lib/utils';

interface Search {
  id: string;
  title: string;
  status: string;
  aiProvider: string;
  depth: string;
  patentsFound: number;
  createdAt: string;
  report?: { id: string; patentabilityScore: number | null; overallVerdict: string | null } | null;
}

export function RecentSearches({ searches }: { searches: Search[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">Recent Searches</h2>
        <Link href="/dashboard/searches" className="text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-400 mb-4">No searches yet</p>
          <Link
            href="/dashboard/search/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            Start Your First Search
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {searches.map((search) => (
            <Link
              key={search.id}
              href={`/dashboard/search/${search.id}`}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{search.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(search.status))}>
                    {humanizeStatus(search.status)}
                  </span>
                  <span className="text-xs text-slate-400">{search.aiProvider}</span>
                  <span className="text-xs text-slate-400">{formatRelativeTime(search.createdAt)}</span>
                </div>
              </div>
              <div className="text-right">
                {search.report?.patentabilityScore != null ? (
                  <div className="text-lg font-bold text-slate-900">
                    {search.report.patentabilityScore}
                    <span className="text-xs text-slate-400 font-normal">/100</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    {search.patentsFound > 0 ? `${search.patentsFound} patents` : '—'}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
