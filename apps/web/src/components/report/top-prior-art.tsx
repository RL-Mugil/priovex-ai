'use client';

interface ScoredPatent {
  publicationNumber: string;
  title: string;
  abstract: string;
  assignees: string[];
  filingDate: string;
  grantDate?: string;
  countryCode: string;
  cpcCodes: string[];
  similarityScore: number;
  noveltyImpact: string;
  similarities: string[];
  differences: string[];
  url?: string;
}

interface TopPriorArtProps {
  patents: ScoredPatent[] | null;
}

const IMPACT_STYLE: Record<string, string> = {
  blocking: 'bg-red-100 text-red-700',
  strong: 'bg-orange-100 text-orange-700',
  moderate: 'bg-amber-100 text-amber-700',
  weak: 'bg-yellow-100 text-yellow-700',
  minimal: 'bg-slate-100 text-slate-600',
};

export function TopPriorArt({ patents }: TopPriorArtProps) {
  if (!patents || patents.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Top Prior Art</h2>
        <p className="text-sm text-slate-400">No prior art found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Top Prior Art</h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
          {patents.length} patents
        </span>
      </div>
      <div className="space-y-4">
        {patents.slice(0, 10).map((p, idx) => (
          <div key={p.publicationNumber} className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {p.publicationNumber}
                      </a>
                    ) : (
                      <span className="font-mono text-sm font-semibold text-slate-800">{p.publicationNumber}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_STYLE[p.noveltyImpact] ?? 'bg-slate-100 text-slate-600'}`}>
                      {p.noveltyImpact}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5 font-medium">{p.title}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-slate-800">{p.similarityScore}<span className="text-xs font-normal text-slate-400">%</span></div>
                <div className="text-xs text-slate-400">similarity</div>
              </div>
            </div>

            <div className="ml-9 space-y-2">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {p.assignees[0] && <span>{p.assignees[0]}</span>}
                {p.assignees[0] && <span>·</span>}
                <span>{p.filingDate?.slice(0, 4) ?? '—'}</span>
                <span>·</span>
                <span>{p.countryCode}</span>
                {p.cpcCodes.slice(0, 2).map((c) => (
                  <span key={c} className="bg-slate-50 px-1.5 py-0.5 rounded font-mono">{c.slice(0, 6)}</span>
                ))}
              </div>
              {p.abstract && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{p.abstract.slice(0, 250)}…</p>
              )}
              {p.similarities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">Similarities</p>
                  <ul className="space-y-0.5">
                    {p.similarities.slice(0, 3).map((s, i) => (
                      <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-red-400 shrink-0">→</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.differences.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-600 mb-1">Distinguishing features</p>
                  <ul className="space-y-0.5">
                    {p.differences.slice(0, 2).map((d, i) => (
                      <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-400 shrink-0">✓</span>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
