#!/usr/bin/env node

/**
 * claw-usage - Analyze usage of claw-* tools from AI transcripts
 * 
 * Parses OpenClaw session transcripts to find exec calls that invoke
 * claw-* tools. Helps identify which skills are used vs unused.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
const SKILLS_DIR = path.join(os.homedir(), '.openclaw', 'workspace', 'skills');

// Parse command line args
const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        flags[key] = val || true;
    } else if (arg.startsWith('-')) {
        flags[arg.slice(1)] = true;
    } else {
        positional.push(arg);
    }
}

function parseDate(str) {
    if (!str) return null;
    if (str === 'today') {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }
    if (str === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }
    return str;
}

// Get list of all claw-* tools
function getInstalledTools() {
    try {
        return fs.readdirSync(SKILLS_DIR)
            .filter(f => f.startsWith('claw-') && fs.statSync(path.join(SKILLS_DIR, f)).isDirectory());
    } catch {
        return [];
    }
}

// Extract claw-* tool invocations from exec commands
function extractToolCalls(line, installedTools) {
    const tools = [];
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'message' && obj.message?.content) {
            const content = obj.message.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    // Look for exec tool calls
                    if ((block.type === 'toolCall' || block.type === 'tool_use') && block.name === 'exec') {
                        const cmd = block.arguments?.command || '';
                        
                        // Match claw-* tool invocations
                        for (const tool of installedTools) {
                            // Match patterns like:
                            // - node .../claw-lint/index.js
                            // - claw-lint (if in PATH)
                            // - ./skills/claw-lint/...
                            // - cd claw-lint && node index.js
                            const patterns = [
                                new RegExp(`${tool}[\\/\\s]`, 'i'),
                                new RegExp(`skills/${tool}`, 'i'),
                                new RegExp(`\\b${tool}\\b`, 'i')
                            ];
                            
                            for (const pattern of patterns) {
                                if (pattern.test(cmd)) {
                                    tools.push({
                                        name: tool,
                                        command: cmd.slice(0, 100),
                                        timestamp: obj.timestamp
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        // Skip malformed lines
    }
    return tools;
}

function getSessionDate(filepath) {
    try {
        const firstLine = fs.readFileSync(filepath, 'utf8').split('\n')[0];
        const obj = JSON.parse(firstLine);
        if (obj.timestamp) {
            return obj.timestamp.split('T')[0];
        }
    } catch (e) {}
    return null;
}

async function analyze(options = {}) {
    const { date, days, json, verbose } = options;
    
    const installedTools = getInstalledTools();
    
    // Get all session files
    const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => path.join(SESSIONS_DIR, f));
    
    // Filter by date if specified
    let targetDates = [];
    if (date) {
        targetDates = [parseDate(date)];
    } else if (days) {
        const numDays = parseInt(days) || 1;
        for (let i = 0; i < numDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            targetDates.push(d.toISOString().split('T')[0]);
        }
    }
    
    const toolCounts = {};
    const toolExamples = {};
    let totalCalls = 0;
    let sessionsAnalyzed = 0;
    
    // Initialize all installed tools with 0
    for (const tool of installedTools) {
        toolCounts[tool] = 0;
        toolExamples[tool] = [];
    }
    
    for (const filepath of files) {
        const sessionDate = getSessionDate(filepath);
        
        if (targetDates.length > 0 && !targetDates.includes(sessionDate)) {
            continue;
        }
        
        sessionsAnalyzed++;
        
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            const calls = extractToolCalls(line, installedTools);
            for (const call of calls) {
                totalCalls++;
                toolCounts[call.name] = (toolCounts[call.name] || 0) + 1;
                
                if (!toolExamples[call.name]) toolExamples[call.name] = [];
                if (toolExamples[call.name].length < 3) {
                    toolExamples[call.name].push(call.command);
                }
            }
        }
    }
    
    // Sort by usage (used first, then unused)
    const used = Object.entries(toolCounts)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);
    
    const unused = Object.entries(toolCounts)
        .filter(([_, count]) => count === 0)
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    if (json) {
        const result = {
            summary: {
                totalCalls,
                toolsUsed: used.length,
                toolsUnused: unused.length,
                totalTools: installedTools.length,
                sessionsAnalyzed,
                dateRange: targetDates.length > 0 ? targetDates : 'all'
            },
            used: used.map(([name, count]) => ({
                name,
                calls: count,
                percentage: totalCalls > 0 ? ((count / totalCalls) * 100).toFixed(1) : '0'
            })),
            unused: unused.map(([name]) => name)
        };
        
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    
    // Human-readable output
    console.log('\n📊 claw-* Tool Usage Analysis\n');
    console.log(`Sessions analyzed: ${sessionsAnalyzed}`);
    console.log(`Total tool invocations: ${totalCalls}`);
    console.log(`Tools installed: ${installedTools.length}`);
    console.log(`Tools used: ${used.length} | Unused: ${unused.length}`);
    if (targetDates.length > 0) {
        console.log(`Date filter: ${targetDates.join(', ')}`);
    }
    
    if (used.length > 0) {
        console.log('\n' + '─'.repeat(50));
        console.log(`${'Tool'.padEnd(25)} ${'Calls'.padStart(8)} ${'%'.padStart(8)}`);
        console.log('─'.repeat(50));
        
        for (const [name, count] of used) {
            const pct = totalCalls > 0 ? ((count / totalCalls) * 100).toFixed(1) : '0';
            
            let prefix = '🟢';
            if (count >= 10) prefix = '🔥';
            else if (count <= 2) prefix = '🔵';
            
            console.log(`${prefix} ${name.padEnd(23)} ${String(count).padStart(8)} ${pct.padStart(7)}%`);
            
            if (verbose && toolExamples[name]?.length > 0) {
                console.log(`   └─ ${toolExamples[name][0].slice(0, 60)}...`);
            }
        }
        console.log('─'.repeat(50));
    }
    
    if (unused.length > 0) {
        console.log('\n⚠️  UNUSED TOOLS (0 invocations — consider removing):');
        for (const [name] of unused) {
            console.log(`   ❌ ${name}`);
        }
    }
    
    // Summary recommendation
    console.log('\n📋 Summary:');
    if (unused.length > 0) {
        console.log(`   • ${unused.length} tools have ZERO usage — review for removal`);
    }
    if (used.length > 0) {
        const top3 = used.slice(0, 3).map(([n]) => n).join(', ');
        console.log(`   • Top tools: ${top3}`);
    }
    
    console.log('');
}

function showHelp() {
    console.log(`claw-usage - Analyze claw-* tool usage from AI transcripts

Usage:
  claw-usage [options]

Options:
  --date=<YYYY-MM-DD|today|yesterday>  Filter by date
  --days=<n>                           Analyze last n days (default: 1)
  --json                               Output JSON
  --verbose, -v                        Show example commands
  -h, --help                           Show this help

Examples:
  claw-usage                           # Last 24 hours (default)
  claw-usage --days=7                  # Last 7 days
  claw-usage --days=999                # All time
  claw-usage --json                    # JSON for scripting

Purpose:
  Find which of your claw-* tools are actually used vs sitting idle.
  Remove unused tools to save tokens and reduce complexity.
`);
}

// Main
if (flags.h || flags.help) {
    showHelp();
} else {
    // Default to last 24 hours if no date/days specified
    const days = flags.days || (flags.date ? undefined : 1);
    analyze({
        date: flags.date,
        days: days,
        json: flags.json,
        verbose: flags.verbose || flags.v
    });
}
