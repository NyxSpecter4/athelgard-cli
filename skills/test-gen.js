/**
 * ATHELGARD SKILL: Test Generator
 * Superpowers: Auto-detect framework, generate tests, coverage analysis
 */

const fs = require('fs');
const path = require('path');

class TestGenerator {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  // ===== FRAMEWORK DETECTION =====
  detectFramework() {
    const files = {
      vitest: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs'],
      jest: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
      playwright: ['playwright.config.ts', 'playwright.config.js'],
      cypress: ['cypress.config.js', 'cypress.config.ts', 'cypress.json'],
      mocha: ['.mocharc.js', '.mocharc.json'],
      ava: ['ava.config.js'],
      tap: ['tap.yml', '.taprc']
    };

    for (const [framework, configFiles] of Object.entries(files)) {
      if (configFiles.some(f => fs.existsSync(path.join(this.cwd, f)))) {
        return framework;
      }
    }

    // Check package.json scripts
    const pkgPath = path.join(this.cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = JSON.stringify(pkg.scripts || {});
      if (scripts.includes('vitest')) return 'vitest';
      if (scripts.includes('jest')) return 'jest';
      if (scripts.includes('playwright')) return 'playwright';
      if (scripts.includes('cypress')) return 'cypress';
      if (scripts.includes('mocha')) return 'mocha';
    }

    // Check node_modules (if they exist)
    const nm = path.join(this.cwd, 'node_modules');
    if (fs.existsSync(nm)) {
      if (fs.existsSync(path.join(nm, 'vitest'))) return 'vitest';
      if (fs.existsSync(path.join(nm, 'jest'))) return 'jest';
      if (fs.existsSync(path.join(nm, 'playwright'))) return 'playwright';
    }

    return 'vitest'; // Default
  }

  // ===== GENERATE TESTS =====
  async generateTests(filePath, framework = null, askAI) {
    const detected = framework || this.detectFramework();
    const code = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);
    const ext = path.extname(filePath);
    const testFilename = filename.replace(ext, `.test${ext}`);

    const frameworkPrompts = {
      vitest: `Use Vitest (import { describe, it, expect } from 'vitest'). Use 'it' not 'test'.`,
      jest: `Use Jest (no imports needed, globals are available).`,
      playwright: `Use Playwright test runner (import { test, expect } from '@playwright/test').`,
      cypress: `Use Cypress (cy commands, describe/it blocks).`,
      mocha: `Use Mocha + Chai (import { expect } from 'chai').`,
    };

    const prompt = `Generate comprehensive ${detected} tests for this code.

${frameworkPrompts[detected] || 'Use standard test syntax.'}

Requirements:
1. Test ALL exported functions and methods
2. Include happy path tests
3. Include edge cases: null, undefined, empty strings, empty arrays, 0, negative numbers
4. Include error cases: invalid types, missing required params
5. Mock external dependencies
6. Use descriptive test names: "should [behavior] when [condition]"
7. Group related tests in describe blocks

Code to test (${filename}):
\`\`\`${ext.replace('.', '')}
${code}
\`\`\`

Return ONLY the test file content, no explanation. Name the file ${testFilename}.`;

    return await askAI(prompt);
  }

  // ===== GENERATE SNAPSHOT TESTS =====
  async generateSnapshotTests(filePath, askAI) {
    const code = fs.readFileSync(filePath, 'utf8');
    const prompt = `Generate snapshot tests for this React/Vue/Svelte component.

Code:
\`\`\`
${code}
\`\`\`

Requirements:
1. Test rendering with different props
2. Test user interactions (clicks, inputs)
3. Use Testing Library (render, screen, fireEvent)
4. Include accessibility tests

Return ONLY the test file content.`;

    return await askAI(prompt);
  }

  // ===== GENERATE E2E TESTS =====
  async generateE2ETests(url, flow, askAI) {
    const prompt = `Generate Playwright E2E tests for this user flow:

URL: ${url}
Flow: ${flow}

Requirements:
1. Use page object model
2. Include setup/teardown
3. Test happy path and error states
4. Add assertions for visual elements
5. Include mobile viewport tests

Return ONLY the test file content.`;

    return await askAI(prompt);
  }

  // ===== FIND UNTESTED FILES =====
  findUntestedFiles(srcDir = 'src', testDir = null) {
    testDir = testDir || srcDir;
    
    const sourceFiles = [];
    const testFiles = [];

    function findFiles(dir, pattern, result) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          findFiles(fullPath, pattern, result);
        } else if (entry.isFile() && entry.name.match(pattern)) {
          result.push(fullPath);
        }
      }
    }

    findFiles(srcDir, /\.(js|ts|jsx|tsx)$/, sourceFiles);
    findFiles(testDir, /\.(test|spec)\.(js|ts|jsx|tsx)$/, testFiles);

    const tested = new Set();
    for (const testFile of testFiles) {
      const baseName = path.basename(testFile).replace(/\.(test|spec)\.(js|ts|jsx|tsx)$/, '');
      tested.add(baseName);
    }

    const untested = [];
    for (const srcFile of sourceFiles) {
      const baseName = path.basename(srcFile).replace(/\.(js|ts|jsx|tsx)$/, '');
      if (!tested.has(baseName) && !srcFile.includes('.test.') && !srcFile.includes('.spec.')) {
        untested.push(srcFile);
      }
    }

    return { untested, tested: testFiles.length, total: sourceFiles.length, coverage: sourceFiles.length > 0 ? (testFiles.length / sourceFiles.length * 100).toFixed(1) : 0 };
  }

  // ===== RUN TESTS =====
  runTests(framework = null, args = []) {
    const fw = framework || this.detectFramework();
    const commands = {
      vitest: `npx vitest run ${args.join(' ')}`,
      jest: `npx jest ${args.join(' ')}`,
      playwright: `npx playwright test ${args.join(' ')}`,
      cypress: `npx cypress run ${args.join(' ')}`,
      mocha: `npx mocha ${args.join(' ')}`
    };
    return commands[fw] || `npx ${fw} ${args.join(' ')}`;
  }
}

module.exports = TestGenerator;
