#!/usr/bin/env bash
# =============================================================================
# VM First-Boot Setup
# Run this ONCE after SSH-ing into the Azure VM for the first time.
# It assumes Docker is already installed by cloud-init (wait ~3 min after VM creation).
#
# Usage (from your local machine):
#   scp -i priovex-vm-key.pem scripts/vm-setup.sh azureuser@VM_IP:/home/azureuser/
#   ssh -i priovex-vm-key.pem azureuser@VM_IP
#   bash vm-setup.sh
# =============================================================================
set -euo pipefail

echo ""
echo "==> Verifying Docker is ready..."
if ! docker info &>/dev/null; then
  echo "    Docker not ready yet — waiting for cloud-init to finish..."
  # cloud-init typically finishes in 3-5 minutes
  timeout 300 bash -c 'until docker info &>/dev/null; do sleep 10; echo "    still waiting..."; done'
fi
docker --version
docker compose version
echo "  ✓ Docker ready"

echo ""
echo "==> Creating directory structure under /opt/priovex..."
sudo mkdir -p /opt/priovex/nginx/certs/app.priovex.ai
sudo mkdir -p /opt/priovex/nginx/certs/errors.priovex.ai
sudo mkdir -p /opt/priovex/nginx/certbot/www
sudo chown -R azureuser:azureuser /opt/priovex
echo "  ✓ Directories created"

echo ""
echo "==> Installing postgresql-client (for migration scripts)..."
sudo apt-get install -y postgresql-client-16 2>/dev/null || \
sudo apt-get install -y postgresql-client 2>/dev/null || \
echo "    (install manually if needed: sudo apt-get install -y postgresql-client)"
echo "  ✓ postgresql-client ready"

echo ""
echo "==> Checking certbot..."
if ! command -v certbot &>/dev/null; then
  sudo snap install --classic certbot
  sudo ln -sf /snap/bin/certbot /usr/bin/certbot
fi
certbot --version
echo "  ✓ certbot ready"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  VM Setup Complete                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps (run these in order):"
echo ""
echo "  1. Copy the repo to the VM (from your local machine):"
echo "     rsync -avz --exclude node_modules --exclude .next \\"
echo "       -e 'ssh -i priovex-vm-key.pem' \\"
echo "       ./ azureuser@VM_IP:/opt/priovex/"
echo ""
echo "  2. Create env files on the VM:"
echo "     cd /opt/priovex"
echo "     cp .env.prod.example .env.prod     # fill in all values"
echo "     cp .env.glitchtip.example .env.glitchtip  # fill in values"
echo "     cp .env.compose.example .env       # fill in ACR_LOGIN_SERVER"
echo ""
echo "  3. Run DB setup:"
echo "     export AZURE_ADMIN_URL='postgresql://admin:pass@host:5432/postgres?sslmode=require'"
echo "     export APP_PASSWORD='your-app-password'"
echo "     bash scripts/1-azure-db-setup.sh"
echo ""
echo "  4. Start Nginx + GlitchTip first (web + workers come after first CI deploy):"
echo "     docker compose -f docker-compose.prod.yml up -d nginx glitchtip-worker glitchtip-web"
echo ""
echo "  5. Get SSL certs (DNS must point to this VM's IP first):"
echo "     sudo certbot certonly --webroot \\"
echo "       -w /opt/priovex/nginx/certbot/www \\"
echo "       -d app.priovex.ai \\"
echo "       -d errors.priovex.ai \\"
echo "       --email mugilvannan@myipstrategy.com \\"
echo "       --agree-tos --non-interactive"
echo ""
echo "  6. Copy certs to nginx volume:"
echo "     sudo cp /etc/letsencrypt/live/app.priovex.ai/fullchain.pem  /opt/priovex/nginx/certs/app.priovex.ai/"
echo "     sudo cp /etc/letsencrypt/live/app.priovex.ai/privkey.pem    /opt/priovex/nginx/certs/app.priovex.ai/"
echo "     sudo cp /etc/letsencrypt/live/errors.priovex.ai/fullchain.pem /opt/priovex/nginx/certs/errors.priovex.ai/"
echo "     sudo cp /etc/letsencrypt/live/errors.priovex.ai/privkey.pem   /opt/priovex/nginx/certs/errors.priovex.ai/"
echo "     sudo chown -R azureuser:azureuser /opt/priovex/nginx/certs"
echo "     docker compose -f docker-compose.prod.yml restart nginx"
echo ""
echo "  7. Add cron for cert auto-renewal:"
echo "     (crontab -l 2>/dev/null; echo '0 3 * * * certbot renew --quiet && docker compose -f /opt/priovex/docker-compose.prod.yml restart nginx') | crontab -"
echo ""
echo "  8. Add GitHub secrets → push a commit → CI deploys web + workers automatically"
echo ""
