# ATHELGARD v2.0 — Skill Arsenal

**Built:** 2026-08-08 by MakoThoth-KClaw
**Repos:**
- CLI: https://github.com/NyxSpecter4/athelgard-cli
- Web IDE: https://github.com/NyxSpecter4/athelgard-site

---

## 🕵️ GIT INTELLIGENCE

```bash
athelgard git blame <file> [line]     # Who wrote this line
athelgard git log [n]                 # Recent commits
athelgard git status                  # Working tree status
athelgard git diff [base]             # Changed files
athelgard git summary [days]          # Activity summary
athelgard git suggest-commit          # Auto-generate commit message
athelgard git branches                # List branches
athelgard git stash                   # List stashes
athelgard git contributors            # Top contributors
athelgard git stats                   # Repo statistics
```

## 🗺️ NAVIGATOR

```bash
athelgard map [dir]                   # Project structure
athelgard tree [dir]                  # Tree view
athelgard stats                       # File statistics
athelgard find <pattern>              # Find files
athelgard grep <term> [ext]           # Search file contents
athelgard detect                      # Detect project type
```

## 🧩 CODE CHUNKER

```bash
athelgard chunk <file> [function]     # Chunk file by functions
athelgard context <file> <line>       # Get context around line
```

## 🧪 TEST GENERATOR

```bash
athelgard test-gen <file>             # Generate tests
athelgard test-gen --coverage         # Find untested files
athelgard test-run [pattern]          # Run tests
```

## 📝 DOC GENERATOR

```bash
athelgard docs readme                 # Generate README
athelgard docs jsdoc <file>           # Add JSDoc comments
athelgard docs api <file>             # Generate API docs
athelgard docs changelog              # Generate CHANGELOG
athelgard docs license [type]         # Generate LICENSE
```

## 🎯 PROMPT ENGINEER

```bash
athelgard prompt list                 # List all templates
athelgard prompt use <name> "query"   # Use a template
athelgard prompt test <name> "query"  # A/B test variations
athelgard prompt optimize "prompt"    # Analyze & optimize
athelgard prompt analyze "prompt"     # Score a prompt
athelgard prompt engineer             # Interactive builder
```

---

## INSTALLATION

```bash
git clone https://github.com/NyxSpecter4/athelgard-cli.git
cd athelgard-cli
npm link  # or: node athelgard.js config
```

## 🚀 VERCEL MANAGER

```bash
athelgard vercel projects             # List all projects
athelgard vercel deploys <project>    # List deployments
athelgard vercel status <deploy-id>   # Check deployment status
athelgard vercel env <project>        # List env vars
athelgard vercel env-add <project> <key> <value>  # Add env var
athelgard vercel domains <project>    # List domains
```

## REQUIREMENTS

- Node.js 18+
- DeepSeek API key (or Kimi as fallback)
- Git (for Git Intelligence)
- Vercel token (optional, for Vercel commands)

---

*Part of the Athelgard ecosystem for Captain's bountywarz team.*
