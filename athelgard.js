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
const GitIntel = require('./skills/git-intel');
const Navigator = require('./skills/navigator');
const CodeChunker = require('./skills/chunker');
const TestGenerator = require('./skills/test-gen');
const DocGenerator = require('./skills/doc-gen');

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

// ===== GIT INTELLIGENCE COMMANDS =====

async function gitCommand(args) {
  const [subcmd, ...rest] = args;
  const git = new GitIntel();
  
  if (!git.isGitRepo()) {
    console.log('❌ Not a git repository');
    return;
  }

  switch(subcmd) {
    case 'blame': {
      const [file, line] = rest;
      if (!file) { console.log('Usage: athelgard git blame <file> [line]'); return; }
      const result = git.blame(file, line ? parseInt(line) : null);
      if (!result) { console.log('❌ Could not get blame info'); return; }
      console.log(`\n🕵️ BLAME: ${file}${line ? `:${line}` : ''}`);
      console.log(`   Commit: ${result.commit}`);
      console.log(`   Author: ${result.author}`);
      console.log(`   Date: ${result.date}`);
      console.log(`   Message: ${result.message}`);
      break;
    }
    
    case 'log': {
      const n = parseInt(rest[0]) || 20;
      const commits = git.log({ n });
      console.log(`\n📜 LAST ${commits.length} COMMITS:\n`);
      for (const c of commits) {
        console.log(`   ${c.hash}  ${c.date}  ${c.author.padEnd(15)}  ${c.subject}`);
      }
      break;
    }
    
    case 'status': {
      const status = git.status();
      if (!status.length) { console.log('✅ Working tree clean'); return; }
      console.log('\n📋 WORKING TREE:\n');
      for (const s of status) {
        const icon = s.status === '??' ? '❓' : s.staged ? '✅' : '✏️';
        console.log(`   ${icon} [${s.status.padEnd(2)}] ${s.file}`);
      }
      break;
    }
    
    case 'diff': {
      const base = rest[0] || 'HEAD~1';
      const target = rest[1] || 'HEAD';
      const changes = git.changedFiles(base, target);
      console.log(`\n📊 CHANGES: ${base} → ${target}\n`);
      for (const c of changes) {
        const icon = c.status === 'A' ? '➕' : c.status === 'D' ? '➖' : c.status === 'M' ? '✏️' : '📝';
        console.log(`   ${icon} ${c.statusLabel.padEnd(10)} ${c.file}`);
      }
      break;
    }
    
    case 'summary': {
      const days = parseInt(rest[0]) || 7;
      const summary = git.summary(days);
      console.log(`\n📈 ACTIVITY: Last ${summary.period}\n`);
      console.log(`   Total commits: ${summary.totalCommits}`);
      console.log(`\n   Top contributors:`);
      for (const [name, count] of summary.topAuthors) {
        console.log(`      ${name}: ${count} commits`);
      }
      console.log(`\n   Recent commits:`);
      for (const c of summary.recentCommits) {
        console.log(`      ${c.hash} ${c.subject}`);
      }
      break;
    }
    
    case 'suggest-commit': {
      console.log('\n🤖 Analyzing staged changes...');
      const result = await git.suggestCommitMessage((prompt) => askAI(prompt));
      if (result.error) { console.log(`❌ ${result.error}`); return; }
      console.log('\n💡 SUGGESTED COMMIT MESSAGE:\n');
      console.log('─'.repeat(50));
      console.log(result.message);
      console.log('─'.repeat(50));
      console.log(`\n   Files: ${result.files.length}`);
      console.log(`   Use: git commit -m "${result.message.split('\n')[0]}"`);
      break;
    }
    
    case 'branches': {
      const branches = git.branches();
      console.log('\n🌿 BRANCHES:\n');
      for (const b of branches) {
        const marker = b.current ? '👉 ' : '   ';
        console.log(`${marker}${b.name.padEnd(20)} ${b.upstream || '(no upstream)'}`);
      }
      break;
    }
    
    case 'stash': {
      const stashes = git.stashList();
      if (!stashes.length) { console.log('📦 No stashes'); return; }
      console.log('\n📦 STASHES:\n');
      for (const s of stashes) {
        console.log(`   ${s.ref}  ${s.age} ago  ${s.subject}`);
      }
      break;
    }
    
    case 'contributors': {
      const contributors = git.contributors();
      console.log('\n👥 TOP CONTRIBUTORS:\n');
      for (const c of contributors.slice(0, 10)) {
        const bar = '█'.repeat(Math.min(c.commits / 5, 20));
        console.log(`   ${c.name.padEnd(20)} ${bar} ${c.commits}`);
      }
      break;
    }
    
    case 'stats': {
      const stats = git.stats();
      console.log('\n📊 REPO STATISTICS:\n');
      console.log(`   Total commits: ${stats.totalCommits}`);
      console.log(`   Total files: ${stats.totalFiles}`);
      console.log(`   Active days: ${stats.activeDays}`);
      console.log(`   First commit: ${stats.firstCommit}`);
      console.log(`   Last commit: ${stats.lastCommit}`);
      break;
    }
    
    default:
      console.log(`
🕵️ GIT INTELLIGENCE

  athelgard git blame <file> [line]    - Who wrote this
  athelgard git log [n]                - Recent commits
  athelgard git status                 - Working tree
  athelgard git diff [base] [target]   - Changed files
  athelgard git summary [days]         - Activity summary
  athelgard git suggest-commit         - Auto-generate commit message
  athelgard git branches               - List branches
  athelgard git stash                  - List stashes
  athelgard git contributors           - Top contributors
  athelgard git stats                  - Repo statistics
`);
  }
}

