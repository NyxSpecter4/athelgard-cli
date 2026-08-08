#!/usr/bin/env node
/**
 * ATHELGARD AGENT ORCHESTRATOR — Agent Swarm Factory
 * Auto-routes tasks to the right agent based on task type
 */

const C = process.stdout.isTTY ? {
  bold: '\x1b[1m', reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m'
} : { bold: '', reset: '', red: '', green: '', yellow: '', cyan: '', gray: '' };

// Agent registry
const AGENTS = {
  cursor: {
    name: 'Cursor',
    role: 'builder',
    skills: ['code', 'implement', 'build', 'create', 'write'],
    cost: '$99/mo',
    availability: '24/7',
    chair: 3
  },
  qodo: {
    name: 'Qodo',
    role: 'reviewer',
    skills: ['review', 'audit', 'check', 'analyze', 'inspect'],
    cost: '$0 (local)',
    availability: '24/7',
    chair: 5
  },
  'code-rabbit': {
    name: 'Code Rabbit',
    role: 'reviewer-2',
    skills: ['review', 'style', 'quality', 'format', 'lint'],
    cost: '$0 (local)',
    availability: '24/7',
    chair: 6
  },
  copilot: {
    name: 'Copilot',
    role: 'fixer',
    skills: ['fix', 'debug', 'polish', 'optimize', 'refactor'],
    cost: '$99/mo (with Cursor)',
    availability: '24/7',
    chair: 7
  },
  sgrok: {
    name: 'SGROK',
    role: 'tester',
    skills: ['test', 'research', 'benchmark', 'analyze', 'investigate'],
    cost: '$0 (on-call)',
    availability: 'On-demand',
    chair: 10
  },
  hermes: {
    name: 'Hermes',
    role: 'merger',
    skills: ['merge', 'deploy', 'cron', 'schedule', 'automate'],
    cost: '$0 (cron)',
    availability: 'Silent',
    chair: 11
  },
  makothoth: {
    name: 'MakoThoth-KClaw',
    role: 'multi',
    skills: ['monitor', 'account', 'document', 'plan', 'orchestrate', 'secure', 'devops'],
    cost: '$0 (me)',
    availability: '24/7',
    chairs: [8, 9, 12, 13, 14]
  },
  aider: {
    name: 'Aider',
    role: 'architect',
    skills: ['design', 'architect', 'refactor', 'plan', 'structure'],
    cost: '$0 (local)',
    availability: 'On-call',
    chair: 2
  }
};

// Task type classifier
function classifyTask(task) {
  const lower = task.toLowerCase();
  
  if (/\b(code|build|implement|create|write|add|feature)\b/.test(lower)) {
    return { type: 'feature', agent: 'cursor', confidence: 0.9 };
  }
  if (/\b(fix|debug|bug|error|broken|repair|patch)\b/.test(lower)) {
    return { type: 'fix', agent: 'copilot', confidence: 0.9 };
  }
  if (/\b(review|audit|check|analyze|inspect|look at)\b/.test(lower)) {
    return { type: 'review', agent: 'qodo', confidence: 0.85 };
  }
  if (/\b(test|benchmark|research|investigate|study)\b/.test(lower)) {
    return { type: 'research', agent: 'sgrok', confidence: 0.85 };
  }
  if (/\b(deploy|merge|release|publish|schedule|cron)\b/.test(lower)) {
    return { type: 'deploy', agent: 'hermes', confidence: 0.9 };
  }
  if (/\b(monitor|track|watch|alert|status|health)\b/.test(lower)) {
    return { type: 'monitor', agent: 'makothoth', confidence: 0.9 };
  }
  if (/\b(document|doc|readme|guide|tutorial|explain)\b/.test(lower)) {
    return { type: 'docs', agent: 'makothoth', confidence: 0.85 };
  }
  if (/\b(plan|roadmap|prioritize|strategy|organize)\b/.test(lower)) {
    return { type: 'pm', agent: 'makothoth', confidence: 0.8 };
  }
  if (/\b(secure|vulnerability|scan|hack|protect)\b/.test(lower)) {
    return { type: 'security', agent: 'sgrok', confidence: 0.85 };
  }
  if (/\b(design|architect|structure|pattern|system)\b/.test(lower)) {
    return { type: 'architecture', agent: 'aider', confidence: 0.8 };
  }
  
  return { type: 'general', agent: 'makothoth', confidence: 0.5 };
}

