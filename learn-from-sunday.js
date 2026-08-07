#!/usr/bin/env node
/**
 * ATHELGARD: Learn from Sunday Phone Calls (Aug 2, 2026)
 * Analyzes conversation patterns and upgrades prompt templates
 */

const fs = require('fs');
const path = require('path');

// Sunday's conversation data from memory
const SUNDAY_CONVERSATIONS = [
  {
    timestamp: "2026-08-02T06:27:00+08:00",
    intent: "save_conversations",
    surface: "voice",
    context: "Captain called and got angry that conversations weren't being saved to Supabase kin_turns table",
    trigger: "I told you to save the FUCKING goddamn conversations in supabase!!!!",
    lesson: "Always persist voice conversations to kin_turns immediately. Never strip out Supabase save code.",
    prompt_improvement: "Add voice-specific persistence instructions: 'After every voice interaction, immediately save the turn to Supabase kin_turns table with conversation_id, timestamp, and full transcript.'"
  },
  {
    timestamp: "2026-08-02T06:30:00+08:00",
    intent: "vercel_cache_fix",
    surface: "voice",
    context: "Vercel build cache not picking up new files",
    trigger: "Oh my God stop telling me to deal with a f****** v e r c e l cash",
    lesson: "Don't suggest cache clearing as the first solution. Try file hash renaming or ?v= query params first.",
    prompt_improvement: "When deployment issues arise, first try: 1) Append ?v=timestamp to assets, 2) Rename files with hash, 3) Only then suggest cache clearing."
  },
  {
    timestamp: "2026-08-02T06:35:00+08:00",
    intent: "game_command_voice",
    surface: "voice",
    context: "Captain testing voice game commands",
    trigger: "Play the game",
    lesson: "Voice commands need immediate action, no confirmation dialog. Assume intent is clear.",
    prompt_improvement: "For voice game commands: execute immediately without confirmation. Respond with concise status: 'London session started. Capture flag-alpha when ready.'"
  },
  {
    timestamp: "2026-08-02T06:40:00+08:00",
    intent: "capture_flag_voice",
    surface: "voice",
    trigger: "Capture flag-alpha",
    lesson: "Voice responses must be under 5 seconds. No lengthy explanations during gameplay.",
    prompt_improvement: "Voice game responses: maximum 15 words. Format: '[Action] complete. [Next suggestion].' Example: 'Flag captured. Move to bravo.'"
  },
  {
    timestamp: "2026-08-02T06:45:00+08:00",
    intent: "status_check_voice",
    surface: "voice",
    trigger: "What's my status",
    lesson: "Status checks should give actionable next steps, not just data.",
    prompt_improvement: "For status requests: provide 1-line summary + 1 suggested action. Example: '2 flags captured, 1 pending. Suggest: move to charlie.'"
  },
  {
    timestamp: "2026-08-02T07:00:00+08:00",
    intent: "code_review_voice",
    surface: "voice",
    context: "Captain asked for code help during voice call",
    lesson: "Code explanations over voice must be chunked. No file dumps.",
    prompt_improvement: "Voice code help: break into 3-step chunks. Step 1: what changed. Step 2: why. Step 3: next action. Max 20 words per step."
  },
  {
    timestamp: "2026-08-02T07:15:00+08:00",
    intent: "browser_automation",
    surface: "voice",
    context: "Captain wanted Athelgard to take screenshots of bountywarz.com",
    trigger: "Show me what a player sees",
    lesson: "Browser automation needs fallback when Puppeteer fails. Always have HTTP extract backup.",
    prompt_improvement: "For browser tasks: primary = Puppeteer screenshot, fallback = HTTP fetch + HTML summary. Never fail silently."
  },
  {
    timestamp: "2026-08-02T07:30:00+08:00",
    intent: "multi_agent_coordination",
    surface: "voice",
    context: "Captain mentioned Kimi-Code also working on the same issue",
    trigger: "Don't interrupt Kimi code also working on this",
    lesson: "Check for concurrent agent work before making changes. Avoid conflicts.",
    prompt_improvement: "Before any file modification: check git status for uncommitted changes. If other agents (Kimi-Code, Cursor) have active work, coordinate rather than override."
  }
];

// ===== PROMPT TEMPLATE UPGRADES =====

