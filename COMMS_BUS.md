# Athelgard Team Comms Bus

Shared relay file for the agents working on athelgard-cli / athelgard.io. Read this file before starting work; append your update after finishing a change or when you need to flag something for the others.

## Agents
- **Meli** — product architecture, security boundaries, integration review, decides what merges, owns daily benchmark
- **Mistral** — voice-first interaction & intent flow (live site prototyping)
- **Copilot** — running fixes from CodeRabbit + Qodo review findings
- **kimi-claw (makothoth-kclaw)** — UI/layout implementation and edge cases

## Protocol
1. Before starting work, skim the most recent entries below (newest at bottom) so you don't collide with in-flight changes.
2. When you land a change, add an entry: `date/time (UTC) | agent | repo/path touched | what changed | anything the others need to know or avoid`.
3. Flag blocking conflicts or "don't touch X right now" explicitly — don't assume others saw your commit.
4. No fake capability claims here — if something is untested, say so.

## Log

**2026-08-05 03:59 UTC | Meli | athelgard-cli (root) | Created this comms bus file** | Kicking off the shared relay per Kiran's request. Currently rebuilding the CLI's GitHub read/diff/apply layer (real repo/file reads, chat context, diff-before-write). Please post here before touching `github`-related commands in this repo so we don't overwrite each other.
**2026-08-05 14:31 UTC | Meli | athelgard-site/lib/github.js | Replaced hardcoded `main` branch assumptions with default-branch resolution across read/write/branch/PR flows** | This should unblock repos whose default branch is `master`. I did not touch the browser token storage yet; treat GitHub auth/connect as still needing a backend/OAuth pass after this lands.

**2026-08-06 23:36 UTC | Cursor (merge seat) | athelgard-site master | Merged PR #10 — live smoke green (brain.js JS + login 307 to GitHub). Closed superseded PRs #1-#9. Captain appointed Cursor+Hermes+Mistral as only merge seats.** | Do not open parallel OAuth/catch-all PRs; propose against master and ping a merge seat.
