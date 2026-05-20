'use client';

import { useState, useCallback } from 'react';
import { Search, RefreshCw, Edit2, RotateCcw, ExternalLink, X, Check } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  searchesUsedThisMonth: number;
  searchQuotaLimit: number;
  createdAt: string;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { searches: number };
}

interface AdminOrg {
  id: string;
  name: string;
  subscriptionTier: string;
  _count: { members: number };
}

interface Props {
  initialUsers: AdminUser[];
  initialTotal: number;
  orgs: AdminOrg[];
}

const TIERS = ['FREE', 'PRO', 'AGENCY', 'ENTERPRISE'];
const ROLES = ['USER', 'ADMIN', 'ENTERPRISE'];

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600',
    PRO: 'bg-blue-100 text-blue-700',
    AGENCY: 'bg-purple-100 text-purple-700',
    ENTERPRISE: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[tier] ?? 'bg-slate-100 text-slate-600'}`}>
      {tier}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    USER: 'bg-slate-100 text-slate-600',
    ADMIN: 'bg-red-100 text-red-700',
    ENTERPRISE: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[role] ?? 'bg-slate-100 text-slate-600'}`}>
      {role}
    </span>
  );
}

function EditUserModal({ user, orgs, onClose, onSaved }: {
  user: AdminUser;
  orgs: AdminOrg[];
  onClose: () => void;
  onSaved: (updated: Partial<AdminUser>) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [tier, setTier] = useState(user.subscriptionTier);
  const [quota, setQuota] = useState(String(user.searchQuotaLimit));
  const [status, setStatus] = useState(user.subscriptionStatus);
  const [orgId, setOrgId] = useState(user.organizationId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          subscriptionTier: tier,
          searchQuotaLimit: parseInt(quota, 10),
          subscriptionStatus: status,
          organizationId: orgId || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      const selectedOrg = orgs.find((o) => o.id === orgId) ?? null;
      onSaved({
        role,
        subscriptionTier: tier,
        searchQuotaLimit: parseInt(quota, 10),
        subscriptionStatus: status,
        organizationId: orgId || null,
        organization: selectedOrg ? { id: selectedOrg.id, name: selectedOrg.name } : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subscription Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Monthly Search Quota <span className="text-slate-400 font-normal">(-1 = unlimited)</span>
            </label>
            <input type="number" value={quota} onChange={(e) => setQuota(e.target.value)} min="-1"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subscription Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'UNPAID'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Team Assignment
              <span className="text-slate-400 font-normal ml-1">(bypasses invite flow)</span>
            </label>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— No team —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.subscriptionTier} · {o._count.members} member{o._count.members !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
            {user.organization && orgId !== user.organizationId && (
              <p className="text-xs text-amber-600 mt-1">
                Currently in <strong>{user.organization.name}</strong> — saving will move them.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserTable({ initialUsers, initialTotal, orgs }: Props) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const fetchUsers = useCallback(async (p = 1, s = search, t = tierFilter, r = roleFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), search: s, tier: t, role: r });
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json() as { users: AdminUser[]; total: number };
      setUsers(data.users);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter, roleFilter]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function resetQuota(user: AdminUser) {
    setResetting(user.id);
    try {
      await fetch(`/api/admin/users/${user.id}/reset-quota`, { method: 'POST' });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, searchesUsedThisMonth: 0 } : u));
      showToast(`Reset quota for ${user.name}`);
    } finally {
      setResetting(null);
    }
  }

  function onSaved(userId: string, updated: Partial<AdminUser>) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...updated } : u));
    showToast('User updated');
  }

  const pages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg z-50 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          orgs={orgs}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => { onSaved(editUser.id, updated); setEditUser(null); }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Search by name or email…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchUsers(1, search, tierFilter, roleFilter); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); fetchUsers(1, search, e.target.value, roleFilter); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All tiers</option>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); fetchUsers(1, search, tierFilter, e.target.value); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => fetchUsers(1, search, tierFilter, roleFilter)}
          className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <p className="text-sm text-slate-500">{total} user{total !== 1 ? 's' : ''} found</p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Team</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Usage</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Searches</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="text-slate-500 text-xs">{user.email}</p>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                  <td className="px-4 py-3">
                    <TierBadge tier={user.subscriptionTier} />
                    {user.subscriptionStatus !== 'ACTIVE' && (
                      <span className="ml-1 text-xs text-rose-500">{user.subscriptionStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.organization
                      ? <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{user.organization.name}</span>
                      : <span className="text-xs text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-900">
                      {user.searchesUsedThisMonth}
                    </span>
                    <span className="text-slate-400"> / </span>
                    <span className="font-mono text-slate-600">
                      {user.searchQuotaLimit === -1 ? '∞' : user.searchQuotaLimit}
                    </span>
                    {user.searchesUsedThisMonth >= user.searchQuotaLimit && user.searchQuotaLimit !== -1 && (
                      <span className="ml-1 text-xs text-rose-500 font-medium">FULL</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user._count.searches}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatRelativeTime(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditUser(user)}
                        title="Edit user"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => resetQuota(user)}
                        disabled={resetting === user.id}
                        title="Reset monthly quota"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                      >
                        <RotateCcw className={`w-4 h-4 ${resetting === user.id ? 'animate-spin' : ''}`} />
                      </button>
                      <a
                        href={`/dashboard/admin/searches?user=${encodeURIComponent(user.email)}`}
                        title="View searches"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => fetchUsers(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">
                Previous
              </button>
              <button onClick={() => fetchUsers(page + 1)} disabled={page >= pages}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
