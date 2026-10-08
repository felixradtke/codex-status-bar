#!/usr/bin/env node
// Desktop fallback: incrementally read local lifecycle metadata. No network or content storage.
const fs = require('node:fs');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');
const { root, codexHome, statePath, readJSON, writeAtomic, withLock, reduce, active } = require('./core');
const sessionsRoot = process.env.CODEX_STATUSBAR_SESSIONS_ROOT || path.join(codexHome, 'sessions');
const tracked = new Map();
let titleMtime = 0, titles = new Map();
function loadTitles() {
  try {
    const file = path.join(codexHome, 'session_index.jsonl');
    const stat = fs.statSync(file); if (stat.mtimeMs === titleMtime || stat.size > 16 * 1024 * 1024) return;
    const next = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      try { const row = JSON.parse(line); if (row.id && row.thread_name) next.set(row.id, String(row.thread_name).slice(0, 300)); } catch {}
    }
    titles = next; titleMtime = stat.mtimeMs;
  } catch {}
}
const parent = Number(process.argv[process.argv.indexOf('--parent') + 1]) || 0;
const startTime = Date.now() / 1000;
function applyRecord(r, c) {
  const p = r.payload || {}, ts = Date.parse(r.timestamp) / 1000;
  if (!Number.isFinite(ts)) return false;
  if (r.type === 'session_meta') {
    c.desktop = /Codex Desktop|ChatGPT Desktop/.test(p.originator || '') && typeof p.source !== 'object';
    c.id = p.id || p.session_id; c.cwd = p.cwd || ''; return false;
  }
  if (!c.desktop || !c.id) return false;
  if (r.type === 'turn_context') { c.turnId = p.turn_id || c.turnId; c.cwd = p.cwd || c.cwd; return false; }
  let event, input = {};
  if (r.type === 'event_msg') {
    event = ({ task_started: 'prompt', task_complete: 'stop', turn_aborted: 'interrupt', task_cancelled: 'interrupt',
      context_compaction_started: 'compact', context_compaction_finished: 'compacted' })[p.type];
    if (p.type === 'task_started') c.turnId = p.turn_id || c.turnId;
    input.turn_id = p.turn_id || c.turnId;
  } else if (r.type === 'response_item') {
    if (['function_call', 'custom_tool_call'].includes(p.type)) {
      event = 'pre'; input.tool_name = p.name; input.tool_call_id = p.call_id;
    } else if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) {
      event = 'post'; input.tool_call_id = p.call_id;
    }
  }
  if (!event) return false;
  const next = reduce(c.state, event, { session_id: c.id, cwd: c.cwd, transcript_path: c.file, turn_id: c.turnId, ...input }, ts);
  if (!next) return false;
  c.state = { ...next, entrypoint: 'codex-app', pid: 0, source: 'monitor' };
  return true;
}
function readRecords(buffer, c, initial = false) {
  c.decoder ||= new StringDecoder('utf8');
  let text = (c.partial || '') + c.decoder.write(buffer);
  const end = text.lastIndexOf('\n');
  if (end < 0) { c.partial = text.length < 8 * 1024 * 1024 ? text : ''; return false; }
  c.partial = text.slice(end + 1);
  let changed = false;
  for (const line of text.slice(0, end).split('\n')) {
    try { changed = applyRecord(JSON.parse(line), c) || changed; } catch {}
  }
  return changed;
}
function processFile(file) {
  let stat; try { stat = fs.statSync(file); } catch { tracked.delete(file); return; }
  let c = tracked.get(file), changed = false;
  if (!c || stat.size < c.offset) {
    c = { file, offset: 0, partial: '', state: null, turnId: '' };
    const fd = fs.openSync(file, 'r');
    try {
      const head = Buffer.alloc(Math.min(stat.size, 65536)); fs.readSync(fd, head, 0, head.length, 0);
      try { applyRecord(JSON.parse(head.toString('utf8').split('\n')[0]), c); } catch {}
      c.offset = Math.max(0, stat.size - 2 * 1024 * 1024);
      if (c.offset > 0) {
        const b = Buffer.alloc(stat.size - c.offset); fs.readSync(fd, b, 0, b.length, c.offset);
        const nl = b.indexOf(10); if (nl >= 0) changed = readRecords(b.subarray(nl + 1), c, true);
        c.offset = stat.size;
      }
    } finally { fs.closeSync(fd); }
    tracked.set(file, c);
  }
  if (stat.size > c.offset) {
    const fd = fs.openSync(file, 'r');
    try {
      while (c.offset < stat.size) {
        const b = Buffer.alloc(Math.min(256 * 1024, stat.size - c.offset));
        const count = fs.readSync(fd, b, 0, b.length, c.offset); if (!count) break;
        changed = readRecords(b.subarray(0, count), c) || changed; c.offset += count;
      }
    } finally { fs.closeSync(fd); }
  }
  if (c.state && titles.has(c.id) && c.state.chatTitle !== titles.get(c.id)) {
    c.state.chatTitle = titles.get(c.id); changed = true;
  }
  if (!changed || !c.state) return;
  // Old incomplete rollouts are not proof a task is still running. Wait for fresh activity.
  if (active(c.state.state) && c.state.ts < startTime - 5) return;
  if (!active(c.state.state) && c.state.ts < startTime - 900) return;
  const fileOut = statePath(c.id);
  withLock(fileOut, () => {
    const previous = readJSON(fileOut);
    // Hooks know approval/input states that transcripts may omit. For that turn they win.
    if (previous.source === 'hooks' && previous.turnId === c.state.turnId) return;
    if ((previous.ts || 0) > c.state.ts) return;
    writeAtomic(fileOut, c.state);
  });
}
function discover(dir = sessionsRoot) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) discover(file);
    else if (e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) {
      try { if (Date.now() - fs.statSync(file).mtimeMs < 8 * 3600 * 1000) processFile(file); } catch {}
    }
  }
}
function scan() {
  loadTitles();
  if (parent) { try { process.kill(parent, 0); } catch { process.exit(0); } }
  for (const file of tracked.keys()) { try { processFile(file); } catch {} }
}
if (require.main === module) {
  loadTitles(); discover();
  if (!process.argv.includes('--once')) {
    try { fs.watch(sessionsRoot, { recursive: true }, (_, file) => {
      if (file && String(file).endsWith('.jsonl')) { try { processFile(path.join(sessionsRoot, String(file))); } catch {} }
    }); } catch {}
    setInterval(scan, 1000);
    setInterval(() => discover(), 60000);
  }
}
module.exports = { applyRecord, readRecords, processFile, discover };
