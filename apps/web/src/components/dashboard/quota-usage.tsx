import Link from 'next/link';

interface Props {
  used: number;
  limit: number;
  tier: string;
}

export function QuotaUsage({ used, limit, tier }: Props) {
  const unlimited = limit === -1;
  const percent = unlimited ? 0 : Math.min(Math.round((used / limit) * 100), 100);
  const isNearLimit = !unlimited && percent >= 80;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900 mb-4">Monthly Usage</h2>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Searches Used</span>
            <span className="text-sm font-medium text-slate-900">
              {used} / {unlimited ? '∞' : limit}
            </span>
          </div>
          {!unlimited && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">Current Plan</span>
            <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              {tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()}
            </span>
          </div>

          {tier === 'FREE' && (
            <Link
              href="/dashboard/billing"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 px-4 rounded-lg flex items-center justify-center transition-colors"
            >
              Upgrade Plan
            </Link>
          )}

          {tier !== 'FREE' && tier !== 'ENTERPRISE' && (
            <Link
              href="/dashboard/billing"
              className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 px-4 rounded-lg flex items-center justify-center transition-colors"
            >
              Manage Subscription
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
