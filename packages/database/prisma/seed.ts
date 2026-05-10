import { PrismaClient, UserRole, PlanTier, SubStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create primary admin user (Clerk will sync actual auth)
  const admin1 = await prisma.user.upsert({
    where: { email: 'admin@priovex.ai' },
    update: {},
    create: {
      clerkId: 'seed_admin_clerk_id',
      email: 'admin@priovex.ai',
      name: 'PrioVex Admin',
      role: UserRole.ADMIN,
      subscriptionTier: PlanTier.ENTERPRISE,
      subscriptionStatus: SubStatus.ACTIVE,
    },
  });

  // Create secondary admin user
  const admin2 = await prisma.user.upsert({
    where: { email: 'mugilvannan@myipstrategy.com' },
    update: {},
    create: {
      clerkId: 'seed_mugil_clerk_id',
      email: 'mugilvannan@myipstrategy.com',
      name: 'Mugil Vannan',
      role: UserRole.ADMIN,
      subscriptionTier: PlanTier.ENTERPRISE,
      subscriptionStatus: SubStatus.ACTIVE,
    },
  });

  console.log('✅ Admin user created:', admin1.email);
  console.log('✅ Admin user created:', admin2.email);
  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
