import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { syncUser } from '@/lib/user-sync';
import { prisma } from '@priovex/database';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/sign-in');

  // Sync Clerk user to our database
  await syncUser(clerkUser);

  // Fetch user to get role
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });

  const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'ENTERPRISE';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-h-screen">
        <DashboardHeader />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
