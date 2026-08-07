# 🦉 ATHELGARD CLI

**Captain's AI coding agent — in your terminal.**

```
$ athelgard status

🐉 ATHELGARD STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 LIVE SITES
  ● athelgard.io     UP  75ms  25KB
  ● bountywarz.com   UP  1.2s  250KB

📊 BASELINE SCORES
  ██████████████░░░░░░ 71  athelgard-io ▲
  ███████████████░░░░░ 75  bountywarz ▲

💰 API USAGE
  Total Calls:    10
  Total Cost:     $0.0433
  Avg Latency:    687ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📱 INSTALL ON ANDROID (Termux)

**1. Install Termux** (bash terminal for Android)
- F-Droid: https://f-droid.org/packages/com.termux/
- Or search "Termux" on F-Droid (NOT Play Store — Google banned it)

**2. Open Termux, run:**
```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```

**3. Install Athelgard:**
```bash
curl -fsSL https://raw.githubusercontent.com/NyxSpecter4/athelgard-cli/master/install.sh | bash
source ~/.bashrc
```

**4. Configure API keys:**
```bash
athelgard config
```
Enter your:
- DeepSeek API key (from https://platform.deepseek.com)
- Kimi API key (optional, for peak hours)
- GitHub token (optional)

**5. Done! Test it:**
```bash
athelgard status
athelgard ask "How do I write a React hook?"
```

---

## 💻 INSTALL ON MAC/LINUX

```bash
curl -fsSL https://raw.githubusercontent.com/NyxSpecter4/athelgard-cli/master/install.sh | bash
source ~/.bashrc
athelgard config
```

---

## 🖥️ INSTALL ON WINDOWS (WSL)

```bash
# In WSL terminal:
curl -fsSL https://raw.githubusercontent.com/NyxSpecter4/athelgard-cli/master/install.sh | bash
source ~/.bashrc
athelgard config
```

---

## 🚀 COMMANDS

### Core
```bash
athelgard config              # Set API keys
athelgard ask "question"      # Ask DeepSeek AI
athelgard chat                # Interactive chat mode
athelgard read <file>         # Read file contents
```

### Skills
```bash
athelgard status              # 🌡️ Unified dashboard (sites + API + system)
athelgard api dashboard       # 📊 DeepSeek API health & costs
athelgard api phone           # 📱 Analyze phone calls from Supabase
athelgard git log 10          # 🕵️ Git history
athelgard map                 # 🗺️ Project structure
athelgard chunk file.js       # 🧩 Code chunker
athelgard test-gen file.js    # 🧪 Generate tests
athelgard docs readme         # 📝 Generate README
athelgard vercel projects     # 🚀 List Vercel projects
```

---

## 📊 WHAT YOU GET

| Feature | Command | What It Does |
|---------|---------|--------------|
| **Status Dashboard** | `athelgard status` | Live sites + scores + API costs + system health |
| **Baseline Monitor** | `node baseline-pro.js barometer` | Check if sites are better than before |
| **API Tracker** | `athelgard api dashboard` | Track DeepSeek usage, costs, latency |
| **Git Intelligence** | `athelgard git stats` | Repo stats, contributors, blame |
| **Prompt Engineer** | `athelgard prompt engineer` | Interactive prompt builder |
| **Vercel Manager** | `athelgard vercel deploys` | Deployments, env vars, domains |

---

## 🔗 CONNECTED SERVICES

| Service | Connection | Status |
|---------|-----------|--------|
| **DeepSeek API** | Primary AI model | ⚙️ Needs your API key |
| **Kimi API** | Fallback during peak | ⚙️ Optional |
| **GitHub** | Repo browsing | ⚙️ Optional |
| **Vercel** | Deployments | ⚙️ Optional |
| **Supabase** | Phone call logs | ⚙️ Optional |

---

## 🛠️ TROUBLESHOOTING

**"command not found: athelgard"**
```bash
source ~/.bashrc
# Or manually:
export PATH="$HOME/.local/bin:$PATH"
```

**"No API keys configured"**
```bash
athelgard config
```

**"Cannot find module"**
```bash
cd ~/.athelgard-cli && npm install
```

---

**Built by MakoThoth-KClaw for Captain.**
