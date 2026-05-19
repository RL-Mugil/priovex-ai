#!/usr/bin/env bash
# =============================================================================
# PrioVex.AI — Azure Resource Provisioning
#
# Provisions all required Azure resources using the free 12-month tier.
# Designed to run in Azure Cloud Shell (portal.azure.com → Cloud Shell icon)
# so no local Azure CLI installation is needed.
#
# Run once:
#   1. Go to portal.azure.com
#   2. Click the >_ Cloud Shell icon (top nav bar)
#   3. Choose Bash
#   4. Upload or paste this script, then: bash provision-azure.sh
#
# What gets created:
#   - Resource Group
#   - Azure Container Registry  (Basic)
#   - Azure PostgreSQL Flexible Server  (B1MS — free 12 months)
#   - Azure Cache for Redis  (C0 Basic — free 12 months)
#   - Azure Storage Account + Blob Container  (LRS — 5 GB free)
#   - Azure VM  (B2s during $200 credit / B1s after — Ubuntu 24.04 + Docker)
#   - Azure Communication Services  (free 100 emails/day)
#   - Static public IP + NSG (ports 22, 80, 443)
# =============================================================================
set -euo pipefail

# ── Configuration — edit these before running ─────────────────────────────────
PROJECT="priovex"
LOCATION="southindia"            # Change to your nearest region
                                  # Options: eastus, westeurope, southindia, southeastasia

# VM size: B2s uses $200 credit (recommended for 30 days), B1s is free forever after
VM_SIZE="Standard_B2s"           # Switch to Standard_B1s after credit runs out

# Credentials — change these
PG_ADMIN_USER="priovexadmin"
PG_ADMIN_PASS="PrioVex@Azure2026!"   # Must: 8+ chars, upper+lower+digit+symbol
PG_APP_PASS="PrioVexApp@2026!"       # Used by the application (priovexapp user)
VM_ADMIN_USER="azureuser"

# ── Derived names (globally unique where needed) ──────────────────────────────
SUFFIX=$(cat /proc/sys/kernel/random/uuid | tr -d '-' | head -c 6)
RG="${PROJECT}-rg"
ACR_NAME="${PROJECT}acr${SUFFIX}"          # Must be globally unique, alphanumeric
PG_SERVER="${PROJECT}-db-${SUFFIX}"        # Must be globally unique
REDIS_NAME="${PROJECT}-redis-${SUFFIX}"    # Must be globally unique
STORAGE_ACCOUNT="${PROJECT}stor${SUFFIX}"  # 3-24 chars, lowercase, no hyphens
STORAGE_CONTAINER="priovex-reports"
VM_NAME="${PROJECT}-vm"
IP_NAME="${PROJECT}-ip"
NSG_NAME="${PROJECT}-nsg"
VNET_NAME="${PROJECT}-vnet"
SUBNET_NAME="${PROJECT}-subnet"
EMAIL_SERVICE="${PROJECT}-email-${SUFFIX}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        PrioVex.AI — Azure Resource Provisioning             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Region:   $LOCATION"
echo "  Project:  $PROJECT"
echo "  Suffix:   $SUFFIX"
echo "  VM Size:  $VM_SIZE"
echo ""

# ── 1. Resource Group ─────────────────────────────────────────────────────────
echo "==> [1/8] Creating resource group: $RG"
az group create \
  --name "$RG" \
  --location "$LOCATION" \
  --output none
echo "  ✓ Resource group created"

# ── 2. Azure Container Registry ──────────────────────────────────────────────
echo ""
echo "==> [2/8] Creating Container Registry: $ACR_NAME"
az acr create \
  --resource-group "$RG" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none
ACR_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
echo "  ✓ ACR: $ACR_SERVER"

# ── 3. Azure PostgreSQL Flexible Server ──────────────────────────────────────
echo ""
echo "==> [3/8] Creating PostgreSQL Flexible Server: $PG_SERVER"
echo "    (this takes ~5 minutes)"
az postgres flexible-server create \
  --resource-group "$RG" \
  --name "$PG_SERVER" \
  --location "$LOCATION" \
  --admin-user "$PG_ADMIN_USER" \
  --admin-password "$PG_ADMIN_PASS" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0 \
  --output none

# Allowlist extensions BEFORE creating databases (required by Azure)
echo "    Allowlisting pgvector and pg_trgm extensions..."
az postgres flexible-server parameter set \
  --resource-group "$RG" \
  --server-name "$PG_SERVER" \
  --name azure.extensions \
  --value "vector,pg_trgm" \
  --output none

PG_HOST="${PG_SERVER}.postgres.database.azure.com"
echo "  ✓ PostgreSQL: $PG_HOST"