// ===== NAVIGATOR COMMANDS =====

function mapCommand(args) {
  const [dir = '.'] = args;
  const nav = new Navigator();
  const map = nav.map(dir, 0, 3);
  
  console.log(`\n🗺️ PROJECT MAP: ${dir}\n`);
  console.log(`   Files: ${map.totalFiles} | Size: ${nav._formatSize(map.totalSize)}\n`);
  
  const byDepth = {};
  for (const d of map.dirs) {
    if (!byDepth[d.depth]) byDepth[d.depth] = [];
    byDepth[d.depth].push(d.path);
  }
  
  for (let d = 0; d <= 3; d++) {
    if (byDepth[d]) {
      console.log(`   ${'  '.repeat(d)}📁 ${byDepth[d].length} directories`);
    }
  }
  
  const exts = {};
  for (const f of map.files) {
    exts[f.ext || '(no ext)'] = (exts[f.ext || '(no ext)'] || 0) + 1;
  }
  const sortedExts = Object.entries(exts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n   Top file types:`);
  for (const [ext, count] of sortedExts) {
    console.log(`      ${ext.padEnd(8)} ${count} files`);
  }
}

function treeCommand(args) {
  const [dir = '.'] = args;
  const nav = new Navigator();
  console.log(`\n${dir}`);
  console.log(nav.tree(dir, '', 4));
}

function statsCommand() {
  const nav = new Navigator();
  const stats = nav.stats();
  
  console.log('\n📊 PROJECT STATISTICS:\n');
  console.log(`   Total files: ${stats.totalFiles}`);
  console.log(`   Total size: ${stats.totalSize}`);
  console.log(`   Total lines: ${stats.totalLines.toLocaleString()}`);
  console.log(`   Directories: ${stats.directories}\n`);
  console.log(`   By extension:`);
  for (const [ext, count] of stats.byExtension) {
    console.log(`      ${(ext || 'none').padEnd(8)} ${String(count).padStart(4)} files`);
  }
}

function findCommand(args) {
  const [pattern] = args;
  if (!pattern) { console.log('Usage: athelgard find <pattern>'); return; }
  const nav = new Navigator();
  const results = nav.find(pattern);
  console.log(`\n🔍 FOUND ${results.length} FILES:\n`);
  for (const r of results.slice(0, 30)) {
    console.log(`   ${r.path}`);
  }
  if (results.length > 30) console.log(`   ... and ${results.length - 30} more`);
}

function grepCommand(args) {
  const [term, ext] = args;
  if (!term) { console.log('Usage: athelgard grep <term> [ext]'); return; }
  const nav = new Navigator();
  const results = nav.grep(term, '.', ext);
  
  console.log(`\n🔍 "${term}" FOUND IN ${results.length} FILES:\n`);
  for (const r of results.slice(0, 10)) {
    console.log(`   📄 ${r.file} (${r.totalMatches} matches)`);
    for (const m of r.matches) {
      console.log(`      ${String(m.line).padStart(4)}: ${m.text.substring(0, 80)}`);
    }
  }
}

function detectCommand() {
  const nav = new Navigator();
  const project = nav.detectProject();
  
  console.log('\n🔎 PROJECT DETECTION:\n');
  console.log(`   Type: ${project.name}`);
  if (project.framework) console.log(`   Framework: ${project.framework}`);
  if (project.version) console.log(`   Version: ${project.version}`);
  if (project.main) console.log(`   Entry: ${project.main}`);
  if (project.scripts?.length) {
    console.log(`   Scripts: ${project.scripts.join(', ')}`);
  }
}

// ===== CODE CHUNKER COMMANDS =====

function chunkCommand(args) {
  const [file, targetFunc] = args;
  if (!file) { console.log('Usage: athelgard chunk <file> [function-name]'); return; }
  
  const code = fs.readFileSync(file, 'utf8');
  const chunker = new CodeChunker();
  const language = chunker.detectLanguage(file);
  const chunks = chunker.chunkByFunction(code, language);
  
  if (targetFunc) {
    const target = chunks.find(c => c.name === targetFunc);
    if (!target) { console.log(`❌ Function "${targetFunc}" not found`); return; }
    console.log(`\n🧩 CHUNK: ${target.type} "${target.name}" (${target.content.length} lines)\n`);
    console.log(target.content.join('\n'));
  } else {
    console.log(`\n🧩 ${file} → ${chunks.length} chunks (${language}):\n`);
    for (const c of chunks) {
      if (c.type === 'separator') continue;
      const icon = c.type === 'class' ? '🏛️' : c.type === 'function' ? '⚙️' : '📝';
      console.log(`   ${icon} ${c.type.toUpperCase()} "${c.name}" (${c.content.length} lines)`);
    }
  }
}

function contextCommand(args) {
  const [file, lineStr] = args;
  if (!file || !lineStr) { console.log('Usage: athelgard context <file> <line>'); return; }
  
  const code = fs.readFileSync(file, 'utf8');
  const chunker = new CodeChunker();
  const language = chunker.detectLanguage(file);
  const context = chunker.getContext(code, parseInt(lineStr), 20, language);
  
  console.log(`\n📍 CONTEXT: ${file}:${lineStr}\n`);
  if (context.enclosingFunction) {
    console.log(`   Enclosing ${context.enclosingFunction.type}: ${context.enclosingFunction.name}\n`);
  }
  console.log('─'.repeat(60));
  const lines = context.around.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNum = context.lineNumbers.start + i;
    const marker = lineNum === context.lineNumbers.target ? '▶️' : '  ';
    console.log(`${marker} ${String(lineNum).padStart(4)}: ${lines[i]}`);
  }
  console.log('─'.repeat(60));
}

// ===== TEST GENERATOR COMMANDS =====

async function testGenCommand(args) {
  const [file, ...rest] = args;
  const gen = new TestGenerator();
  
  if (file === '--coverage') {
    const result = gen.findUntestedFiles();
    console.log(`\n🧪 COVERAGE ANALYSIS:\n`);
    console.log(`   Tested: ${result.tested} | Total: ${result.total} | Coverage: ${result.coverage}%\n`);
    console.log(`   ❌ UNTESTED FILES (${result.untested.length}):`);
    for (const f of result.untested.slice(0, 20)) {
      console.log(`      ${f}`);
    }
    if (result.untested.length > 20) console.log(`      ... and ${result.untested.length - 20} more`);
    return;
  }
  
  if (!file) { console.log('Usage: athelgard test-gen <file> [--framework vitest]'); return; }
  
  const frameworkFlag = rest.find(r => r.startsWith('--framework'));
  const framework = frameworkFlag ? frameworkFlag.split('=')[1] : null;
  
  console.log(`\n🧪 GENERATING ${framework || gen.detectFramework().toUpperCase()} TESTS FOR: ${file}\n`);
  const tests = await gen.generateTests(file, framework, (prompt) => askAI(prompt));
  
  const testFile = file.replace(/\.[^.]+$/, `.test.${file.split('.').pop()}`);
  console.log(`\n💾 WRITING TO: ${testFile}\n`);
  fs.writeFileSync(testFile, tests);
  console.log('✅ Tests generated!');
}

function testRunCommand(args) {
  const gen = new TestGenerator();
  const cmd = gen.runTests(null, args);
  console.log(`\n▶️  RUNNING: ${cmd}\n`);
  const { execSync } = require('child_process');
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
  } catch (e) {
    // Test failures throw, but we showed output via inherit
  }
}

// ===== DOC GENERATOR COMMANDS =====

async function docsCommand(args) {
  const [subcmd, ...rest] = args;
  const gen = new DocGenerator();
  
  switch(subcmd) {
    case 'readme': {
      console.log('\n📝 GENERATING README...\n');
      const readme = await gen.generateREADME((prompt) => askAI(prompt));
      fs.writeFileSync('README.md', readme);
      console.log('✅ README.md created!');
      break;
    }
    
    case 'jsdoc': {
      const [file] = rest;
      if (!file) { console.log('Usage: athelgard docs jsdoc <file>'); return; }
      console.log(`\n📝 ADDING JSDOC TO: ${file}\n`);
      const documented = await gen.addJSDoc(file, (prompt) => askAI(prompt));
      fs.writeFileSync(file, documented);
      console.log('✅ JSDoc comments added!');
      break;
    }
    
    case 'api': {
      const [file] = rest;
      if (!file) { console.log('Usage: athelgard docs api <file>'); return; }
      console.log(`\n📝 GENERATING API DOCS FOR: ${file}\n`);
      const docs = await gen.generateAPIDocs(file, (prompt) => askAI(prompt));
      const outFile = file.replace(/\.[^.]+$/, '.API.md');
      fs.writeFileSync(outFile, docs);
      console.log(`✅ API docs written to ${outFile}`);
      break;
    }
    
    case 'changelog': {
      console.log('\n📝 GENERATING CHANGELOG...\n');
      const changelog = await gen.generateChangelog((prompt) => askAI(prompt));
      fs.writeFileSync('CHANGELOG.md', changelog);
      console.log('✅ CHANGELOG.md created!');
      break;
    }
    
    case 'license': {
      const [type = 'MIT', author = ''] = rest;
      const license = gen.generateLicense(type, author);
      fs.writeFileSync('LICENSE', license);
      console.log(`✅ ${type} LICENSE created!`);
      break;
    }
    
    default:
      console.log(`
📝 DOC GENERATOR

  athelgard docs readme              - Generate README.md
  athelgard docs jsdoc <file>        - Add JSDoc comments
  athelgard docs api <file>          - Generate API docs
  athelgard docs changelog           - Generate CHANGELOG
  athelgard docs license [type]      - Generate LICENSE
`);
  }
}

function help() {
  console.log(`
🐉 ATHELGARD CLI - Captain's AI Coding Agent + Prompt Engineer + Skills

📁 CORE:
  athelgard config
  athelgard ask "question"
  athelgard chat
  athelgard read <file>
  athelgard write <file> "content" --apply
  athelgard edit <file> "instruction"
  athelgard edit <file> "instruction" --apply
  athelgard github list [owner]
  athelgard github get <owner/repo> <path>

🎯 PROMPT ENGINEER:
  athelgard prompt list
  athelgard prompt use <name> "query"
  athelgard prompt test <name> "query"
  athelgard prompt optimize "prompt"
  athelgard prompt analyze "prompt"
  athelgard prompt engineer
  athelgard prompt create

🕵️ GIT INTELLIGENCE:
  athelgard git blame <file> [line]
  athelgard git log [n]
  athelgard git status
  athelgard git diff [base]
  athelgard git summary [days]
  athelgard git suggest-commit
  athelgard git branches
  athelgard git stash
  athelgard git contributors
  athelgard git stats

🗺️ NAVIGATOR:
  athelgard map [dir]
  athelgard tree [dir]
  athelgard stats
  athelgard find <pattern>
  athelgard grep <term> [ext]
  athelgard detect

🧩 CODE CHUNKER:
  athelgard chunk <file> [function]
  athelgard context <file> <line>

🧪 TEST GENERATOR:
  athelgard test-gen <file>
  athelgard test-gen --coverage
  athelgard test-run [pattern]

📝 DOC GENERATOR:
  athelgard docs readme
  athelgard docs jsdoc <file>
  athelgard docs api <file>
  athelgard docs changelog
  athelgard docs license [type]
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

  // ===== GIT INTELLIGENCE =====
  if (command === 'git') return gitCommand(args);

  // ===== NAVIGATOR =====
  if (command === 'map') return mapCommand(args);
  if (command === 'tree') return treeCommand(args);
  if (command === 'stats') return statsCommand(args);
  if (command === 'find') return findCommand(args);
  if (command === 'grep') return grepCommand(args);
  if (command === 'detect') return detectCommand(args);

  // ===== CODE CHUNKER =====
  if (command === 'chunk') return chunkCommand(args);
  if (command === 'context') return contextCommand(args);

  // ===== TEST GENERATOR =====
  if (command === 'test-gen') return testGenCommand(args);
  if (command === 'test-run') return testRunCommand(args);

  // ===== DOC GENERATOR =====
  if (command === 'docs') return docsCommand(args);

  return console.log(`\n🐉 ${await askAI([command, ...args].join(' '))}`);
}

main().catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
