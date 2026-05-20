-- Add ownerId to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- Create organization_invites table
CREATE TABLE IF NOT EXISTS "organization_invites" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "token"          TEXT NOT NULL,
    "invitedById"    TEXT NOT NULL,
    "accepted"       BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt"     TIMESTAMP(3),
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_invites_token_key" ON "organization_invites"("token");
CREATE INDEX IF NOT EXISTS "organization_invites_organizationId_idx" ON "organization_invites"("organizationId");
CREATE INDEX IF NOT EXISTS "organization_invites_token_idx" ON "organization_invites"("token");
CREATE INDEX IF NOT EXISTS "organization_invites_email_idx" ON "organization_invites"("email");

ALTER TABLE "organization_invites"
    ADD CONSTRAINT "organization_invites_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_invites"
    ADD CONSTRAINT "organization_invites_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