function delegateCommand(task) {
  if (!task) {
    console.log(`${C.bold}🎯 ATHELGARD AGENT ORCHESTRATOR${C.reset}`);
    console.log(`${C.cyan}Agent Swarm Factory — Auto-route tasks to the right agent${C.reset}\n`);
    
    console.log(`${C.bold}REGISTERED AGENTS${C.reset}`);
    Object.entries(AGENTS).forEach(([id, agent]) => {
      const chairs = Array.isArray(agent.chairs) ? agent.chairs.join(', #') : agent.chair;
      console.log(`  ${C.cyan}${agent.name}${C.reset} — ${agent.role} (🪑 #${chairs})`);
      console.log(`    Skills: ${agent.skills.join(', ')}`);
      console.log(`    Cost: ${agent.cost} | Available: ${agent.availability}\n`);
    });
    
    console.log(`${C.bold}USAGE${C.reset}`);
    console.log(`  athelgard delegate "<task description>"`);
    console.log(`  athelgard delegate "Build a login page"`);
    console.log(`  athelgard delegate "Review this PR for security issues"`);
    console.log(`  athelgard delegate "Research competitor pricing"\n`);
    return;
  }
  
  console.log(`${C.bold}🎯 ATHELGARD AGENT ORCHESTRATOR${C.reset}\n`);
  console.log(`Task: "${task}"\n`);
  
  const classification = classifyTask(task);
  const agent = AGENTS[classification.agent];
  
  console.log(`${C.bold}CLASSIFICATION${C.reset}`);
  console.log(`  Type: ${classification.type}`);
  console.log(`  Confidence: ${Math.round(classification.confidence * 100)}%`);
  console.log(`  Agent: ${C.cyan}${agent.name}${C.reset} (${agent.role})\n`);
  
  console.log(`${C.bold}AGENT PROFILE${C.reset}`);
  console.log(`  Name: ${agent.name}`);
  console.log(`  Chair: #${agent.chair || agent.chairs?.join(', #')}`);
  console.log(`  Skills: ${agent.skills.join(', ')}`);
  console.log(`  Cost: ${agent.cost}`);
  console.log(`  Availability: ${agent.availability}\n`);
  
  console.log(`${C.bold}RECOMMENDED ACTION${C.reset}`);
  switch(classification.type) {
    case 'feature':
      console.log(`  1. Assign to ${agent.name}: "${task}"`);
      console.log(`  2. After build, send to Qodo for review`);
      console.log(`  3. After review, send to Copilot for polish`);
      console.log(`  4. After polish, Hermes merges and deploys`);
      break;
    case 'fix':
      console.log(`  1. Assign to ${agent.name}: "${task}"`);
      console.log(`  2. Run tests to verify fix`);
      console.log(`  3. Quick review by Qodo`);
      console.log(`  4. Hermes merges and deploys`);
      break;
    case 'review':
      console.log(`  1. Assign to ${agent.name}: "${task}"`);
      console.log(`  2. If issues found, send to Copilot to fix`);
      console.log(`  3. Re-review by Code Rabbit`);
      break;
    case 'research':
      console.log(`  1. Assign to ${agent.name}: "${task}"`);
      console.log(`  2. Compile findings into report`);
      console.log(`  3. Captain reviews and decides`);
      break;
    case 'security':
      console.log(`  1. Assign to ${agent.name}: "${task}"`);
      console.log(`  2. If vulns found, IMMEDIATE fix by Copilot`);
      console.log(`  3. Re-scan to verify`);
      console.log(`  4. Document in security log`);
      break;
    default:
      console.log(`  1. Assign to ${agent.name}: "${task}"`);
      console.log(`  2. Review output`);
      console.log(`  3. Iterate if needed`);
  }
  
  console.log(`\n${C.bold}SIMULATED WORKFLOW${C.reset}`);
  console.log(`  🪑 #${agent.chair || agent.chairs?.[0]} ${agent.name} → ACCEPTS TASK`);
  
  if (classification.type === 'feature') {
    console.log(`  🪑 #5 Qodo → REVIEWS`);
    console.log(`  🪑 #7 Copilot → POLISHES`);
    console.log(`  🪑 #11 Hermes → MERGES & DEPLOYS`);
  } else if (classification.type === 'fix') {
    console.log(`  🪑 #5 Qodo → QUICK REVIEW`);
    console.log(`  🪑 #11 Hermes → MERGES & DEPLOYS`);
  }
  
  console.log(`\n${C.green}✅ Task routed successfully!${C.reset}`);
}

// CLI
const task = process.argv.slice(2).join(' ');
delegateCommand(task || null);
