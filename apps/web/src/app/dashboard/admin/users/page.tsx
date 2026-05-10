import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { AdminNav } from '@/components/admin/admin-nav';
import { UserTable } from '@/components/admin/user-table';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (!me || (me.role !== 'ADMIN' && me.role !== 'ENTERPRISE')) redirect('/dashboard');

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, clerkId: true, name: true, email: true,
        role: true, subscriptionTier: true, subscriptionStatus: true,
        searchesUsedThisMonth: true, searchQuotaLimit: true,
        createdAt: true, lastQuotaResetAt: true,
        _count: { select: { searches: true } },
      },
    }),
    prisma.user.count(),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 mt-1">User management — edit roles, plans, quotas</p>
      </div>

      <AdminNav />

      <UserTable initialUsers={users as any} initialTotal={total} />
    </div>
  );
}
