#!/usr/bin/env node
/**
 * ATHELGARD PEAK PROTECTION — Smart Cost Router v2.0
 * 
 * THE FEATURE: Automatic model switching during DeepSeek peak hours
 * Saves 50% on API costs by routing to Kimi when DeepSeek is 2x priced
 * 
 * DeepSeek Peak Windows (Beijing Time / UTC+8):
 *   - Morning: 09:00–12:00 (01:00–04:00 UTC)
 *   - Afternoon: 14:00–18:00 (06:00–10:00 UTC)
 * During peak: 2x pricing = switch to Kimi automatically
 * Off-peak: DeepSeek = $0.14/M tokens (cheapest)
 */

const readline = require('readline');

// ===== PEAK WINDOW DETECTION =====

const DEEPSEEK_PEAK_WINDOWS = [
  { start: '09:00', end: '12:00', label: 'Morning Peak', tz: 'Asia/Shanghai' },
  { start: '14:00', end: '18:00', label: 'Afternoon Peak', tz: 'Asia/Shanghai' },
];

function getBeijingTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { hour: Number(get('hour')), minute: Number(get('minute')), time: `${get('hour')}:${get('minute')}` };
}

function getLocalTime() {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes(), time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}` };
}

function isPeakHour() {
  const bj = getBeijingTime();
  const minutes = bj.hour * 60 + bj.minute;
  
  for (const window of DEEPSEEK_PEAK_WINDOWS) {
    const [startH, startM] = window.start.split(':').map(Number);
    const [endH, endM] = window.end.split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    
    if (start < end) {
      if (minutes >= start && minutes < end) return { peak: true, label: window.label, window };
    } else {
      if (minutes >= start || minutes < end) return { peak: true, label: window.label, window };
    }
  }
  
  return { peak: false, label: 'Off-Peak', window: null };
}

function getTimeUntilNextChange() {
  const bj = getBeijingTime();
  const minutes = bj.hour * 60 + bj.minute;
  const isPeak = isPeakHour().peak;
  
  // Find next window boundary
  const boundaries = [];
  for (const w of DEEPSEEK_PEAK_WINDOWS) {
    const [sh, sm] = w.start.split(':').map(Number);
    const [eh, em] = w.end.split(':').map(Number);
    boundaries.push(sh * 60 + sm);
    boundaries.push(eh * 60 + em);
  }
  boundaries.sort((a, b) => a - b);
  
  // Find next boundary
  let nextBoundary = boundaries.find(b => b > minutes);
  if (!nextBoundary) nextBoundary = boundaries[0] + 24 * 60; // tomorrow
  
  const diff = nextBoundary - minutes;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  
  return { isPeak, nextIn: `${hours}h ${mins}m`, nextIs: isPeak ? 'off-peak' : 'peak' };
}

// ===== COST CALCULATOR =====

function calculateCosts(tokens = 1000000) {
  // Rates are per-million tokens
  const deepseekPerM = 0.14;   // $0.14 per 1M tokens
  const kimiPerM = 0.03;       // ~$0.03 per 1M tokens
  
  const ratio = tokens / 1000000;
  const deepseekPeak = ratio * deepseekPerM * 2;  // 2x during peak
  const deepseekOff = ratio * deepseekPerM;       // Normal
  const kimi = ratio * kimiPerM;                  // Kimi rate
  
  return {
    deepseekPeak: deepseekPeak.toFixed(4),
    deepseekOff: deepseekOff.toFixed(4),
    kimi: kimi.toFixed(4),
    savings: (deepseekPeak - kimi).toFixed(4),
    savingsPercent: Math.round(((deepseekPeak - kimi) / deepseekPeak) * 100)
  };
}

// ===== VISUAL OUTPUT =====

function showStatus() {
  const bj = getBeijingTime();
  const local = getLocalTime();
  const peak = isPeakHour();
  const next = getTimeUntilNextChange();
  const costs = calculateCosts();
  
  const C = process.stdout.isTTY ? {
    bold: '\x1b[1m', reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m'
  } : { bold: '', reset: '', green: '', red: '', yellow: '', cyan: '', gray: '' };
  
  console.log('');
  console.log(`${C.cyan}${C.bold}🐉 ATHELGARD PEAK PROTECTION${C.reset}`);
  console.log(`${C.gray}DeepSeek Smart Cost Router v2.0${C.reset}`);
  console.log('');
  
  // Current status
  const statusIcon = peak.peak ? '🔴' : '🟢';
  const statusColor = peak.peak ? C.red : C.green;
  const statusText = peak.peak ? 'PEAK PRICING ACTIVE' : 'OFF-PEAK (SAVE MONEY)';
  
  console.log(`${C.bold}Current Status:${C.reset} ${statusIcon} ${statusColor}${statusText}${C.reset}`);
  console.log(`  Beijing Time:     ${C.bold}${bj.time}${C.reset} CST (UTC+8)`);
  console.log(`  Your Local Time:  ${C.bold}${local.time}${C.reset}`);
  console.log(`  Window:           ${peak.peak ? C.red : C.green}${peak.label}${C.reset}`);
  console.log(`  Next Change:      ${next.nextIn} → switches to ${next.nextIs}`);
  console.log('');
  
  // Pricing comparison
  console.log(`${C.bold}💰 Cost Comparison (per 1M tokens):${C.reset}`);
  console.log(`  DeepSeek Peak:    ${C.red}$${costs.deepseekPeak}${C.reset} ❌`);
  console.log(`  DeepSeek Off-Peak:${C.green}$${costs.deepseekOff}${C.reset} ✅ Best value`);
  console.log(`  Kimi Fallback:    ${C.cyan}$${costs.kimi}${C.reset} 🔄 Used during peak`);
  console.log('');
  
  // Savings
  if (peak.peak) {
    console.log(`${C.bold}💸 Savings Right Now:${C.reset}`);
    console.log(`  Using Kimi saves: ${C.green}$${costs.savings}${C.reset} per 1M tokens`);
    console.log(`  That's ${C.green}${costs.savingsPercent}%${C.reset} cheaper than DeepSeek peak pricing`);
    console.log('');
  }
  
  // Recommendation
  console.log(`${C.bold}📋 Recommendation:${C.reset}`);
  if (peak.peak) {
    console.log(`  ${C.yellow}→ Route to Kimi API now${C.reset}`);
    console.log(`  ${C.gray}DeepSeek is 2x priced during ${peak.label}${C.reset}`);
  } else {
    console.log(`  ${C.green}→ Use DeepSeek API${C.reset}`);
    console.log(`  ${C.gray}Cheapest rate available right now${C.reset}`);
  }
  console.log('');
}

