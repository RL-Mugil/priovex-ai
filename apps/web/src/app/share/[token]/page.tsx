import { notFound } from 'next/navigation';

interface SharedReport {
  id: string;
  inventionTitle: string;
  patentabilityScore: number | null;
  overallVerdict: string | null;
  noveltyRating: string | null;
  obviousnessRating: string | null;
  executiveSummary: string | null;
  ftoRiskData: Record<string, unknown> | null;
  generatedAt: string;
  search: { title: string; depth: string; jurisdictions: string[] };
}

async function getSharedReport(token: string): Promise<SharedReport | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://priovex-app.centralindia.cloudapp.azure.com';
  try {
    const res = await fetch(`${appUrl}/api/share/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

const VERDICT_COLORS: Record<string, string> = {
  PROCEED: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  PROCEED_WITH_CAUTION: 'bg-amber-50 border-amber-200 text-amber-900',
  REFINE_FIRST: 'bg-orange-50 border-orange-200 text-orange-900',
  UNLIKELY: 'bg-red-50 border-red-200 text-red-900',
};

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getSharedReport(token);
  if (!report) notFound();

  const verdictColor = VERDICT_COLORS[report.overallVerdict ?? ''] ?? 'bg-slate-50 border-slate-200 text-slate-900';
  const fto = report.ftoRiskData as { riskLevel?: string; blockingPatents?: Array<{ publicationNumber: string; title: string; riskScore: number }>; summary?: string } | null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-blue-600 font-bold text-lg">PrioVex.AI</span>
            <span className="text-slate-400 text-sm ml-2">Shared Report</span>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:underline">Start your own search →</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{report.inventionTitle}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {report.search.depth} depth · {report.search.jurisdictions.join(', ')} · Generated {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Verdict */}
        <div className={`rounded-2xl border p-6 ${verdictColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm opacity-70 mb-1">Patentability Verdict</h2>
              <p className="text-2xl font-bold">{(report.overallVerdict ?? '').replace(/_/g, ' ')}</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-black">{report.patentabilityScore ?? '—'}</div>
              <div className="text-sm opacity-70">/ 100</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/60 rounded-lg p-3">
              <div className="text-xs font-medium opacity-70 mb-1">Novelty (35 USC 102)</div>
              <div className="font-bold">{report.noveltyRating ?? '—'}</div>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <div className="text-xs font-medium opacity-70 mb-1">Non-Obviousness (35 USC 103)</div>
              <div className="font-bold">{report.obviousnessRating ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        {report.executiveSummary && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-3">Executive Summary</h3>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{report.executiveSummary}</p>
          </div>
        )}

        {/* FTO lite */}
        {fto && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              Freedom-to-Operate Risk
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                fto.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                fto.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>{fto.riskLevel}</span>
            </h3>
            {fto.summary && <p className="text-slate-700 text-sm mb-4">{fto.summary}</p>}
            {fto.blockingPatents && fto.blockingPatents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Potentially Blocking Patents</p>
                {fto.blockingPatents.slice(0, 5).map((p) => (
                  <div key={p.publicationNumber} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.publicationNumber}</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs">{p.title}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${p.riskScore >= 70 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      Risk {p.riskScore}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-8">
          This report is shared via PrioVex.AI. For a complete analysis with claims strategy and IDS, sign in to your account.
        </p>
      </main>
    </div>
  );
}
