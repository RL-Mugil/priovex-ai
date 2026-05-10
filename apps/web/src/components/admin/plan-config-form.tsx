'use client';

import { useState } from 'react';
import { Save, RefreshCw, Check, Infinity } from 'lucide-react';

const TIERS = [
  { key: 'FREE', label: 'Free', color: 'bg-slate-100 text-slate-700', desc: 'Default for new signups' },
  { key: 'PRO', label: 'Pro', color: 'bg-blue-100 text-blue-700', desc: 'Paid individual plan' },
  { key: 'AGENCY', label: 'Agency', color: 'bg-purple-100 text-purple-700', desc: 'Multi-seat agency plan' },
  { key: 'ENTERPRISE', label: 'Enterprise', color: 'bg-amber-100 text-amber-700', desc: 'Unlimited enterprise plan' },
] as const;

interface Props {
  initialQuotas: Record<string, number>;
}

export function PlanConfigForm({ initialQuotas }: Props) {
  const [quotas, setQuotas] = useState<Record<string, number>>(initialQuotas);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function setQuota(tier: string, value: string) {
    const num = value === '' ? 0 : parseInt(value, 10);
    if (!isNaN(num)) setQuotas((prev) => ({ ...prev, [tier]: num }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotas }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Auto-propagation:</strong> When you save, all users on a tier whose quota hasn&apos;t been manually overridden will be updated to the new default.
      </div>

      <div className="grid gap-4">
        {TIERS.map(({ key, label, color, desc }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                  {label}
                </span>
              </div>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <label className="block text-xs font-medium text-slate-500 mb-1">Searches / month</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={quotas[key] ?? 0}
                    onChange={(e) => setQuota(key, e.target.value)}
                    min="-1"
                    className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setQuotas((prev) => ({ ...prev, [key]: -1 }))}
                    title="Set to unlimited"
                    className={`p-1.5 rounded-lg border transition-colors ${quotas[key] === -1 ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                  >
                    <Infinity className="w-4 h-4" />
                  </button>
                </div>
                {quotas[key] === -1 && (
                  <p className="text-xs text-blue-600 mt-1">Unlimited</p>
                )}
                {quotas[key] !== -1 && quotas[key] !== undefined && (
                  <p className="text-xs text-slate-400 mt-1">{quotas[key]} searches</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Plan Configuration
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <Check className="w-4 h-4" /> Saved and applied to all users
          </span>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Current Configuration Preview</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TIERS.map(({ key, label, color }) => (
            <div key={key} className="text-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color} mb-1`}>{label}</span>
              <p className="text-xl font-bold text-slate-900 font-mono">
                {quotas[key] === -1 ? '∞' : (quotas[key] ?? 0)}
              </p>
              <p className="text-xs text-slate-400">searches/mo</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
