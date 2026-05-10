#!/bin/bash
set -e

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     PrioVex.AI — Setup Script         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "❌ Node.js 22+ required. Current: $(node --version)"
  exit 1
fi
echo "✅ Node.js $(node --version)"

# Check if .env exists
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  No .env file found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Edit .env with your actual credentials before continuing"
  echo "   Required: DATABASE_URL, REDIS_URL, Clerk keys, at least one AI provider key"
  echo ""
  read -p "Press Enter when .env is configured..." _
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🗄️  Generating Prisma client..."
npm run db:generate

echo ""
echo "🗄️  Running database migrations..."
npm run db:migrate

echo ""
echo "🌱 Seeding database..."
npm run db:seed

echo ""
echo "✅ Validating environment..."
node scripts/validate-env.js

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     Setup Complete!                    ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "To start development:"
echo "  npm run dev          # Start all apps (web + workers)"
echo "  npm run db:studio    # Prisma Studio (DB browser)"
echo ""
echo "Or with Docker:"
echo "  docker-compose up -d"
echo ""