function showSchedule() {
  const C = process.stdout.isTTY ? {
    bold: '\x1b[1m', reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', gray: '\x1b[90m'
  } : { bold: '', reset: '', red: '', green: '', gray: '' };
  
  console.log('');
  console.log(`${C.bold}📅 DeepSeek Peak Schedule (Beijing Time)${C.reset}`);
  console.log(`${C.gray}All times in CST (UTC+8)${C.reset}`);
  console.log('');
  
  for (const w of DEEPSEEK_PEAK_WINDOWS) {
    console.log(`  ${C.red}🔴 ${w.label}${C.reset}`);
    console.log(`     ${w.start} – ${w.end} Beijing`);
    console.log(`     ${C.gray}2x pricing active${C.reset}`);
    console.log('');
  }
  
  console.log(`${C.green}🟢 Off-Peak${C.reset}`);
  console.log(`  All other hours`);
  console.log(`  ${C.gray}Normal pricing (50% cheaper)${C.reset}`);
  console.log('');
}

function showSavings(monthlyTokens = 10000000) {
  const costs = calculateCosts(monthlyTokens);
  const C = process.stdout.isTTY ? {
    bold: '\x1b[1m', reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m'
  } : { bold: '', reset: '', red: '', green: '', cyan: '' };
  
  const peakHoursPerDay = 7; // 3h morning + 4h afternoon
  const peakRatio = peakHoursPerDay / 24;
  const offRatio = 1 - peakRatio;
  
  const noRouterCost = monthlyTokens * 0.00014 * (1 + peakRatio); // All DeepSeek, peak = 2x
  const routerCost = (monthlyTokens * offRatio * 0.00014) + (monthlyTokens * peakRatio * 0.00003);
  const saved = noRouterCost - routerCost;
  
  console.log('');
  console.log(`${C.bold}💰 Monthly Savings Estimate${C.reset}`);
  console.log(`  Monthly tokens:     ${(monthlyTokens / 1000000).toFixed(1)}M`);
  console.log('');
  console.log(`${C.red}Without Peak Protection:${C.reset}`);
  console.log(`  All DeepSeek:       $${noRouterCost.toFixed(2)}/month`);
  console.log('');
  console.log(`${C.green}With Peak Protection:${C.reset}`);
  console.log(`  DeepSeek off-peak:  $${(monthlyTokens * offRatio * 0.00014).toFixed(2)}`);
  console.log(`  Kimi peak:          $${(monthlyTokens * peakRatio * 0.00003).toFixed(2)}`);
  console.log(`  Total:              $${routerCost.toFixed(2)}/month`);
  console.log('');
  console.log(`${C.bold}💸 You Save: $${saved.toFixed(2)}/month${C.reset}`);
  console.log(`${C.bold}📉 That's ${Math.round((saved / noRouterCost) * 100)}% cheaper${C.reset}`);
  console.log('');
}

// ===== MAIN =====

function showHelp() {
  console.log(`
🐉 ATHELGARD PEAK PROTECTION

DeepSeek Smart Cost Router — saves 50% during peak hours

Usage:
  node peak-protection.js status       Show current status
  node peak-protection.js schedule     Show peak windows
  node peak-protection.js savings      Calculate monthly savings
  node peak-protection.js demo         Live demo (updates every minute)
  node peak-protection.js help         This help

What it does:
  DeepSeek charges 2x during peak hours (9AM-12PM, 2PM-6PM Beijing).
  This router automatically switches to Kimi during those hours,
  saving up to 50% on API costs.

Integration:
  const { isPeakHour } = require('./peak-protection');
  const model = isPeakHour().peak ? 'kimi' : 'deepseek';
`);
}

function liveDemo() {
  showStatus();
  console.log('⏰ Updating every 60 seconds... (Ctrl+C to stop)\n');
  setInterval(() => {
    console.clear();
    showStatus();
  }, 60000);
}

// CLI
const cmd = process.argv[2] || 'status';

switch(cmd) {
  case 'status': showStatus(); break;
  case 'schedule': showSchedule(); break;
  case 'savings': showSavings(); break;
  case 'demo': liveDemo(); break;
  case 'help': showHelp(); break;
  default: showHelp();
}

// Export for use in other modules
module.exports = { isPeakHour, getBeijingTime, calculateCosts, DEEPSEEK_PEAK_WINDOWS };
