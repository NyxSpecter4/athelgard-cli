/**
 * ATHELGARD SKILL: Documentation Generator
 * Superpowers: README gen, JSDoc insertion, API docs, changelog
 */

const fs = require('fs');
const path = require('path');

class DocGenerator {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  // ===== GENERATE README =====
  async generateREADME(askAI) {
    const pkgPath = path.join(this.cwd, 'package.json');
    let pkg = { name: 'Project', description: '', version: '0.0.1' };
    
    if (fs.existsSync(pkgPath)) {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    }

    // Find main entry file
    let entryCode = '';
    const entryCandidates = [
      pkg.main,
      'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
      'index.js', 'index.ts', 'app.js', 'app.ts',
      'src/App.tsx', 'src/App.jsx'
    ].filter(Boolean);

    for (const candidate of entryCandidates) {
      const fullPath = path.join(this.cwd, candidate);
      if (fs.existsSync(fullPath)) {
        entryCode = fs.readFileSync(fullPath, 'utf8').substring(0, 3000);
        break;
      }
    }

    // Find scripts
    const scripts = pkg.scripts || {};
    const hasTests = Object.keys(scripts).some(s => s.includes('test'));
    const hasBuild = Object.keys(scripts).some(s => s.includes('build'));
    const hasDev = Object.keys(scripts).some(s => s.includes('dev') || s.includes('start'));

    const prompt = `Generate a professional README.md for this project:

Project Name: ${pkg.name}
Description: ${pkg.description || 'A software project'}
Version: ${pkg.version}
License: ${pkg.license || 'MIT'}

Scripts: ${Object.keys(scripts).join(', ')}
Dependencies: ${Object.keys(pkg.dependencies || {}).slice(0, 10).join(', ')}

Entry file preview:
\`\`\`
${entryCode}
\`\`\`

Generate a README with:
1. Title and description
2. Badges (build, version, license)
3. Installation instructions
4. Quick start / Usage
5. API overview (from entry file exports)
6. Scripts table
7. Contributing section
8. License

Use markdown. Be concise but informative. Return ONLY the README content.`;

    return await askAI(prompt);
  }

  // ===== ADD JSDOC TO FILE =====
  async addJSDoc(filePath, askAI) {
    const code = fs.readFileSync(filePath, 'utf8');
    const prompt = `Add comprehensive JSDoc comments to all functions, classes, and methods in this code.

Rules:
- Add @param for every parameter with type and description
- Add @returns with type and description
- Add @example for complex functions
- Add @throws if function can throw
- Use @typedef for complex types
- Keep existing code unchanged, only add comments

Code:
\`\`\`
${code}
\`\`\`

Return the COMPLETE file with JSDoc comments added.`;

    return await askAI(prompt);
  }

  // ===== GENERATE API DOCUMENTATION =====
  async generateAPIDocs(filePath, askAI) {
    const code = fs.readFileSync(filePath, 'utf8');
    const prompt = `Generate API documentation for this module.

Format as markdown with:
1. Module overview
2. Exported functions table (name, params, returns, description)
3. Detailed function docs with examples
4. Type definitions
5. Usage examples

Code:
\`\`\`
${code}
\`\`\`

Return ONLY markdown documentation.`;

    return await askAI(prompt);
  }

  // ===== GENERATE CHANGELOG =====
  async generateChangelog(askAI) {
    let commits = '';
    try {
      const { execSync } = require('child_process');
      commits = execSync('git log --oneline -30', { cwd: this.cwd, encoding: 'utf8' });
    } catch (e) {
      commits = 'No git history available';
    }

    const prompt = `Generate a CHANGELOG.md from these commits using Keep a Changelog format.

Commits:
${commits}

Rules:
- Group by: Added, Changed, Deprecated, Removed, Fixed, Security
- Use semantic versioning sections
- Infer version bumps (major/minor/patch) from commit types
- Write user-focused descriptions

Return ONLY the changelog content.`;

    return await askAI(prompt);
  }

  // ===== GENERATE CONTRIBUTING GUIDE =====
  async generateContributing(askAI) {
    const framework = this.detectProjectType();
    
    const prompt = `Generate a CONTRIBUTING.md guide for a ${framework} project.

Include:
1. Development setup
2. Code style guide
3. Testing requirements
4. Pull request process
5. Commit message conventions (Conventional Commits)
6. Issue reporting template

Return ONLY the markdown content.`;

    return await askAI(prompt);
  }

  // ===== GENERATE LICENSE =====
  generateLicense(type = 'MIT', author = '', year = new Date().getFullYear()) {
    const licenses = {
      MIT: `MIT License

Copyright (c) ${year} ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,

      Apache: `Apache License 2.0

Copyright ${year} ${author}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,

      GPL: `GNU General Public License v3.0

Copyright (C) ${year} ${author}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.`
    };

    return licenses[type] || licenses.MIT;
  }

  detectProjectType() {
    if (fs.existsSync(path.join(this.cwd, 'package.json'))) return 'Node.js';
    if (fs.existsSync(path.join(this.cwd, 'Cargo.toml'))) return 'Rust';
    if (fs.existsSync(path.join(this.cwd, 'go.mod'))) return 'Go';
    return 'Software';
  }
}

module.exports = DocGenerator;
