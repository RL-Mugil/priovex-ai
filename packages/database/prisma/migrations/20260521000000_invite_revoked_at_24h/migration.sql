-- Add revokedAt to organization_invites to support invite revocation
ALTER TABLE "organization_invites"
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
