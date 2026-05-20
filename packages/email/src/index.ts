import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://priovex-app.centralindia.cloudapp.azure.com';

async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[Email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, (err as Error).message);
  }
}

export async function sendSearchComplete(opts: {
  to: string;
  name: string;
  searchTitle: string;
  searchId: string;
  score: number;
  verdict: string;
}): Promise<void> {
  const url = `${APP_URL}/dashboard/search/${opts.searchId}`;
  await send(
    opts.to,
    `Your patent search is ready — ${opts.searchTitle}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e3a5f">Search Complete</h2>
      <p>Hi ${opts.name},</p>
      <p>Your prior art search for <strong>${opts.searchTitle}</strong> has finished.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">Patentability Score</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${opts.score}/100</td>
        </tr>
        <tr>
          <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">Verdict</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${opts.verdict}</td>
        </tr>
      </table>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">View Full Report</a>
      <p style="color:#64748b;font-size:12px;margin-top:24px">PrioVex.AI — Patent Prior Art Intelligence</p>
    </div>`
  );
}

export async function sendSearchFailed(opts: {
  to: string;
  name: string;
  searchTitle: string;
  searchId: string;
  error?: string;
}): Promise<void> {
  const url = `${APP_URL}/dashboard/search/${opts.searchId}`;
  await send(
    opts.to,
    `Search failed — ${opts.searchTitle}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#dc2626">Search Failed</h2>
      <p>Hi ${opts.name},</p>
      <p>Your prior art search for <strong>${opts.searchTitle}</strong> encountered an error.</p>
      ${opts.error ? `<p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;color:#b91c1c">${opts.error}</p>` : ''}
      <a href="${url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Retry Search</a>
      <p style="color:#64748b;font-size:12px;margin-top:24px">PrioVex.AI — Patent Prior Art Intelligence</p>
    </div>`
  );
}

export async function sendQuotaWarning(opts: {
  to: string;
  name: string;
  used: number;
  limit: number;
  tier: string;
}): Promise<void> {
  const upgradeUrl = `${APP_URL}/dashboard/billing`;
  await send(
    opts.to,
    `You've used ${opts.used}/${opts.limit} searches this month`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#d97706">Search Quota Warning</h2>
      <p>Hi ${opts.name},</p>
      <p>You've used <strong>${opts.used} of ${opts.limit}</strong> searches this month on the <strong>${opts.tier}</strong> plan.</p>
      <p>Upgrade to get more searches and unlock advanced features.</p>
      <a href="${upgradeUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Upgrade Plan</a>
      <p style="color:#64748b;font-size:12px;margin-top:24px">PrioVex.AI — Patent Prior Art Intelligence</p>
    </div>`
  );
}

export async function sendTeamInvite(opts: {
  to: string;
  inviterName: string;
  teamName: string;
  token: string;
}): Promise<void> {
  const acceptUrl = `${APP_URL}/invite/${opts.token}`;
  await send(
    opts.to,
    `${opts.inviterName} invited you to join ${opts.teamName} on PrioVex.AI`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e3a5f">Team Invitation</h2>
      <p><strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.teamName}</strong> on PrioVex.AI.</p>
      <p>Accept the invitation to start collaborating on patent prior art searches.</p>
      <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Accept Invitation</a>
      <p style="color:#64748b;font-size:12px;margin-top:24px">This invitation expires in 24 hours. PrioVex.AI — Patent Prior Art Intelligence</p>
    </div>`
  );
}

export async function sendWelcome(opts: {
  to: string;
  name: string;
}): Promise<void> {
  const url = `${APP_URL}/dashboard`;
  await send(
    opts.to,
    'Welcome to PrioVex.AI — Your patent search platform',
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e3a5f">Welcome to PrioVex.AI</h2>
      <p>Hi ${opts.name},</p>
      <p>You're now set up on PrioVex.AI — the AI-powered patent prior art intelligence platform.</p>
      <p>Start your first search to get a comprehensive patentability analysis powered by BigQuery (170M+ patents), EPO OPS, arXiv, and more.</p>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Start a Search</a>
      <p style="color:#64748b;font-size:12px;margin-top:24px">PrioVex.AI — Patent Prior Art Intelligence</p>
    </div>`
  );
}
