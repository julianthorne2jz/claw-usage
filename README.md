# claw-usage

Analyze AI transcript tool usage to find which tools are used vs unused — save tokens by removing bloat.

## Why

Every tool in your system prompt costs tokens. If you never use a tool, it's wasting context window. This tool parses OpenClaw session transcripts and counts tool calls to show:

- Which tools you use heavily (core tools)
- Which tools you rarely/never use (candidates for removal)
- Usage patterns over time

## Install

```bash
git clone https://github.com/julianthorne2jz/claw-usage
cd claw-usage
npm link
```

## Usage

```bash
# Analyze all sessions
claw-usage

# Today only
claw-usage --date=today

# Yesterday
claw-usage --date=yesterday

# Last 7 days
claw-usage --days=7

# Specific date
claw-usage --date=2026-02-02

# JSON output (for automation)
claw-usage --json

# Verbose (per-session breakdown)
claw-usage --date=today -v
```

## Output

```
📊 Tool Usage Analysis

Sessions analyzed: 106
Total tool calls: 3025
Unique tools: 15

────────────────────────────────────────────────────────────
Tool                    Calls   Sessions        %
────────────────────────────────────────────────────────────
🔥 exec                   1120         79    37.0%
🔥 read                    519        101    17.2%
🔥 browser                 377         34    12.5%
🟢 write                   184         45     6.1%
🔵 web_search               19         17     0.6%
⚪ nodes                     1          1     0.0%
────────────────────────────────────────────────────────────

⚠️  Low usage (consider removing to save tokens):
   • nodes (1 call)

🔥 Heavy usage (core tools):
   • exec (1120 calls, 37.0%)
   • read (519 calls, 17.2%)
```

## Legend

| Icon | Meaning |
|------|---------|
| 🔥 | Heavy usage (>15% of calls) |
| 🟢 | Normal usage (1-15%) |
| 🔵 | Low usage (<1%) |
| ⚪ | Rarely used (1-2 calls total) |

## Use Cases

1. **Token optimization**: Remove tools you never use from system prompts
2. **Identify core tools**: See which tools are essential
3. **Track habits**: Understand your usage patterns over time
4. **Audit**: Check which capabilities you're actually leveraging

## JSON Output

```bash
claw-usage --date=today --json | jq '.tools[] | select(.calls < 3)'
```

Returns tools with fewer than 3 calls — prime candidates for removal.

## License

MIT

## Author

Julian Thorne — [github.com/julianthorne2jz](https://github.com/julianthorne2jz)
