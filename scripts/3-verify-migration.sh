#!/usr/bin/env bash
# =============================================================================
# Step 3 — Verify migration: compare row counts Supabase vs Azure
#
# Usage:
#   export SUPABASE_DIRECT_URL="postgresql://postgres.xxxx:password@db.xxxx.supabase.co:5432/postgres"
#   export AZURE_DB_URL="postgresql://priovexapp:password@priovex-db.postgres.database.azure.com:5432/priovex?sslmode=require"
#   bash scripts/3-verify-migration.sh
# =============================================================================
set -euo pipefail

: "${SUPABASE_DIRECT_URL:?ERROR: Set SUPABASE_DIRECT_URL}"
: "${AZURE_DB_URL:?ERROR: Set AZURE_DB_URL}"

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

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Migration Verification — Row Count Comparison    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
printf "%-25s %12s %12s %8s\n" "TABLE" "SUPABASE" "AZURE" "STATUS"
printf "%-25s %12s %12s %8s\n" "─────────────────────────" "────────────" "────────────" "────────"

PASS=0
FAIL=0

for table in "${TABLES[@]}"; do
  SUP_COUNT=$(psql "$SUPABASE_DIRECT_URL" -t -A -c "SELECT COUNT(*) FROM public.\"$table\";" 2>/dev/null || echo "N/A")
  AZ_COUNT=$(psql "$AZURE_DB_URL"         -t -A -c "SELECT COUNT(*) FROM public.\"$table\";" 2>/dev/null || echo "N/A")

  if [ "$SUP_COUNT" = "N/A" ] || [ "$AZ_COUNT" = "N/A" ]; then
    STATUS="⚠ ERROR"
    FAIL=$((FAIL + 1))
  elif [ "$SUP_COUNT" = "$AZ_COUNT" ]; then
    STATUS="✓ OK"
    PASS=$((PASS + 1))
  else
    STATUS="✗ MISMATCH"
    FAIL=$((FAIL + 1))
  fi

  printf "%-25s %12s %12s %8s\n" "$table" "$SUP_COUNT" "$AZ_COUNT" "$STATUS"
done

echo ""
echo "Result: $PASS passed, $FAIL failed"
echo ""

# Verify pgvector extension
echo "==> Checking extensions on Azure..."
psql "$AZURE_DB_URL" -c "
  SELECT extname, extversion, nspname AS schema
  FROM pg_extension
  JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid
  WHERE extname IN ('vector', 'pg_trgm')
  ORDER BY extname;
"

# Verify Prisma migration history
echo "==> Prisma migration history on Azure:"
psql "$AZURE_DB_URL" -c "
  SELECT migration_name, finished_at
  FROM _prisma_migrations
  ORDER BY finished_at;
" 2>/dev/null || echo "  (no _prisma_migrations table found — run prisma migrate deploy first)"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "⚠  Some tables have mismatched counts. Review before cutting over DNS."
  exit 1
else
  echo "✓ All table counts match. Safe to cut over DNS."
fi
