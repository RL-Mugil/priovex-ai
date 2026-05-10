export type UserRole = 'user' | 'admin' | 'enterprise';
export type OrgRole = 'owner' | 'admin' | 'member';

export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  searchesUsedThisMonth: number;
  searchQuotaLimit: number;
  stripeCustomerId?: string;
  subscriptionTier: 'free' | 'pro' | 'agency' | 'enterprise';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'cancelled';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  members: OrgMember[];
  subscriptionTier: 'pro' | 'agency' | 'enterprise';
  searchQuotaLimit: number;
  searchesUsedThisMonth: number;
  stripeCustomerId?: string;
  createdAt: string;
}

export interface OrgMember {
  userId: string;
  role: OrgRole;
  joinedAt: string;
}
