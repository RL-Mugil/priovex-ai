-- Add share token and FTO risk data to reports
ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "shareToken"      TEXT,
  ADD COLUMN IF NOT EXISTS "shareExpiresAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "shareViewCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ftoRiskData"     JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "reports_shareToken_key" ON "reports"("shareToken");
CREATE INDEX IF NOT EXISTS "reports_shareToken_idx" ON "reports"("shareToken");
