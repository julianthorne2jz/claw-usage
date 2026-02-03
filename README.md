# claw-usage

Analyze usage of your claw-* skills from AI transcripts. Find which tools you actually use vs which are sitting idle.

## Why

You build tools. But do you use them? This parses OpenClaw session transcripts to count how often each claw-* skill is invoked via exec commands:

- Which skills you use heavily (keep improving)
- Which skills you rarely/never use (deletion candidates)
- Usage patterns over time

## Install

```bash
git clone https://github.com/julianthorne2jz/claw-usage
cd claw-usage
npm link
```

## Usage

```bash
# Analyze last 24 hours (default)
claw-usage

# Last 7 days
claw-usage --days=7

# All time
claw-usage --days=999

# Specific date
claw-usage --date=2026-02-02

# JSON output (for automation)
claw-usage --json

# Verbose (show example commands)
claw-usage -v
```

## Output

```
📊 claw-* Tool Usage Analysis

Sessions analyzed: 107
Total tool invocations: 843
Tools installed: 22
Tools used: 22 | Unused: 0

──────────────────────────────────────────────────
Tool                         Calls        %
──────────────────────────────────────────────────
🔥 claw-devlog                  135    16.0%
🔥 claw-todo                     76     9.0%
🔥 claw-git                      70     8.3%
🔥 claw-lint                     44     5.2%
🔥 claw-molt                     25     3.0%
🟢 claw-flow                      7     0.8%
🟢 claw-usage                     5     0.6%
──────────────────────────────────────────────────

⚠️  UNUSED TOOLS (0 invocations — consider removing):
   ❌ claw-foo
   ❌ claw-bar

📋 Summary:
   • 2 tools have ZERO usage — review for removal
   • Top tools: claw-devlog, claw-todo, claw-git
```

## Legend

| Icon | Meaning |
|------|---------|
| 🔥 | Heavy usage (10+ calls) |
| 🟢 | Normal usage (1-9 calls) |
| ❌ | Never used (0 calls) |

## Use Cases

1. **Audit your portfolio**: Which tools actually get used?
2. **Prioritize improvements**: Fix high-usage tools first
3. **Identify dead weight**: Remove tools nobody uses
4. **Track adoption**: Are new tools getting picked up?

## JSON Output

```bash
# Find unused tools
claw-usage --json | jq '.unused[]'

# Get top 5 most used
claw-usage --json | jq '.used[:5]'
```

## License

MIT

## Author

Julian Thorne — [github.com/julianthorne2jz](https://github.com/julianthorne2jz)
