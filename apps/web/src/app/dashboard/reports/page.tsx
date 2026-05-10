import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      reports: {
        orderBy: { generatedAt: 'desc' },
        include: { search: { select: { id: true, title: true } } },
      },
    },
  });

  if (!user) redirect('/sign-in');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Generated Reports</h1>
        <p className="text-slate-500 mt-1">Access all your patentability and prior art reports</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {user.reports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 mb-4">No reports generated yet</p>
            <Link
              href="/dashboard/search/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Start a New Search
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {user.reports.map((report) => (
              <Link
                key={report.id}
                href={`/dashboard/search/${report.search.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{report.inventionTitle || report.search.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 font-medium text-emerald-600">Score: {report.patentabilityScore}/100</span>
                    <span className="text-xs text-slate-300">&middot;</span>
                    <span className="text-xs text-slate-400">{formatRelativeTime(report.generatedAt.toISOString())}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
