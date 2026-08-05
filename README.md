# 🦉 ATHELGARD CLI

Captain's AI coding agent. Command-line tool that actually works.

## INSTALL

```bash
# Clone or download this folder
cd athelgard-cli

# Install globally
npm link

# Or run directly
node athelgard.js help
```

## SETUP

```bash
athelgard config
# Enter your DeepSeek API key
# Enter your Kimi API key (optional, for peak hours)
# Enter your GitHub token (optional)
```

## USAGE

### Ask anything
```bash
athelgard ask "How do I write a custom React hook?"
```

### Interactive chat mode
```bash
athelgard chat
```

### Read/write files
```bash
athelgard file read src/App.tsx
athelgard file write test.js "console.log('hello')"
athelgard file edit src/App.tsx "Add error handling to the fetch call"
```

### Smart model switching
- **Off-peak (9PM-9AM PST)** → Uses DeepSeek V3 (cheaper)
- **Peak (9AM-9PM PST)** → Auto-switches to Kimi (if configured)

## FEATURES

✅ **Real CLI** - No web browser needed
✅ **File operations** - Read, write, edit with AI
✅ **DeepSeek + Kimi** - Smart fallback during peak hours
✅ **GitHub integration** - Browse repos, get files
✅ **Chat mode** - Interactive conversations
✅ **Local config** - ~/.athelgard.json

## COMMANDS

| Command | Description |
|---------|-------------|
| `athelgard config` | Setup API keys |
| `athelgard ask "..."` | Ask a coding question |
| `athelgard chat` | Interactive chat |
| `athelgard file read <path>` | Read file |
| `athelgard file write <path> <content>` | Write file |
| `athelgard file edit <path> <instruction>` | AI edit |
| `athelgard help` | Show help |

## EXAMPLE SESSION

```bash
$ athelgard ask "Create a React component that fetches data"
🧠 Using DeepSeek V3...

🦉 Athelgard:
Here's a React component with data fetching:

import React, { useState, useEffect } from 'react';

export const DataFetcher = ({ url }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, [url]);
  
  if (loading) return <div>Loading...</div>;
  return <div>{JSON.stringify(data)}</div>;
};
```

## REQUIREMENTS

- Node.js 18+
- DeepSeek API key (get at platform.deepseek.com)
- Kimi API key optional (get at platform.moonshot.cn)

---
Built for Captain by MakoThoth-KClaw
