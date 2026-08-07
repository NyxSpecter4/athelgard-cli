#!/usr/bin/env node
/**
 * ATHELGARD STATUS — Unified dashboard
 * Shows: baseline (sites) + api (costs) + system health
 * One command, everything that matters
 */

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for terminal
const C = process.stdout.isTTY ? {
  cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', gray: '\x1b[90m', reset: '\x1b[0m', bold: '\x1b[1m'
} : { cyan: '', green: '', red: '', yellow: '', gray: '', reset: '', bold: '' };

function c(str, color) { return C[color] + str + C.reset; }

// ===== FAST SITE CHECK =====
async function checkSite(url) {
  const start = Date.now();
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : require('http');
    const req = client.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        up: res.statusCode === 200,
        status: res.statusCode,
        time: Date.now() - start,
        size: Buffer.byteLength(body)
      }));
    });
    req.on('error', () => resolve({ up: false, status: 0, time: Date.now() - start, size: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ up: false, status: 0, time: 10000, size: 0 }); });
  });
}

// ===== LOAD BASELINE DATA =====
function loadBaseline() {
  const p = path.join(os.homedir(), '.athelgard-baseline-v2.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p));
}

// ===== LOAD API DATA =====
function loadAPI() {
  const p = path.join(os.homedir(), '.athelgard-deepseek-kpi.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p));
}

// ===== BAR =====
function bar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
  return c('█'.repeat(filled) + '░'.repeat(empty), color);
}

// ===== MAIN =====
async function main() {
  console.log('');
  console.log(c('🐉 ATHELGARD STATUS', 'bold') + c(' — ' + new Date().toLocaleString(), 'gray'));
  console.log('');

  // === SITES ===
  console.log(c('━'.repeat(50), 'gray'));
  console.log(c('🌐 LIVE SITES', 'bold'));
  console.log(c('━'.repeat(50), 'gray'));

  const sites = [
    { url: 'https://athelgard.io', name: 'athelgard.io' },
    { url: 'https://bountywarz.com', name: 'bountywarz.com' }
  ];

  for (const site of sites) {
    const result = await checkSite(site.url);
    const icon = result.up ? c('●', 'green') : c('●', 'red');
    const time = result.time < 1000 ? `${result.time}ms` : `${(result.time/1000).toFixed(1)}s`;
    const size = result.size < 1024 ? `${result.size}B` : `${(result.size/1024).toFixed(1)}KB`;
    console.log(`  ${icon} ${c(site.name, 'bold')}  ${result.up ? c('UP', 'green') : c('DOWN', 'red')}  ${time}  ${size}`);
  }

  // === BASELINE HISTORY ===
  const baseline = loadBaseline();
  if (baseline && baseline.sites) {
    console.log('');
    console.log(c('📊 BASELINE SCORES', 'bold'));
    for (const [name, site] of Object.entries(baseline.sites)) {
      const runs = site.runs;
      if (runs.length === 0) continue;
      const last = runs[runs.length - 1];
      const score = last.score || 0;
      const trend = runs.length > 1 ? (last.score - runs[runs.length - 2].score) : 0;
      const trendIcon = trend > 2 ? c('▲', 'green') : trend < -2 ? c('▼', 'red') : c('→', 'gray');
      console.log(`  ${bar(score)} ${c(score.toString(), score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red')}  ${name} ${trendIcon}`);
    }
  }

  // === API USAGE ===
  const api = loadAPI();
  if (api && api.calls.length > 0) {
    console.log('');
    console.log(c('━'.repeat(50), 'gray'));
    console.log(c('💰 API USAGE', 'bold'));
    console.log(c('━'.repeat(50), 'gray'));

    const recent = api.calls.slice(-20);
    const totalCost = recent.reduce((a, c) => a + c.cost, 0);
    const totalTokens = recent.reduce((a, c) => a + c.tokens, 0);
    const avgLat = recent.reduce((a, c) => a + c.latency, 0) / recent.length;
    const errors = recent.filter(c => c.status === 'error').length;

    console.log(`  Total Calls:    ${c(recent.length.toString(), 'cyan')}`);
    console.log(`  Total Tokens:   ${c(totalTokens.toLocaleString(), 'cyan')}`);
    console.log(`  Total Cost:     ${c('$' + totalCost.toFixed(4), 'green')}`);
    console.log(`  Avg Latency:    ${c(Math.round(avgLat) + 'ms', avgLat < 500 ? 'green' : 'yellow')}`);
    console.log(`  Errors:         ${errors === 0 ? c('0', 'green') : c(errors.toString(), 'red')}`);

    // Model split
    const models = {};
    for (const c of recent) models[c.model] = (models[c.model] || 0) + 1;
    console.log(`  Models:         ${Object.entries(models).map(([k,v]) => `${k}:${v}`).join(', ')}`);
  }

  // === SYSTEM ===
  console.log('');
  console.log(c('━'.repeat(50), 'gray'));
  console.log(c('🔧 SYSTEM', 'bold'));
  console.log(c('━'.repeat(50), 'gray'));

  // Git status
  try {
    const gitStatus = execSync('git status --short', { cwd: '/root/.openclaw/workspace/athelgard-cli', encoding: 'utf8' }).trim();
    const clean = gitStatus === '';
    console.log(`  CLI Repo:       ${clean ? c('clean', 'green') : c(gitStatus.split('\n').length + ' changes', 'yellow')}`);
  } catch { console.log(`  CLI Repo:       ${c('unknown', 'gray')}`); }

  // Disk
  try {
    const df = execSync('df -h . | tail -1', { encoding: 'utf8' }).trim().split(/\s+/);
    console.log(`  Disk:           ${c(df[4], 'cyan')} used`);
  } catch {}

  // Node version
  console.log(`  Node:           ${c(process.version, 'cyan')}`);

  // Config check
  const configPath = path.join(os.homedir(), '.athelgard.json');
  const hasConfig = fs.existsSync(configPath);
  console.log(`  Config:         ${hasConfig ? c('set', 'green') : c('missing', 'red')} (${configPath})`);

  console.log('');
  console.log(c('━'.repeat(50), 'gray'));
  console.log(`  ${c('athelgard status', 'cyan')}  — this view`);
  console.log(`  ${c('athelgard ask "..."', 'cyan')} — ask AI`);
  console.log(`  ${c('athelgard api dashboard', 'cyan')} — API details`);
  console.log(`  ${c('node baseline-pro.js barometer', 'cyan')} — site health`);
  console.log(c('━'.repeat(50), 'gray'));
  console.log('');
}

main().catch(console.error);
