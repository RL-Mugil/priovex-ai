'use client';

interface BlockingPatent {
  publicationNumber: string;
  title: string;
  riskScore: number;
  claimOverlapReason?: string;
}

interface FTORisk {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  blockingPatents: BlockingPatent[];
  summary?: string;
  analyzedCount?: number;
}

interface FTORiskProps {
  ftoRisk: FTORisk | null;
}

const RISK_LEVEL_STYLE: Record<string, { badge: string; header: string; border: string }> = {
  HIGH:   { badge: 'bg-red-100 text-red-700',    header: 'bg-red-50 border-red-200',   border: 'border-red-200' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-700', header: 'bg-amber-50 border-amber-200', border: 'border-amber-200' },
  LOW:    { badge: 'bg-emerald-100 text-emerald-700', header: 'bg-emerald-50 border-emerald-200', border: 'border-emerald-200' },
};

export function FTORisk({ ftoRisk }: FTORiskProps) {
  if (!ftoRisk) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Freedom-to-Operate Analysis</h2>
        <p className="text-sm text-slate-400">FTO analysis not available for this search.</p>
      </div>
    );
  }

  const style = RISK_LEVEL_STYLE[ftoRisk.riskLevel] ?? RISK_LEVEL_STYLE.MEDIUM;

  return (
    <div className={`rounded-2xl border p-6 ${style.border} bg-white`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Freedom-to-Operate Analysis</h2>
        <div className="flex items-center gap-2">
          {ftoRisk.analyzedCount && (
            <span className="text-xs text-slate-400">{ftoRisk.analyzedCount} patents analyzed</span>
          )}
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${style.badge}`}>
            {ftoRisk.riskLevel} RISK
          </span>
        </div>
      </div>

      {ftoRisk.summary && (
        <p className="text-sm text-slate-700 mb-4 leading-relaxed">{ftoRisk.summary}</p>
      )}

      {ftoRisk.blockingPatents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Potentially Blocking Patents ({ftoRisk.blockingPatents.length})
          </p>
          <div className="space-y-2">
            {ftoRisk.blockingPatents.map((p) => (
              <div key={p.publicationNumber} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 font-mono">{p.publicationNumber}</p>
                  <p className="text-xs text-slate-500 truncate">{p.title}</p>
                  {p.claimOverlapReason && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.claimOverlapReason}</p>
                  )}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${p.riskScore >= 70 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.riskScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ftoRisk.blockingPatents.length === 0 && (
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-emerald-700 text-sm font-medium">No blocking patents identified in the analyzed set.</p>
        </div>
      )}
    </div>
  );
}
