import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'json';

  const report = await prisma.report.findFirst({
    where: { id, userId: user.id },
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
    // If Supabase URL exists, redirect to stored file (fastest path)
    if (report.pdfStorageUrl) {
      return NextResponse.redirect(report.pdfStorageUrl);
    }

    // No stored PDF — generate on-demand from saved HTML
    const html = (report as any).htmlContent as string | null;
    if (!html) {
      return NextResponse.json({ error: 'PDF not available — report has no HTML content' }, { status: 404 });
    }

    try {
      const { generatePDFFromHTML } = await import('@priovex/report-generator');
      const pdf = await generatePDFFromHTML(html);
      const title = (report as any).inventionTitle as string | null;
      const filename = `priovex-report-${title ? title.slice(0, 40).replace(/[^a-z0-9]/gi, '-') : report.id}.pdf`;
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (err) {
      console.error('[API/reports] On-demand PDF generation failed:', err);
      return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
    }
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
