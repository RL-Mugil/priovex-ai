'use client';

import { useState } from 'react';

interface IDSEntry {
  id: string;
  type: 'patent' | 'npl';
  patentNumber?: string;
  title: string;
  assignee?: string;
  authors?: string[];
  publicationDate?: string;
  country?: string;
  url?: string;
  source?: string;
  relevanceScore: number;
  risk102: number;
  risk103: number;
  examinerCitationProbability: number;
  disclosureReason: string;
}

interface IDSTableProps {
  entries: IDSEntry[] | null;
}

type SortKey = 'relevanceScore' | 'risk102' | 'risk103' | 'examinerCitationProbability';

function RiskBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-red-400' : value >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-600 w-6">{value}</span>
    </div>
  );
}

export function IDSTable({ entries }: IDSTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('relevanceScore');
  const [desc, setDesc] = useState(true);

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">IDS References</h2>
        <p className="text-sm text-slate-400">No IDS entries generated for this search.</p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    const diff = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
    return desc ? -diff : diff;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setDesc((d) => !d);
    else { setSortKey(key); setDesc(true); }
  }

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="py-2 px-3 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {label} {sortKey === col ? (desc ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">IDS References</h2>
        <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full font-medium">
          {entries.filter((e) => e.type === 'patent').length} patents · {entries.filter((e) => e.type === 'npl').length} NPL
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        These references must be disclosed to the USPTO under 37 CFR 1.56. Sorted by disclosure priority.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-100">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Reference</th>
              <SortHeader col="relevanceScore" label="Relevance" />
              <SortHeader col="risk102" label="§102 Risk" />
              <SortHeader col="risk103" label="§103 Risk" />
              <SortHeader col="examinerCitationProbability" label="Examiner %" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-3 max-w-xs">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${
                      entry.type === 'patent' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
                    }`}>
                      {entry.type === 'patent' ? 'PAT' : 'NPL'}
                    </span>
                    <div>
                      <div className="font-medium text-slate-800">
                        {entry.url ? (
                          <a href={entry.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                            {entry.patentNumber ?? entry.title.slice(0, 40)}
                          </a>
                        ) : (
                          entry.patentNumber ?? entry.title.slice(0, 40)
                        )}
                      </div>
                      <div className="text-slate-400 truncate max-w-[200px]" title={entry.title}>
                        {entry.type === 'patent' ? entry.title : (entry.authors?.slice(0, 2).join(', ') ?? '')}
                      </div>
                      <div className="text-slate-300 mt-0.5">{entry.publicationDate?.slice(0, 4)} {entry.country ?? entry.source ?? ''}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3"><RiskBar value={entry.relevanceScore} /></td>
                <td className="py-3 px-3"><RiskBar value={entry.risk102} /></td>
                <td className="py-3 px-3"><RiskBar value={entry.risk103} /></td>
                <td className="py-3 px-3"><RiskBar value={entry.examinerCitationProbability} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
