import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@priovex/database';
import { AdminNav } from '@/components/admin/admin-nav';
import { SearchesTable } from '@/components/admin/searches-table';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ user?: string }>;
}

export default async function AdminSearchesPage(props: Props) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (!me || (me.role !== 'ADMIN' && me.role !== 'ENTERPRISE')) redirect('/dashboard');

  const { user: userFilter = '' } = await props.searchParams;

  const where: Record<string, unknown> = {};
  if (userFilter) {
    where.user = { email: { contains: userFilter, mode: 'insensitive' } };
  }

  const [searches, total] = await Promise.all([
    prisma.search.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, title: true, status: true, depth: true, searchType: true,
        progressPercent: true, patentsFound: true, nplFound: true,
        createdAt: true, completedAt: true, durationSeconds: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.search.count({ where }),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 mt-1">All platform searches — monitor, filter, cancel</p>
      </div>

      <AdminNav />

      <SearchesTable
        initialSearches={searches as any}
        initialTotal={total}
        initialSearch={userFilter}
      />
    </div>
  );
}
