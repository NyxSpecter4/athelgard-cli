#!/usr/bin/env node
/**
 * ATHELGARD CLI - Captain's Coding Agent + Prompt Engineer
 * 
 * Usage:
 *   athelgard ask "How do I write a React hook?"
 *   athelgard prompt create         - Create prompt template
 *   athelgard prompt list           - List all templates
 *   athelgard prompt use <name>     - Use a template
 *   athelgard prompt test <name>    - A/B test variations
 *   athelgard prompt optimize       - Optimize a prompt
 *   athelgard prompt engineer       - Interactive builder
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');
const promptEngineer = require('./prompt-engineer');

const CONFIG_PATH = path.join(os.homedir(), '.athelgard.json');
const MAX_CONTEXT = 12000;

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log('✓ Configuration saved');
}
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Request failed (${res.statusCode}): ${data.slice(0, 300)}`));
        }
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}
async function configure() {
  const config = loadConfig();
  config.deepseekKey = await prompt('DeepSeek API key (Enter keeps existing): ') || config.deepseekKey;
  config.kimiKey = await prompt('Kimi API key (optional; Enter keeps existing): ') || config.kimiKey;
  config.githubToken = await prompt('GitHub token (optional; Enter keeps existing): ') || config.githubToken;
  saveConfig(config);
}
function provider(config) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }).format(new Date()));
  if (hour >= 9 && hour < 21 && config.kimiKey) {
    return { host: 'api.moonshot.cn', path: '/v1/chat/completions', key: config.kimiKey, model: 'kimi-k2.5' };
  }
  if (config.deepseekKey) return { host: 'api.deepseek.com', path: '/chat/completions', key: config.deepseekKey, model: 'deepseek-chat' };
  if (config.kimiKey) return { host: 'api.moonshot.cn', path: '/v1/chat/completions', key: config.kimiKey, model: 'kimi-k2.5' };
  throw new Error('No model key configured. Run: athelgard config');
}

async function askAI(userPrompt, history = [], systemOverride = '') {
  const p = provider(loadConfig());
  const systemContent = systemOverride || 'You are Athelgard, a careful coding agent. State uncertainty. Never claim a change was applied unless it was. When asked to edit, return only the complete replacement file in one fenced code block.';
  const body = JSON.stringify({
    model: p.model,
    temperature: 0.2,
    max_tokens: 5000,
    messages: [
      { role: 'system', content: systemContent },
      ...history.slice(-10),
      { role: 'user', content: userPrompt }
    ]
  });
  const result = await request({ hostname: p.host, path: p.path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}`, 'Content-Length': Buffer.byteLength(body) } }, body);
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Model returned no usable response');
  return text;
}

function extractCode(answer) {
  const match = answer.match(/```(?:[\w+-]+)?\n([\s\S]*?)```/);
  return match ? match[1] : null;
}
function lineDiff(before, after) {
  const a = before.split('\n'); const b = after.split('\n');
  let start = 0; while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1; let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB--; }
  const removed = a.slice(start, endA + 1); const added = b.slice(start, endB + 1);
  return [`@@ lines ${start + 1} @@`, ...removed.map(x => `- ${x}`), ...added.map(x => `+ ${x}`)].join('\n');
}
function readFile(file) { return fs.readFileSync(path.resolve(file), 'utf8'); }
function writeFile(file, content) { fs.writeFileSync(path.resolve(file), content, 'utf8'); }

async function editFile(args) {
  const apply = args.includes('--apply');
  const clean = args.filter(x => x !== '--apply');
  const [file, ...instructionParts] = clean;
  const instruction = instructionParts.join(' ');
  if (!file || !instruction) throw new Error('Usage: athelgard edit <file> <instruction> [--apply]');
  const before = readFile(file);
  const context = before.length > MAX_CONTEXT ? `${before.slice(0, MAX_CONTEXT)}\n/* context truncated */` : before;
  const answer = await askAI(`Replace ${file} according to this request: ${instruction}\n\nCurrent file:\n\`\`\`\n${context}\n\`\`\``);
  const candidate = extractCode(answer);
  if (!candidate) { console.log(answer); throw new Error('No replacement file was returned; nothing was written'); }
  console.log(`\nProposed change — ${file}:\n${lineDiff(before, candidate)}\n`);
  if (!apply) { console.log('Review only. Re-run with --apply to write this candidate.'); return; }
  writeFile(file, candidate);
  console.log(`✓ Applied ${file}`);
}

