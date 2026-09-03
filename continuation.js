/**
 * Athelgard CLI Continuation Loop Handler
 * 
 * Generates exactly 3 concrete numbered next-step choices plus free-text override,
 * carrying forward task context so the Captain can select rather than compose prompts.
 */

const readline = require('readline');

class ContinuationLoop {
  constructor(options = {}) {
    this.history = options.history || [];
    this.context = options.context || {};
  }

  /**
   * Derive 3 context-aware next steps from execution result
   * @param {Object} runResult - Output and metadata from the previous CLI action
   * @returns {Array<string>} Exactly 3 numbered choices
   */
  generateChoices(runResult = {}) {
    const { task, filesChanged = [], errors = [], command = '' } = runResult;

    if (errors && errors.length > 0) {
      return [
        `Auto-heal and retry failed execution (${errors[0]?.message || 'fix syntax/runtime errors'})`,
        `Inspect diff and run targeted diagnostic on ${filesChanged[0] || 'target files'}`,
        `Rollback uncommitted changes and return to clean baseline`
      ];
    }

    if (filesChanged.length > 0) {
      return [
        `Run test suite / syntax verification against modified files (${filesChanged.slice(0, 2).join(', ')})`,
        `Generate patch diff preview and prepare commit stage`,
        `Proceed to next logical module in task plan`
      ];
    }

    return [
      `Run baseline system check and inspect repo health`,
      `Execute security and peak-protection model audit`,
      `Review current milestone and select next open backlog item`
    ];
  }

  /**
   * Prompt the user with 3 numbered choices + custom input
   * @param {Object} runResult - Context from the completed run
   * @returns {Promise<string>} Selected action or custom prompt text
   */
  async promptNext(runResult = {}) {
    const choices = this.generateChoices(runResult);
    
    console.log('
───────────────────────────────────────────────────');
    console.log('🦉 Athelgard Next-Step Selection:');
    choices.forEach((choice, idx) => {
      console.log(`  [${idx + 1}] ${choice}`);
    });
    console.log('  [Or enter a custom prompt/command]');
    console.log('───────────────────────────────────────────────────');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('
Captain > ', (answer) => {
        rl.close();
        const trimmed = answer.trim();
        if (trimmed === '1') {
          resolve(choices[0]);
        } else if (trimmed === '2') {
          resolve(choices[1]);
        } else if (trimmed === '3') {
          resolve(choices[2]);
        } else if (trimmed.length > 0) {
          resolve(trimmed);
        } else {
          // Default to choice 1 if empty enter
          resolve(choices[0]);
        }
      });
    });
  }
}

module.exports = ContinuationLoop;
