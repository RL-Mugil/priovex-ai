'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Users, Mail, Plus, Crown, Clock, X } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
  createdAt: Date | string;
}

interface Invite {
  id: string;
  email: string;
  createdAt: Date | string;
  expiresAt: Date | string;
}

interface Organization {
  id: string;
  name: string;
  ownerId: string | null;
  subscriptionTier: string;
  searchQuotaLimit: number;
  searchesUsedThisMonth: number;
  members: Member[];
  invites: Invite[];
}

interface Props {
  user: { id: string; name: string; email: string; subscriptionTier: string };
  organization: Organization | null;
  isOwner: boolean;
}

export function TeamView({ user, organization, isOwner }: Props) {
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function createTeam() {
    if (!teamName.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      window.location.reload();
    } catch { setError('Failed to create team'); }
    finally { setLoading(false); }
  }

  async function revokeInvite(inviteId: string, email: string) {
    if (!confirm(`Revoke the invite sent to ${email}?`)) return;
    setRevoking(inviteId);
    try {
      const res = await fetch(`/api/team/invites/${inviteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(`Invite to ${email} revoked`);
      window.location.reload();
    } catch { setError('Failed to revoke invite'); }
    finally { setRevoking(null); }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      window.location.reload();
    } catch { setError('Failed to send invite'); }
    finally { setLoading(false); }
  }

  if (!organization) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No Team Yet</h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Create a team workspace to collaborate on patent searches with your colleagues.
          </p>
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Team
            </button>
          ) : (
            <div className="max-w-xs mx-auto space-y-3">
              <input
                type="text"
                placeholder="Team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && createTeam()}
              />
              {error && <p className="text-rose-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={createTeam}
                  disabled={loading || !teamName.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
                >
                  {loading ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => { setCreating(false); setError(''); }}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const seatLimit = organization.subscriptionTier === 'AGENCY' ? 5 : organization.subscriptionTier === 'ENTERPRISE' ? -1 : 1;
  const seatsUsed = organization.members.length;
  const canInvite = isOwner && (seatLimit === -1 || seatsUsed < seatLimit);

  return (
    <div className="space-y-6">
      {/* Team header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{organization.name}</h2>
              <p className="text-sm text-slate-500">{organization.subscriptionTier} plan · {seatsUsed}{seatLimit > 0 ? `/${seatLimit}` : ''} seats</p>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            <span className="font-medium text-slate-900">{organization.searchesUsedThisMonth}</span>/{organization.searchQuotaLimit === -1 ? '∞' : organization.searchQuotaLimit} searches used
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Members ({seatsUsed})</h3>
          {isOwner && canInvite && (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
              />
              <button
                onClick={sendInvite}
                disabled={loading || !inviteEmail.trim()}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5" />
                {loading ? '…' : 'Invite'}
              </button>
            </div>
          )}
          {!canInvite && isOwner && seatLimit > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">Seat limit reached</span>
          )}
        </div>

        {(error || success) && (
          <div className={`px-6 py-2 text-sm ${error ? 'text-rose-600 bg-rose-50' : 'text-emerald-700 bg-emerald-50'}`}>
            {error || success}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {organization.members.map((member) => (
            <div key={member.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {member.avatarUrl ? (
                  <Image src={member.avatarUrl} alt="" width={32} height={32} className="rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-medium">
                    {member.name[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                    {member.name}
                    {member.id === organization.ownerId && (
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    {member.id === user.id && (
                      <span className="text-xs text-slate-400">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{member.email}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">{formatRelativeTime(member.createdAt instanceof Date ? member.createdAt.toISOString() : member.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invites */}
      {isOwner && organization.invites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Pending Invites ({organization.invites.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {organization.invites.map((invite) => (
              <div key={invite.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                    <p className="text-xs text-slate-400">Invited {formatRelativeTime(invite.createdAt instanceof Date ? invite.createdAt.toISOString() : invite.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Expires {formatRelativeTime(invite.expiresAt instanceof Date ? invite.expiresAt.toISOString() : invite.expiresAt)}
                  </div>
                  <button
                    onClick={() => revokeInvite(invite.id, invite.email)}
                    disabled={revoking === invite.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Revoke invite"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
