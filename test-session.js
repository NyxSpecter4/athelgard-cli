#!/usr/bin/env node
'use strict';

const assert = require('assert');
const ContinuationLoop = require('./continuation.js');

function takePrompt(argv) {
  const prompt = argv.slice(2).join(' ').trim();
  if (!prompt) throw new Error('A task prompt is required');
  return prompt;
}

function generateDiff(prompt) {
  return {
    prompt,
    filesChanged: ['demo.txt'],
    patch: `+ ${prompt}`
  };
}

function applyDiff(diff, apply) {
  return {
    ...diff,
    applied: apply === true
  };
}

class TestContinuationLoop extends ContinuationLoop {
  constructor(answer) {
    super();
    this.answer = answer;
    this.handoff = null;
  }

  async promptNext(runResult) {
    const choices = this.generateChoices(runResult);
    this.handoff = { choices, answer: this.answer };
    if (this.answer === '1' || this.answer === '2' || this.answer === '3') {
      return choices[Number(this.answer) - 1];
    }
    return this.answer;
  }
}

async function runSession(argv = ['node', 'test-session.js', 'update', 'demo']) {
  const prompt = takePrompt(argv);
  const diff = generateDiff(prompt);
  const result = applyDiff(diff, true);
  const continuation = new TestContinuationLoop('2');
  const nextStep = await continuation.promptNext(result);

  return { prompt, diff, result, continuation, nextStep };
}

async function main() {
  const session = await runSession();

  assert.strictEqual(session.prompt, 'update demo');
  assert.strictEqual(session.diff.patch, '+ update demo');
  assert.strictEqual(session.result.applied, true);
  assert.strictEqual(session.continuation.handoff.choices.length, 3);
  assert.strictEqual(session.nextStep, session.continuation.handoff.choices[1]);

  console.log('Session flow verified: prompt -> diff -> apply -> 3-choice continuation.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { runSession, takePrompt, generateDiff, applyDiff, TestContinuationLoop };
