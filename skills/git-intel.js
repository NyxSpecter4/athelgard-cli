/**
 * ATHELGARD SKILL: Git Intelligence Engine
 * Superpowers: blame, log, diff, commit suggestions, branch analysis
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitIntel {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  _exec(cmd) {
    try {
      return execSync(cmd, { cwd: this.cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (e) {
      return '';
    }
  }

  isGitRepo() {
    return fs.existsSync(path.join(this.cwd, '.git'));
  }

  // ===== BLAME & ATTRIBUTION =====
  blame(file, line = null) {
    const lineFlag = line ? `-L ${line},${line} ` : '';
    const out = this._exec(`git blame ${lineFlag}--porcelain "${file}"`);
    if (!out) return null;
    
    const lines = out.split('\n');
    const commit = lines[0].split(' ')[0];
    const author = lines.find(l => l.startsWith('author '))?.replace('author ', '');
    const time = lines.find(l => l.startsWith('author-time '))?.replace('author-time ', '');
    const summary = lines.find(l => l.startsWith('summary '))?.replace('summary ', '');
    
    return {
      commit: commit.substring(0, 7),
      author,
      date: time ? new Date(parseInt(time) * 1000).toISOString().split('T')[0] : null,
      message: summary,
      fullCommit: commit
    };
  }

  // ===== COMMIT HISTORY =====
  log(options = {}) {
    const { n = 20, author = null, since = null, grep = null, file = null } = options;
    let cmd = `git log --oneline -n ${n} --format="%h|%s|%an|%ad|%D" --date=short`;
    if (author) cmd += ` --author="${author}"`;
    if (since) cmd += ` --since="${since}"`;
    if (grep) cmd += ` --grep="${grep}"`;
    if (file) cmd += ` -- "${file}"`;
    
    const out = this._exec(cmd);
    return out.split('\n').filter(Boolean).map(line => {
      const [hash, subject, author, date, refs] = line.split('|');
      return { hash, subject, author, date, refs: refs || null };
    });
  }

  // ===== FILE HISTORY =====
  fileHistory(file) {
    const out = this._exec(`git log --follow --format="%h|%s|%an|%ad" --date=short -- "${file}"`);
    return out.split('\n').filter(Boolean).map(line => {
      const [hash, subject, author, date] = line.split('|');
      return { hash, subject, author, date };
    });
  }

  // ===== CHANGED FILES =====
  changedFiles(base = 'HEAD~1', target = 'HEAD') {
    const out = this._exec(`git diff --name-status ${base} ${target}`);
    return out.split('\n').filter(Boolean).map(line => {
      const [status, file] = line.split('\t');
      return { status, file, statusLabel: this._statusLabel(status) };
    });
  }

  _statusLabel(s) {
    const map = { A: 'Added', M: 'Modified', D: 'Deleted', R: 'Renamed', C: 'Copied' };
    return map[s] || s;
  }

  // ===== WORKING TREE STATUS =====
  status() {
    const out = this._exec('git status --short');
    return out.split('\n').filter(Boolean).map(line => {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);
      return { status, file, staged: status[0] !== ' ' && status[0] !== '?', label: this._statusLabel(status.replace(/\s/g, '')) };
    });
  }

  // ===== STASH LIST =====
  stashList() {
    const out = this._exec('git stash list --format="%h|%s|%gd|%cr"');
    return out.split('\n').filter(Boolean).map(line => {
      const [hash, subject, ref, age] = line.split('|');
      return { hash, subject, ref, age };
    });
  }

  // ===== BRANCHES =====
  branches() {
    const out = this._exec('git branch -vv --format="%(refname:short)|%(upstream:short)|%(committerdate:short)|%(subject)"');
    const current = this._exec('git branch --show-current').trim();
    return out.split('\n').filter(Boolean).map(line => {
      const [name, upstream, date, subject] = line.split('|');
      return { name, upstream: upstream || null, date, subject, current: name === current };
    });
  }

  // ===== CONTRIBUTORS =====
  contributors() {
    const out = this._exec('git shortlog -sn --no-merges');
    return out.split('\n').filter(Boolean).map(line => {
      const match = line.match(/^\s*(\d+)\s+(.+)$/);
      return match ? { commits: parseInt(match[1]), name: match[2] } : null;
    }).filter(Boolean);
  }

  // ===== STATS =====
  stats() {
    const totalCommits = this._exec('git rev-list --count HEAD').trim();
    const totalFiles = this._exec('git ls-files | wc -l').trim();
    const firstCommit = this._exec('git log --reverse --format="%ad" --date=short | head -1').trim();
    const lastCommit = this._exec('git log --format="%ad" --date=short | head -1').trim();
    
    return {
      totalCommits: parseInt(totalCommits) || 0,
      totalFiles: parseInt(totalFiles) || 0,
      firstCommit,
      lastCommit,
      activeDays: this._exec('git log --format="%ad" --date=short | sort -u | wc -l').trim()
    };
  }

  // ===== COMMIT MESSAGE SUGGESTION =====
  async suggestCommitMessage(askAI) {
    const diff = this._exec('git diff --cached --stat');
    if (!diff.trim()) return { error: 'No staged changes' };
    
    const files = this._exec('git diff --cached --name-only').trim().split('\n');
    const detailedDiff = this._exec('git diff --cached -U2').substring(0, 4000);
    
    const prompt = `Generate a conventional commit message for these changes.

Files changed:
${files.join('\n')}

Diff summary:
${diff}

Rules:
- Use format: type(scope): description
- Types: feat, fix, docs, style, refactor, test, chore
- Keep subject under 72 chars
- Add body if needed for details

Return ONLY the commit message, nothing else.`;

    const message = await askAI(prompt);
    return { message: message.trim(), files, diff };
  }

  // ===== RECENT ACTIVITY SUMMARY =====
  summary(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const commits = this.log({ n: 50, since });
    const authors = {};
    for (const c of commits) {
      authors[c.author] = (authors[c.author] || 0) + 1;
    }
    
    return {
      period: `${days} days`,
      totalCommits: commits.length,
      topAuthors: Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 5),
      recentCommits: commits.slice(0, 10)
    };
  }
}

module.exports = GitIntel;
