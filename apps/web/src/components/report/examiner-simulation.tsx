'use client';

interface FirstOAScenario {
  predictedReferences: string[];
  rejectionBasis: string;
  mappedClaims: number[];
  responseStrategy: string;
  estimatedAllowanceChance: number;
}

interface ExaminerPrediction {
  likelyRejectionBasis: string[];
  predictedCitedReferences: string[];
  cpcClassesLikelySearched: string[];
  closestArtCluster?: string;
  likelyObjectionPathways?: string[];
  enablementRisks?: string[];
  section112Risks?: string[];
  firstOfficeActionScenario: FirstOAScenario;
  examinersLikelySearch?: string;
}

interface ExaminerSimulationProps {
  prediction: ExaminerPrediction | null;
}

export function ExaminerSimulation({ prediction }: ExaminerSimulationProps) {
  if (!prediction) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Examiner Simulation</h2>
        <p className="text-sm text-slate-400">Examiner simulation not available for this search.</p>
      </div>
    );
  }

  const oa = prediction.firstOfficeActionScenario;
  const allowanceChance = oa.estimatedAllowanceChance;
  const allowanceColor = allowanceChance >= 60 ? 'text-emerald-600' : allowanceChance >= 35 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">USPTO Examiner Simulation</h2>
        <div className="text-right">
          <div className={`text-3xl font-black ${allowanceColor}`}>{allowanceChance}%</div>
          <div className="text-xs text-slate-400">estimated allowance</div>
        </div>
      </div>

      {/* Rejection basis tags */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Likely Rejection Basis</p>
        <div className="flex flex-wrap gap-2">
          {prediction.likelyRejectionBasis.map((b) => (
            <span key={b} className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium border border-red-100">
              35 USC §{b}
            </span>
          ))}
        </div>
      </div>

      {/* First OA scenario */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">First Office Action Scenario</p>
        <p className="text-sm text-slate-700">{oa.rejectionBasis}</p>
        {oa.predictedReferences.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Likely cited references</p>
            <div className="flex flex-wrap gap-1.5">
              {oa.predictedReferences.map((r) => (
                <span key={r} className="text-xs font-mono bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded">{r}</span>
              ))}
            </div>
          </div>
        )}
        {oa.mappedClaims.length > 0 && (
          <p className="text-xs text-slate-500">
            Claims at risk: {oa.mappedClaims.map((c) => `Claim ${c}`).join(', ')}
          </p>
        )}
      </div>

      {/* Response strategy */}
      {oa.responseStrategy && (
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Recommended Response Strategy</p>
          <p className="text-sm text-slate-700 leading-relaxed">{oa.responseStrategy}</p>
        </div>
      )}

      {/* Examiner search */}
      {prediction.examinersLikelySearch && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Examiner's Likely Search</p>
          <p className="text-sm text-slate-600 leading-relaxed">{prediction.examinersLikelySearch}</p>
        </div>
      )}

      {/* CPC codes examiner will search */}
      {prediction.cpcClassesLikelySearched.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">CPC Classes Likely Searched</p>
          <div className="flex flex-wrap gap-1.5">
            {prediction.cpcClassesLikelySearched.map((c) => (
              <span key={c} className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* 35 USC 112 risks */}
      {prediction.section112Risks && prediction.section112Risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">35 USC 112 Risks</p>
          <ul className="space-y-1">
            {prediction.section112Risks.map((r, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-2"><span className="text-orange-400 shrink-0">⚠</span>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Enablement risks */}
      {prediction.enablementRisks && prediction.enablementRisks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Enablement Risks</p>
          <ul className="space-y-1">
            {prediction.enablementRisks.map((r, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-2"><span className="text-orange-400 shrink-0">⚠</span>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
