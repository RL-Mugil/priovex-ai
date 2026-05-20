import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@priovex/database';
import { authenticateApiKey } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req.headers.get('authorization'));
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const { id } = await params;

  const search = await prisma.search.findFirst({
    where: { id, userId: auth.userId },
    include: {
      report: {
        select: {
          id: true, patentabilityScore: true, overallVerdict: true,
          noveltyRating: true, obviousnessRating: true, executiveSummary: true,
          pdfStorageUrl: true, markdownStorageUrl: true, ftoRiskData: true,
        },
      },
    },
  });

  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(search);
}
