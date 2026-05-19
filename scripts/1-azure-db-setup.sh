#!/usr/bin/env bash
# =============================================================================
# Step 1 — One-time Azure PostgreSQL setup
# Run this ONCE before Prisma migrations and data import.
#
# Prerequisites (do these in Azure Portal FIRST — takes ~2 min):
#   1. Create Azure Database for PostgreSQL Flexible Server (B1MS, PostgreSQL 16)
#   2. Portal → Your server → Server parameters → azure.extensions
#      → add "vector" and "pg_trgm" to the allowlist → Save
#   3. Portal → Your server → Networking → Allow access from Azure services ✓
#      → Add your local IP (for running this script from your machine)
#
# Usage:
#   export AZURE_ADMIN_URL="postgresql://priovexadmin:PASSWORD@priovex-db.postgres.database.azure.com:5432/postgres?sslmode=require"
#   export APP_PASSWORD="your-strong-app-password"
#   bash scripts/1-azure-db-setup.sh
# =============================================================================
set -euo pipefail

: "${AZURE_ADMIN_URL:?ERROR: Set AZURE_ADMIN_URL (connect to 'postgres' DB as admin user)}"
: "${APP_PASSWORD:?ERROR: Set APP_PASSWORD for the application DB user}"

APP_DB="${APP_DB:-priovex}"
APP_USER="${APP_USER:-priovexapp}"
GLITCHTIP_DB="${GLITCHTIP_DB:-glitchtip}"

# Strip trailing database from admin URL and append target DB
BASE_URL="${AZURE_ADMIN_URL%/*}"

echo ""
echo "==> Creating databases..."
psql "$AZURE_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
  -- Application database
  SELECT 'CREATE DATABASE "$APP_DB"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$APP_DB') \gexec

  -- GlitchTip database (error tracking)
  SELECT 'CREATE DATABASE "$GLITCHTIP_DB"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$GLITCHTIP_DB') \gexec

  -- Application user
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN
      CREATE USER "$APP_USER" WITH PASSWORD '$APP_PASSWORD';
    END IF;
  END \$\$;
SQL

echo "==> Configuring priovex database (extensions + permissions)..."
psql "${BASE_URL}/${APP_DB}?sslmode=require" -v ON_ERROR_STOP=1 <<SQL
  -- Extensions schema (required by Prisma schema — vector and pg_trgm live here)
  CREATE SCHEMA IF NOT EXISTS extensions;

  -- NOTE: azure.extensions allowlist in Azure Portal is required before these work
  CREATE EXTENSION IF NOT EXISTS vector  WITH SCHEMA extensions;
  CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

  -- Grant app user full access to this database
  GRANT ALL PRIVILEGES ON DATABASE "$APP_DB" TO "$APP_USER";
  GRANT ALL ON SCHEMA public     TO "$APP_USER";
  GRANT ALL ON SCHEMA extensions TO "$APP_USER";
  GRANT USAGE ON SCHEMA extensions TO "$APP_USER";

  -- Ensure future tables/sequences in public are accessible
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES    TO "$APP_USER";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO "$APP_USER";

  -- Make app user owner of extensions schema so Prisma can introspect it
  ALTER SCHEMA extensions OWNER TO "$APP_USER";
SQL

echo "==> Configuring glitchtip database..."
psql "${BASE_URL}/${GLITCHTIP_DB}?sslmode=require" -v ON_ERROR_STOP=1 <<SQL
  GRANT ALL PRIVILEGES ON DATABASE "$GLITCHTIP_DB" TO "$APP_USER";
  GRANT ALL ON SCHEMA public TO "$APP_USER";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES    TO "$APP_USER";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO "$APP_USER";
SQL

echo ""
echo "✓ Azure PostgreSQL setup complete."
echo ""
echo "Next steps:"
echo "  1. Set DATABASE_URL and DATABASE_DIRECT_URL in .env.prod (use $APP_USER credentials)"
echo "  2. Run Prisma migrations to create the schema:"
echo "     docker compose -f docker-compose.prod.yml run -T --rm workers \\"
echo "       node_modules/.bin/prisma migrate deploy \\"
echo "       --schema=packages/database/prisma/schema.prisma"
echo "  3. Then run: bash scripts/2-migrate-from-supabase.sh"
