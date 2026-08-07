/**
 * ATHELGARD SKILL: DeepSeek KPI Tracker
 * Tracks: API usage, costs, tokens, latency, errors, model switching
 * Stores: JSON history + optional Supabase sync
 * Learns: From phone call conversations in kin_turns
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DeepSeekKPI {
  constructor(config = {}) {
    this.configPath = config.configPath || path.join(os.homedir(), '.athelgard-deepseek-kpi.json');
    this.supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    this.supabaseKey = config.supabaseKey || process.env.SUPABASE_ANON_KEY;
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.configPath)) {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    }
    return {
      calls: [],
      daily: {},
      models: { deepseek: 0, kimi: 0, fallback: 0 },
      totalCost: 0,
      totalTokens: 0,
      errors: 0,
      startDate: new Date().toISOString()
    };
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  // ===== RECORD A CALL =====
  recordCall(record) {
    const entry = {
      timestamp: new Date().toISOString(),
      model: record.model || 'deepseek',
      tokens: record.tokens || 0,
      cost: record.cost || 0,
      latency: record.latency || 0,
      status: record.status || 'success', // success, error, fallback
      endpoint: record.endpoint || 'chat/completions',
      error: record.error || null,
      // Phone call context
      conversationId: record.conversationId || null,
      surface: record.surface || 'cli', // cli, voice, web
      intent: record.intent || null // play_game, capture_flag, code_review, etc
    };

    this.data.calls.push(entry);
    this.data.totalCost += entry.cost;
    this.data.totalTokens += entry.tokens;
    if (entry.status === 'error') this.data.errors++;
    this.data.models[entry.model] = (this.data.models[entry.model] || 0) + 1;

    // Daily rollup
    const day = entry.timestamp.split('T')[0];
    if (!this.data.daily[day]) {
      this.data.daily[day] = { calls: 0, tokens: 0, cost: 0, errors: 0, latency: [] };
    }
    this.data.daily[day].calls++;
    this.data.daily[day].tokens += entry.tokens;
    this.data.daily[day].cost += entry.cost;
    if (entry.status === 'error') this.data.daily[day].errors++;
    this.data.daily[day].latency.push(entry.latency);

    // Keep last 1000 calls
    if (this.data.calls.length > 1000) {
      this.data.calls = this.data.calls.slice(-1000);
    }

    this.save();
    return entry;
  }

  // ===== SIMULATE A CALL (for testing) =====
  simulateCall(model = 'deepseek', surface = 'cli', intent = null) {
    const tokens = Math.floor(Math.random() * 3000) + 500;
    const cost = model === 'deepseek' ? tokens * 0.000002 : tokens * 0.000003;
    const latency = Math.floor(Math.random() * 2000) + 200;
    
    return this.recordCall({
      model,
      tokens,
      cost,
      latency,
      status: Math.random() > 0.95 ? 'error' : 'success',
      surface,
      intent
    });
  }

  // ===== FETCH FROM SUPABASE =====
  async fetchFromSupabase() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.log('❌ Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY');
      return null;
    }

    return new Promise((resolve) => {
      const url = `${this.supabaseUrl}/rest/v1/kin_turns?select=*&order=timestamp.desc&limit=100`;
      const req = https.request(url, {
        method: 'GET',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch {
            resolve([]);
          }
        });
      });
      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.end();
    });
  }

  // ===== ANALYZE PHONE CALLS =====
  analyzePhoneCalls(calls) {
    if (!calls || calls.length === 0) {
      return { message: 'No phone call data found in Supabase' };
    }

    const intents = {};
    const surfaces = {};
    const hourly = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const call of calls) {
      // Extract intent from conversation
      const intent = call.intent || call.metadata?.intent || 'unknown';
      intents[intent] = (intents[intent] || 0) + 1;

      // Surface
      const surface = call.surface || 'voice';
      surfaces[surface] = (surfaces[surface] || 0) + 1;

      // Hourly distribution
      const hour = new Date(call.timestamp).getHours();
      hourly[hour] = (hourly[hour] || 0) + 1;

      // Costs
      totalTokens += call.tokens || 0;
      totalCost += call.cost || 0;
    }

    return {
      totalCalls: calls.length,
      totalTokens,
      totalCost,
      intents,
      surfaces,
      hourly,
      topIntent: Object.entries(intents).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
      peakHour: Object.entries(hourly).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'
    };
  }

  // ===== PROMPT IMPROVEMENT FROM CALLS =====
  generatePromptImprovements(analysis) {
    const improvements = [];

    // Based on common intents from phone calls
    if (analysis.intents) {
      const intentKeys = Object.keys(analysis.intents);
      
      if (intentKeys.includes('play_game') || intentKeys.includes('capture_flag')) {
        improvements.push({
          area: 'Game Commands',
          insight: 'Users frequently use voice for game actions',
          action: 'Add voice-optimized prompts for: "play the game", "capture flag", "what\'s my status"'
        });
      }

      if (intentKeys.includes('code_review') || intentKeys.includes('debug')) {
        improvements.push({
          area: 'Code Help',
          insight: 'Users ask for code help via voice',
          action: 'Create concise voice-friendly code explanations (under 30 seconds spoken)'
        });
      }

      if (analysis.peakHour && parseInt(analysis.peakHour) > 18) {
        improvements.push({
          area: 'Peak Hours',
          insight: `Peak usage at ${analysis.peakHour}:00 — likely evening coding sessions`,
          action: 'Pre-warm DeepSeek connection during 6-10 PM to reduce latency'
        });
      }
    }

    // Based on cost patterns
    if (analysis.totalCost > 5) {
      improvements.push({
        area: 'Cost Optimization',
        insight: `High voice call costs: $${analysis.totalCost.toFixed(2)}`,
        action: 'Switch to Kimi for voice responses (cheaper per token)'
      });
    }

    return improvements;
  }

  // ===== KPI DASHBOARD =====
  getDashboard(days = 7) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentCalls = this.data.calls.filter(c => new Date(c.timestamp) >= cutoff);
    const dailyKeys = Object.keys(this.data.daily).filter(d => new Date(d) >= cutoff).sort();

    // Calculate metrics
    const avgLatency = recentCalls.length > 0 
      ? Math.round(recentCalls.reduce((a, c) => a + c.latency, 0) / recentCalls.length) 
      : 0;
    
    const successRate = recentCalls.length > 0
      ? Math.round((recentCalls.filter(c => c.status === 'success').length / recentCalls.length) * 100)
      : 0;

    const avgTokens = recentCalls.length > 0
      ? Math.round(recentCalls.reduce((a, c) => a + c.tokens, 0) / recentCalls.length)
      : 0;

    return {
      period: `${days} days`,
      totalCalls: recentCalls.length,
      totalCost: recentCalls.reduce((a, c) => a + c.cost, 0),
      totalTokens: recentCalls.reduce((a, c) => a + c.tokens, 0),
      avgLatency,
      successRate,
      avgTokens,
      errorRate: 100 - successRate,
      modelSplit: this.data.models,
      daily: dailyKeys.map(d => ({ date: d, ...this.data.daily[d] })),
      // Trend
      trend: this.calculateTrend(dailyKeys),
      // Health score
      healthScore: Math.round(
        (successRate * 0.4) + 
        (Math.min(100, 1000 / (avgLatency + 1)) * 0.3) +
        (Math.min(100, 5000 / (avgTokens + 1)) * 0.3)
      )
    };
  }

  calculateTrend(dailyKeys) {
    if (dailyKeys.length < 2) return 'insufficient';
    const first = this.data.daily[dailyKeys[0]];
    const last = this.data.daily[dailyKeys[dailyKeys.length - 1]];
    const diff = last.calls - first.calls;
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }

  // ===== FORMATTERS =====
  static formatCurrency(n) {
    return `$${n.toFixed(4)}`;
  }

  static formatNumber(n) {
    return n.toLocaleString();
  }

  static msToSeconds(ms) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

module.exports = DeepSeekKPI;
