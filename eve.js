#!/usr/bin/env node
/**
 * ATHELGARD EVE AGENT — Event-driven Virtual Entity
 * 
 * What makes this a REAL agent:
 * 1. EVENT LOOP — runs continuously, not just on command
 * 2. TOOL REGISTRY — can actually DO things (edit files, call APIs)
 * 3. MEMORY — remembers context across sessions
 * 4. PLANNING — breaks tasks into steps and executes them
 * 5. AUTONOMY — acts when triggered, not just when you type
 * 
 * Usage:
 *   athelgard eve start        — Start the agent loop
 *   athelgard eve stop         — Stop the agent
 *   athelgard eve status       — Check agent state
 *   athelgard eve task "..."   — Assign a task
 *   athelgard eve memory       — View agent memory
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, spawn } = require('child_process');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.athelgard.json');
const MEMORY_PATH = path.join(os.homedir(), '.athelgard-memory.json');
const TASKS_PATH = path.join(os.homedir(), '.athelgard-tasks.json');
const PID_FILE = path.join(os.homedir(), '.athelgard-eve.pid');

// ═══════════════════════════════════════════════════════════════
// MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════

class Memory {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    } catch {
      return {
        conversations: [],
        tasks: [],
        facts: {},
        files: {},
        preferences: {},
        created: new Date().toISOString()
      };
    }
  }

  save() {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(this.data, null, 2));
  }

  addConversation(role, content, metadata = {}) {
    this.data.conversations.push({
      timestamp: new Date().toISOString(),
      role,
      content,
      ...metadata
    });
    // Keep last 100 conversations
    if (this.data.conversations.length > 100) {
      this.data.conversations = this.data.conversations.slice(-100);
    }
    this.save();
  }

  getRecentContext(n = 10) {
    return this.data.conversations.slice(-n);
  }

  rememberFact(key, value) {
    this.data.facts[key] = {
      value,
      updated: new Date().toISOString()
    };
    this.save();
  }

  getFact(key) {
    return this.data.facts[key]?.value;
  }

  trackFile(filepath, action) {
    this.data.files[filepath] = {
      lastAction: action,
      timestamp: new Date().toISOString()
    };
    this.save();
  }
}

// ═══════════════════════════════════════════════════════════════
// TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════

class ToolRegistry {
  constructor(memory, config) {
    this.memory = memory;
    this.config = config;
    this.tools = this.registerTools();
  }

  registerTools() {
    return {
      // FILE TOOLS
      readFile: async (filepath) => {
        try {
          const content = fs.readFileSync(filepath, 'utf8');
          this.memory.trackFile(filepath, 'read');
          return { success: true, content };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },

      writeFile: async (filepath, content) => {
        try {
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          fs.writeFileSync(filepath, content);
          this.memory.trackFile(filepath, 'write');
          return { success: true, filepath };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },

      listFiles: async (dirpath) => {
        try {
          const files = fs.readdirSync(dirpath);
          return { success: true, files };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },

      // GIT TOOLS
      gitStatus: async () => {
        try {
          const output = execSync('git status --short', { encoding: 'utf8', cwd: process.cwd() });
          return { success: true, status: output || 'clean' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },

      gitCommit: async (message) => {
        try {
          execSync('git add -A', { cwd: process.cwd() });
          execSync(`git commit -m "${message}"`, { cwd: process.cwd() });
          return { success: true, message };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },

      // GITHUB TOOLS
      githubListRepos: async () => {
        const token = this.config.githubToken;
        if (!token) return { success: false, error: 'No GitHub token' };
        
        return new Promise((resolve) => {
          const req = https.request({
            hostname: 'api.github.com',
            path: '/user/repos?per_page=10',
            headers: {
              'Authorization': `Bearer ${token}`,
              'User-Agent': 'athelgard-eve'
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const repos = JSON.parse(data);
                resolve({ success: true, repos: repos.map(r => ({ name: r.name, url: r.html_url })) });
              } catch {
                resolve({ success: false, error: 'Failed to parse response' });
              }
            });
          });
          req.on('error', (e) => resolve({ success: false, error: e.message }));
          req.end();
        });
      },

      // EXECUTE COMMAND
      exec: async (command) => {
        try {
          const output = execSync(command, { encoding: 'utf8', timeout: 30000 });
          return { success: true, output };
        } catch (e) {
          return { success: false, error: e.message, stdout: e.stdout, stderr: e.stderr };
        }
      },

      // SEARCH
      searchCode: async (query, dir = '.') => {
        try {
          const output = execSync(`grep -rn "${query}" ${dir} --include="*.js" --include="*.ts" --include="*.json" 2>/dev/null | head -20`, { encoding: 'utf8' });
          return { success: true, matches: output.split('\n').filter(Boolean) };
        } catch {
          return { success: true, matches: [] };
        }
      },

      // MEMORY TOOLS
      remember: async (key, value) => {
        this.memory.rememberFact(key, value);
        return { success: true };
      },

      recall: async (key) => {
        const value = this.memory.getFact(key);
        return { success: true, value };
      }
    };
  }

  async execute(toolName, ...args) {
    const tool = this.tools[toolName];
    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
    console.log(`  🔧 Tool: ${toolName}(${args.map(a => JSON.stringify(a).slice(0, 50)).join(', ')})`);
    const result = await tool(...args);
    console.log(`  ✅ Result: ${result.success ? 'OK' : 'FAIL'}${result.error ? ` — ${result.error.slice(0, 100)}` : ''}`);
    return result;
  }

  list() {
    return Object.keys(this.tools);
  }
}

// ═══════════════════════════════════════════════════════════════
// AI BRAIN (LLM Integration)
// ═══════════════════════════════════════════════════════════════

class Brain {
  constructor(config) {
    this.config = config;
  }

  async think(prompt, context = []) {
    const apiKey = this.config.deepseek_api_key;
    if (!apiKey) {
      return { error: 'No DeepSeek API key configured' };
    }

    const messages = [
      { role: 'system', content: `You are Athelgard, an autonomous coding agent. You have access to tools: readFile, writeFile, listFiles, gitStatus, gitCommit, githubListRepos, exec, searchCode, remember, recall.

When given a task, decide which tools to use and return a JSON plan:
{
  "thought": "your reasoning",
  "actions": [
    { "tool": "toolName", "args": ["arg1", "arg2"] }
  ],
  "response": "what to tell the user"
}

Be concise. Only use tools when necessary.` },
      ...context.map(c => ({ role: c.role, content: c.content })),
      { role: 'user', content: prompt }
    ];

    return new Promise((resolve) => {
      const data = JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.3,
        max_tokens: 2000
      });

      const req = https.request({
        hostname: 'api.deepseek.com',
        path: '/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 second timeout
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            const content = parsed.choices?.[0]?.message?.content || '{}';
            // Try to parse JSON plan
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ thought: content, actions: [], response: content });
            }
          } catch {
            resolve({ thought: responseData, actions: [], response: responseData });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'DeepSeek API timeout (15s). Check network or API key.' });
      });

      req.on('error', (e) => resolve({ error: e.message }));
      req.write(data);
      req.end();
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// TASK SYSTEM
// ═══════════════════════════════════════════════════════════════

class TaskQueue {
  constructor(memory) {
    this.memory = memory;
    this.tasks = this.load();
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
    } catch {
      return [];
    }
  }

  save() {
    fs.writeFileSync(TASKS_PATH, JSON.stringify(this.tasks, null, 2));
  }

  add(description, priority = 'normal') {
    const task = {
      id: Date.now().toString(36),
      description,
      priority,
      status: 'pending',
      created: new Date().toISOString(),
      completed: null,
      result: null
    };
    this.tasks.push(task);
    this.save();
    return task;
  }

  getPending() {
    return this.tasks.filter(t => t.status === 'pending');
  }

  complete(id, result) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = 'completed';
      task.completed = new Date().toISOString();
      task.result = result;
      this.save();
    }
  }

  fail(id, error) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = 'failed';
      task.completed = new Date().toISOString();
      task.result = { error };
      this.save();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EVE AGENT — The Event Loop
// ═══════════════════════════════════════════════════════════════

class EveAgent {
  constructor() {
    this.config = this.loadConfig();
    this.memory = new Memory();
    this.tools = new ToolRegistry(this.memory, this.config);
    this.brain = new Brain(this.config);
    this.tasks = new TaskQueue(this.memory);
    this.running = false;
    this.interval = null;
  }

  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      return {};
    }
  }

  async start() {
    if (this.running) {
      console.log('🐉 EVE is already running');
      return;
    }

    this.running = true;
    fs.writeFileSync(PID_FILE, process.pid.toString());
    
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     🐉 ATHELGARD EVE AGENT v2.0        ║');
    console.log('║     Event-driven Virtual Entity          ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('✅ Agent loop started');
    console.log('🧠 Memory loaded:', Object.keys(this.memory.data.facts).length, 'facts');
    console.log('🔧 Tools available:', this.tools.list().join(', '));
    console.log('📋 Pending tasks:', this.tasks.getPending().length);
    console.log('');
    console.log('Commands: eve stop | eve status | eve task "..." | eve memory');
    console.log('');

    // Main event loop
    this.interval = setInterval(async () => {
      await this.tick();
    }, 5000); // Check every 5 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
    console.log('\n🐉 EVE Agent stopped');
    process.exit(0);
  }

  async tick() {
    // Check for pending tasks
    const pending = this.tasks.getPending();
    
    for (const task of pending.slice(0, 1)) { // Process one at a time
      console.log(`\n📋 Processing task: ${task.description}`);
      
      try {
        // Think about the task
        const plan = await this.brain.think(task.description, this.memory.getRecentContext(5));
        
        if (plan.error) {
          console.log(`  ❌ Brain error: ${plan.error}`);
          this.tasks.fail(task.id, plan.error);
          continue;
        }

        console.log(`  💭 Thought: ${plan.thought?.slice(0, 100)}...`);
        
        // Execute actions
        if (plan.actions && plan.actions.length > 0) {
          for (const action of plan.actions) {
            const result = await this.tools.execute(action.tool, ...action.args);
            
            if (!result.success) {
              console.log(`  ❌ Tool failed: ${result.error}`);
              this.tasks.fail(task.id, result.error);
              break;
            }
          }
        }

        // Complete task
        this.tasks.complete(task.id, plan.response || 'Task completed');
        this.memory.addConversation('assistant', plan.response || 'Done', { task: task.id });
        
        console.log(`  ✅ Task completed: ${task.id}`);
        
      } catch (e) {
        console.log(`  ❌ Task failed: ${e.message}`);
        this.tasks.fail(task.id, e.message);
      }
    }
  }

  async assignTask(description) {
    const task = this.tasks.add(description);
    console.log(`📋 Task assigned: ${task.id}`);
    console.log(`   ${description}`);
    
    // If not running in daemon mode, process immediately
    if (!this.running) {
      console.log('   (Agent not running in daemon mode — processing now)');
      await this.processTask(task);
    }
    
    return task;
  }

  async processTask(task) {
    try {
      const plan = await this.brain.think(task.description, this.memory.getRecentContext(5));
      
      if (plan.error) {
        console.log(`❌ Error: ${plan.error}`);
        return;
      }

      console.log(`\n💭 Athelgard thinks: ${plan.thought?.slice(0, 150)}...`);
      
      if (plan.actions && plan.actions.length > 0) {
        console.log(`\n🔧 Executing ${plan.actions.length} action(s):`);
        for (const action of plan.actions) {
          const result = await this.tools.execute(action.tool, ...action.args);
          if (!result.success) {
            console.log(`   ❌ Failed: ${result.error}`);
          }
        }
      }

      console.log(`\n🐉 Athelgard: ${plan.response || 'Done'}`);
      
      this.tasks.complete(task.id, plan.response);
      this.memory.addConversation('assistant', plan.response, { task: task.id });
      
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
  }

  status() {
    const pending = this.tasks.getPending().length;
    const completed = this.tasks.tasks.filter(t => t.status === 'completed').length;
    const failed = this.tasks.tasks.filter(t => t.status === 'failed').length;
    
    console.log('');
    console.log('🐉 ATHELGARD EVE STATUS');
    console.log('═══════════════════════════════════════');
    console.log(`Running: ${this.running ? '✅ Yes' : '❌ No'}`);
    console.log(`Memory: ${this.memory.data.conversations.length} conversations`);
    console.log(`Facts: ${Object.keys(this.memory.data.facts).length} remembered`);
    console.log(`Tasks: ${pending} pending | ${completed} completed | ${failed} failed`);
    console.log(`Tools: ${this.tools.list().length} available`);
    console.log('═══════════════════════════════════════');
    
    if (this.tasks.getPending().length > 0) {
      console.log('\n📋 Pending Tasks:');
      this.tasks.getPending().forEach(t => {
        console.log(`   [${t.priority}] ${t.description.slice(0, 60)}`);
      });
    }
  }

  showMemory() {
    console.log('');
    console.log('🧠 ATHELGARD MEMORY');
    console.log('═══════════════════════════════════════');
    
    console.log('\n📚 Facts:');
    Object.entries(this.memory.data.facts).forEach(([key, data]) => {
      console.log(`   ${key}: ${JSON.stringify(data.value).slice(0, 80)}`);
    });
    
    console.log('\n💬 Recent Conversations:');
    this.memory.getRecentContext(5).forEach(c => {
      console.log(`   [${c.role}] ${c.content?.slice(0, 80)}...`);
    });
    
    console.log('\n📁 Recently Accessed Files:');
    Object.entries(this.memory.data.files).slice(-5).forEach(([file, data]) => {
      console.log(`   ${data.lastAction}: ${file}`);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const command = process.argv[2];
const args = process.argv.slice(3);

const eve = new EveAgent();

switch (command) {
  case 'start':
    eve.start();
    break;
    
  case 'stop':
    try {
      const pid = fs.readFileSync(PID_FILE, 'utf8');
      process.kill(parseInt(pid), 'SIGTERM');
      console.log('🐉 Stopped EVE agent');
    } catch {
      console.log('❌ EVE not running');
    }
    break;
    
  case 'status':
    eve.status();
    break;
    
  case 'task':
    eve.assignTask(args.join(' '));
    break;
    
  case 'memory':
    eve.showMemory();
    break;
    
  default:
    console.log('');
    console.log('🐉 ATHELGARD EVE — Event-driven Virtual Entity');
    console.log('');
    console.log('Usage:');
    console.log('  athelgard eve start          — Start agent daemon');
    console.log('  athelgard eve stop           — Stop agent daemon');
    console.log('  athelgard eve status         — Check agent state');
    console.log('  athelgard eve task "..."     — Assign a task');
    console.log('  athelgard eve memory         — View agent memory');
    console.log('');
    console.log('Examples:');
    console.log('  athelgard eve task "Read README and summarize"');
    console.log('  athelgard eve task "Find all TODO comments in src/"');
    console.log('  athelgard eve task "Commit changes with message \"Fix bug\""');
    console.log('');
}
