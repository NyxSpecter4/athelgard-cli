#!/usr/bin/env python3
"""
Athelgard Bridge Agent — Local Python Version
Runs on your machine (not Colab). Same capabilities.

Setup:
  pip install PyGithub requests
  export GITHUB_TOKEN="ghp_..."
  export SENDER_EMAIL="you@gmail.com"
  export SENDER_APP_PW="your-app-password"
  export VERCEL_HOOK="https://api.vercel.com/v1/integrations/deploy/..."

Usage:
  python3 athelgard-bridge-agent.py --sync --pr 675
"""

import os
import sys
import argparse
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    from github import Github
except ImportError:
    print("pip install PyGithub")
    sys.exit(1)

# ─── CONFIG ───
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL')
SENDER_APP_PW = os.environ.get('SENDER_APP_PW')
VERCEL_HOOK = os.environ.get('VERCEL_HOOK')
REPO = "NyxSpecter4/athelgard-site"

# ─── TOOLS ───

def send_email(to_email: str, subject: str, body: str) -> str:
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_APP_PW)
        server.send_message(msg)
        server.quit()
        return "✅ Email sent"
    except Exception as e:
        return f"❌ Email failed: {e}"

def post_github_comment(repo: str, pr: int, comment: str) -> str:
    try:
        g = Github(GITHUB_TOKEN)
        r = g.get_repo(repo)
        p = r.get_pull(pr)
        p.create_issue_comment(comment)
        return f"✅ Comment posted on {repo}#{pr}"
    except Exception as e:
        return f"❌ GitHub failed: {e}"

def trigger_vercel_deploy(hook_url: str = None) -> str:
    url = hook_url or VERCEL_HOOK
    if not url:
        return "❌ No VERCEL_HOOK env var set"
    try:
        res = requests.post(url, timeout=30)
        return f"✅ Vercel deploy triggered (HTTP {res.status_code})"
    except Exception as e:
        return f"❌ Vercel deploy failed: {e}"

def get_repo_status(repo: str) -> dict:
    try:
        g = Github(GITHUB_TOKEN)
        r = g.get_repo(repo)
        latest = r.get_commits()[0]
        prs = r.get_pulls(state='open')
        return {
            "latest_commit": latest.sha[:7],
            "commit_message": latest.commit.message,
            "open_prs": prs.totalCount,
        }
    except Exception as e:
        return {"error": str(e)}

# ─── AGENT ───

class BridgeAgent:
    def __init__(self):
        self.log = []

    def _log(self, action, result):
        self.log.append({"action": action, "result": result})
        print(f"  [{action}] {result}")

    def sync(self, kimis_email=None, pr=None):
        print("=" * 50)
        print("🦉 ATHELGARD BRIDGE AGENT — SYNC")
        print("=" * 50)

        # Check repo
        status = get_repo_status(REPO)
        print(f"\n📊 {REPO}")
        print(f"   Commit: {status.get('latest_commit', '?')} — {status.get('commit_message', '')[:40]}")
        print(f"   Open PRs: {status.get('open_prs', '?')}")

        # Email Kimi
        if kimis_email:
            directive = """🦉 OWL + LONDON LOCK
- Mascot: Owl (Athelgard identity)
- Range: London (support.london.sim)
- SF drone-recon: DECOMMISSIONED
- Action: Verify Vercel redeploy + LDN-SUP-001"""
            r = send_email(kimis_email, "[HANDOFF] Athelgard Owl + London", directive)
            self._log("email", r)

        # GitHub PR comment
        if pr:
            msg = f"🤖 Bridge Agent: Owl + London locked. Awaiting Vercel deploy."
            r = post_github_comment(REPO, pr, msg)
            self._log("github", r)

        # Vercel deploy
        if VERCEL_HOOK:
            r = trigger_vercel_deploy()
            self._log("vercel", r)
        else:
            print("\n⚠️  Set VERCEL_HOOK env var to auto-deploy")

        print("\n" + "=" * 50)
        print("Done. Run with --report to see full log.")

    def report(self):
        print("\n📋 LOG:")
        for e in self.log:
            print(f"  • {e['action']}: {e['result']}")

# ─── CLI ───

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Athelgard Bridge Agent")
    parser.add_argument("--sync", action="store_true", help="Run full sync")
    parser.add_argument("--email", help="Kimi's email for handoff")
    parser.add_argument("--pr", type=int, help="PR number to comment on")
    parser.add_argument("--report", action="store_true", help="Show activity log")
    args = parser.parse_args()

    agent = BridgeAgent()

    if args.sync:
        agent.sync(kimis_email=args.email, pr=args.pr)
    elif args.report:
        agent.report()
    else:
        parser.print_help()
