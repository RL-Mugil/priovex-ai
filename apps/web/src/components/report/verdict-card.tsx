'use client';

import { getVerdictColor } from '@/lib/utils';

interface VerdictCardProps {
  patentabilityScore: number | null;
  overallVerdict: string | null;
  noveltyRating: string | null;
  obviousnessRating: string | null;
}

const RATING_COLOR: Record<string, string> = {
  HIGH: 'text-green-700',
  'MEDIUM-HIGH': 'text-emerald-700',
  MEDIUM: 'text-amber-700',
  'MEDIUM-LOW': 'text-orange-700',
  LOW: 'text-red-700',
};

export function VerdictCard({ patentabilityScore, overallVerdict, noveltyRating, obviousnessRating }: VerdictCardProps) {
  const verdict = overallVerdict ?? 'PROCEED_WITH_CAUTION';
  const colorClass = getVerdictColor(verdict);

  return (
    <div className={`rounded-2xl border p-6 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-70 mb-1">Patentability Verdict</p>
          <p className="text-3xl font-bold">{verdict.replace(/_/g, ' ')}</p>
        </div>
        <div className="text-right">
          <div className="text-6xl font-black">{patentabilityScore ?? '—'}</div>
          <div className="text-sm opacity-70">/ 100</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="bg-white/50 rounded-xl p-4">
          <p className="text-xs font-medium opacity-60 mb-1">Novelty (35 USC 102)</p>
          <p className={`font-bold text-lg ${RATING_COLOR[noveltyRating ?? ''] ?? ''}`}>{noveltyRating ?? '—'}</p>
        </div>
        <div className="bg-white/50 rounded-xl p-4">
          <p className="text-xs font-medium opacity-60 mb-1">Non-Obviousness (35 USC 103)</p>
          <p className={`font-bold text-lg ${RATING_COLOR[obviousnessRating ?? ''] ?? ''}`}>{obviousnessRating ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
