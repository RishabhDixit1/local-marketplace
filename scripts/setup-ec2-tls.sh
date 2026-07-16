#!/usr/bin/env bash
# setup-ec2-tls.sh — Install Caddy for TLS termination on EC2
#
# Run this ONCE on the EC2 instance. Requires:
#   - Domain DNS A record already pointing to this instance's public IP
#   - Ports 80 and 443 open in the security group
#
# Usage:
#   ssh ec2-user@<EC2_HOST> 'bash -s' < scripts/setup-ec2-tls.sh

set -euo pipefail

echo "=== Serviq EC2 TLS Setup (Caddy) ==="

# 1. Install Caddy
if ! command -v caddy &>/dev/null; then
  echo "Installing Caddy..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
  echo "Caddy installed: $(caddy version)"
else
  echo "Caddy already installed: $(caddy version)"
fi

# 2. Stop existing nginx if running (free ports 80/443)
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "Stopping nginx (Caddy will take over ports 80/443)..."
  sudo systemctl stop nginx
  sudo systemctl disable nginx
fi

# 3. Deploy Caddyfile
echo "Deploying Caddyfile..."
sudo cp /home/ec2-user/serviq/scripts/Caddyfile /etc/caddy/Caddyfile
sudo chown root:root /etc/caddy/Caddyfile
sudo chmod 644 /etc/caddy/Caddyfile

# 4. Reload Caddy
echo "Restarting Caddy..."
sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl restart caddy

# 5. Verify
sleep 3
if systemctl is-active --quiet caddy; then
  echo ""
  echo "=== Caddy is running ==="
  echo "TLS certificates will be auto-provisioned on first request."
  echo "Check status: sudo systemctl status caddy"
  echo "Check logs:   sudo journalctl -u caddy --no-pager -n 20"
  echo ""
  echo "Verify HTTPS works:"
  echo "  curl -I https://serviqapp.com"
  echo ""
  echo "NOTE: Update NEXT_PUBLIC_SUPABASE_URL in your env to use https://"
  echo "      if Supabase API is exposed via Caddy subdomain."
else
  echo "ERROR: Caddy failed to start. Check logs:"
  echo "  sudo journalctl -u caddy --no-pager -n 50"
  exit 1
fi
