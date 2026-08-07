#!/usr/bin/env node
/**
 * ATHELGARD BASELINE PRO — Full telemetry with visual reports
 * Generates: HTML dashboard with Chart.js radar, line, bar charts
 * Metrics: 15+ submetrics per site
 * Schedule: Daily snapshots with trend analysis
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============ DEEP METRICS COLLECTOR ============

class MetricsCollector {
  async collect(url, name) {
    const start = process.hrtime.bigint();
    const dnsStart = Date.now();
    
    return new Promise((resolve) => {
      const client = url.startsWith('https:') ? https : http;
      const reqStart = Date.now();
      
      const req = client.get(url, { 
        timeout: 30000,
        headers: {
          'User-Agent': 'Athelgard-Baseline/2.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive'
        }
      }, (res) => {
        const ttfb = Date.now() - reqStart;
        let body = '';
        let bytesReceived = 0;
        
        res.on('data', chunk => {
          body += chunk;
          bytesReceived += chunk.length;
        });
        
        res.on('end', () => {
          const totalTime = Number(process.hrtime.bigint() - start) / 1_000_000; // ms
          const domLoad = this.estimateDOMLoad(body);
          
          resolve({
            // Core
            url, name: name || new URL(url).hostname,
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode,
            isUp: res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302,
            
            // Timing
            metrics: {
              dnsLookup: dnsStart - dnsStart, // Placeholder for DNS timing
              ttfb: Math.round(ttfb),
              totalTime: Math.round(totalTime),
              domEstimate: domLoad,
              
              // Size
              bytes: bytesReceived,
              headersSize: JSON.stringify(res.headers).length,
              
              // Content analysis
              htmlSize: body.length,
              scriptCount: (body.match(/<script/gi) || []).length,
              styleCount: (body.match(/<style/gi) || []).length + (body.match(/\.css/gi) || []).length,
              imageCount: (body.match(/<img/gi) || []).length,
              linkCount: (body.match(/<a /gi) || []).length,
              
              // Quality checks
              hasTitle: /<title[^>]*>[^<]+<\/title>/i.test(body),
              hasMeta: /<meta/i.test(body),
              hasViewport: /<meta[^>]*viewport/i.test(body),
              hasDescription: /<meta[^>]*description/i.test(body),
              hasOG: /<meta[^>]*og:/i.test(body),
              hasTwitter: /<meta[^>]*twitter:/i.test(body),
              hasCanonical: /<link[^>]*canonical/i.test(body),
              hasSchema: /application\/ld\+json/i.test(body),
              hasFavicon: /(favicon|icon).*\.(ico|png|svg)/i.test(body),
              isHTTPS: url.startsWith('https:'),
              http2: res.httpVersion >= 2,
              gzip: res.headers['content-encoding'] === 'gzip' || res.headers['content-encoding'] === 'br',
              cacheControl: !!res.headers['cache-control'],
              etag: !!res.headers.etag,
              server: res.headers.server || 'unknown',
              
              // Security headers
              hasCSP: !!res.headers['content-security-policy'],
              hasHSTS: !!res.headers['strict-transport-security'],
              hasXFrame: !!res.headers['x-frame-options'],
              hasXContentType: !!res.headers['x-content-type-options'],
              hasReferrer: !!res.headers['referrer-policy'],
              
              // Score (0-100)
              score: 0 // Calculated below
            }
          });
        });
      });
      
      req.on('error', (err) => {
        resolve({
          url, name: name || new URL(url).hostname,
          timestamp: new Date().toISOString(),
          statusCode: 0, isUp: false, error: err.message,
          metrics: { score: 0, ttfb: 0, totalTime: 0, bytes: 0 }
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          url, name: name || new URL(url).hostname,
          timestamp: new Date().toISOString(),
          statusCode: 0, isUp: false, error: 'TIMEOUT',
          metrics: { score: 0, ttfb: 30000, totalTime: 30000, bytes: 0 }
        });
      });
    });
  }
  
  estimateDOMLoad(body) {
    // Rough estimate based on complexity
    const scripts = (body.match(/<script/gi) || []).length;
    const images = (body.match(/<img/gi) || []).length;
    const iframes = (body.match(/<iframe/gi) || []).length;
    return Math.round(100 + scripts * 50 + images * 30 + iframes * 200);
  }
  
  calculateScore(result) {
    if (!result.isUp) return 0;
    const m = result.metrics;
    let score = 0;
    
    // Uptime (30 points)
    score += 30;
    
    // Speed (25 points)
    if (m.ttfb < 200) score += 10;
    else if (m.ttfb < 500) score += 7;
    else if (m.ttfb < 1000) score += 4;
    if (m.totalTime < 1000) score += 10;
    else if (m.totalTime < 2000) score += 7;
    else if (m.totalTime < 5000) score += 4;
    if (m.bytes < 500000) score += 5;
    else if (m.bytes < 1000000) score += 3;
    
    // SEO/Meta (20 points)
    if (m.hasTitle) score += 4;
    if (m.hasMeta) score += 3;
    if (m.hasDescription) score += 3;
    if (m.hasViewport) score += 3;
    if (m.hasOG) score += 2;
    if (m.hasTwitter) score += 2;
    if (m.hasCanonical) score += 2;
    if (m.hasSchema) score += 1;
    
    // Security (15 points)
    if (m.isHTTPS) score += 5;
    if (m.hasCSP) score += 3;
    if (m.hasHSTS) score += 3;
    if (m.hasXFrame) score += 2;
    if (m.hasXContentType) score += 1;
    if (m.hasReferrer) score += 1;
    
    // Performance (10 points)
    if (m.gzip) score += 3;
    if (m.cacheControl) score += 3;
    if (m.http2) score += 2;
    if (m.etag) score += 2;
    
    return Math.min(score, 100);
  }
}

// ============ STORAGE & HISTORY ============

class BaselineStore {
  constructor(configPath = path.join(os.homedir(), '.athelgard-baseline-v2.json')) {
    this.configPath = configPath;
    this.data = this.load();
  }
  
  load() {
    if (fs.existsSync(this.configPath)) return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    return { sites: {}, firstRun: new Date().toISOString() };
  }
  
  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }
  
  addResult(siteName, result) {
    if (!this.data.sites[siteName]) {
      this.data.sites[siteName] = { 
        url: result.url,
        runs: [],
        best: null,
        worst: null
      };
    }
    
    const run = {
      timestamp: result.timestamp,
      metrics: result.metrics,
      score: result.metrics.score,
      isUp: result.isUp
    };
    
    this.data.sites[siteName].runs.push(run);
    
    // Keep 90 days (truncate to last 100 runs)
    if (this.data.sites[siteName].runs.length > 100) {
      this.data.sites[siteName].runs = this.data.sites[siteName].runs.slice(-100);
    }
    
    // Update best/worst
    if (!this.data.sites[siteName].best || result.metrics.score > this.data.sites[siteName].best.score) {
      this.data.sites[siteName].best = { score: result.metrics.score, timestamp: result.timestamp };
    }
    if (!this.data.sites[siteName].worst || result.metrics.score < this.data.sites[siteName].worst.score) {
      this.data.sites[siteName].worst = { score: result.metrics.score, timestamp: result.timestamp };
    }
    
    this.save();
  }
  
  getHistory(siteName, days = 30) {
    const site = this.data.sites[siteName];
    if (!site) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return site.runs.filter(r => new Date(r.timestamp) >= cutoff);
  }
  
  getTrend(siteName) {
    const history = this.getHistory(siteName, 7);
    if (history.length < 2) return 'insufficient';
    
    const first = history[0].score;
    const last = history[history.length - 1].score;
    const diff = last - first;
    
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }
}

// ============ REPORT GENERATOR ============

class ReportGenerator {
  generateHTML(store, results) {
    const date = new Date().toLocaleString();
    
    // Prepare data for charts
    const sites = Object.keys(store.data.sites);
    const radarData = this.prepareRadarData(store, results);
    const lineData = this.prepareLineData(store);
    const barData = this.prepareBarData(results);
    
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Athelgard Baseline Report — ${date}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0a0e1a; 
  color: #e0e6ed; 
  padding: 20px;
}
h1 { 
  color: #00d4ff; 
  font-size: 28px; 
  margin-bottom: 10px;
  text-align: center;
}
.subtitle { 
  text-align: center; 
  color: #6b7b8e; 
  margin-bottom: 30px; 
}
.grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
  gap: 20px; 
  max-width: 1600px; 
  margin: 0 auto;
}
.card { 
  background: #111827; 
  border-radius: 12px; 
  padding: 20px; 
  border: 1px solid #1e3a5f;
}
.card h2 { 
  color: #00d4ff; 
  font-size: 18px; 
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-up { color: #10b981; }
.status-down { color: #ef4444; }
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 15px;
}
.metric {
  background: #0d1117;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}
.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #00d4ff;
}
.metric-label {
  font-size: 11px;
  color: #6b7b8e;
  text-transform: uppercase;
  margin-top: 4px;
}
.chart-container {
  position: relative;
  height: 300px;
  margin-top: 15px;
}
.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
  margin: 0 auto 15px;
}
.score-excellent { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 2px solid #10b981; }
.score-good { background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: 2px solid #3b82f6; }
.score-fair { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 2px solid #f59e0b; }
.score-poor { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 2px solid #ef4444; }
.trend { display: inline-block; margin-left: 10px; font-size: 14px; }
.trend-up { color: #10b981; }
.trend-down { color: #ef4444; }
.trend-stable { color: #6b7b8e; }
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 10px;
}
.matrix-table th {
  background: #0d1117;
  padding: 8px;
  text-align: left;
  color: #6b7b8e;
  font-weight: 500;
}
.matrix-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #1e3a5f;
}
.check-yes { color: #10b981; font-weight: bold; }
.check-no { color: #ef4444; }
.check-warn { color: #f59e0b; }
.full-width { grid-column: 1 / -1; }
</style>
</head>
<body>
<h1>🐉 ATHELGARD BASELINE PRO</h1>
<p class="subtitle">Generated: ${date} | ${sites.length} sites monitored</p>

<div class="grid">
  <!-- SCORE CARDS -->
  ${results.map(r => this.renderScoreCard(r, store)).join('')}
  
  <!-- RADAR CHART -->
  <div class="card full-width">
    <h2>🎯 Multi-Dimensional Health Radar</h2>
    <div class="chart-container">
      <canvas id="radarChart"></canvas>
    </div>
  </div>
  
  <!-- TREND LINES -->
  <div class="card full-width">
    <h2>📈 Score Trends (7 Days)</h2>
    <div class="chart-container">
      <canvas id="lineChart"></canvas>
    </div>
  </div>
  
  <!-- COMPARISON BARS -->
  <div class="card full-width">
    <h2>📊 Current Performance Comparison</h2>
    <div class="chart-container">
      <canvas id="barChart"></canvas>
    </div>
  </div>
  
  <!-- FULL METRICS MATRIX -->
  <div class="card full-width">
    <h2>🔍 Full Metrics Matrix</h2>
    ${this.renderMatrix(results)}
  </div>
</div>

<script>
// Radar Chart
new Chart(document.getElementById('radarChart'), {
  type: 'radar',
  data: ${JSON.stringify(radarData)},
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: { color: '#1e3a5f' },
        angleLines: { color: '#1e3a5f' },
        pointLabels: { color: '#e0e6ed', font: { size: 11 } },
        ticks: { display: false }
      }
    },
    plugins: {
      legend: { labels: { color: '#e0e6ed' } }
    }
  }
});

// Line Chart
new Chart(document.getElementById('lineChart'), {
  type: 'line',
  data: ${JSON.stringify(lineData)},
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { color: '#1e3a5f' }, ticks: { color: '#6b7b8e' } },
      y: { grid: { color: '#1e3a5f' }, ticks: { color: '#6b7b8e' }, min: 0, max: 100 }
    },
    plugins: {
      legend: { labels: { color: '#e0e6ed' } }
    }
  }
});

// Bar Chart
new Chart(document.getElementById('barChart'), {
  type: 'bar',
  data: ${JSON.stringify(barData)},
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { color: '#1e3a5f' }, ticks: { color: '#6b7b8e' } },
      y: { grid: { color: '#1e3a5f' }, ticks: { color: '#6b7b8e' } }
    },
    plugins: {
      legend: { labels: { color: '#e0e6ed' } }
    }
  }
});
</script>
</body>
</html>`;
  }
  
  renderScoreCard(result, store) {
    const score = result.metrics?.score || 0;
    const scoreClass = score >= 80 ? 'score-excellent' : score >= 60 ? 'score-good' : score >= 40 ? 'score-fair' : 'score-poor';
    const statusIcon = result.isUp ? '🟢' : '🔴';
    const trend = store.getTrend(result.name);
    const trendIcon = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';
    const trendClass = trend === 'improving' ? 'trend-up' : trend === 'declining' ? 'trend-down' : 'trend-stable';
    
    return `
  <div class="card">
    <h2>${statusIcon} ${result.name} <span class="trend ${trendClass}">${trendIcon} ${trend}</span></h2>
    <div class="score-circle ${scoreClass}">${score}</div>
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-value">${result.metrics?.ttfb || 0}ms</div>
        <div class="metric-label">TTFB</div>
      </div>
      <div class="metric">
        <div class="metric-value">${result.metrics?.totalTime || 0}ms</div>
        <div class="metric-label">Total</div>
      </div>
      <div class="metric">
        <div class="metric-value">${this.formatBytes(result.metrics?.bytes || 0)}</div>
        <div class="metric-label">Size</div>
      </div>
    </div>
  </div>`;
  }
  
  renderMatrix(results) {
    const metrics = [
      ['Status', 'isUp', 'boolean'],
      ['HTTPS', 'isHTTPS', 'boolean'],
      ['HTTP/2', 'http2', 'boolean'],
      ['Gzip', 'gzip', 'boolean'],
      ['Cache', 'cacheControl', 'boolean'],
      ['Title', 'hasTitle', 'boolean'],
      ['Viewport', 'hasViewport', 'boolean'],
      ['Description', 'hasDescription', 'boolean'],
      ['OG Tags', 'hasOG', 'boolean'],
      ['Twitter', 'hasTwitter', 'boolean'],
      ['Canonical', 'hasCanonical', 'boolean'],
      ['Schema', 'hasSchema', 'boolean'],
      ['Favicon', 'hasFavicon', 'boolean'],
      ['CSP', 'hasCSP', 'boolean'],
      ['HSTS', 'hasHSTS', 'boolean'],
      ['X-Frame', 'hasXFrame', 'boolean'],
    ];
    
    let html = '<table class="matrix-table"><tr><th>Site</th>';
    for (const [label] of metrics) html += `<th>${label}</th>`;
    html += '<th>Score</th></tr>';
    
    for (const r of results) {
      html += `<tr><td><strong>${r.name}</strong></td>`;
      for (const [, key] of metrics) {
        const val = r.metrics?.[key];
        const cls = val ? 'check-yes' : 'check-no';
        html += `<td class="${cls}">${val ? '✓' : '✗'}</td>`;
      }
      html += `<td><strong>${r.metrics?.score || 0}/100</strong></td></tr>`;
    }
    
    html += '</table>';
    return html;
  }
  
  prepareRadarData(store, results) {
    const dimensions = ['Speed', 'SEO', 'Security', 'Performance', 'Uptime'];
    const datasets = results.map((r, i) => {
      const m = r.metrics || {};
      const speed = Math.max(0, 100 - (m.ttfb || 0) / 10);
      const seo = (m.hasTitle ? 20 : 0) + (m.hasDescription ? 20 : 0) + (m.hasViewport ? 20 : 0) + (m.hasOG ? 20 : 0) + (m.hasSchema ? 20 : 0);
      const security = (m.isHTTPS ? 40 : 0) + (m.hasCSP ? 20 : 0) + (m.hasHSTS ? 20 : 0) + (m.hasXFrame ? 20 : 0);
      const perf = (m.gzip ? 30 : 0) + (m.cacheControl ? 30 : 0) + (m.http2 ? 20 : 0) + (m.bytes < 500000 ? 20 : 0);
      const uptime = r.isUp ? 100 : 0;
      
      const colors = ['#00d4ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
      return {
        label: r.name,
        data: [speed, seo, security, perf, uptime],
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33',
        borderWidth: 2
      };
    });
    
    return { labels: dimensions, datasets };
  }
  
  prepareLineData(store) {
    const sites = Object.keys(store.data.sites);
    const colors = ['#00d4ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    
    // Get last 7 runs for each site
    const datasets = sites.map((siteName, i) => {
      const history = store.getHistory(siteName, 7);
      return {
        label: siteName,
        data: history.map(h => h.score),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33',
        tension: 0.3,
        fill: false
      };
    });
    
    // X axis labels (dates)
    const labels = [];
    if (sites.length > 0) {
      const history = store.getHistory(sites[0], 7);
      labels.push(...history.map(h => h.timestamp.split('T')[0].slice(5))); // MM-DD
    }
    
    return { labels, datasets };
  }
  
  prepareBarData(results) {
    const sites = results.map(r => r.name);
    const colors = ['#00d4ff', '#10b981', '#f59e0b'];
    
    return {
      labels: sites,
      datasets: [
        {
          label: 'Load Time (ms)',
          data: results.map(r => r.metrics?.totalTime || 0),
          backgroundColor: colors[0]
        },
        {
          label: 'TTFB (ms)',
          data: results.map(r => r.metrics?.ttfb || 0),
          backgroundColor: colors[1]
        },
        {
          label: 'Size (KB / 10)',
          data: results.map(r => Math.round((r.metrics?.bytes || 0) / 102.4)),
          backgroundColor: colors[2]
        }
      ]
    };
  }
  
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

// ============ MAIN ============

async function main() {
  const cmd = process.argv[2] || 'run';
  const collector = new MetricsCollector();
  const store = new BaselineStore();
  const reporter = new ReportGenerator();
  
  if (cmd === 'check') {
    const url = process.argv[3];
    const name = process.argv[4];
    if (!url) { console.log('Usage: node baseline-pro.js check <url> [name]'); return; }
    
    console.log(`Checking ${url}...`);
    const result = await collector.collect(url, name);
    result.metrics.score = collector.calculateScore(result);
    store.addResult(name || result.name, result);
    
    console.log(`\n✅ ${result.name}`);
    console.log(`   Score: ${result.metrics.score}/100`);
    console.log(`   Load: ${result.metrics.ttfb}ms TTFB, ${result.metrics.totalTime}ms total`);
    console.log(`   Size: ${reporter.formatBytes(result.metrics.bytes)}`);
  }
  else if (cmd === 'run') {
    const sites = [
      { url: 'https://athelgard.io', name: 'athelgard-io' },
      { url: 'https://bountywarz.com', name: 'bountywarz' },
    ];
    
    console.log('\n🐉 ATHELGARD BASELINE PRO\n');
    const results = [];
    
    for (const site of sites) {
      console.log(`Checking ${site.name}...`);
      const result = await collector.collect(site.url, site.name);
      result.metrics.score = collector.calculateScore(result);
      store.addResult(site.name, result);
      results.push(result);
      
      const status = result.isUp ? '✅ UP' : '❌ DOWN';
      console.log(`   ${status} | Score: ${result.metrics.score}/100 | ${result.metrics.ttfb}ms`);
    }
    
    // Generate HTML report
    const reportPath = path.join(process.cwd(), 'baseline-report.html');
    const html = reporter.generateHTML(store, results);
    fs.writeFileSync(reportPath, html);
    
    console.log(`\n📊 Report generated: ${reportPath}`);
    console.log(`   Open in browser to see radar charts, trends, full matrix`);
    console.log(`   History: ${Object.keys(store.data.sites).length} sites tracked`);
  }
  else if (cmd === 'report') {
    // Just regenerate report from existing data
    const results = Object.keys(store.data.sites).map(name => {
      const site = store.data.sites[name];
      const lastRun = site.runs[site.runs.length - 1];
      return {
        name,
        url: site.url,
        metrics: lastRun.metrics,
        isUp: lastRun.isUp
      };
    });
    
    const reportPath = path.join(process.cwd(), 'baseline-report.html');
    const html = reporter.generateHTML(store, results);
    fs.writeFileSync(reportPath, html);
    console.log(`📊 Report regenerated: ${reportPath}`);
  }
  else if (cmd === 'history') {
    const siteName = process.argv[3];
    if (!siteName) {
      console.log('Tracked sites:');
      for (const name of Object.keys(store.data.sites)) {
        const site = store.data.sites[name];
        console.log(`  ${name}: ${site.runs.length} runs, best: ${site.best?.score || 'N/A'}, worst: ${site.worst?.score || 'N/A'}`);
      }
      return;
    }
    
    const history = store.getHistory(siteName, 30);
    console.log(`\n📊 HISTORY: ${siteName} (${history.length} runs)\n`);
    for (const run of history) {
      const icon = run.isUp ? '✅' : '❌';
      console.log(`   ${icon} ${run.timestamp.split('T')[0]} — Score: ${run.score}, ${run.metrics.ttfb}ms TTFB`);
    }
  }
  else {
    console.log(`
🐉 ATHELGARD BASELINE PRO

Usage:
  node baseline-pro.js check <url> [name]    Deep check one site
  node baseline-pro.js run                    Full report with charts
  node baseline-pro.js report                 Regenerate HTML from history
  node baseline-pro.js history [site]         Show history

Features:
  • 15+ submetrics per site (speed, SEO, security, performance)
  • Score calculation (0-100)
  • Radar charts for multi-dimensional health
  • Line charts for 7-day trends
  • Bar charts for performance comparison
  • Full metrics matrix (yes/no for every check)
  • HTML dashboard with Chart.js
  • 100-run history per site
`);
  }
}

main().catch(console.error);
