'use client';

import { useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, Code2, BookOpen } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | string | null;
  usageCount: number;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

export function DeveloperView({ keys: initialKeys }: { keys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  async function createKey() {
    if (!newKeyName.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json() as { id: string; name: string; key: string; keyPrefix: string; createdAt: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed'); return; }
      setNewKey(data.key);
      setKeys(prev => [{ id: data.id, name: data.name, keyPrefix: data.keyPrefix, lastUsedAt: null, usageCount: 0, expiresAt: null, createdAt: data.createdAt }, ...prev]);
      setNewKeyName(''); setCreating(false);
    } catch { setError('Failed to create key'); }
    finally { setLoading(false); }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' });
    setKeys(prev => prev.filter(k => k.id !== id));
  }

  async function copyKey(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Developer API</h1>
        <p className="text-slate-500 mt-1">Integrate PrioVex.AI searches into your workflow via REST API.</p>
      </div>

      {/* New key shown once */}
      {newKey && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-2">API key created — copy it now, it won&apos;t be shown again.</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm font-mono text-emerald-900 truncate">{newKey}</code>
            <button onClick={() => copyKey(newKey)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-emerald-600 mt-2 hover:underline">Dismiss</button>
        </div>
      )}

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Key className="w-4 h-4" /> API Keys ({keys.length}/5)</h2>
          {!creating && keys.length < 5 && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500">
              <Plus className="w-3.5 h-3.5" /> New Key
            </button>
          )}
        </div>

        {creating && (
          <div className="px-6 py-3 border-b border-slate-100 flex gap-2">
            <input
              type="text" placeholder="Key name (e.g. Production, Testing)"
              value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey()}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={createKey} disabled={loading || !newKeyName.trim()} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-60">
              {loading ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => { setCreating(false); setError(''); }} className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        )}

        {error && <div className="px-6 py-2 text-sm text-rose-600 bg-rose-50">{error}</div>}

        {keys.length === 0 && !creating ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">No API keys yet. Create one to get started.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {keys.map(key => (
              <div key={key.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{key.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{key.keyPrefix}••••••••••••••••</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-slate-400">
                    <p>{key.usageCount} requests</p>
                    <p>{key.lastUsedAt ? `Last used ${formatRelativeTime(key.lastUsedAt instanceof Date ? key.lastUsedAt.toISOString() : key.lastUsedAt)}` : 'Never used'}</p>
                  </div>
                  <button onClick={() => revokeKey(key.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick-start docs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Quick Start</h2>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-slate-500 mb-1 font-medium">Base URL</p>
            <code className="block bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono text-xs">{appUrl}/api/v1</code>
          </div>
          <div>
            <p className="text-slate-500 mb-1 font-medium flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> Submit a search</p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg px-4 py-3 text-xs overflow-x-auto">{`curl -X POST ${appUrl}/api/v1/searches \\
  -H "Authorization: Bearer pvx_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My Invention",
    "description": "...",
    "technicalField": "Software",
    "problemSolved": "...",
    "keyInnovations": ["Feature A", "Feature B"]
  }'`}</pre>
          </div>
          <div>
            <p className="text-slate-500 mb-1 font-medium">Poll for results</p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg px-4 py-3 text-xs overflow-x-auto">{`curl ${appUrl}/api/v1/searches/{searchId} \\
  -H "Authorization: Bearer pvx_YOUR_KEY"`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
