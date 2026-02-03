#!/usr/bin/env node

/**
 * claw-usage - Analyze AI transcript tool usage
 * 
 * Parses OpenClaw session transcripts to count tool calls.
 * Helps identify which tools are used vs unused for optimization.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

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
    return str; // Assume YYYY-MM-DD format
}

function extractToolCalls(line) {
    const tools = [];
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'message' && obj.message?.content) {
            const content = obj.message.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === 'toolCall' || block.type === 'tool_use') {
                        tools.push({
                            name: block.name,
                            timestamp: obj.timestamp,
                            sessionId: obj.id
                        });
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
    const { date, days, json, verbose, sessions: showSessions } = options;
    
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
    const sessionCounts = {};
    let totalCalls = 0;
    let sessionsAnalyzed = 0;
    const sessionDetails = {};
    
    for (const filepath of files) {
        const sessionDate = getSessionDate(filepath);
        
        // Filter by date if specified
        if (targetDates.length > 0 && !targetDates.includes(sessionDate)) {
            continue;
        }
        
        sessionsAnalyzed++;
        const sessionId = path.basename(filepath, '.jsonl');
        sessionDetails[sessionId] = { date: sessionDate, tools: {} };
        
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            const calls = extractToolCalls(line);
            for (const call of calls) {
                totalCalls++;
                toolCounts[call.name] = (toolCounts[call.name] || 0) + 1;
                
                if (!sessionCounts[call.name]) {
                    sessionCounts[call.name] = new Set();
                }
                sessionCounts[call.name].add(sessionId);
                
                sessionDetails[sessionId].tools[call.name] = 
                    (sessionDetails[sessionId].tools[call.name] || 0) + 1;
            }
        }
    }
    
    // Sort by usage
    const sorted = Object.entries(toolCounts)
        .sort((a, b) => b[1] - a[1]);
    
    if (json) {
        const result = {
            summary: {
                totalCalls,
                uniqueTools: Object.keys(toolCounts).length,
                sessionsAnalyzed,
                dateRange: targetDates.length > 0 ? targetDates : 'all'
            },
            tools: sorted.map(([name, count]) => ({
                name,
                calls: count,
                sessions: sessionCounts[name]?.size || 0,
                percentage: ((count / totalCalls) * 100).toFixed(1)
            }))
        };
        
        if (showSessions) {
            result.sessions = sessionDetails;
        }
        
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    
    // Human-readable output
    console.log('\n📊 Tool Usage Analysis\n');
    console.log(`Sessions analyzed: ${sessionsAnalyzed}`);
    console.log(`Total tool calls: ${totalCalls}`);
    console.log(`Unique tools: ${Object.keys(toolCounts).length}`);
    if (targetDates.length > 0) {
        console.log(`Date filter: ${targetDates.join(', ')}`);
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log(`${'Tool'.padEnd(20)} ${'Calls'.padStart(8)} ${'Sessions'.padStart(10)} ${'%'.padStart(8)}`);
    console.log('─'.repeat(60));
    
    for (const [name, count] of sorted) {
        const pct = ((count / totalCalls) * 100).toFixed(1);
        const sessions = sessionCounts[name]?.size || 0;
        
        // Color coding based on usage
        let prefix = '';
        if (count === 1) prefix = '⚪'; // Rarely used
        else if (pct < 1) prefix = '🔵'; // Low usage
        else if (pct < 10) prefix = '🟢'; // Normal
        else prefix = '🔥'; // Heavy usage
        
        console.log(`${prefix} ${name.padEnd(18)} ${String(count).padStart(8)} ${String(sessions).padStart(10)} ${pct.padStart(7)}%`);
    }
    
    console.log('─'.repeat(60));
    
    // Recommendations
    const lowUsage = sorted.filter(([_, count]) => count <= 2);
    const highUsage = sorted.filter(([_, count]) => (count / totalCalls) > 0.15);
    
    if (lowUsage.length > 0) {
        console.log('\n⚠️  Low usage (consider removing to save tokens):');
        for (const [name, count] of lowUsage) {
            console.log(`   • ${name} (${count} call${count > 1 ? 's' : ''})`);
        }
    }
    
    if (highUsage.length > 0) {
        console.log('\n🔥 Heavy usage (core tools):');
        for (const [name, count] of highUsage) {
            console.log(`   • ${name} (${count} calls, ${((count / totalCalls) * 100).toFixed(1)}%)`);
        }
    }
    
    if (verbose) {
        console.log('\n📋 Per-session breakdown:');
        for (const [sessionId, data] of Object.entries(sessionDetails)) {
            const toolList = Object.entries(data.tools)
                .sort((a, b) => b[1] - a[1])
                .map(([t, c]) => `${t}:${c}`)
                .join(', ');
            if (toolList) {
                console.log(`   ${data.date} | ${sessionId.slice(0, 8)}... | ${toolList}`);
            }
        }
    }
    
    console.log('');
}

function showHelp() {
    console.log(`claw-usage - Analyze AI transcript tool usage

Usage:
  claw-usage [options]

Options:
  --date=<YYYY-MM-DD|today|yesterday>  Filter by date
  --days=<n>                           Analyze last n days
  --json                               Output JSON
  --verbose, -v                        Show per-session breakdown
  --sessions                           Include session details in JSON
  -h, --help                           Show this help

Examples:
  claw-usage                           # All sessions
  claw-usage --date=today              # Today only
  claw-usage --days=7                  # Last 7 days
  claw-usage --date=2026-02-02 --json  # Specific date, JSON output

Output:
  🔥 Heavy usage (>15%)
  🟢 Normal usage (1-15%)
  🔵 Low usage (<1%)
  ⚪ Rarely used (1-2 calls)
`);
}

// Main
if (flags.h || flags.help) {
    showHelp();
} else {
    analyze({
        date: flags.date,
        days: flags.days,
        json: flags.json,
        verbose: flags.verbose || flags.v,
        sessions: flags.sessions
    });
}