# ── 4. Azure Cache for Redis ──────────────────────────────────────────────────
echo ""
echo "==> [4/8] Creating Redis Cache: $REDIS_NAME"
echo "    (this takes ~15 minutes — continuing with other resources)"
az redis create \
  --resource-group "$RG" \
  --name "$REDIS_NAME" \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size c0 \
  --minimum-tls-version 1.2 \
  --output none &
REDIS_PID=$!
echo "    Redis provisioning running in background (PID $REDIS_PID)..."

# ── 5. Azure Storage Account + Blob Container ─────────────────────────────────
echo ""
echo "==> [5/8] Creating Storage Account: $STORAGE_ACCOUNT"
az storage account create \
  --resource-group "$RG" \
  --name "$STORAGE_ACCOUNT" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access true \
  --output none

STORAGE_KEY=$(az storage account keys list \
  --resource-group "$RG" \
  --account-name "$STORAGE_ACCOUNT" \
  --query "[0].value" -o tsv)

STORAGE_CONN="DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net"

# Create the reports container with blob-level public access
az storage container create \
  --name "$STORAGE_CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$STORAGE_KEY" \
  --public-access blob \
  --output none
echo "  ✓ Storage: ${STORAGE_ACCOUNT}.blob.core.windows.net/$STORAGE_CONTAINER"

# ── 6. Azure Communication Services (email) ───────────────────────────────────
echo ""
echo "==> [6/8] Creating Communication Services: $EMAIL_SERVICE"
az communication create \
  --resource-group "$RG" \
  --name "$EMAIL_SERVICE" \
  --location global \
  --data-location unitedstates \
  --output none 2>/dev/null || echo "    (skipped — use Azure Portal to set up email domain manually)"
echo "  ✓ Communication Services created (configure email domain in Portal)"

# ── 7. Azure VM (Ubuntu 24.04 + Docker) ───────────────────────────────────────
echo ""
echo "==> [7/8] Creating VM: $VM_NAME ($VM_SIZE)"

# Cloud-init: installs Docker, docker compose plugin, postgresql-client, certbot
CLOUD_INIT=$(cat <<'CLOUDINIT'
#cloud-config
package_update: true
packages:
  - apt-transport-https
  - ca-certificates
  - curl
  - gnupg
  - postgresql-client
  - git
  - snapd
runcmd:
  - curl -fsSL https://get.docker.com | sh
  - usermod -aG docker azureuser
  - mkdir -p /usr/local/lib/docker/cli-plugins
  - curl -SL https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
  - chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  - mkdir -p /opt/priovex/nginx/certs /opt/priovex/nginx/certbot/www
  - chown -R azureuser:azureuser /opt/priovex
  - snap install --classic certbot
  - ln -sf /snap/bin/certbot /usr/bin/certbot
CLOUDINIT
)

echo "$CLOUD_INIT" > /tmp/cloud-init.yaml

# Generate SSH key pair for this deployment
ssh-keygen -t ed25519 -f /tmp/priovex-vm-key -N "" -C "priovex-azure-vm" 2>/dev/null || true
VM_SSH_PUB=$(cat /tmp/priovex-vm-key.pub)

# Create VNet + Subnet + NSG + Public IP + VM
az network vnet create \
  --resource-group "$RG" \
  --name "$VNET_NAME" \
  --address-prefix 10.0.0.0/16 \
  --subnet-name "$SUBNET_NAME" \
  --subnet-prefix 10.0.0.0/24 \
  --output none

az network public-ip create \
  --resource-group "$RG" \
  --name "$IP_NAME" \
  --sku Standard \
  --allocation-method Static \
  --output none

az network nsg create \
  --resource-group "$RG" \
  --name "$NSG_NAME" \
  --output none

# Allow SSH, HTTP, HTTPS
for rule in \
  "SSH 22 100" \
  "HTTP 80 110" \
  "HTTPS 443 120"; do
  read NAME PORT PRIORITY <<< "$rule"
  az network nsg rule create \
    --resource-group "$RG" \
    --nsg-name "$NSG_NAME" \
    --name "$NAME" \
    --priority "$PRIORITY" \
    --protocol Tcp \
    --destination-port-ranges "$PORT" \
    --access Allow \
    --output none
done

az vm create \
  --resource-group "$RG" \
  --name "$VM_NAME" \
  --location "$LOCATION" \
  --image Ubuntu2404 \
  --size "$VM_SIZE" \
  --admin-username "$VM_ADMIN_USER" \
  --ssh-key-value "$VM_SSH_PUB" \
  --vnet-name "$VNET_NAME" \
  --subnet "$SUBNET_NAME" \
  --public-ip-address "$IP_NAME" \
  --nsg "$NSG_NAME" \
  --custom-data /tmp/cloud-init.yaml \
  --output none

VM_IP=$(az vm show \
  --resource-group "$RG" \
  --name "$VM_NAME" \
  --show-details \
  --query publicIps -o tsv)

echo "  ✓ VM: $VM_IP (cloud-init installing Docker in background ~3 min)"

