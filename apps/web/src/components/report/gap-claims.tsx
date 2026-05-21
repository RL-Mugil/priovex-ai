'use client';

import { useState } from 'react';

interface DraftClaim {
  number: number;
  text: string;
  type: 'system' | 'method' | 'apparatus' | 'cmu';
  rationale?: string;
  gapBasis?: string;
  vulnerabilities?: string[];
}

interface NarrowAroundEntry {
  blockerRef: string;
  distinctions: string[];
}

interface GapGroundedClaimDraft {
  independentClaims: DraftClaim[];
  dependentClaims: DraftClaim[];
  narrowAroundGuidance?: NarrowAroundEntry[];
  prosecutionNotes?: string;
}

interface GapClaimsProps {
  gapClaimDraft: GapGroundedClaimDraft | null;
  systemClaimDraft?: string;
  methodClaimDraft?: string;
}

const TYPE_BADGE: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700',
  method: 'bg-purple-50 text-purple-700',
  apparatus: 'bg-indigo-50 text-indigo-700',
  cmu: 'bg-cyan-50 text-cyan-700',
};

export function GapClaims({ gapClaimDraft }: GapClaimsProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!gapClaimDraft || (gapClaimDraft.independentClaims.length === 0 && gapClaimDraft.dependentClaims.length === 0)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Gap-Grounded Claim Drafts</h2>
        <p className="text-sm text-slate-400">Claim drafts not available for this search.</p>
      </div>
    );
  }

  const allClaims = [...gapClaimDraft.independentClaims, ...gapClaimDraft.dependentClaims];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Gap-Grounded Claim Drafts</h2>
        <div className="flex gap-2 text-xs">
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {gapClaimDraft.independentClaims.length} independent
          </span>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {gapClaimDraft.dependentClaims.length} dependent
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Claims drafted to exploit gaps in the coverage matrix — targeting prior art white space.
      </p>

      <div className="space-y-2">
        {allClaims.map((claim) => {
          const isIndependent = gapClaimDraft.independentClaims.some((c) => c.number === claim.number);
          const isOpen = expanded === claim.number;
          return (
            <div
              key={claim.number}
              className={`border rounded-xl overflow-hidden ${isIndependent ? 'border-blue-100' : 'border-slate-100'}`}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : claim.number)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold shrink-0 mt-0.5 ${isIndependent ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {claim.number}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[claim.type] ?? 'bg-slate-100 text-slate-500'}`}>
                      {claim.type}
                    </span>
                    {isIndependent && <span className="text-[10px] text-blue-500 font-medium">independent</span>}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 font-mono">{claim.text}</p>
                </div>
                <span className="text-slate-400 shrink-0 mt-1">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-50 p-4 bg-slate-50 space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Full Claim Text</p>
                    <p className="text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap">{claim.text}</p>
                  </div>
                  {claim.rationale && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Rationale</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{claim.rationale}</p>
                    </div>
                  )}
                  {claim.gapBasis && (
                    <div>
                      <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Gap Basis</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{claim.gapBasis}</p>
                    </div>
                  )}
                  {claim.vulnerabilities && claim.vulnerabilities.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Known Vulnerabilities</p>
                      <ul className="space-y-0.5">
                        {claim.vulnerabilities.map((v, i) => (
                          <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-red-400 shrink-0">⚠</span>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {gapClaimDraft.narrowAroundGuidance && gapClaimDraft.narrowAroundGuidance.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Narrow-Around Guidance</p>
          <div className="space-y-2">
            {gapClaimDraft.narrowAroundGuidance.map((g) => (
              <div key={g.blockerRef} className="border border-slate-100 rounded-xl p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">vs. <span className="font-mono">{g.blockerRef}</span></p>
                <ul className="space-y-0.5">
                  {g.distinctions.map((d, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-400 shrink-0">✓</span>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {gapClaimDraft.prosecutionNotes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Prosecution Notes</p>
          <p className="text-xs text-slate-700 leading-relaxed">{gapClaimDraft.prosecutionNotes}</p>
        </div>
      )}
    </div>
  );
}
