/**
 * ATHELGARD SKILL: Baseline — Is the live site better than before?
 * 
 * Measures: load time, functionality, errors, size, uptime
 * Stores: JSON history with timestamps
 * Reports: current vs last → BETTER / WORSE / SAME
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class Baseline {
  constructor(configPath = path.join(os.homedir(), '.athelgard-baseline.json')) {
    this.configPath = configPath;
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.configPath)) {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    }
    return { runs: [], sites: {} };
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  // ===== CHECK A SITE =====
  async checkSite(url, name = null) {
    const startTime = Date.now();
    const siteName = name || new URL(url).hostname;
    
    return new Promise((resolve) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, { timeout: 30000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const endTime = Date.now();
          const result = {
            url,
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode,
            loadTimeMs: endTime - startTime,
            sizeBytes: Buffer.byteLength(body),
            headers: {
              server: res.headers.server,
              contentType: res.headers['content-type'],
              cacheControl: res.headers['cache-control'],
            },
            checks: {
              isUp: res.statusCode === 200,
              hasContent: body.length > 100,
              hasTitle: /<title[^>]*>[^<]+<\/title>/i.test(body),
              hasMeta: /<meta/i.test(body),
              isHTTPS: url.startsWith('https:'),
            }
          };
          resolve(result);
        });
      });

      req.on('error', (err) => {
        resolve({
          url,
          timestamp: new Date().toISOString(),
          statusCode: 0,
          loadTimeMs: Date.now() - startTime,
          sizeBytes: 0,
          error: err.message,
          checks: { isUp: false, hasContent: false, hasTitle: false, hasMeta: false, isHTTPS: url.startsWith('https:') }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          url,
          timestamp: new Date().toISOString(),
          statusCode: 0,
          loadTimeMs: 30000,
          sizeBytes: 0,
          error: 'TIMEOUT',
          checks: { isUp: false, hasContent: false, hasTitle: false, hasMeta: false, isHTTPS: url.startsWith('https:') }
        });
      });
    });
  }

  // ===== CHECK A LIST OF SITES =====
  async checkSites(sites) {
    const results = [];
    for (const site of sites) {
      const url = typeof site === 'string' ? site : site.url;
      const name = typeof site === 'string' ? null : site.name;
      console.log(`   Checking ${url}...`);
      const result = await this.checkSite(url, name);
      results.push(result);
    }
    return results;
  }

  // ===== STORE & COMPARE =====
  storeResults(siteName, results) {
    if (!this.data.sites[siteName]) {
      this.data.sites[siteName] = { runs: [] };
    }
    this.data.sites[siteName].runs.push({
      timestamp: new Date().toISOString(),
      results
    });
    
    // Keep only last 30 runs
    if (this.data.sites[siteName].runs.length > 30) {
      this.data.sites[siteName].runs = this.data.sites[siteName].runs.slice(-30);
    }
    
    this.save();
  }

  // ===== COMPARE CURRENT VS PREVIOUS =====
  compare(siteName) {
    const site = this.data.sites[siteName];
    if (!site || site.runs.length < 2) {
      return { hasPrevious: false, message: 'First run — no previous data to compare' };
    }

    const current = site.runs[site.runs.length - 1];
    const previous = site.runs[site.runs.length - 2];

    const comparisons = [];
    
    for (let i = 0; i < current.results.length; i++) {
      const curr = current.results[i];
      const prev = previous.results[i];
      if (!prev) continue;

      const url = curr.url;
      const diffs = [];

      // Load time
      const loadDiff = curr.loadTimeMs - prev.loadTimeMs;
      if (Math.abs(loadDiff) > 100) {
        diffs.push({
          metric: 'Load Time',
          current: `${curr.loadTimeMs}ms`,
          previous: `${prev.loadTimeMs}ms`,
          change: loadDiff > 0 ? `+${loadDiff}ms` : `${loadDiff}ms`,
          better: loadDiff < 0
        });
      }

      // Size
      const sizeDiff = curr.sizeBytes - prev.sizeBytes;
      if (Math.abs(sizeDiff) > 1024) {
        diffs.push({
          metric: 'Size',
          current: this.formatBytes(curr.sizeBytes),
          previous: this.formatBytes(prev.sizeBytes),
          change: sizeDiff > 0 ? `+${this.formatBytes(sizeDiff)}` : `-${this.formatBytes(Math.abs(sizeDiff))}`,
          better: sizeDiff < 0
        });
      }

      // Status
      if (curr.statusCode !== prev.statusCode) {
        diffs.push({
          metric: 'Status',
          current: curr.statusCode,
          previous: prev.statusCode,
          change: curr.statusCode === 200 ? 'FIXED' : 'BROKEN',
          better: curr.statusCode === 200 && prev.statusCode !== 200
        });
      }

      // Checks
      const currChecks = Object.values(curr.checks).filter(Boolean).length;
      const prevChecks = Object.values(prev.checks).filter(Boolean).length;
      if (currChecks !== prevChecks) {
        diffs.push({
          metric: 'Health Score',
          current: `${currChecks}/5`,
          previous: `${prevChecks}/5`,
          change: currChecks > prevChecks ? `+${currChecks - prevChecks}` : `${currChecks - prevChecks}`,
          better: currChecks > prevChecks
        });
      }

      comparisons.push({ url, diffs });
    }

    const totalDiffs = comparisons.flatMap(c => c.diffs);
    const betterCount = totalDiffs.filter(d => d.better).length;
    const worseCount = totalDiffs.filter(d => !d.better).length;
    
    let verdict;
    if (betterCount > worseCount) verdict = 'BETTER';
    else if (worseCount > betterCount) verdict = 'WORSE';
    else verdict = 'SAME';

    return {
      hasPrevious: true,
      verdict,
      betterCount,
      worseCount,
      comparisons,
      currentTime: current.timestamp,
      previousTime: previous.timestamp
    };
  }

  // ===== FORMAT HELPERS =====
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  // ===== REPORT =====
  printReport(siteName, results, comparison = null) {
    console.log(`\n📊 BASELINE REPORT: ${siteName.toUpperCase()}`);
    console.log(`   Time: ${new Date().toLocaleString()}`);
    console.log('');

    for (const r of results) {
      const icon = r.checks.isUp ? '✅' : '❌';
      console.log(`   ${icon} ${r.url}`);
      console.log(`      Status: ${r.statusCode} | Load: ${r.loadTimeMs}ms | Size: ${this.formatBytes(r.sizeBytes)}`);
      
      if (r.error) {
        console.log(`      ❌ ERROR: ${r.error}`);
      } else {
        const checks = [];
        if (r.checks.hasTitle) checks.push('title');
        if (r.checks.hasMeta) checks.push('meta');
        if (r.checks.isHTTPS) checks.push('https');
        console.log(`      Health: ${checks.join(', ')}`);
      }
      console.log('');
    }

    // Comparison
    if (comparison && comparison.hasPrevious) {
      const arrow = comparison.verdict === 'BETTER' ? '📈' : comparison.verdict === 'WORSE' ? '📉' : '➡️';
      console.log(`\n   ${arrow} VS PREVIOUS (${comparison.previousTime.split('T')[0]}):`);
      console.log(`      Verdict: ${comparison.verdict}`);
      console.log(`      Better: ${comparison.betterCount} | Worse: ${comparison.worseCount}`);
      
      for (const comp of comparison.comparisons) {
        if (comp.diffs.length === 0) continue;
        console.log(`\n      ${comp.url}:`);
        for (const d of comp.diffs) {
          const icon = d.better ? '✅' : '❌';
          console.log(`        ${icon} ${d.metric}: ${d.current} (was ${d.previous}) ${d.change}`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
  }
}

module.exports = Baseline;