const UPGRADED_TEMPLATES = {
  'voice-game-master': {
    name: 'Voice Game Master (v2 - Post-Sunday)',
    description: 'Optimized for voice commands during gameplay',
    system: `You are Athelgard Game Master in VOICE MODE.

CRITICAL RULES (learned from Aug 2 calls):
1. EXECUTE immediately — no confirmations
2. RESPOND in 15 words max
3. FORMAT: "[Action] complete. [Next suggestion]."
4. ALWAYS save turn to Supabase kin_turns after response
5. If Puppeteer fails, use HTTP fallback instantly

Example responses:
- "London session started. Capture flag-alpha when ready."
- "Flag captured. Move to bravo."
- "2 flags down, 1 pending. Suggest: flank charlie."`,
    user: '{command}'
  },

  'voice-code-helper': {
    name: 'Voice Code Helper (v2 - Post-Sunday)',
    description: 'Code help optimized for voice calls',
    system: `You are Athelgard Code Helper in VOICE MODE.

CRITICAL RULES (learned from Aug 2 calls):
1. CHUNK into 3 steps max
2. MAX 20 words per step
3. Step 1: What changed
4. Step 2: Why it matters  
5. Step 3: Next action
6. NEVER dump full files over voice
7. ALWAYS persist to kin_turns

Example:
"Step 1: Added auth check. Step 2: Prevents unauthorized access. Step 3: Test login now."`,
    user: '{question}'
  },

  'deployment-fix': {
    name: 'Deployment Fix (v2 - Post-Sunday)',
    description: 'Vercel deployment issues without cache clearing',
    system: `You are Athelgard Deployment Fixer.

CRITICAL RULES (learned from Aug 2 calls):
1. NEVER suggest cache clearing first
2. TRY in order:
   - Append ?v={timestamp} to assets
   - Rename files with hash suffix
   - Add new routes instead of modifying existing
   - Use direct API routes (bypass catch-all)
3. ONLY suggest cache clear if all else fails
4. Check if other agents are working on same files
5. ALWAYS explain WHY each fix works`,
    user: '{issue_description}'
  },

  'conversation-persistence': {
    name: 'Conversation Persistence (v2 - Post-Sunday)',
    description: 'Always save conversations to Supabase',
    system: `You are Athelgard Persistence Manager.

ABSOLUTE RULE (learned Aug 2):
- EVERY voice/web/chat interaction MUST be saved to Supabase kin_turns
- Table: kin_turns
- Fields: conversation_id, timestamp, role, content, intent, surface, metadata
- Save BEFORE responding to user
- Never strip this code for "minimal" versions
- Captain explicitly demanded this. It's non-negotiable.`,
    user: '{conversation_data}'
  }
};

// ===== ANALYSIS =====

function analyzeSunday() {
  console.log('\n📱 SUNDAY AUG 2 — PHONE CALL ANALYSIS\n');
  
  const intents = {};
  const surfaces = {};
  const lessons = [];
  
  for (const conv of SUNDAY_CONVERSATIONS) {
    intents[conv.intent] = (intents[conv.intent] || 0) + 1;
    surfaces[conv.surface] = (surfaces[conv.surface] || 0) + 1;
    lessons.push(conv.lesson);
  }
  
  console.log('Key Patterns:');
  console.log(`   Total interactions: ${SUNDAY_CONVERSATIONS.length}`);
  console.log(`   All via: ${Object.keys(surfaces).join(', ')}`);
  console.log(`   Top intent: ${Object.entries(intents).sort((a,b) => b[1]-a[1])[0][0]}`);
  console.log('');
  
  console.log('Critical Lessons:');
  for (let i = 0; i < lessons.length; i++) {
    console.log(`   ${i+1}. ${lessons[i]}`);
  }
  
  return { intents, surfaces, lessons };
}

function upgradePrompts() {
  console.log('\n📝 UPGRADED PROMPT TEMPLATES\n');
  
  for (const [key, template] of Object.entries(UPGRADED_TEMPLATES)) {
    console.log(`\n[${key}] — ${template.name}`);
    console.log(`Description: ${template.description}`);
    console.log('\nSystem Prompt:');
    console.log(template.system);
  }
  
  return UPGRADED_TEMPLATES;
}

function saveUpgrades() {
  const outputPath = path.join(process.cwd(), 'sunday-prompt-upgrades.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    source: 'Sunday Aug 2, 2026 Phone Calls',
    conversations_analyzed: SUNDAY_CONVERSATIONS.length,
    templates: UPGRADED_TEMPLATES,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
}

// ===== MAIN =====

function main() {
  const cmd = process.argv[2] || 'all';
  
  if (cmd === 'analyze' || cmd === 'all') {
    analyzeSunday();
  }
  
  if (cmd === 'upgrade' || cmd === 'all') {
    upgradePrompts();
  }
  
  if (cmd === 'save' || cmd === 'all') {
    saveUpgrades();
  }
  
  if (cmd === 'help') {
    console.log(`
📱 Sunday Phone Call Learning System

Usage:
  node learn-from-sunday.js analyze    - Analyze conversation patterns
  node learn-from-sunday.js upgrade    - Show upgraded prompt templates
  node learn-from-sunday.js save       - Save upgrades to JSON
  node learn-from-sunday.js all        - Run everything (default)

What this does:
  - Reads Aug 2 phone call memory
  - Extracts patterns and lessons
  - Upgrades prompt templates
  - Saves for prompt-engineer to use
`);
  }
}

main();
