import { CheckCircle2, Clock, XCircle, BarChart3 } from 'lucide-react';

interface Props {
  completedSearches: number;
  failedSearches: number;
  inProgressSearches: number;
  searchesThisMonth: number;
  quotaLimit: number;
}

export function DashboardStats({
  completedSearches,
  failedSearches,
  inProgressSearches,
  searchesThisMonth,
  quotaLimit,
}: Props) {
  const quotaPercent = quotaLimit === -1 ? 0 : Math.round((searchesThisMonth / quotaLimit) * 100);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
        label="Completed"
        value={completedSearches}
        bg="bg-green-50"
      />
      <StatCard
        icon={<Clock className="w-5 h-5 text-blue-500" />}
        label="In Progress"
        value={inProgressSearches}
        bg="bg-blue-50"
      />
      <StatCard
        icon={<XCircle className="w-5 h-5 text-red-500" />}
        label="Failed"
        value={failedSearches}
        bg="bg-red-50"
      />
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-purple-50">
            <BarChart3 className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-xs text-slate-400 font-medium">This Month</span>
        </div>
        <div className="text-2xl font-bold text-slate-900 mb-1">
          {searchesThisMonth}
          <span className="text-sm font-normal text-slate-400 ml-1">
            / {quotaLimit === -1 ? '∞' : quotaLimit}
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
          <div
            className="bg-purple-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(quotaPercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">Quota used</p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