async function github(args) {
  const [action, target, file] = args;
  const token = loadConfig().githubToken;
  if (!token) throw new Error('No GitHub token configured. Run: athelgard config');
  const headers = { 'User-Agent': 'athelgard-cli', 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` };
  if (action === 'list') {
    const owner = target || 'me';
    const apiPath = owner === 'me' ? '/user/repos?per_page=100&sort=updated' : `/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`;
    const repos = await request({ hostname: 'api.github.com', path: apiPath, headers });
    repos.forEach(repo => console.log(`${repo.full_name}\t${repo.private ? 'private' : 'public'}\t${repo.description || ''}`));
    return;
  }
  if (action === 'get') {
    if (!target || !file || !target.includes('/')) throw new Error('Usage: athelgard github get <owner/repo> <path>');
    const result = await request({ hostname: 'api.github.com', path: `/repos/${target.split('/').map(encodeURIComponent).join('/')}/contents/${file.split('/').map(encodeURIComponent).join('/')}`, headers });
    if (Array.isArray(result)) { result.forEach(item => console.log(`${item.type}\t${item.path}`)); return; }
    if (result.encoding === 'base64') console.log(Buffer.from(result.content, 'base64').toString('utf8'));
    else console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error('Usage: athelgard github list [owner] | github get <owner/repo> <path>');
}

async function chat() {
  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('🐉 Athelgard chat — type exit to leave');
  const next = () => rl.question('You: ', async input => {
    if (input.trim().toLowerCase() === 'exit') return rl.close();
    try {
      const answer = await askAI(input, history);
      history.push({ role: 'user', content: input }, { role: 'assistant', content: answer });
      console.log(`\n🐉 ${answer}\n`);
    } catch (error) { console.error(`Error: ${error.message}`); }
    next();
  });
  next();
}

// ===== PROMPT ENGINEER COMMANDS =====

async function promptCommand(args) {
  const [subcmd, ...rest] = args;
  
  switch(subcmd) {
    case 'create':
      await promptEngineer.interactiveBuilder(readline, (prompt, system) => askAI(prompt, [], system));
      break;
      
    case 'list': {
      const templates = promptEngineer.loadTemplates();
      console.log('\n🎯 ATHELGARD PROMPT TEMPLATES\n');
      
      const byCategory = {};
      for (const [key, t] of Object.entries(templates)) {
        const cat = t.category || 'uncategorized';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({ key, ...t });
      }
      
      for (const [cat, items] of Object.entries(byCategory)) {
        console.log(`\n📁 ${cat.toUpperCase()}`);
        for (const t of items) {
          const vars = t.variables?.length ? ` [${t.variables.join(', ')}]` : '';
          console.log(`  ${t.key.padEnd(20)} ${t.name}${vars}`);
          console.log(`  ${''.padEnd(20)} ${t.description}`);
        }
      }
      console.log('\n💡 Usage: athelgard prompt use <template> "your query"');
      console.log('   Or: athelgard prompt use <template> --var key=value');
      break;
    }
      
    case 'use': {
      const templateName = rest[0];
      const queryParts = [];
      const variables = {};
      
      let i = 1;
      while (i < rest.length) {
        if (rest[i] === '--var' && i + 1 < rest.length) {
          const [k, v] = rest[i + 1].split('=');
          variables[k] = v;
          i += 2;
        } else {
          queryParts.push(rest[i]);
          i++;
        }
      }
      
      const query = queryParts.join(' ');
      
      if (!templateName) {
        console.log('Usage: athelgard prompt use <template> "your query"');
        console.log('   Or: athelgard prompt use <template> --var key=value');
        return;
      }
      
      try {
        const prompt = promptEngineer.buildPrompt(templateName, { query, ...variables });
        console.log(`\n🎯 Using template: ${templateName}`);
        console.log(`📝 ${prompt.template.name}\n`);
        
        const response = await askAI(prompt.user, [], prompt.system);
        console.log('\n🦉 Athelgard:\n' + response);
      } catch (e) {
        console.log(`❌ ${e.message}`);
      }
      break;
    }
      
    case 'test': {
      const templateName = rest[0];
      const query = rest.slice(1).join(' ');
      
      if (!templateName || !query) {
        console.log('Usage: athelgard prompt test <template> "test query"');
        return;
      }
      
      const result = await promptEngineer.runABTest(
        templateName, 
        query, 
        [],
        (prompt, system) => askAI(prompt, [], system)
      );
      
      console.log('\n🏆 RESULTS:\n');
      const ranked = result.variations
        .filter(v => !v.error)
        .sort((a, b) => b.score.overall - a.score.overall);
      
      for (let i = 0; i < ranked.length; i++) {
        const v = ranked[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        console.log(`${medal} ${v.name}: ${v.score.overall}/100 (${v.duration}ms)`);
        console.log(`   Structure: ${v.score.structure} | Length: ${v.score.length} | Code: ${v.score.codeBlocks} | Actionable: ${v.score.actionable}`);
      }
      
      console.log(`\n✨ Winner: ${result.winner}`);
      console.log(`📊 Full results saved: ${result.id}.json`);
      break;
    }
      
    case 'optimize': {
      const input = rest.join(' ');
      
      if (!input) {
        console.log('Usage: athelgard prompt optimize "your prompt here"');
        console.log('   Or: athelgard prompt optimize --file prompt.txt');
        return;
      }
      
      let promptToOptimize = input;
      if (input === '--file' && rest[1]) {
        promptToOptimize = fs.readFileSync(rest[1], 'utf8');
      }
      
      const result = promptEngineer.optimizePrompt(promptToOptimize);
      
      console.log('\n🔍 PROMPT ANALYSIS\n');
      console.log(`Score: ${result.analysis.score}/100`);
      console.log(`Length: ${result.analysis.length} chars, ${result.analysis.wordCount} words`);
      
      if (result.analysis.issues.length) {
        console.log('\n⚠️ Issues found:');
        for (const issue of result.analysis.issues) {
          const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '⚪';
          console.log(`  ${icon} ${issue.rule}: ${issue.suggestion}`);
        }
      }
      
      console.log('\n✨ Optimized prompt:\n');
      console.log(result.optimized);
      
      const optPath = path.join(promptEngineer.PROMPTS_DIR, 'optimized-prompt.txt');
      fs.writeFileSync(optPath, result.optimized);
      console.log(`\n💾 Saved to: ${optPath}`);
      break;
    }
      
    case 'engineer':
      await promptEngineer.interactiveBuilder(readline, (prompt, system) => askAI(prompt, [], system));
      break;
      
    case 'analyze': {
      const input = rest.join(' ');
      if (!input) {
        console.log('Usage: athelgard prompt analyze "your prompt"');
        return;
      }
      
      const analysis = promptEngineer.analyzePrompt(input);
      console.log('\n📊 PROMPT ANALYSIS\n');
      console.log(`Score: ${analysis.score}/100`);
      console.log(`Length: ${analysis.length} chars, ${analysis.wordCount} words`);
      
      if (analysis.issues.length === 0) {
        console.log('\n✅ No issues found! This prompt looks great.');
      } else {
        console.log('\n⚠️ Improvements needed:');
        for (const issue of analysis.issues) {
          const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '⚪';
          console.log(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.rule}: ${issue.suggestion}`);
        }
      }
      break;
    }
      
    default:
      console.log(`
🎯 ATHELGARD PROMPT ENGINEER

Commands:
  athelgard prompt list                    - List all templates
  athelgard prompt use <name> "query"      - Use a template
  athelgard prompt use <name> --var k=v    - Use with variables
  athelgard prompt create                  - Create new template (interactive)
  athelgard prompt test <name> "query"     - A/B test prompt variations
  athelgard prompt optimize "prompt"       - Analyze & optimize a prompt
  athelgard prompt analyze "prompt"        - Score a prompt
  athelgard prompt engineer                - Interactive prompt builder

Built-in templates:
  code-review, bounty-report, debug-helper,
  creative-writing, system-architect
`);
  }
}

