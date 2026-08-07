/**
 * ATHELGARD SKILL: Smart Navigator
 * Superpowers: Project mapping, entry point detection, stats, file finder
 */

const fs = require('fs');
const path = require('path');

class Navigator {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.ignorePatterns = [
      'node_modules', '.git', '.vercel', '.next', 'dist', 'build', 'coverage',
      '.openclaw', '.cache', '.vscode', '.idea', 'tmp', 'temp',
      '*.log', '*.lock', '.DS_Store', 'Thumbs.db'
    ];
  }

  shouldIgnore(name) {
    return this.ignorePatterns.some(p => {
      if (p.includes('*')) return new RegExp(p.replace('*', '.*')).test(name);
      return name === p || name.startsWith('.');
    });
  }

  // ===== PROJECT MAP =====
  map(dir = this.cwd, depth = 0, maxDepth = 3) {
    const result = { dirs: [], files: [], totalSize: 0, totalFiles: 0 };
    
    function scan(current, d) {
      if (d > maxDepth) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          
          const fullPath = path.join(current, entry.name);
          const relPath = path.relative(dir, fullPath);
          
          if (entry.isDirectory()) {
            result.dirs.push({ path: relPath, depth: d });
            scan(fullPath, d + 1);
          } else {
            const stat = fs.statSync(fullPath);
            result.files.push({
              path: relPath,
              ext: path.extname(entry.name),
              size: stat.size,
              depth: d
            });
            result.totalSize += stat.size;
            result.totalFiles++;
          }
        }
      } catch (e) {}
    }
    
    scan(dir, 0);
    return result;
  }

  // ===== TREE VIEW =====
  tree(dir = this.cwd, prefix = '', maxDepth = 4, currentDepth = 0) {
    if (currentDepth > maxDepth) return '';
    
    let output = '';
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });
      
      entries.forEach((entry, i) => {
        const isLast = i === entries.length - 1;
        const line = prefix + (isLast ? '└── ' : '├── ') + entry.name;
        output += line + '\n';
        
        if (entry.isDirectory()) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          output += this.tree(path.join(dir, entry.name), newPrefix, maxDepth, currentDepth + 1);
        }
      });
    } catch (e) {}
    
    return output;
  }

  // ===== ENTRY POINT DETECTION =====
  detectProject() {
    const detectors = [
      { file: 'package.json', type: 'node', name: 'Node.js' },
      { file: 'Cargo.toml', type: 'rust', name: 'Rust' },
      { file: 'go.mod', type: 'go', name: 'Go' },
      { file: 'requirements.txt', type: 'python', name: 'Python' },
      { file: 'pom.xml', type: 'java-maven', name: 'Java (Maven)' },
      { file: 'build.gradle', type: 'java-gradle', name: 'Java (Gradle)' },
      { file: 'Gemfile', type: 'ruby', name: 'Ruby' },
      { file: 'composer.json', type: 'php', name: 'PHP' },
      { file: 'mix.exs', type: 'elixir', name: 'Elixir' },
      { file: 'Dockerfile', type: 'docker', name: 'Docker' },
    ];
    
    for (const d of detectors) {
      if (fs.existsSync(path.join(this.cwd, d.file))) {
        return this._analyzeProject(d);
      }
    }
    
    // Check for common patterns
    if (fs.existsSync(path.join(this.cwd, 'src'))) {
      if (fs.existsSync(path.join(this.cwd, 'src', 'App.tsx')) || fs.existsSync(path.join(this.cwd, 'src', 'App.jsx'))) {
        return { type: 'react', name: 'React', framework: 'React', entry: 'src/App.tsx or src/App.jsx' };
      }
      if (fs.existsSync(path.join(this.cwd, 'src', 'main.ts')) || fs.existsSync(path.join(this.cwd, 'src', 'main.js'))) {
        return { type: 'typescript', name: 'TypeScript', entry: 'src/main.ts or src/main.js' };
      }
    }
    
    return { type: 'unknown', name: 'Unknown', entry: null };
  }

  _analyzeProject(detector) {
    const result = { type: detector.type, name: detector.name };
    
    if (detector.type === 'node') {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.cwd, 'package.json'), 'utf8'));
      result.name = pkg.name || 'Node.js Project';
      result.version = pkg.version;
      result.main = pkg.main || 'index.js';
      result.scripts = Object.keys(pkg.scripts || {});
      result.dependencies = Object.keys(pkg.dependencies || {});
      result.devDependencies = Object.keys(pkg.devDependencies || {});
      
      // Detect framework
      if (pkg.dependencies?.next || pkg.devDependencies?.next) result.framework = 'Next.js';
      else if (pkg.dependencies?.react || pkg.devDependencies?.react) result.framework = 'React';
      else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) result.framework = 'Vue';
      else if (pkg.dependencies?.svelte || pkg.devDependencies?.svelte) result.framework = 'Svelte';
      else if (pkg.dependencies?.express) result.framework = 'Express';
      else if (pkg.dependencies?.fastify) result.framework = 'Fastify';
      else result.framework = 'Node.js';
    }
    
    return result;
  }

  // ===== FILE STATS =====
  stats(dir = this.cwd) {
    const map = this.map(dir, 0, 10);
    const byExt = {};
    let totalLines = 0;
    
    for (const file of map.files) {
      byExt[file.ext] = (byExt[file.ext] || 0) + 1;
      
      // Count lines for code files
      if (['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h'].includes(file.ext)) {
        try {
          const content = fs.readFileSync(path.join(dir, file.path), 'utf8');
          totalLines += content.split('\n').length;
        } catch (e) {}
      }
    }
    
    return {
      totalFiles: map.totalFiles,
      totalSize: this._formatSize(map.totalSize),
      totalSizeBytes: map.totalSize,
      totalLines,
      byExtension: Object.entries(byExt).sort((a, b) => b[1] - a[1]).slice(0, 10),
      directories: map.dirs.length
    };
  }

  _formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  // ===== FIND FILES =====
  find(pattern, dir = this.cwd) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    const map = this.map(dir, 0, 10);
    return map.files.filter(f => regex.test(f.path));
  }

  // ===== SEARCH CONTENT =====
  grep(searchTerm, dir = this.cwd, ext = null) {
    const results = [];
    const map = this.map(dir, 0, 5);
    
    for (const file of map.files) {
      if (ext && !file.ext.endsWith(ext)) continue;
      if (file.size > 500000) continue; // Skip large files
      
      try {
        const content = fs.readFileSync(path.join(dir, file.path), 'utf8');
        const lines = content.split('\n');
        const matches = [];
        
        lines.forEach((line, i) => {
          if (line.includes(searchTerm)) {
            matches.push({ line: i + 1, text: line.trim() });
          }
        });
        
        if (matches.length) {
          results.push({ file: file.path, matches: matches.slice(0, 5), totalMatches: matches.length });
        }
      } catch (e) {}
    }
    
    return results;
  }
}

module.exports = Navigator;
