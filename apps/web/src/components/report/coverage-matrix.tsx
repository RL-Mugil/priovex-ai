'use client';

import { useState } from 'react';

interface CoverageCell {
  state: 'fully_covered' | 'partially_covered' | 'implied' | 'not_covered' | 'ambiguous';
  reasoning: string;
  confidenceScore: number;
  evidence?: string;
}

interface CoverageReference {
  id: string;
  publicationNumber?: string;
  title: string;
  type: 'patent' | 'npl';
  similarityScore?: number;
}

interface NovelElement {
  id: string;
  label: string;
  component: string;
  noveltyWeight: number;
}

interface CoverageMatrix {
  elements: NovelElement[];
  references: CoverageReference[];
  cells: Record<string, Record<string, CoverageCell>>;
}

interface CoverageMatrixProps {
  matrix: CoverageMatrix | null;
}

const CELL_STYLE: Record<string, { bg: string; text: string; symbol: string; label: string }> = {
  fully_covered:    { bg: 'bg-red-100',    text: 'text-red-700',    symbol: '✗', label: 'Fully covered' },
  partially_covered:{ bg: 'bg-amber-100',  text: 'text-amber-700',  symbol: '~', label: 'Partially covered' },
  implied:          { bg: 'bg-yellow-50',  text: 'text-yellow-700', symbol: '≈', label: 'Implied' },
  not_covered:      { bg: 'bg-emerald-100',text: 'text-emerald-700',symbol: '✓', label: 'Not covered' },
  ambiguous:        { bg: 'bg-slate-100',  text: 'text-slate-500',  symbol: '?', label: 'Ambiguous' },
};

export function CoverageMatrix({ matrix }: CoverageMatrixProps) {
  const [activeCell, setActiveCell] = useState<{ elemId: string; refId: string } | null>(null);

  if (!matrix || matrix.elements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Feature Coverage Matrix</h2>
        <p className="text-sm text-slate-400">No coverage matrix available for this search.</p>
      </div>
    );
  }

  const activeCellData = activeCell
    ? matrix.cells[activeCell.elemId]?.[activeCell.refId]
    : null;
  const activeRef = activeCell
    ? matrix.references.find((r) => r.id === activeCell.refId)
    : null;
  const activeElem = activeCell
    ? matrix.elements.find((e) => e.id === activeCell.elemId)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Feature Coverage Matrix</h2>
        <span className="text-xs text-slate-400">
          {matrix.elements.length} elements × {matrix.references.length} references
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(CELL_STYLE).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs ${val.bg} ${val.text}`}>{val.symbol}</span>
            <span className="text-slate-500">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 font-medium text-slate-500 min-w-[140px]">Element</th>
              {matrix.references.map((ref) => (
                <th key={ref.id} className="py-2 px-1 text-center font-medium text-slate-500 min-w-[60px] max-w-[80px]">
                  <div className="truncate" title={ref.title}>
                    {ref.publicationNumber ?? ref.title.slice(0, 12)}
                  </div>
                  {ref.type === 'npl' && (
                    <span className="text-violet-500 text-[10px]">NPL</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.elements.map((elem) => (
              <tr key={elem.id} className="border-t border-slate-50">
                <td className="py-2 pr-3 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {elem.label.toUpperCase()}
                    </span>
                    <span className="text-slate-700 font-medium truncate max-w-[100px]" title={elem.component}>
                      {elem.component}
                    </span>
                  </div>
                </td>
                {matrix.references.map((ref) => {
                  const cell = matrix.cells[elem.id]?.[ref.id];
                  if (!cell) {
                    return (
                      <td key={ref.id} className="py-2 px-1 text-center">
                        <span className="text-slate-200">—</span>
                      </td>
                    );
                  }
                  const style = CELL_STYLE[cell.state] ?? CELL_STYLE.ambiguous;
                  const isActive = activeCell?.elemId === elem.id && activeCell?.refId === ref.id;
                  return (
                    <td key={ref.id} className="py-2 px-1 text-center">
                      <button
                        onClick={() => setActiveCell(isActive ? null : { elemId: elem.id, refId: ref.id })}
                        className={`w-7 h-7 rounded font-bold text-sm mx-auto flex items-center justify-center transition-all ${style.bg} ${style.text} ${isActive ? 'ring-2 ring-blue-400 scale-110' : 'hover:scale-105'}`}
                        title={`${elem.component} × ${ref.publicationNumber ?? ref.title}: ${cell.state}`}
                      >
                        {style.symbol}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {activeCellData && activeRef && activeElem && (
        <div className="mt-4 border border-blue-100 rounded-xl p-4 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-800">
              Element {activeElem.label.toUpperCase()} ({activeElem.component}) ×{' '}
              {activeRef.publicationNumber ?? activeRef.title}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CELL_STYLE[activeCellData.state]?.bg} ${CELL_STYLE[activeCellData.state]?.text}`}>
              {activeCellData.state.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-2">{activeCellData.reasoning}</p>
          {activeCellData.evidence && (
            <div className="bg-white rounded p-2 border border-blue-100">
              <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Evidence</p>
              <p className="text-xs text-slate-600 italic">{activeCellData.evidence}</p>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-2">Confidence: {activeCellData.confidenceScore}%</p>
        </div>
      )}
    </div>
  );
}
