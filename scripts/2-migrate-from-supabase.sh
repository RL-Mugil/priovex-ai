#!/usr/bin/env bash
# =============================================================================
# Step 2 — Migrate data from Supabase → Azure PostgreSQL
#
# Run AFTER:
#   - scripts/1-azure-db-setup.sh
#   - Prisma migrate deploy (schema must exist on Azure before data import)
#
# Supabase direct URL (NOT the pooler URL — pg_dump needs a direct connection):
#   Format:  postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres
#   Find it: Supabase Dashboard → Project Settings → Database → Connection string → URI
#            Toggle "Display connection pooler" OFF to get the direct URL
#
# Usage:
#   export SUPABASE_DIRECT_URL="postgresql://postgres.xxxx:password@db.xxxx.supabase.co:5432/postgres"
#   export AZURE_DB_URL="postgresql://priovexapp:password@priovex-db.postgres.database.azure.com:5432/priovex?sslmode=require"
#   bash scripts/2-migrate-from-supabase.sh
# =============================================================================
set -euo pipefail

: "${SUPABASE_DIRECT_URL:?ERROR: Set SUPABASE_DIRECT_URL (direct, non-pooler Supabase connection)}"
: "${AZURE_DB_URL:?ERROR: Set AZURE_DB_URL (Azure priovex database, app user)}"

DUMP_FILE="/tmp/priovex-supabase-$(date +%Y%m%d-%H%M%S).dump"

# Application tables to migrate — excludes _prisma_migrations (Azure gets its own)
TABLES=(
  users
  organizations
  searches
  progress_logs
  reports
  patent_cache
  saved_patents
  npl_cache
  uploaded_files
  search_files
  stripe_events
  api_keys
  audit_logs
  notifications
  system_configs
  daily_stats
)

# Build --table flags
TABLE_FLAGS=()
for t in "${TABLES[@]}"; do
  TABLE_FLAGS+=(--table "public.$t")
done

echo ""
echo "==> Exporting data from Supabase..."
echo "    Tables: ${TABLES[*]}"
echo "    Output: $DUMP_FILE"
echo ""

pg_dump "$SUPABASE_DIRECT_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --data-only \
  "${TABLE_FLAGS[@]}" \
  --file="$DUMP_FILE"

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo "✓ Dump complete — $DUMP_SIZE"
echo ""
echo "==> Importing data to Azure PostgreSQL..."
echo "    (FK constraints temporarily suspended for clean import order)"
echo ""

# pg_restore with a wrapper that disables FK checks for the session
psql "$AZURE_DB_URL" -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;"

pg_restore \
  --dbname="$AZURE_DB_URL" \
  --no-owner \
  --no-acl \
  --single-transaction \
  --disable-triggers \
  --exit-on-error \
  "$DUMP_FILE"

# Re-enable FK checks
psql "$AZURE_DB_URL" -v ON_ERROR_STOP=1 -c "SET session_replication_role = DEFAULT;"

echo ""
echo "✓ Data import complete."
echo ""

# Quick row count check
echo "==> Row counts on Azure:"
psql "$AZURE_DB_URL" -c "
  SELECT
    schemaname,
    relname   AS table_name,
    n_live_tup AS row_count
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY n_live_tup DESC;
"

echo ""
echo "Next: run bash scripts/3-verify-migration.sh to compare counts with Supabase"

# Clean up dump file
rm -f "$DUMP_FILE"
echo "✓ Dump file removed."
