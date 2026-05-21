'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'claims',    label: 'Claims & Coverage' },
  { id: 'fto',       label: 'FTO & IDS' },
  { id: 'examiner',  label: 'Examiner' },
  { id: 'stats',     label: 'Statistics' },
];

interface ReportTabsProps {
  activeTab: string;
  reportId: string;
}

export function ReportTabs({ activeTab, reportId }: ReportTabsProps) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/reports/${reportId}?tab=${tab.id}`}
            className={cn(
              'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
