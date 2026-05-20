'use client';

import { useState, use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

interface Props {
  params: Promise<{ token: string }>;
}

export default function AcceptInvitePage(props: Props) {
  const params = use(props.params);
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Team Invitation</h1>
          <p className="text-slate-500 mb-6">Sign in or create an account to accept this invitation.</p>
          <a
            href={`/sign-in?redirect_url=/invite/${params.token}`}
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500"
          >
            Sign In to Accept
          </a>
        </div>
      </div>
    );
  }

  async function accept() {
    setStatus('loading');
    try {
      const res = await fetch(`/api/team/invite/${params.token}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setStatus('error'); setMessage(data.error); return; }
      setStatus('success');
      setMessage(data.organizationName);
      setTimeout(() => router.push('/dashboard/team'), 2000);
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">You joined {message}</h1>
          <p className="text-slate-500 mt-2">Redirecting to your team dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Team Invitation</h1>
        <p className="text-slate-500 mb-6">You have been invited to join a team on PrioVex.AI.</p>
        {status === 'error' && (
          <p className="text-rose-600 text-sm mb-4 bg-rose-50 border border-rose-200 rounded-lg p-3">{message}</p>
        )}
        <button
          onClick={accept}
          disabled={status === 'loading'}
          className="w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-60"
        >
          {status === 'loading' ? 'Accepting…' : 'Accept Invitation'}
        </button>
      </div>
    </div>
  );
}
