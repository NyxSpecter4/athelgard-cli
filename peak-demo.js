#!/usr/bin/env node
/**
 * ATHELGARD PEAK PROTECTION — FULL DEMO
 * Shows the routing logic working with real scenarios
 */

const C = process.stdout.isTTY ? {
  bold: '\x1b[1m', reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  cyan: '\x1b[36m', yellow: '\x1b[33m', gray: '\x1b[90m'
} : { bold: '', reset: '', green: '', red: '', cyan: '', yellow: '', gray: '' };

function c(str, color) { return C[color] + str + C.reset; }

// Simulate the provider function
function provider(config, simulatedHour = null) {
  const bjHour = simulatedHour !== null ? simulatedHour : 
    Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date()));
  const isPeak = (bjHour >= 9 && bjHour < 12) || (bjHour >= 14 && bjHour < 18);
  
  if (isPeak && config.kimiKey) {
    return { 
      model: 'kimi-k2.5', 
      host: 'api.moonshot.cn',
      reason: 'Peak Protection: DeepSeek 2x priced (' + bjHour + ':00 Beijing)',
      peak: true,
      hour: bjHour
    };
  }
  if (config.deepseekKey) {
    return { 
      model: 'deepseek-chat', 
      host: 'api.deepseek.com',
      reason: 'DeepSeek off-peak (' + bjHour + ':00 Beijing)',
      peak: false,
      hour: bjHour
    };
  }
  throw new Error('No keys configured');
}

console.log('');
console.log(c('🐉 ATHELGARD PEAK PROTECTION — FULL DEMO', 'bold'));
console.log(c('Shows automatic model routing based on DeepSeek peak hours', 'gray'));
console.log('');

// Scenario 1: Current time
console.log(c('━'.repeat(60), 'gray'));
console.log(c('SCENARIO 1: Right Now', 'bold'));
console.log(c('━'.repeat(60), 'gray'));

const now = new Date();
const bjNow = new Intl.DateTimeFormat('en-US', { 
  hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'Asia/Shanghai' 
}).format(now);

console.log(`Your local time: ${now.toLocaleTimeString()}`);
console.log(`Beijing time:    ${bjNow}`);
console.log('');

const result1 = provider({ deepseekKey: 'real-key', kimiKey: 'real-key' });
const icon1 = result1.peak ? c('🔴 PEAK', 'red') : c('🟢 OFF-PEAK', 'green');
console.log(`Status: ${icon1}`);
console.log(`Router chose: ${c(result1.model, 'cyan')}`);
console.log(`Reason: ${result1.reason}`);
console.log('');

// Scenario 2: Full day simulation
console.log(c('━'.repeat(60), 'gray'));
console.log(c('SCENARIO 2: Full Day Simulation', 'bold'));
console.log(c('━'.repeat(60), 'gray'));
console.log('');

const config = { deepseekKey: 'ds-key', kimiKey: 'kimi-key' };
let dailyDeepSeekCost = 0;
let dailyKimiCost = 0;
let dailyProtectedCost = 0;

for (let hour = 0; hour < 24; hour++) {
  const result = provider(config, hour);
  const icon = result.peak ? c('🔴', 'red') : c('🟢', 'green');
  const modelColor = result.model === 'deepseek-chat' ? 'green' : 'cyan';
  const tokens = 5000; // Simulate 5K tokens per hour (realistic coding usage)
  
  // Calculate costs
  const deepseekCost = tokens * (result.peak ? 0.00028 : 0.00014);
  const kimiCost = tokens * 0.00003;
  const actualCost = result.peak ? kimiCost : deepseekCost;
  
  dailyDeepSeekCost += deepseekCost;
  dailyProtectedCost += actualCost;
  
  console.log(`${icon} ${String(hour).padStart(2,'0')}:00  →  ${c(result.model, modelColor).padEnd(20)}  Cost: $${actualCost.toFixed(4)}`);
}

console.log('');
console.log(c('━'.repeat(60), 'gray'));
console.log(c('DAILY COST COMPARISON', 'bold'));
console.log(c('━'.repeat(60), 'gray'));
console.log(`Using only DeepSeek (including peak):  $${dailyDeepSeekCost.toFixed(4)}`);
console.log(`With Peak Protection (auto-switch):    $${dailyProtectedCost.toFixed(4)}`);
console.log(`Daily savings:                           ${c('$' + (dailyDeepSeekCost - dailyProtectedCost).toFixed(4), 'green')}`);
console.log(`Savings percentage:                      ${c(Math.round((1 - dailyProtectedCost/dailyDeepSeekCost)*100) + '%', 'green')}`);
console.log('');

// Scenario 3: What if no Kimi key?
console.log(c('━'.repeat(60), 'gray'));
console.log(c('SCENARIO 3: No Kimi Key Configured', 'bold'));
console.log(c('━'.repeat(60), 'gray'));
console.log('');

const noKimiResult = provider({ deepseekKey: 'ds-key' }, 10); // 10 AM = peak
console.log(`At 10:00 Beijing (peak):`);
console.log(`  Router chose: ${c(noKimiResult.model, 'green')}`);
console.log(`  ${c('⚠️ Warning:', 'yellow')} No Kimi key → stays on DeepSeek at 2x price`);
console.log(`  ${c('Fix:', 'cyan')} Run 'athelgard config' and add Kimi API key`);
console.log('');

console.log(c('━'.repeat(60), 'gray'));
console.log(c('HOW TO USE', 'bold'));
console.log(c('━'.repeat(60), 'gray'));
console.log('');
console.log('1. Configure both API keys:');
console.log('   ' + c('athelgard config', 'cyan'));
console.log('   - Add DeepSeek key (primary, cheapest off-peak)');
console.log('   - Add Kimi key (fallback during peak)');
console.log('');
console.log('2. Just use Athelgard normally:');
console.log('   ' + c('athelgard ask "How do I write a React hook?"', 'cyan'));
console.log('   ' + c('athelgard chat', 'cyan'));
console.log('');
console.log('3. Peak Protection works automatically:');
console.log('   - Off-peak → routes to DeepSeek (cheapest)');
console.log('   - Peak hours → routes to Kimi (saves 50%+)');
console.log('');
console.log('4. Check status anytime:');
console.log('   ' + c('athelgard peak status', 'cyan'));
console.log('');
