import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'json';

  const report = await prisma.report.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  if (format === 'markdown') {
    return new Response(report.markdownContent ?? '', {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="report-${report.id}.md"`,
      },
    });
  }

  if (format === 'html') {
    return new Response(report.htmlContent ?? '', {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="report-${report.id}.html"`,
      },
    });
  }

  if (format === 'pdf') {
    if (!report.pdfStorageUrl) {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
    }
    // Redirect to Supabase signed URL
    return NextResponse.redirect(report.pdfStorageUrl);
  }

  // Default: JSON
  return NextResponse.json({
    id: report.id,
    searchId: report.searchId,
    inventionTitle: report.inventionTitle,
    patentabilityScore: report.patentabilityScore,
    overallVerdict: report.overallVerdict,
    noveltyRating: report.noveltyRating,
    obviousnessRating: report.obviousnessRating,
    executiveSummary: report.executiveSummary,
    patentabilityAssessment: report.patentabilityData,
    claimStrategy: report.claimStrategyData,
    topPriorArt: report.topPriorArtData,
    idsReferences: report.idsReferences,
    statistics: report.statisticsData,
    generatedAt: report.generatedAt,
    downloadUrls: {
      pdf: report.pdfStorageUrl,
      markdown: report.markdownStorageUrl,
    },
  });
}
