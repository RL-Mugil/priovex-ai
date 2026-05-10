import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { AdminNav } from '@/components/admin/admin-nav';
import { PlanConfigForm } from '@/components/admin/plan-config-form';
import { getPlanQuotas } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (!me || me.role !== 'ADMIN') redirect('/dashboard');

  const [quotas, tierStats] = await Promise.all([
    getPlanQuotas(),
    prisma.user.groupBy({ by: ['subscriptionTier'], _count: { id: true } }),
  ]);

  const countByTier: Record<string, number> = {};
  for (const t of tierStats) countByTier[t.subscriptionTier] = t._count.id;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 mt-1">Plan configuration — set default search quotas per tier</p>
      </div>

      <AdminNav />

      <div className="grid md:grid-cols-4 gap-4 mb-2">
        {['FREE', 'PRO', 'AGENCY', 'ENTERPRISE'].map((tier) => (
          <div key={tier} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{countByTier[tier] ?? 0}</p>
            <p className="text-sm text-slate-500">{tier} users</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Monthly Search Quotas</h2>
        <p className="text-sm text-slate-500 mb-6">
          These are the default search quotas per plan tier. Changes automatically propagate to users
          on each tier (unless their quota was individually overridden via the Users tab).
        </p>
        <PlanConfigForm initialQuotas={quotas} />
      </div>
    </div>
  );
}
