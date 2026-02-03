---
name: claw-usage
description: Analyze claw-* tool usage from AI transcripts - find which tools are used vs unused.
homepage: https://github.com/julianthorne2jz/claw-usage
---

# claw-usage

Track usage of your claw-* skills from AI session transcripts.

## Quick Start

```bash
# Last 24 hours (default)
claw-usage

# Last 7 days
claw-usage --days=7

# JSON output
claw-usage --json
```

## What it shows

- Which skills you use heavily (🔥)
- Which skills are unused (❌)
- Usage counts and percentages

## Flags

- `--days=N` — Analyze last N days (default: 1)
- `--date=YYYY-MM-DD` — Specific date
- `--human, -H — Human-readable output (default: JSON)
- `-v` — Verbose (show commands)

## Use Cases

- Audit your portfolio
- Prioritize improvements (fix high-usage tools first)  
- Find dead weight (remove unused tools)
