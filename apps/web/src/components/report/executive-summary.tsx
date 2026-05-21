'use client';

interface ExecutiveSummaryProps {
  summary: string | null;
  patentabilityAssessment?: {
    keyRisks?: string[];
    opportunities?: string[];
    whiteSpaceAreas?: string[];
  } | null;
}

export function ExecutiveSummary({ summary, patentabilityAssessment }: ExecutiveSummaryProps) {
  if (!summary) return null;
  const { keyRisks, opportunities, whiteSpaceAreas } = patentabilityAssessment ?? {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <h2 className="font-semibold text-slate-900 text-lg">Executive Summary</h2>
      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>

      {(keyRisks?.length || opportunities?.length || whiteSpaceAreas?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {keyRisks && keyRisks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Key Risks</p>
              <ul className="space-y-1">
                {keyRisks.map((r, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {opportunities && opportunities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Opportunities</p>
              <ul className="space-y-1">
                {opportunities.map((o, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">•</span>{o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {whiteSpaceAreas && whiteSpaceAreas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">White Space</p>
              <ul className="space-y-1">
                {whiteSpaceAreas.map((w, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-blue-400 mt-0.5 shrink-0">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
