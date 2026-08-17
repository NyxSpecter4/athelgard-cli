#!/bin/bash
# Athelgard Game Mode — Interactive Bounty Hunter Terminal
# Run: bash athelgard-game.sh

clear
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     🐉 ATHELGARD — BOUNTY HUNTER TERMINAL v1.0         ║"
echo "║     Type 'help' for commands  |  'exit' to quit         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Game state
MISSION_ACTIVE=false
CURRENT_LEVEL=1
XP=0

show_help() {
  echo ""
  echo "📋 COMMANDS:"
  echo "  mission     — Get a new bounty mission"
  echo "  status      — Check your hunter status"
  echo "  intel       — Get intel on a target"
  echo "  hack        — Attempt a simulated exploit"
  echo "  report      — Submit findings"
  echo "  ask <text>  — Ask Athelgard anything"
  echo "  clear       — Clear screen"
  echo "  exit        — Quit"
  echo ""
}

while true; do
  echo -n "[Lvl $CURRENT_LEVEL | XP $XP] hunter> "
  read cmd arg1 arg2
  
  case "$cmd" in
    "exit"|"quit")
      echo ""
      echo "🐉 Athelgard: Mission complete. Standby for next deployment."
      echo ""
      break
      ;;
      
    "help")
      show_help
      ;;
      
    "clear")
      clear
      ;;
      
    "mission")
      echo ""
      echo "🎯 REQUESTING MISSION..."
      athelgard ask "Generate a beginner-friendly ethical bounty hunting mission. Include: target description, vulnerability type, safe testing boundaries, and success criteria. Make it feel like a real CTF challenge." 2>/dev/null | tail -n +2
      MISSION_ACTIVE=true
      ;;
      
    "status")
      echo ""
      echo "📊 HUNTER STATUS"
      echo "   Level: $CURRENT_LEVEL"
      echo "   XP: $XP"
      echo "   Active Mission: $MISSION_ACTIVE"
      echo "   DeepSeek: Connected (off-peak rates)"
      echo ""
      ;;
      
    "intel")
      echo ""
      echo "🕵️  GATHERING INTEL..."
      athelgard ask "As a cyber intelligence analyst, give me reconnaissance tips for ethical bounty hunting. What tools and techniques should I use?" 2>/dev/null | tail -n +2
      ;;
      
    "hack")
      echo ""
      echo "⚡ INITIATING SIMULATED EXPLOIT..."
      athelgard ask "Walk me through a simulated SQL injection attack on a test environment. Show me the payload, explain how it works, and demonstrate the safe testing methodology. This is for educational purposes only." 2>/dev/null | tail -n +2
      XP=$((XP + 50))
      echo ""
      echo "✅ +50 XP"
      ;;
      
    "report")
      echo ""
      echo "📝 MISSION REPORT"
      athelgard ask "How do I write a professional bug bounty report? Give me a template with sections for: summary, steps to reproduce, impact, and remediation." 2>/dev/null | tail -n +2
      if [ "$MISSION_ACTIVE" = true ]; then
        XP=$((XP + 100))
        echo ""
        echo "✅ +100 XP — Mission complete!"
        MISSION_ACTIVE=false
        if [ $XP -ge 200 ]; then
          CURRENT_LEVEL=$((CURRENT_LEVEL + 1))
          XP=0
          echo "🎉 LEVEL UP! You are now Level $CURRENT_LEVEL"
        fi
      fi
      ;;
      
    "ask")
      if [ -n "$arg1" ]; then
        echo ""
        athelgard ask "$arg1 $arg2" 2>/dev/null | tail -n +2
      else
        echo "Usage: ask <your question>"
      fi
      ;;
      
    "")
      # Empty line, do nothing
      ;;
      
    *)
      echo ""
      echo "🐉 Athelgard: Processing '$cmd'..."
      athelgard ask "$cmd $arg1 $arg2" 2>/dev/null | tail -n +2
      ;;
  esac
  
  echo ""
done
