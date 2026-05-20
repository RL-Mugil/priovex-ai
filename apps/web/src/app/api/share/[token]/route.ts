import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const report = await prisma.report.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      shareExpiresAt: true,
      inventionTitle: true,
      patentabilityScore: true,
      overallVerdict: true,
      noveltyRating: true,
      obviousnessRating: true,
      executiveSummary: true,
      topPriorArtData: true,
      claimStrategyData: true,
      ftoRiskData: true,
      generatedAt: true,
      search: { select: { title: true, depth: true, jurisdictions: true } },
    },
  });

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (report.shareExpiresAt && report.shareExpiresAt < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  // Increment view count (fire-and-forget)
  prisma.report.update({ where: { shareToken: token }, data: { shareViewCount: { increment: 1 } } }).catch(() => {});

  return NextResponse.json(report);
}
