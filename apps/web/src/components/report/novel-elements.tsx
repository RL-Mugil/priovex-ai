'use client';

interface NovelElement {
  id: string;
  label: string;
  component: string;
  function: string;
  technicalPurpose: string;
  noveltyWeight: number;
  claimLanguage: string;
  searchKeywords?: string[];
  cpcMapping?: string[];
}

interface NovelElementsProps {
  elements: NovelElement[] | null;
}

function NoveltyBar({ weight }: { weight: number }) {
  const color = weight >= 70 ? 'bg-emerald-500' : weight >= 40 ? 'bg-amber-500' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${weight}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-500 w-8 text-right">{weight}%</span>
    </div>
  );
}

export function NovelElements({ elements }: NovelElementsProps) {
  if (!elements || elements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Novel Element Decomposition</h2>
        <p className="text-sm text-slate-400">No novel elements decomposed for this search.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Novel Element Decomposition</h2>
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
          {elements.length} elements
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {elements.map((el) => (
          <div key={el.id} className="border border-slate-100 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {el.label.toUpperCase()}
                </span>
                <p className="font-medium text-slate-900 text-sm">{el.component}</p>
              </div>
            </div>
            <NoveltyBar weight={el.noveltyWeight} />
            <p className="text-xs text-slate-500">{el.technicalPurpose}</p>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wide">Claim language</p>
              <p className="text-xs text-slate-700 leading-relaxed italic">{el.claimLanguage}</p>
            </div>
            {el.searchKeywords && el.searchKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {el.searchKeywords.slice(0, 4).map((kw, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{kw}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
