-- PrioVex.AI v2 — Enterprise Intelligence Migration

-- New SearchType enum
CREATE TYPE "SearchType" AS ENUM ('PATENTABILITY', 'INVALIDITY', 'FTO', 'NOVELTY', 'EXAMINER_STYLE');

-- Extend SearchStatus enum with new pipeline steps
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'NOVEL_ELEMENTS';
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'NPL_SEARCH';
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'CLAIMS_RETRIEVAL';
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'AI_SCORING';
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'COVERAGE_ANALYSIS';
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'IDS_GENERATION';
ALTER TYPE "SearchStatus" ADD VALUE IF NOT EXISTS 'EXAMINER_SIMULATION';

-- Add searchType + nplFound to searches table
ALTER TABLE "searches"
  ADD COLUMN IF NOT EXISTS "searchType"        "SearchType" NOT NULL DEFAULT 'PATENTABILITY',
  ADD COLUMN IF NOT EXISTS "nplFound"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "confidentialMode"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "encryptionKeyId"   TEXT;

-- Update totalSteps default to 14
ALTER TABLE "searches" ALTER COLUMN "totalSteps" SET DEFAULT 14;

-- Create index on searchType
CREATE INDEX IF NOT EXISTS "searches_searchType_idx" ON "searches"("searchType");

-- Add v2 columns to reports table
ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "searchType"              "SearchType" NOT NULL DEFAULT 'PATENTABILITY',
  ADD COLUMN IF NOT EXISTS "novelElementsData"       JSONB,
  ADD COLUMN IF NOT EXISTS "coverageMatrixData"      JSONB,
  ADD COLUMN IF NOT EXISTS "idsEntriesData"          JSONB,
  ADD COLUMN IF NOT EXISTS "examinerSimulationData"  JSONB,
  ADD COLUMN IF NOT EXISTS "gapClaimDraftData"       JSONB,
  ADD COLUMN IF NOT EXISTS "nplReferencesData"       JSONB,
  ADD COLUMN IF NOT EXISTS "nplStatisticsData"       JSONB,
  ADD COLUMN IF NOT EXISTS "clientReportContent"     TEXT,
  ADD COLUMN IF NOT EXISTS "clientReportHtml"        TEXT,
  ADD COLUMN IF NOT EXISTS "clientPdfStorageUrl"     TEXT,
  ADD COLUMN IF NOT EXISTS "clientReportStorageUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "disclaimerVersion"       TEXT DEFAULT 'v2';

-- Add fullClaims and claimsSource to patent_cache
ALTER TABLE "patent_cache"
  ADD COLUMN IF NOT EXISTS "fullClaims"    JSONB,
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "claimsSource" TEXT;

-- Create npl_cache table
CREATE TABLE IF NOT EXISTS "npl_cache" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "sourceId"        TEXT NOT NULL UNIQUE,
  "source"          TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "authors"         TEXT[] NOT NULL DEFAULT '{}',
  "abstract"        TEXT,
  "publicationDate" TEXT,
  "url"             TEXT,
  "doi"             TEXT,
  "categories"      TEXT[] NOT NULL DEFAULT '{}',
  "citationCount"   INTEGER,
  "rawData"         JSONB NOT NULL,
  "cachedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"       TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "npl_cache_sourceId_idx" ON "npl_cache"("sourceId");
CREATE INDEX IF NOT EXISTS "npl_cache_source_idx"   ON "npl_cache"("source");
CREATE INDEX IF NOT EXISTS "npl_cache_cachedAt_idx" ON "npl_cache"("cachedAt");

-- Add nplSearch column to daily_stats
ALTER TABLE "daily_stats"
  ADD COLUMN IF NOT EXISTS "totalNplSearches" INTEGER NOT NULL DEFAULT 0;