function help() {
  console.log(`
🐉 ATHELGARD CLI

  athelgard config
  athelgard ask "question"
  athelgard chat
  athelgard read <file>
  athelgard write <file> "content" --apply
  athelgard edit <file> "instruction"           # shows a candidate diff
  athelgard edit <file> "instruction" --apply   # writes reviewed candidate
  athelgard github list [owner]
  athelgard github get <owner/repo> <path>

🎯 PROMPT ENGINEER:
  athelgard prompt list                    - List all templates
  athelgard prompt use <name> "query"      - Use a template
  athelgard prompt test <name> "query"     - A/B test variations
  athelgard prompt optimize "prompt"       - Analyze & optimize
  athelgard prompt analyze "prompt"        - Score a prompt
  athelgard prompt engineer                - Interactive builder
  athelgard prompt create                  - Create new template
`);
}

async function main() {
  const [, , command, ...args] = process.argv;
  if (!command || command === 'help') return help();
  if (command === 'config') return configure();
  if (command === 'ask') return console.log(`\n🐉 ${await askAI(args.join(' '))}`);
  if (command === 'chat') return chat();
  if (command === 'read') return console.log(readFile(args[0]));
  if (command === 'write') {
    if (!args.includes('--apply')) throw new Error('Refusing blind write. Add --apply after reviewing the content.');
    const [file, ...content] = args.filter(x => x !== '--apply');
    if (!file) throw new Error('Usage: athelgard write <file> "content" --apply');
    writeFile(file, content.join(' ')); return console.log(`✓ Wrote ${file}`);
  }
  if (command === 'edit') return editFile(args);
  if (command === 'github') return github(args);
  if (command === 'prompt') return promptCommand(args);
  return console.log(`\n🐉 ${await askAI([command, ...args].join(' '))}`);
}

main().catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
