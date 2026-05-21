'use client';

import { Download, FileText, ExternalLink, Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface DownloadUrls {
  pdf?: string | null;
  clientPdf?: string | null;
  markdown?: string | null;
  clientMarkdown?: string | null;
}

interface DownloadActionsProps {
  reportId: string;
  downloadUrls: DownloadUrls;
  searchId: string;
}

export function DownloadActions({ reportId, downloadUrls, searchId }: DownloadActionsProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000); return;
    }
    setSharing(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryDays: 30 }),
      });
      const data = await res.json() as { shareUrl?: string };
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
        await navigator.clipboard.writeText(data.shareUrl);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }
    } finally { setSharing(false); }
  }

  const downloads: Array<{ label: string; href: string; download?: string; className: string; icon: React.ReactNode }> = [
    {
      label: 'Technical Report PDF',
      href: downloadUrls.pdf ?? `/api/reports/${reportId}?format=pdf`,
      download: `report-${reportId}.pdf`,
      className: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700',
      icon: <Download className="w-4 h-4" />,
    },
    {
      label: 'Client Report PDF',
      href: downloadUrls.clientPdf ?? '#',
      download: `client-report-${reportId}.pdf`,
      className: downloadUrls.clientPdf
        ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed',
      icon: <Download className="w-4 h-4" />,
    },
    {
      label: 'Technical Markdown',
      href: `/api/reports/${reportId}?format=markdown`,
      download: `report-${reportId}.md`,
      className: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Client Markdown',
      href: downloadUrls.clientMarkdown ?? '#',
      download: `client-report-${reportId}.md`,
      className: downloadUrls.clientMarkdown
        ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700'
        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'JSON Data',
      href: `/api/reports/${reportId}?format=json`,
      className: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700',
      icon: <ExternalLink className="w-4 h-4" />,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-900 mb-4">Download & Share</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {downloads.map(({ label, href, download, className, icon }) => (
          <a
            key={label}
            href={href}
            download={download}
            target={!download ? '_blank' : undefined}
            rel={!download ? 'noopener noreferrer' : undefined}
            className={`flex items-center gap-2 border px-4 py-3 rounded-xl text-sm font-medium transition-colors ${className}`}
          >
            {icon}
            <span className="truncate">{label}</span>
          </a>
        ))}
      </div>
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 px-4 py-3 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors text-sm disabled:opacity-50"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : shareUrl ? <Copy className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {sharing ? 'Generating share link…' : copied ? 'Link copied!' : shareUrl ? 'Copy share link' : 'Share report (30-day link)'}
      </button>
    </div>
  );
}