# ── 8. Wait for Redis + collect credentials ───────────────────────────────────
echo ""
echo "==> [8/8] Waiting for Redis to finish provisioning..."
wait $REDIS_PID
REDIS_HOST="${REDIS_NAME}.redis.cache.windows.net"
REDIS_KEY=$(az redis list-keys \
  --resource-group "$RG" \
  --name "$REDIS_NAME" \
  --query primaryKey -o tsv)
REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380"
echo "  ✓ Redis: $REDIS_HOST:6380"

# ── Save SSH key ──────────────────────────────────────────────────────────────
SSH_KEY_FILE="./priovex-vm-key.pem"
cp /tmp/priovex-vm-key "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"
echo ""
echo "  SSH private key saved to: $SSH_KEY_FILE"
echo "  ⚠  Download this file and store it securely — you cannot recover it later"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Provisioning Complete — Copy These             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "── GitHub Secrets (Settings → Secrets → Actions) ──────────────"
echo ""
echo "  ACR_LOGIN_SERVER     = $ACR_SERVER"
echo "  ACR_USERNAME         = $ACR_USERNAME"
echo "  ACR_PASSWORD         = $ACR_PASSWORD"
echo ""
echo "  VM_HOST              = $VM_IP"
echo "  VM_USER              = $VM_ADMIN_USER"
echo "  VM_SSH_KEY           = (contents of $SSH_KEY_FILE)"
echo ""
echo "  NEXT_PUBLIC_APP_URL  = https://app.priovex.ai"
echo ""
echo "── .env.prod values ────────────────────────────────────────────"
echo ""
echo "  DATABASE_URL         = postgresql://${PG_ADMIN_USER}:${PG_ADMIN_PASS}@${PG_HOST}:5432/postgres?sslmode=require"
echo "  DATABASE_DIRECT_URL  = postgresql://${PG_ADMIN_USER}:${PG_ADMIN_PASS}@${PG_HOST}:5432/postgres?sslmode=require"
echo "  REDIS_URL            = $REDIS_URL"
echo ""
echo "  AZURE_STORAGE_CONNECTION_STRING = $STORAGE_CONN"
echo "  AZURE_STORAGE_CONTAINER         = $STORAGE_CONTAINER"
echo ""
echo "── /opt/priovex/.env on VM (docker-compose substitution) ───────"
echo ""
echo "  ACR_LOGIN_SERVER = $ACR_SERVER"
echo "  IMAGE_TAG        = latest"
echo ""
echo "── SSH into VM ─────────────────────────────────────────────────"
echo ""
echo "  ssh -i $SSH_KEY_FILE $VM_ADMIN_USER@$VM_IP"
echo ""
echo "── Next steps ──────────────────────────────────────────────────"
echo ""
echo "  1. Point DNS: app.priovex.ai → $VM_IP"
echo "                errors.priovex.ai → $VM_IP"
echo ""
echo "  2. Copy repo to VM:"
echo "     scp -i $SSH_KEY_FILE -r . $VM_ADMIN_USER@$VM_IP:/opt/priovex/"
echo ""
echo "  3. Run DB setup on VM:"
echo "     ssh -i $SSH_KEY_FILE $VM_ADMIN_USER@$VM_IP"
echo "     cd /opt/priovex && bash scripts/1-azure-db-setup.sh"
echo ""
echo "  4. Add GitHub secrets (listed above)"
echo ""
echo "  5. Push a commit → CI passes → deploy.yml auto-deploys"
echo ""
echo "  6. Get SSL certs (after DNS propagates):"
echo "     certbot certonly --webroot -w /opt/priovex/nginx/certbot/www \\"
echo "       -d app.priovex.ai -d errors.priovex.ai"
echo "     # Certs go to /etc/letsencrypt/live/ — copy to /opt/priovex/nginx/certs/"
echo ""

# Save summary to file
cat > /tmp/priovex-azure-credentials.txt <<CREDS
PrioVex.AI Azure Credentials — $(date)
Generated by provision-azure.sh

ACR_LOGIN_SERVER     = $ACR_SERVER
ACR_USERNAME         = $ACR_USERNAME
ACR_PASSWORD         = $ACR_PASSWORD

VM_HOST              = $VM_IP
VM_USER              = $VM_ADMIN_USER

DATABASE_URL         = postgresql://${PG_ADMIN_USER}:${PG_ADMIN_PASS}@${PG_HOST}:5432/postgres?sslmode=require
REDIS_URL            = $REDIS_URL
AZURE_STORAGE_CONNECTION_STRING = $STORAGE_CONN
AZURE_STORAGE_CONTAINER = $STORAGE_CONTAINER
CREDS

echo "  Full credentials also saved to: /tmp/priovex-azure-credentials.txt"
echo "  ⚠  Download that file before closing Cloud Shell"
echo ""
