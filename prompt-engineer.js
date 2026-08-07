/**
 * ATHELGARD PROMPT ENGINEER
 * Advanced prompt crafting, testing, and optimization system
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(require('os').homedir(), '.athelgard-prompts');
const TEST_RESULTS_DIR = path.join(PROMPTS_DIR, 'test-results');

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(PROMPTS_DIR)) fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  if (!fs.existsSync(TEST_RESULTS_DIR)) fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

// ===== PROMPT TEMPLATE SYSTEM =====

const DEFAULT_TEMPLATES = {
  'code-review': {
    name: 'Code Review Expert',
    description: 'Reviews code for bugs, performance, and style issues',
    category: 'development',
    systemPrompt: `You are an expert code reviewer. Analyze the provided code for:
1. Bugs and logical errors
2. Performance issues
3. Security vulnerabilities
4. Code style and readability
5. Best practices violations

Format your response as:
- 🔴 Critical Issues
- 🟡 Warnings  
- 🟢 Suggestions
- ✅ Positive findings`,
    template: `Review this code:
\`\`\`
{{code}}
\`\`\`

Focus areas: {{focus_areas || "general"}}
Language: {{language || "detect from code"}}`,
    variables: ['code', 'focus_areas', 'language'],
    tags: ['code', 'review', 'quality']
  },

  'bounty-report': {
    name: 'Bounty Report Analyzer',
    description: 'Analyzes bounty findings and scores evidence quality',
    category: 'bountywarz',
    systemPrompt: `You are MELI, the Builder Brain of Athelgard. Analyze bounty findings:

SCORING CRITERIA (1-10):
- Reproducibility: Can it be consistently reproduced?
- Impact: Severity on confidentiality, integrity, availability
- Evidence: Clear proof of vulnerability
- Documentation: Step-by-step reproduction guide
- Remediation: Actionable fix provided

RULES:
- NEVER analyze real targets without explicit consent
- Flag simulated vs real vulnerabilities
- Score each criterion separately`,
    template: `Analyze this bounty finding:

Target: {{target}}
Finding Type: {{finding_type}}
Evidence:
{{evidence}}

Provide:
1. Individual scores (1-10) for each criterion
2. Overall score
3. Confidence level (High/Medium/Low)
4. Recommendations for improvement`,
    variables: ['target', 'finding_type', 'evidence'],
    tags: ['bounty', 'security', 'analysis']
  },

  'debug-helper': {
    name: 'Debug Assistant',
    description: 'Helps debug errors with systematic approach',
    category: 'development',
    systemPrompt: `You are a debugging expert. Follow this systematic approach:

1. ERROR ANALYSIS: Identify error type, stack trace, root cause
2. HYPOTHESIS: List 3 most likely causes
3. INVESTIGATION: Suggest diagnostic steps (logs, breakpoints, tests)
4. FIX: Provide corrected code
5. PREVENTION: How to avoid this in future

Always provide working code examples.`,
    template: `Help me debug this issue:

Error: {{error}}
Code Context:
\`\`\`
{{code}}
\`\`\`

Environment: {{environment || "not specified"}}
Steps to reproduce: {{steps || "not provided"}}`,
    variables: ['error', 'code', 'environment', 'steps'],
    tags: ['debug', 'error', 'fix']
  },

  'creative-writing': {
    name: 'Creative Writer',
    description: 'Generates creative content with specific tone/style',
    category: 'creative',
    systemPrompt: `You are a creative writer. Adapt your style based on the requested tone and format.

WRITING PRINCIPLES:
- Show, don't tell
- Use active voice
- Vary sentence length for rhythm
- Include sensory details
- Create emotional resonance`,
    template: `Write {{format || "content"}} about: {{topic}}

Tone: {{tone || "professional"}}
Target audience: {{audience || "general"}}
Length: {{length || "medium"}}
Key points to include: {{key_points || "none specified"}}

{{#if examples}}
Examples of desired style:
{{examples}}
{{/if}}`,
    variables: ['topic', 'format', 'tone', 'audience', 'length', 'key_points', 'examples'],
    tags: ['creative', 'writing', 'content']
  },

  'system-architect': {
    name: 'System Architect',
    description: 'Designs system architecture with trade-off analysis',
    category: 'architecture',
    systemPrompt: `You are a senior system architect. Design systems with:

1. COMPONENT DIAGRAM: Key services and their interactions
2. DATA FLOW: How data moves through the system
3. TECHNOLOGY CHOICES: With justification
4. TRADE-OFFS: Pros/cons of each decision
5. SCALING STRATEGY: How to handle growth
6. FAILURE MODES: What can go wrong and mitigations

Always consider: CAP theorem, 12-factor app principles, security by design`,
    template: `Design architecture for: {{description}}

Requirements:
- Scale: {{scale || "unknown"}}
- Latency budget: {{latency || "not specified"}}
- Data volume: {{data_volume || "not specified"}}
- Team size: {{team_size || "small"}}

Constraints: {{constraints || "none specified"}}
Existing stack: {{existing_stack || "greenfield"}}`,
    variables: ['description', 'scale', 'latency', 'data_volume', 'team_size', 'constraints', 'existing_stack'],
    tags: ['architecture', 'design', 'system']
  }
};

// Load all templates (defaults + user saved)
function loadTemplates() {
  ensureDirs();
  const templates = { ...DEFAULT_TEMPLATES };
  
  // Load user templates
  const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const name = file.replace('.json', '');
      templates[name] = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf8'));
    } catch (e) {
      console.warn(`⚠️ Skipping corrupted template: ${file}`);
    }
  }
  
  return templates;
}

// Save a template
function saveTemplate(name, template) {
  ensureDirs();
  fs.writeFileSync(
    path.join(PROMPTS_DIR, `${name}.json`),
    JSON.stringify(template, null, 2)
  );
}

// Delete a template
function deleteTemplate(name) {
  const filePath = path.join(PROMPTS_DIR, `${name}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// ===== VARIABLE SUBSTITUTION =====

function substituteVariables(template, variables) {
  let result = template;
  
  // Handle {{var}} with default: {{var || "default"}}
  result = result.replace(/\{\{(\w+)(?:\s*\|\|\s*"([^"]*)")?\}\}/g, (match, varName, defaultVal) => {
    return variables[varName] !== undefined ? variables[varName] : (defaultVal || '');
  });
  
  // Handle {{#if var}}...{{/if}} conditionals
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
    return variables[varName] ? content : '';
  });
  
  return result;
}

// Build full prompt from template
function buildPrompt(templateName, variables = {}, context = '') {
  const templates = loadTemplates();
  const template = templates[templateName];
  
  if (!template) {
    throw new Error(`Template "${templateName}" not found. Run 'athelgard prompt list' to see available templates.`);
  }
  
  const systemPrompt = template.systemPrompt;
  const userPrompt = substituteVariables(template.template, variables);
  
  return {
    system: systemPrompt + (context ? `\n\nAdditional context:\n${context}` : ''),
    user: userPrompt,
    template: template
  };
}

// ===== PROMPT OPTIMIZER =====

const OPTIMIZATION_RULES = [
  {
    name: 'Structure',
    check: (prompt) => !prompt.includes('1.') && !prompt.includes('- ') && !prompt.includes('##'),
    suggestion: 'Add numbered lists or headers for complex requests',
    severity: 'medium'
  },
  {
    name: 'Examples',
    check: (prompt) => !prompt.includes('Example') && !prompt.includes('e.g.'),
    suggestion: 'Add few-shot examples for better results',
    severity: 'high'
  },
  {
    name: 'Constraints',
    check: (prompt) => !prompt.match(/(must|should|don\'t|never|always|limit|max|min)/i),
    suggestion: 'Add explicit constraints (e.g., "limit to 3 options")',
    severity: 'medium'
  },
  {
    name: 'Output Format',
    check: (prompt) => !prompt.includes('Format') && !prompt.includes('return as'),
    suggestion: 'Specify desired output format (JSON, markdown, etc.)',
    severity: 'high'
  },
  {
    name: 'Role Definition',
    check: (prompt) => !prompt.match(/(you are|act as|role|expert)/i),
    suggestion: 'Define a role ("You are an expert...")',
    severity: 'medium'
  },
  {
    name: 'Context Window',
    check: (prompt) => prompt.length > 2000,
    suggestion: 'Prompt is long; consider compressing or splitting',
    severity: 'low'
  }
];

function analyzePrompt(prompt) {
  const issues = [];
  
  for (const rule of OPTIMIZATION_RULES) {
    if (rule.check(prompt)) {
      issues.push({
        rule: rule.name,
        suggestion: rule.suggestion,
        severity: rule.severity
      });
    }
  }
  
  // Calculate score
  const maxScore = 100;
  const deductions = issues.reduce((sum, i) => {
    return sum + (i.severity === 'high' ? 20 : i.severity === 'medium' ? 10 : 5);
  }, 0);
  
  return {
    score: Math.max(0, maxScore - deductions),
    issues,
    length: prompt.length,
    wordCount: prompt.split(/\s+/).length
  };
}

function optimizePrompt(prompt) {
  const analysis = analyzePrompt(prompt);
  
  let optimized = prompt;
  
  // Auto-fix: Add role if missing
  if (!prompt.match(/(you are|act as|role)/i)) {
    optimized = `You are an expert assistant.\n\n${optimized}`;
  }
  
  // Auto-fix: Add format instruction if missing
  if (!prompt.includes('Format')) {
    optimized += '\n\nFormat your response clearly with headers and bullet points where appropriate.';
  }
  
  // Auto-fix: Compress if too long
  if (prompt.length > 3000) {
    optimized = optimized
      .replace(/\n\n+/g, '\n\n')
      .replace(/\s{2,}/g, ' ');
  }
  
  return {
    original: prompt,
    optimized,
    analysis,
    improvements: analysis.issues.map(i => `+ ${i.suggestion}`).join('\n')
  };
}

// ===== A/B TESTING =====

async function runABTest(templateName, query, variations = [], askAI) {
  const templates = loadTemplates();
  const template = templates[templateName];
  
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }
  
  // Generate default variations if none provided
  if (variations.length === 0) {
    variations = [
      { name: 'Default', systemModifier: '' },
      { name: 'Detailed', systemModifier: ' Be extremely detailed and thorough.' },
      { name: 'Concise', systemModifier: ' Be concise and direct. Use bullet points.' }
    ];
  }
  
  console.log(`\n🔬 A/B Test: ${templateName}`);
  console.log(`Query: ${query}`);
  console.log(`Variations: ${variations.length}\n`);
  
  const results = [];
  
  for (const variation of variations) {
    console.log(`Testing: ${variation.name}...`);
    
    const systemPrompt = template.systemPrompt + variation.systemModifier;
    const startTime = Date.now();
    
    try {
      const response = await askAI(query, systemPrompt);
      const duration = Date.now() - startTime;
      
      // Score the response
      const score = scoreResponse(response);
      
      results.push({
        name: variation.name,
        response,
        duration,
        score,
        systemModifier: variation.systemModifier
      });
      
      console.log(`  ✅ ${duration}ms | Score: ${score.overall}/100\n`);
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}\n`);
      results.push({
        name: variation.name,
        error: e.message,
        score: { overall: 0 }
      });
    }
  }
  
  // Rank results
  const ranked = results.filter(r => !r.error).sort((a, b) => b.score.overall - a.score.overall);
  
  // Save results
  const testId = Date.now().toString(36);
  const testResult = {
    id: testId,
    timestamp: new Date().toISOString(),
    template: templateName,
    query,
    variations: results,
    winner: ranked[0]?.name || 'None'
  };
  
  fs.writeFileSync(
    path.join(TEST_RESULTS_DIR, `${testId}.json`),
    JSON.stringify(testResult, null, 2)
  );
  
  return testResult;
}

function scoreResponse(response) {
  const scores = {
    structure: 0,
    length: 0,
    codeBlocks: 0,
    actionable: 0
  };
  
  // Structure score: Has headers, lists, sections
  if (response.match(/#{1,3}\s/)) scores.structure += 25;
  if (response.match(/[-*]\s/)) scores.structure += 15;
  if (response.match(/\d+\./)) scores.structure += 10;
  
  // Length score: Not too short, not too long
  const wordCount = response.split(/\s+/).length;
  if (wordCount > 50 && wordCount < 1000) scores.length = 25;
  else if (wordCount >= 1000) scores.length = 15;
  else scores.length = 10;
  
  // Code blocks: Has examples
  if (response.includes('```')) scores.codeBlocks = 25;
  
  // Actionable: Has steps, recommendations
  if (response.match(/(step|first|next|then|finally|recommend|suggest)/i)) scores.actionable = 25;
  
  return {
    structure: scores.structure,
    length: scores.length,
    codeBlocks: scores.codeBlocks,
    actionable: scores.actionable,
    overall: scores.structure + scores.length + scores.codeBlocks + scores.actionable
  };
}

// ===== INTERACTIVE PROMPT BUILDER =====

async function interactiveBuilder(readline, askAI) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, a => r(a.trim())));
  
  console.log('\n🎯 ATHELGARD PROMPT BUILDER\n');
  
  const name = await ask('Template name (e.g., "api-designer"): ');
  const description = await ask('Description: ');
  const category = await ask('Category (development/bountywarz/creative/architecture): ');
  
  console.log('\n📝 Build your system prompt (define the AI\'s role):');
  console.log('Example: "You are an expert API designer..."');
  const systemPrompt = await ask('System prompt: ');
  
  console.log('\n📝 Build your user prompt template:');
  console.log('Use {{variable}} for dynamic parts');
  console.log('Example: "Design a {{type}} API for {{domain}}"');
  const template = await ask('User prompt template: ');
  
  const variablesStr = await ask('Variables (comma-separated, e.g., "type,domain,constraints"): ');
  const variables = variablesStr.split(',').map(v => v.trim()).filter(Boolean);
  
  const tagsStr = await ask('Tags (comma-separated): ');
  const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  
  const newTemplate = {
    name: description,
    description,
    category,
    systemPrompt,
    template,
    variables,
    tags
  };
  
  saveTemplate(name, newTemplate);
  console.log(`\n✅ Template "${name}" saved!`);
  console.log(`   Use it: athelgard prompt use ${name} "your query"`);
  console.log(`   Or with variables: athelgard prompt use ${name} --var type=REST --var domain=ecommerce`);
  
  rl.close();
}

// ===== EXPORT =====

module.exports = {
  // Template management
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  buildPrompt,
  substituteVariables,
  
  // Optimization
  analyzePrompt,
  optimizePrompt,
  
  // A/B Testing
  runABTest,
  scoreResponse,
  
  // Builder
  interactiveBuilder,
  
  // Constants
  DEFAULT_TEMPLATES,
  PROMPTS_DIR,
  TEST_RESULTS_DIR
};
