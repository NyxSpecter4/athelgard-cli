/**
 * ATHELGARD SKILL: Code Chunker
 * Superpowers: Smart context window management, semantic chunking, dependency tracing
 */

class CodeChunker {
  constructor() {
    this.languagePatterns = {
      javascript: {
        function: /(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|let\s+\w+\s*=\s*(?:async\s+)?\(|var\s+\w+\s*=\s*(?:async\s+)?\()/,
        class: /(?:export\s+)?class\s+\w+/,
        import: /^(?:import|require)\b/,
        comment: /^\s*\/\//
      },
      typescript: {
        function: /(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+\w+.*\(|interface\s+\w+|type\s+\w+\s*=|class\s+\w+/,
        class: /(?:export\s+)?(?:abstract\s+)?class\s+\w+/,
        import: /^(?:import|require)\b/,
        comment: /^\s*\/\//
      },
      python: {
        function: /(?:async\s+)?def\s+\w+/,
        class: /class\s+\w+/,
        import: /^(?:import|from)\b/,
        comment: /^\s*#/
      },
      go: {
        function: /(?:func\s+\(.*\)\s+)?func\s+\w+/,
        struct: /type\s+\w+\s+struct/,
        import: /^import\b/,
        comment: /^\/\//
      }
    };
  }

  detectLanguage(filename) {
    const ext = filename.split('.').pop();
    const map = {
      js: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c', cpp: 'cpp', h: 'c',
      rb: 'ruby',
      php: 'php'
    };
    return map[ext] || 'javascript';
  }

  // ===== CHUNK BY FUNCTIONS =====
  chunkByFunction(code, language = 'javascript') {
    const lines = code.split('\n');
    const chunks = [];
    let current = { type: 'header', name: 'preamble', content: [] };
    let depth = 0;
    let inString = false;
    let stringChar = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect function/class start
      const isFunction = this.languagePatterns[language]?.function?.test(trimmed);
      const isClass = this.languagePatterns[language]?.class?.test(trimmed);

      if ((isFunction || isClass) && depth === 0 && !inString) {
        if (current.content.length > 0) {
          chunks.push(current);
        }
        
        const nameMatch = trimmed.match(/(?:function|def|class|func|interface|type)\s+(\w+)/);
        current = {
          type: isClass ? 'class' : 'function',
          name: nameMatch ? nameMatch[1] : 'anonymous',
          content: [line],
          startLine: i + 1
        };
        
        // Track braces for JS/TS/C/Go
        if (['javascript', 'typescript', 'go', 'c', 'cpp', 'java', 'rust'].includes(language)) {
          depth = (line.match(/{/g) || []).length;
          depth -= (line.match(/}/g) || []).length;
          if (depth <= 0 && line.includes('{') && line.includes('}')) {
            // Single-line function
            chunks.push(current);
            current = { type: 'separator', name: 'gap', content: [] };
            depth = 0;
          }
        }
        continue;
      }

      current.content.push(line);

      // Track braces
      if (['javascript', 'typescript', 'go', 'c', 'cpp', 'java', 'rust'].includes(language)) {
        for (const char of line) {
          if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true;
            stringChar = char;
          } else if (inString && char === stringChar && !line.endsWith('\\')) {
            inString = false;
          } else if (!inString) {
            if (char === '{') depth++;
            if (char === '}') depth--;
          }
        }

        if (depth === 0 && current.type !== 'header' && current.type !== 'separator') {
          chunks.push(current);
          current = { type: 'separator', name: 'gap', content: [] };
        }
      }

      // Python/Ruby: track indentation
      if (['python', 'ruby'].includes(language)) {
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('"""') && current.content.length > 1) {
          const baseIndent = (current.content[0].match(/^\s*/) || [''])[0].length;
          const lineIndent = (line.match(/^\s*/) || [''])[0].length;
          
          if (lineIndent <= baseIndent && trimmed && !trimmed.startsWith('@') && !trimmed.startsWith('"""')) {
            if (current.content.length > 1) {
              chunks.push(current);
              current = { type: 'separator', name: 'gap', content: [line] };
            }
          }
        }
      }
    }

    if (current.content.length > 0) chunks.push(current);
    return chunks;
  }

  // ===== GET CONTEXT AROUND LINE =====
  getContext(code, targetLine, contextLines = 20, language = 'javascript') {
    const lines = code.split('\n');
    const start = Math.max(0, targetLine - contextLines - 1);
    const end = Math.min(lines.length, targetLine + contextLines);
    
    // Also find the enclosing function
    const chunks = this.chunkByFunction(code, language);
    const enclosingChunk = chunks.find(c => 
      c.startLine && c.startLine <= targetLine && 
      c.startLine + c.content.length >= targetLine
    );
    
    const context = {
      around: lines.slice(start, end).join('\n'),
      lineNumbers: { start: start + 1, end, target: targetLine }
    };
    
    if (enclosingChunk && enclosingChunk.content.join('\n') !== context.around) {
      context.enclosingFunction = {
        name: enclosingChunk.name,
        type: enclosingChunk.type,
        code: enclosingChunk.content.join('\n')
      };
    }
    
    return context;
  }

  // ===== ASSEMBLE SMART CONTEXT =====
  async assembleContext(targetFunction, allChunks, askAI) {
    const context = [targetFunction];
    const targetText = targetFunction.content.join('\n');
    
    // Find imports
    const imports = allChunks.filter(c => 
      c.type === 'header' && c.content.some(l => l.match(/^(import|require|from|const.*=.*require)/))
    );
    context.push(...imports);
    
    // Find referenced functions (simple heuristic: check if target calls them)
    const calledFunctions = [];
    for (const chunk of allChunks) {
      if (chunk === targetFunction || chunk.type === 'header') continue;
      
      // Check if target function references this chunk by name
      const namePattern = new RegExp(`\\b${chunk.name}\\s*\\(`);
      if (namePattern.test(targetText)) {
        calledFunctions.push(chunk);
      }
    }
    
    // Limit context size
    const maxChunks = 5;
    context.push(...calledFunctions.slice(0, maxChunks));
    
    return context;
  }

  // ===== ESTIMATE TOKENS =====
  estimateTokens(text) {
    // Rough estimate: ~4 chars per token for English/code
    return Math.ceil(text.length / 4);
  }

  // ===== FIT TO CONTEXT WINDOW =====
  fitToWindow(chunks, maxTokens = 8000) {
    const result = [];
    let currentTokens = 0;
    
    for (const chunk of chunks) {
      const chunkText = chunk.content.join('\n');
      const tokens = this.estimateTokens(chunkText);
      
      if (currentTokens + tokens > maxTokens) break;
      result.push(chunk);
      currentTokens += tokens;
    }
    
    return { chunks: result, tokens: currentTokens };
  }
}

module.exports = CodeChunker;
