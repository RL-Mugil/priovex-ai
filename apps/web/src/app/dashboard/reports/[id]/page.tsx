import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@priovex/database';
import { formatDate } from '@/lib/utils';
import { VerdictCard } from '@/components/report/verdict-card';
import { ExecutiveSummary } from '@/components/report/executive-summary';
import { TopPriorArt } from '@/components/report/top-prior-art';
import { NPLReferences } from '@/components/report/npl-references';
import { NovelElements } from '@/components/report/novel-elements';
import { CoverageMatrix } from '@/components/report/coverage-matrix';
import { GapClaims } from '@/components/report/gap-claims';
import { FTORisk } from '@/components/report/fto-risk';
import { IDSTable } from '@/components/report/ids-table';
import { ExaminerSimulation } from '@/components/report/examiner-simulation';
import { SearchStatistics } from '@/components/report/search-statistics';
import { DownloadActions } from '@/components/report/download-actions';
import { ReportTabs } from '@/components/report/report-tabs';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ReportDetailPage(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) redirect('/sign-in');

  const report = await prisma.report.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      searchId: true,
      inventionTitle: true,
      patentabilityScore: true,
      overallVerdict: true,
      noveltyRating: true,
      obviousnessRating: true,
      executiveSummary: true,
      patentabilityData: true,
      claimStrategyData: true,
      topPriorArtData: true,
      statisticsData: true,
      generatedAt: true,
      // v2 intelligence
      novelElementsData: true,
      coverageMatrixData: true,
      idsEntriesData: true,
      examinerSimulationData: true,
      gapClaimDraftData: true,
      nplReferencesData: true,
      nplStatisticsData: true,
      ftoRiskData: true,
      // storage URLs
      pdfStorageUrl: true,
      clientPdfStorageUrl: true,
      markdownStorageUrl: true,
      clientReportStorageUrl: true,
      search: {
        select: { id: true, title: true, depth: true, jurisdictions: true, aiProvider: true },
      },
    },
  });

  if (!report) notFound();

  const tab = searchParams.tab ?? 'overview';

  const patentabilityAssessment = report.patentabilityData as {
    keyRisks?: string[];
    opportunities?: string[];
    whiteSpaceAreas?: string[];
  } | null;

  const downloadUrls = {
    pdf: report.pdfStorageUrl,
    clientPdf: report.clientPdfStorageUrl,
    markdown: report.markdownStorageUrl,
    clientMarkdown: report.clientReportStorageUrl,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/search/${report.searchId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to search
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{report.inventionTitle}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {report.search.depth} depth · {report.search.jurisdictions.join(', ')} ·{' '}
          Generated {formatDate(report.generatedAt)}
        </p>
      </div>

      {/* Verdict */}
      <VerdictCard
        patentabilityScore={report.patentabilityScore}
        overallVerdict={report.overallVerdict}
        noveltyRating={report.noveltyRating}
        obviousnessRating={report.obviousnessRating}
      />

      {/* Executive Summary */}
      <ExecutiveSummary
        summary={report.executiveSummary}
        patentabilityAssessment={patentabilityAssessment}
      />

      {/* Tabbed sections */}
      <ReportTabs activeTab={tab} reportId={report.id} />

      {tab === 'overview' && (
        <div className="space-y-6">
          <TopPriorArt patents={report.topPriorArtData as any} />
          <NPLReferences
            references={report.nplReferencesData as any}
            stats={report.nplStatisticsData as any}
          />
        </div>
      )}

      {tab === 'claims' && (
        <div className="space-y-6">
          <NovelElements elements={report.novelElementsData as any} />
          <CoverageMatrix matrix={report.coverageMatrixData as any} />
          <GapClaims gapClaimDraft={report.gapClaimDraftData as any} />
        </div>
      )}

      {tab === 'fto' && (
        <div className="space-y-6">
          <FTORisk ftoRisk={report.ftoRiskData as any} />
          <IDSTable entries={report.idsEntriesData as any} />
        </div>
      )}

      {tab === 'examiner' && (
        <ExaminerSimulation prediction={report.examinerSimulationData as any} />
      )}

      {tab === 'stats' && (
        <div className="space-y-6">
          <SearchStatistics statistics={report.statisticsData as any} search={report.search} />
          <DownloadActions reportId={report.id} downloadUrls={downloadUrls} searchId={report.searchId} />
        </div>
      )}
    </div>
  );
}
