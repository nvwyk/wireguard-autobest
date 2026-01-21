#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

// --- Configuration ---
const PING_COUNT = 4;
const PING_RETRIES = 2;
const PING_RETRY_DELAY_MS = 1000;
const STABILITY_DELAY_MS = 5000;
const IS_WINDOWS = process.platform === 'win32';

// --- Utility Functions ---

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function execAsync(command, options = {}) {
  return new Promise((resolve) => {
    exec(command, { timeout: 60000, ...options }, (error, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error });
    });
  });
}

// --- Ping Functions ---

function parsePingOutput(output) {
  if (!output) return null;

  // Windows: "Average = 6ms"
  const winMatch = output.match(/Average\s*=\s*(\d+)ms/i);
  if (winMatch) {
    return parseFloat(winMatch[1]);
  }

  // Linux: "min/avg/max/mdev = 1.0/2.0/3.0/0.5 ms"
  const linuxMatch = output.match(/\/(\d+(?:\.\d+)?)\//);
  if (linuxMatch) {
    return parseFloat(linuxMatch[1]);
  }

  // Single reply fallback: "time=6ms" or "time=6.5 ms"
  const singleMatch = output.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i);
  if (singleMatch) {
    return parseFloat(singleMatch[1]);
  }

  return null;
}

async function runPing(target, retries = PING_RETRIES) {
  const cmd = IS_WINDOWS
    ? `ping -n ${PING_COUNT} ${target}`
    : `ping -c ${PING_COUNT} ${target}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (attempt === 1) {
      console.log(`    [PING] ${target}...`);
    } else {
      console.log(`    [PING] Retry ${attempt}/${retries}...`);
    }

    const { stdout, error } = await execAsync(cmd, { timeout: 30000 });
    const avgPing = parsePingOutput(stdout);

    if (!error && avgPing !== null) {
      console.log(`    [PING] ${avgPing} ms`);
      return avgPing;
    }

    if (attempt < retries) {
      await delay(PING_RETRY_DELAY_MS);
    }
  }

  console.log('    [PING] No response after all retries.');
  return null;
}

// --- Traceroute Functions ---

function parseTracerouteOutput(output) {
  if (!output) return { hopCount: 0, lastHopRtt: null };

  const lines = output.split(/\r?\n/);
  const hopLines = lines.filter((line) => /^\s*\d+\s/.test(line));
  const hopCount = hopLines.length;

  let lastHopRtt = null;
  for (let i = hopLines.length - 1; i >= 0; i--) {
    // Match "XXms" or "XX ms"
    const matches = hopLines[i].match(/(\d+)\s*ms/gi);
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const num = lastMatch.match(/(\d+)/);
      if (num) {
        lastHopRtt = parseFloat(num[1]);
        break;
      }
    }
  }

  return { hopCount, lastHopRtt };
}

async function runTraceroute(target) {
  const cmd = IS_WINDOWS ? `tracert -d -w 1000 ${target}` : `traceroute -n ${target}`;

  console.log(`    [TRACE] ${target}...`);
  const { stdout, error } = await execAsync(cmd, { timeout: 90000 });

  // Log each hop
  if (stdout) {
    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
      if (/^\s*\d+\s/.test(line)) {
        console.log(`           ${line.trim()}`);
      }
    }
  }

  const { hopCount, lastHopRtt } = parseTracerouteOutput(stdout);
  if (error || hopCount === 0) {
    console.log('    [TRACE] Incomplete or timeout.');
  } else {
    console.log(`    [TRACE] Result: ${hopCount} hops, last RTT: ${lastHopRtt ?? '-'} ms`);
  }

  return { hopCount: hopCount || null, lastHopRtt };
}

// --- Config Parsing ---

async function parseEndpoint(configPath) {
  try {
    const content = await fs.promises.readFile(configPath, 'utf-8');
    const match = content.match(/Endpoint\s*=\s*([^:\s]+):(\d+)/i);
    if (match) {
      return { ip: match[1], port: match[2] };
    }
  } catch (err) {
    console.log(`    [ERROR] Failed to read config: ${err.message}`);
  }
  return null;
}

async function resolveHostname(ip) {
  const cmd = IS_WINDOWS ? `nslookup ${ip}` : `host ${ip}`;
  const { stdout, error } = await execAsync(cmd, { timeout: 5000 });
  
  if (error || !stdout) return null;
  
  if (IS_WINDOWS) {
    // Windows nslookup: "Name:    hostname.com"
    const match = stdout.match(/Name:\s+(.+)/i);
    return match ? match[1].trim() : null;
  } else {
    // Linux host: "165.186.127.79.in-addr.arpa domain name pointer hostname.com."
    const match = stdout.match(/pointer\s+(.+)\.$/m);
    return match ? match[1].trim() : null;
  }
}

async function checkEndpoint(configPath, routeName) {
  console.log(`    [ENDPOINT] Checking VPN server...`);
  
  const endpoint = await parseEndpoint(configPath);
  if (!endpoint) {
    console.log(`    [ENDPOINT] Could not parse endpoint from config.`);
    return;
  }
  
  console.log(`    [ENDPOINT] IP: ${endpoint.ip}:${endpoint.port}`);
  
  // Resolve hostname
  const hostname = await resolveHostname(endpoint.ip);
  if (hostname) {
    console.log(`    [ENDPOINT] Hostname: ${hostname}`);
  } else {
    console.log(`    [ENDPOINT] Hostname: (not resolved)`);
  }
  
  // Ping the VPN server
  const cmd = IS_WINDOWS
    ? `ping -n 4 ${endpoint.ip}`
    : `ping -c 4 ${endpoint.ip}`;
  
  const { stdout, error } = await execAsync(cmd, { timeout: 10000 });
  const avgPing = parsePingOutput(stdout);
  
  if (!error && avgPing !== null) {
    console.log(`    [ENDPOINT] Ping: ${avgPing} ms`);
  } else {
    console.log(`    [ENDPOINT] Ping: No response`);
  }
}

// --- WireGuard Functions (Windows) ---

async function wgUp(configPath, tunnelName) {
  if (IS_WINDOWS) {
    // Windows: wireguard /installtunnelservice <full_config_path>
    const fullPath = path.resolve(configPath);
    const cmd = `wireguard /installtunnelservice "${fullPath}"`;
    console.log(`    [WG] Starting tunnel: ${tunnelName}`);
    const { error } = await execAsync(cmd);
    return !error;
  } else {
    // Linux: wg-quick up <config>
    const cmd = `wg-quick up ${configPath}`;
    console.log(`    [WG] Starting tunnel: ${tunnelName}`);
    const { error } = await execAsync(cmd);
    return !error;
  }
}

async function wgDown(tunnelName) {
  if (IS_WINDOWS) {
    // Windows: wireguard /uninstalltunnelservice <tunnel_name>
    const cmd = `wireguard /uninstalltunnelservice "${tunnelName}"`;
    console.log(`    [WG] Stopping tunnel: ${tunnelName}`);
    await execAsync(cmd);
  } else {
    // Linux: wg-quick down <tunnel_name>
    const cmd = `wg-quick down ${tunnelName}`;
    console.log(`    [WG] Stopping tunnel: ${tunnelName}`);
    await execAsync(cmd);
  }
}

// --- Test Functions ---

async function testRoute(target, routeName, configPath = null) {
  console.log(`\n[ Testing: ${routeName} ]`);

  let tunnelStarted = false;

  try {
    // Check endpoint if config provided
    if (configPath) {
      await checkEndpoint(configPath, routeName);
    }
    
    // Start VPN if config provided
    if (configPath) {
      tunnelStarted = await wgUp(configPath, routeName);
      if (!tunnelStarted) {
        console.log(`    [WG] Failed to start tunnel.`);
        return { route: routeName, avgPing: null, hopCount: null, lastHopRtt: null };
      }
      console.log(`    [WG] Waiting ${STABILITY_DELAY_MS / 1000}s for stability...`);
      await delay(STABILITY_DELAY_MS);
    }

    // Run tests
    const avgPing = await runPing(target);
    const { hopCount, lastHopRtt } = await runTraceroute(target);

    return { route: routeName, avgPing, hopCount, lastHopRtt };
  } finally {
    // Stop VPN if started
    if (configPath && tunnelStarted) {
      await wgDown(routeName);
    }
  }
}

// --- Results Display ---

function renderResults(results) {
  const cols = [
    { name: 'Route', width: 28 },
    { name: 'Ping (ms)', width: 12 },
    { name: 'Hops', width: 8 },
    { name: 'Last RTT', width: 12 },
    { name: 'Best', width: 6 },
  ];

  // Find best route (lowest ping)
  const validResults = results.filter((r) => r.avgPing !== null);
  const best = validResults.length > 0
    ? validResults.reduce((a, b) => (a.avgPing < b.avgPing ? a : b))
    : null;

  // Header
  console.log('\n' + '='.repeat(66));
  console.log(cols.map((c) => c.name.padEnd(c.width)).join(''));
  console.log('-'.repeat(66));

  // Rows
  for (const r of results) {
    const isBest = best && r.route === best.route;
    const row = [
      r.route.padEnd(cols[0].width),
      (r.avgPing !== null ? r.avgPing.toFixed(1) : '-').padEnd(cols[1].width),
      (r.hopCount !== null ? String(r.hopCount) : '-').padEnd(cols[2].width),
      (r.lastHopRtt !== null ? r.lastHopRtt.toFixed(1) : '-').padEnd(cols[3].width),
      (isBest ? '✓' : '').padEnd(cols[4].width),
    ];
    console.log(row.join(''));
  }

  console.log('='.repeat(66));
  console.log(`\nBest route: ${best ? best.route : 'N/A'}`);
}

// --- Config Discovery ---

async function getConfigFiles() {
  const configsDir = path.join(__dirname, 'configs');

  try {
    const entries = await fs.promises.readdir(configsDir);
    return entries
      .filter((f) => f.endsWith('.conf'))
      .map((f) => ({
        name: path.basename(f, '.conf'),
        path: path.join(configsDir, f),
      }));
  } catch {
    console.warn('Warning: configs/ directory not found or not readable.');
    return [];
  }
}

// --- CLI ---

async function promptTarget() {
  const arg = process.argv[2];
  if (arg) return arg.trim();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter target IP or hostname: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- Admin Check ---

async function isAdmin() {
  if (IS_WINDOWS) {
    try {
      const { error } = await execAsync('net session', { timeout: 5000 });
      return !error;
    } catch {
      return false;
    }
  }
  // Linux: check if root
  return process.getuid && process.getuid() === 0;
}

// --- Main ---

async function main() {
  console.log('=== WireGuard Route Tester ===\n');
  console.log(`Platform: ${IS_WINDOWS ? 'Windows' : 'Linux'}`);

  // Check admin privileges
  const admin = await isAdmin();
  if (!admin) {
    console.warn('WARNING: Not running as Administrator!');
    console.warn('VPN tests will fail. Please run terminal as Administrator.\n');
  } else {
    console.log('Running as Administrator: Yes\n');
  }

  const target = await promptTarget();
  if (!target) {
    console.error('Error: Target cannot be empty.');
    process.exit(1);
  }

  console.log(`Target: ${target}`);

  const results = [];

  // Test NON-VPN
  const nonVpn = await testRoute(target, 'NON-VPN');
  results.push(nonVpn);

  // Test each VPN config
  const configs = await getConfigFiles();
  for (const cfg of configs) {
    const result = await testRoute(target, cfg.name, cfg.path);
    results.push(result);
  }

  // Display results
  renderResults(results);
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
