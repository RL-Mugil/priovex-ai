import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { AdminNav } from '@/components/admin/admin-nav';
import { formatRelativeTime, getStatusColor, humanizeStatus } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (!me || (me.role !== 'ADMIN' && me.role !== 'ENTERPRISE')) redirect('/dashboard');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersThisMonth,
    totalSearches,
    completedSearches,
    failedSearches,
    activeSearches,
    recentUsers,
    recentSearches,
    tierBreakdown,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.search.count(),
    prisma.search.count({ where: { status: 'COMPLETED' } }),
    prisma.search.count({ where: { status: 'FAILED' } }),
    prisma.search.count({
      where: {
        status: {
          notIn: ['COMPLETED', 'FAILED', 'CANCELLED'] as any,
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, name: true, email: true, subscriptionTier: true,
        role: true, createdAt: true, searchesUsedThisMonth: true,
      },
    }),
    prisma.search.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, title: true, status: true, progressPercent: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.user.groupBy({
      by: ['subscriptionTier'],
      _count: { id: true },
    }),
  ]);

  const tierColors: Record<string, string> = {
    FREE: 'bg-slate-200',
    PRO: 'bg-blue-400',
    AGENCY: 'bg-purple-400',
    ENTERPRISE: 'bg-amber-400',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 mt-1">Full platform control and analytics</p>
      </div>

      <AdminNav />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers, sub: `+${newUsersThisMonth} this month`, color: 'text-slate-900' },
          { label: 'Total Searches', value: totalSearches, sub: `${activeSearches} active now`, color: 'text-slate-900' },
          { label: 'Completed', value: completedSearches, sub: `${totalSearches > 0 ? Math.round((completedSearches / totalSearches) * 100) : 0}% success rate`, color: 'text-emerald-600' },
          { label: 'Failed', value: failedSearches, sub: `${totalSearches > 0 ? Math.round((failedSearches / totalSearches) * 100) : 0}% failure rate`, color: 'text-rose-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Users by Plan Tier</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['FREE', 'PRO', 'AGENCY', 'ENTERPRISE'].map((tier) => {
            const count = tierBreakdown.find((t) => t.subscriptionTier === tier)?._count.id ?? 0;
            const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
            return (
              <div key={tier} className="text-center">
                <div className={`w-full h-2 rounded-full mb-2 ${tierColors[tier]}`} style={{ opacity: 0.4 + (pct / 100) * 0.6 }} />
                <p className="text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-sm font-medium text-slate-600">{tier}</p>
                <p className="text-xs text-slate-400">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Users</h2>
            <a href="/dashboard/admin/users" className="text-sm text-blue-600 hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-slate-100">
            {recentUsers.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{u.subscriptionTier}</span>
                  {u.role === 'ADMIN' && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">ADMIN</span>}
                  <span className="text-xs text-slate-400">{formatRelativeTime(u.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent searches */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Searches</h2>
            <a href="/dashboard/admin/searches" className="text-sm text-blue-600 hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-slate-100">
            {recentSearches.map((s) => (
              <a key={s.id} href={`/dashboard/search/${s.id}`}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{s.title}</p>
                  <p className="text-xs text-slate-400 truncate">{s.user.name} · {s.user.email}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(s.status)}`}>
                    {humanizeStatus(s.status)}
                  </span>
                  <span className="text-xs text-slate-400">{formatRelativeTime(s.createdAt)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
