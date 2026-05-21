'use client';

interface NPLReference {
  id: string;
  title: string;
  authors: string[];
  publicationDate?: string;
  source: string;
  url?: string;
  doi?: string;
  abstract?: string;
  relevanceScore?: number;
  noveltyImpact?: string;
  similarities?: string[];
}

interface NPLReferencesProps {
  references: NPLReference[] | null;
  stats?: {
    arxivFound?: number;
    semanticScholarFound?: number;
    usptoEftsFound?: number;
    totalAfterFilter?: number;
    sourcesSearched?: string[];
  } | null;
}

const SOURCE_BADGE: Record<string, string> = {
  'arXiv': 'bg-red-50 text-red-700',
  'Semantic Scholar': 'bg-purple-50 text-purple-700',
  'USPTO EFTS (Grants)': 'bg-blue-50 text-blue-700',
  'USPTO EFTS (Applications)': 'bg-indigo-50 text-indigo-700',
  'EPO OPS': 'bg-emerald-50 text-emerald-700',
};

const IMPACT_STYLE: Record<string, string> = {
  blocking: 'bg-red-100 text-red-700',
  strong: 'bg-orange-100 text-orange-700',
  moderate: 'bg-amber-100 text-amber-700',
  weak: 'bg-yellow-100 text-yellow-700',
  minimal: 'bg-slate-100 text-slate-500',
};

export function NPLReferences({ references, stats }: NPLReferencesProps) {
  if (!references || references.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Non-Patent Literature</h2>
        <p className="text-sm text-slate-400">No NPL references found for this search.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Non-Patent Literature</h2>
        <span className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-full font-medium">
          {references.length} references
        </span>
      </div>

      {stats?.sourcesSearched && stats.sourcesSearched.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {stats.sourcesSearched.map((src) => (
            <span key={src} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[src] ?? 'bg-slate-100 text-slate-600'}`}>
              {src}
            </span>
          ))}
          <span className="text-xs text-slate-400 self-center">
            {stats.totalAfterFilter ?? references.length} after relevance filter
          </span>
        </div>
      )}

      <div className="space-y-3">
        {references.map((ref) => (
          <div key={ref.id} className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1">
                {ref.url ? (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline leading-snug">
                    {ref.title}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-slate-800 leading-snug">{ref.title}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ref.relevanceScore !== undefined && (
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-700">{ref.relevanceScore}<span className="text-xs font-normal text-slate-400">%</span></div>
                  </div>
                )}
                {ref.noveltyImpact && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${IMPACT_STYLE[ref.noveltyImpact] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ref.noveltyImpact}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[ref.source] ?? 'bg-slate-100 text-slate-600'}`}>
                {ref.source}
              </span>
              {ref.authors.length > 0 && (
                <span className="text-xs text-slate-400">
                  {ref.authors.slice(0, 3).join(', ')}{ref.authors.length > 3 ? ' et al.' : ''}
                </span>
              )}
              {ref.publicationDate && (
                <span className="text-xs text-slate-400">{ref.publicationDate.slice(0, 4)}</span>
              )}
              {ref.doi && (
                <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-500 font-mono">
                  DOI
                </a>
              )}
            </div>

            {ref.abstract && (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">{ref.abstract.slice(0, 300)}…</p>
            )}

            {ref.similarities && ref.similarities.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-amber-600 mb-1">Relevant to your invention</p>
                <ul className="space-y-0.5">
                  {ref.similarities.slice(0, 2).map((s, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-amber-400 shrink-0">→</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
