-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- Seed default plan quotas
INSERT INTO "system_configs" ("key", "value", "updatedAt") VALUES
  ('plan_quotas', '{"FREE": 3, "PRO": 25, "AGENCY": 100, "ENTERPRISE": -1}', NOW())
ON CONFLICT ("key") DO NOTHING;
