#!/usr/bin/env node
/**
 * ATHELGARD SECURITY SCANNER — Chair #4 FILLED
 * Finds vulnerabilities in code repos using Semgrep + CodeQL patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const C = process.stdout.isTTY ? {
  bold: '\x1b[1m', reset: '\x1b[0m', red: '\x1b[31m', yellow: '\x1b[33m',
  green: '\x1b[32m', cyan: '\x1b[36m'
} : { bold: '', reset: '', red: '', yellow: '', green: '', cyan: '' };

// Built-in vulnerability patterns (Semgrep-style)
const VULN_PATTERNS = [
  {
    id: 'SEC-001',
    name: 'Hardcoded API Key',
    severity: 'CRITICAL',
    pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i,
    fix: 'Move to environment variable',
    fileFilter: null // All files
  },
  {
    id: 'SEC-002',
    name: 'SQL Injection Risk',
    severity: 'HIGH',
    pattern: /(query|execute)\s*\(\s*[`"'].*\$\{.*\}.*[`"']/,
    fix: 'Use parameterized queries',
    fileFilter: /\.(js|ts|py|php|rb)$/
  },
  {
    id: 'SEC-003',
    name: 'XSS — InnerHTML',
    severity: 'HIGH',
    pattern: /\.innerHTML\s*=\s*/,
    fix: 'Use textContent or sanitize with DOMPurify',
    fileFilter: /\.(js|ts|jsx|tsx|html)$/
  },
  {
    id: 'SEC-004',
    name: 'Insecure Randomness',
    severity: 'MEDIUM',
    pattern: /Math\.random\s*\(\s*\)/,
    fix: 'Use crypto.randomBytes for security purposes',
    fileFilter: /\.(js|ts)$/
  },
  {
    id: 'SEC-005',
    name: 'Eval Usage',
    severity: 'HIGH',
    pattern: /\beval\s*\(/,
    fix: 'Use JSON.parse or Function constructor',
    fileFilter: /\.(js|ts)$/
  },
  {
    id: 'SEC-006',
    name: 'Insecure Protocol',
    severity: 'MEDIUM',
    pattern: /http:\/\//,
    fix: 'Use https://',
    fileFilter: null
  },
  {
    id: 'SEC-007',
    name: 'Debug Mode Enabled',
    severity: 'LOW',
    pattern: /debug\s*:\s*true|DEBUG\s*=\s*true/i,
    fix: 'Set debug: false in production',
    fileFilter: null
  },
  {
    id: 'SEC-008',
    name: 'TODO/FIXME in Code',
    severity: 'INFO',
    pattern: /(TODO|FIXME|HACK|XXX|BUG)\s*[:\-]/i,
    fix: 'Address before production',
    fileFilter: null
  }
];

function getFiles(dir, pattern = null) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(item)) continue;
      files.push(...getFiles(fullPath, pattern));
    } else if (stat.isFile()) {
      if (!pattern || pattern.test(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function scanFile(filePath, patterns) {
  const findings = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  for (const pattern of patterns) {
    if (pattern.fileFilter && !pattern.fileFilter.test(filePath)) continue;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (pattern.pattern.test(line)) {
        findings.push({
          id: pattern.id,
          name: pattern.name,
          severity: pattern.severity,
          file: filePath,
          line: i + 1,
          code: line.trim().substring(0, 80),
          fix: pattern.fix
        });
      }
    }
  }
  
  return findings;
}

function severityColor(sev) {
  switch(sev) {
    case 'CRITICAL': return C.red;
    case 'HIGH': return C.red;
    case 'MEDIUM': return C.yellow;
    case 'LOW': return C.green;
    default: return C.cyan;
  }
}

function scanCommand(targetPath = '.') {
  console.log(`${C.bold}🔒 ATHELGARD SECURITY SCANNER${C.reset}`);
  console.log(`${C.cyan}Chair #4: SECURITY — SGROK reporting for duty${C.reset}\n`);
  
  const absPath = path.resolve(targetPath);
  console.log(`Scanning: ${absPath}\n`);
  
  // Get all source files
  const files = getFiles(absPath, /\.(js|ts|jsx|tsx|py|php|rb|html|css|json)$/);
  console.log(`Files scanned: ${files.length}\n`);
  
  const allFindings = [];
  
  for (const file of files) {
    const findings = scanFile(file, VULN_PATTERNS);
    allFindings.push(...findings);
  }
  
  // Sort by severity
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  // Summary
  const bySeverity = {};
  allFindings.forEach(f => {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  });
  
  console.log(`${C.bold}FINDINGS SUMMARY${C.reset}`);
  Object.entries(bySeverity)
    .sort(([a], [b]) => severityOrder[a] - severityOrder[b])
    .forEach(([sev, count]) => {
      const color = severityColor(sev);
      console.log(`  ${color}${sev}${C.reset}: ${count}`);
    });
  console.log(`  ${C.bold}TOTAL: ${allFindings.length}${C.reset}\n`);
  
  // Detailed findings
  if (allFindings.length > 0) {
    console.log(`${C.bold}DETAILED FINDINGS${C.reset}\n`);
    
    let currentSeverity = null;
    for (const finding of allFindings) {
      if (finding.severity !== currentSeverity) {
        currentSeverity = finding.severity;
        const color = severityColor(currentSeverity);
        console.log(`${color}${C.bold}[${currentSeverity}]${C.reset}`);
      }
      
      console.log(`  ${finding.id} — ${finding.name}`);
      console.log(`    ${C.cyan}${finding.file}:${finding.line}${C.reset}`);
      console.log(`    Code: ${finding.code}`);
      console.log(`    Fix: ${finding.fix}\n`);
    }
  } else {
    console.log(`${C.green}✅ No security issues found!${C.reset}\n`);
  }
  
  // Recommendations
  console.log(`${C.bold}RECOMMENDATIONS${C.reset}`);
  if (allFindings.filter(f => f.severity === 'CRITICAL').length > 0) {
    console.log(`${C.red}  🚨 Fix CRITICAL issues before deploying!${C.reset}`);
  }
  if (allFindings.filter(f => f.severity === 'HIGH').length > 0) {
    console.log(`${C.red}  ⚠️  Address HIGH severity issues this sprint${C.reset}`);
  }
  console.log(`  • Run \\\`semgrep\\\` for deeper analysis: npm install -g semgrep`);
  console.log(`  • Consider adding pre-commit hooks for security scanning`);
  console.log(`  • Review OWASP Top 10 for web applications`);
}

// CLI
const target = process.argv[2] || '.';
scanCommand(target);
