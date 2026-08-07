#!/usr/bin/env node
/**
 * ATHELGARD BASELINE — Standalone health checker
 * Usage: node baseline-check.js [check|run|history|compare]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

class Baseline {
  constructor(configPath = path.join(os.homedir(), '.athelgard-baseline.json')) {
    this.configPath = configPath;
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.configPath)) return JSON.parse(fs.readFileSync(this.configPath));
    return { sites: {} };
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  async checkSite(url, name) {
    const start = Date.now();
    return new Promise((resolve) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, { timeout: 30000 }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          resolve({
            url, name: name || url,
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode,
            loadTimeMs: Date.now() - start,
            sizeBytes: Buffer.byteLength(body),
            isUp: res.statusCode === 200,
            hasTitle: /<title[^>]*>[^<]+<\/title>/i.test(body),
            hasMeta: /<meta/i.test(body),
            isHTTPS: url.startsWith('https:')
          });
        });
      });
      req.on('error', () => resolve({ url, name: name||url, timestamp: new Date().toISOString(), statusCode: 0, loadTimeMs: Date.now()-start, sizeBytes: 0, isUp: false, error: true }));
      req.on('timeout', () => { req.destroy(); resolve({ url, name: name||url, timestamp: new Date().toISOString(), statusCode: 0, loadTimeMs: 30000, sizeBytes: 0, isUp: false, error: true }); });
    });
  }

  store(siteName, result) {
    if (!this.data.sites[siteName]) this.data.sites[siteName] = { runs: [] };
    this.data.sites[siteName].runs.push({ timestamp: new Date().toISOString(), result });
    if (this.data.sites[siteName].runs.length > 30) this.data.sites[siteName].runs = this.data.sites[siteName].runs.slice(-30);
    this.save();
  }

  compare(siteName) {
    const site = this.data.sites[siteName];
    if (!site || site.runs.length < 2) return { hasPrevious: false };
    const curr = site.runs[site.runs.length-1].result;
    const prev = site.runs[site.runs.length-2].result;
    const diffs = [];
    
    const loadDiff = curr.loadTimeMs - prev.loadTimeMs;
    if (Math.abs(loadDiff) > 100) diffs.push({ metric: 'Load Time', current: curr.loadTimeMs+'ms', previous: prev.loadTimeMs+'ms', change: loadDiff>0?`+${loadDiff}ms`:`${loadDiff}ms`, better: loadDiff<0 });
    
    const sizeDiff = curr.sizeBytes - prev.sizeBytes;
    if (Math.abs(sizeDiff) > 512) diffs.push({ metric: 'Size', current: this.fmt(curr.sizeBytes), previous: this.fmt(prev.sizeBytes), change: sizeDiff>0?`+${this.fmt(sizeDiff)}`:`-${this.fmt(Math.abs(sizeDiff))}`, better: sizeDiff<0 });
    
    if (curr.statusCode !== prev.statusCode) diffs.push({ metric: 'Status', current: curr.statusCode, previous: prev.statusCode, change: curr.statusCode===200?'FIXED':'BROKEN', better: curr.statusCode===200 });
    
    const better = diffs.filter(d => d.better).length;
    const worse = diffs.filter(d => !d.better).length;
    let verdict = 'SAME';
    if (better > worse) verdict = 'BETTER';
    else if (worse > better) verdict = 'WORSE';
    
    return { hasPrevious: true, verdict, better, worse, diffs };
  }

  fmt(b) { return b<1024?`${b}B`:`${(b/1024).toFixed(1)}KB`; }

  print(result, comparison) {
    const r = result;
    const icon = r.isUp ? '✅' : '❌';
    console.log(`\n${icon} ${r.name}`);
    console.log(`   ${r.url}`);
    console.log(`   Status: ${r.statusCode} | Load: ${r.loadTimeMs}ms | Size: ${this.fmt(r.sizeBytes)}`);
    if (r.error) console.log('   ❌ ERROR');
    
    if (comparison && comparison.hasPrevious) {
      const arrow = comparison.verdict==='BETTER'?'📈':comparison.verdict==='WORSE'?'📉':'➡️';
      console.log(`\n   ${arrow} VS PREVIOUS: ${comparison.verdict}`);
      for (const d of comparison.diffs) {
        const i = d.better ? '✅' : '❌';
        console.log(`   ${i} ${d.metric}: ${d.current} (was ${d.previous}) ${d.change}`);
      }
    }
  }
}

async function main() {
  const cmd = process.argv[2] || 'run';
  const b = new Baseline();

  if (cmd === 'check') {
    const url = process.argv[3];
    const name = process.argv[4];
    if (!url) { console.log('Usage: node baseline-check.js check <url> [name]'); return; }
    const result = await b.checkSite(url, name);
    b.store(name || url, result);
    b.print(result);
  }
  else if (cmd === 'run') {
    const sites = [
      { url: 'https://athelgard.io', name: 'athelgard-io' },
      { url: 'https://athelclaw.vercel.app', name: 'athelclaw' },
      { url: 'https://bountywarz.com', name: 'bountywarz' },
    ];
    console.log('\n📊 BASELINE CHECK\n');
    for (const site of sites) {
      const result = await b.checkSite(site.url, site.name);
      b.store(site.name, result);
      const comp = b.compare(site.name);
      b.print(result, comp);
    }
    console.log('\n✅ Done. Data saved to ~/.athelgard-baseline.json\n');
  }
  else if (cmd === 'history') {
    const siteName = process.argv[3];
    if (!siteName) {
      console.log('Tracked:', Object.keys(b.data.sites).join(', '));
      return;
    }
    const site = b.data.sites[siteName];
    if (!site) { console.log('No history'); return; }
    console.log(`\n📊 HISTORY: ${siteName}\n`);
    for (const run of site.runs.slice(-10)) {
      const r = run.result;
      console.log(`   ${r.isUp?'✅':'❌'} ${run.timestamp.split('T')[0]} — ${r.loadTimeMs}ms`);
    }
  }
  else if (cmd === 'compare') {
    const siteName = process.argv[3];
    if (!siteName) { console.log('Usage: node baseline-check.js compare <site>'); return; }
    const comp = b.compare(siteName);
    if (!comp.hasPrevious) { console.log('Need 2+ runs to compare'); return; }
    console.log(`\n${comp.verdict==='BETTER'?'📈':comp.verdict==='WORSE'?'📉':'➡️'} ${siteName}: ${comp.verdict}`);
  }
  else {
    console.log(`
📊 ATHELGARD BASELINE — Is the live site better?

Usage:
  node baseline-check.js check <url> [name]   Check one site
  node baseline-check.js run                  Check all tracked sites
  node baseline-check.js history [site]       Show history
  node baseline-check.js compare <site>       Compare to previous
`);
  }
}

main().catch(console.error);
