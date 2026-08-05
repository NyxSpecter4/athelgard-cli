#!/usr/bin/env node
/**
 * ATHELGARD CLI - Captain's Coding Agent
 * 
 * Usage:
 *   athelgard ask "How do I write a React hook?"
 *   athelgard file read src/App.tsx
 *   athelgard file write src/new.ts "console.log('hello')"
 *   athelgard github list NyxSpecter4
 *   athelgard github get NyxSpecter4/bountywarz README.md
 *   athelgard chat          # Interactive mode
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

const CONFIG_PATH = path.join(require('os').homedir(), '.athelgard.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('💾 Config saved to ~/.athelgard.json');
}

function getConfig(key, prompt_text) {
  const config = loadConfig();
  if (config[key]) return config[key];
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${prompt_text}: `, val => {
      config[key] = val.trim();
      saveConfig(config);
      rl.close();
      resolve(config[key]);
    });
  });
}

async function askDeepSeek(messages, apiKey) {
  const data = JSON.stringify({
    model: 'deepseek-chat',
    messages,
    temperature: 0.7,
    max_tokens: 4000,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.choices?.[0]?.message?.content || 'No response');
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function askKimi(messages, apiKey) {
  const data = JSON.stringify({
    model: 'kimi-k2p6',
    messages,
    temperature: 0.7,
    max_tokens: 4000
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.moonshot.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.choices?.[0]?.message?.content || 'No response');
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function askAI(prompt, context = '') {
  const config = loadConfig();
  
  // Check peak hours
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const isPeak = pst.getHours() >= 9 && pst.getHours() < 21;
  
  const systemPrompt = `You are Athelgard, Captain's AI coding agent. Help with code, debug, explain.\n${context}`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  if (isPeak && config.kimiKey) {
    console.log('🌙 Using Kimi (DeepSeek peak hours)...');
    return askKimi(messages, config.kimiKey);
  } else if (config.deepseekKey) {
    console.log('🧠 Using DeepSeek V3...');
    return askDeepSeek(messages, config.deepseekKey);
  } else {
    throw new Error('No API key configured. Run: athelgard config');
  }
}

// ===== COMMANDS =====

const commands = {
  async config() {
    const config = loadConfig();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    const ask = q => new Promise(r => rl.question(q, a => r(a.trim())));
    
    config.deepseekKey = await ask('DeepSeek API Key (or press Enter to keep existing): ') || config.deepseekKey;
    config.kimiKey = await ask('Kimi API Key (fallback during peak, optional): ') || config.kimiKey;
    config.githubToken = await ask('GitHub Token (optional): ') || config.githubToken;
    
    rl.close();
    saveConfig(config);
    console.log('✅ Athelgard configured!');
  },

  async ask(question) {
    if (!question) {
      console.log('Usage: athelgard ask "your question"');
      return;
    }
    const answer = await askAI(question);
    console.log('\n🦉 Athelgard:\n' + answer);
  },

  async file(args) {
    const [action, filepath, ...contentParts] = args;
    
    if (action === 'read') {
      const content = fs.readFileSync(filepath, 'utf8');
      console.log(content);
    } else if (action === 'write') {
      const content = contentParts.join(' ');
      fs.writeFileSync(filepath, content);
      console.log(`✅ Wrote ${filepath}`);
    } else if (action === 'edit') {
      const content = fs.readFileSync(filepath, 'utf8');
      const instruction = contentParts.join(' ');
      const context = `Current file (${filepath}):\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\``;
      const newContent = await askAI(`Edit this file: ${instruction}`, context);
      fs.writeFileSync(filepath, newContent);
      console.log(`✅ Edited ${filepath}`);
    } else {
      console.log('Usage: athelgard file read|write|edit <path> [content]');
    }
  },

  async chat() {
    const config = loadConfig();
    if (!config.deepseekKey && !config.kimiKey) {
      console.log('❌ No API key. Run: athelgard config');
      return;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const history = [];
    
    console.log('🦉 Athelgard Chat (type "exit" to quit)\n');
    
    const askPrompt = () => {
      rl.question('You: ', async input => {
        if (input.toLowerCase() === 'exit') {
          rl.close();
          return;
        }
        
        try {
          history.push({ role: 'user', content: input });
          const answer = await askAI(input);
          history.push({ role: 'assistant', content: answer });
          console.log('\n🦉 ' + answer + '\n');
        } catch (e) {
          console.log('❌ Error:', e.message);
        }
        
        askPrompt();
      });
    };
    
    askPrompt();
  },

  async github(args) {
    const [action, repo, filepath] = args;
    const config = loadConfig();
    
    if (!config.githubToken) {
      console.log('❌ No GitHub token. Run: athelgard config');
      return;
    }

    if (action === 'list') {
      // List repos for user
      const [owner] = repo.split('/');
      console.log(`📁 Repos for ${owner}:`);
      // Implementation would call GitHub API
    } else if (action === 'get') {
      console.log(`📄 Getting ${filepath} from ${repo}...`);
      // Implementation would call GitHub API
    }
  },

  help() {
    console.log(`
🦉 ATHELGARD CLI

Commands:
  athelgard config              - Set up API keys
  athelgard ask "question"      - Ask Athelgard anything
  athelgard chat                - Interactive chat mode
  athelgard file read <path>    - Read a file
  athelgard file write <path>   - Write a file
  athelgard file edit <path>    - Edit with AI
  athelgard help                - Show this help

Examples:
  athelgard ask "How do I use useEffect?"
  athelgard file write hello.js "console.log('hi')"
  athelgard chat
`);
  }
};

// ===== MAIN =====
async function main() {
  const [,, cmd, ...args] = process.argv;
  
  if (!cmd || cmd === 'help') {
    commands.help();
    return;
  }
  
  if (commands[cmd]) {
    await commands[cmd](args);
  } else {
    // If no command matched, treat as ask
    await commands.ask([cmd, ...args].join(' '));
  }
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
