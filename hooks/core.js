// Codex lifecycle reducer. Only status metadata is retained; no prompts, outputs or tool arguments.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const codexHome = process.env.CODEX_STATUSBAR_CONFIG_ROOT || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const root = process.env.CODEX_STATUSBAR_ROOT || path.join(codexHome, 'codex-status-bar');
const stateDir = path.join(root, 'state.d');
const safeId = value => crypto.createHash('sha256').update(String(value)).digest('hex');
function statePath(id) { return path.join(stateDir, safeId(id) + '.json'); }
function readJSON(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(value) + '\n', { mode: 0o600 }); fs.renameSync(tmp, file); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}
function withLock(file, fn) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const lock = file + '.lock';
  for (let i = 0; i < 200; i++) {
    try { fs.mkdirSync(lock); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Recover only a genuinely stale lock, never steal a live slow writer's lock.
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 30000) fs.rmdirSync(lock); } catch {}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10); continue;
    }
    try { return fn(); } finally { fs.rmdirSync(lock); }
  }
  throw new Error('Status writer busy');
}
const labels = {
  Bash: 'Running command', shell: 'Running command', shell_command: 'Running command', exec: 'Using tools',
  exec_command: 'Running command', write_stdin: 'Running command', apply_patch: 'Editing',
  Read: 'Reading', read_file: 'Reading', Grep: 'Searching', Glob: 'Searching',
  web__run: 'Browsing web', web_search: 'Searching web', view_image: 'Viewing image',
  request_user_input: 'Needs input', request_user_input_async: 'Needs input',
  spawn_agent: 'Delegating', wait_agent: 'Waiting for agents', wait: 'Waiting for tools',
};
function toolLabel(name) {
  const short = String(name || '').replace(/^functions\./, '');
  if (short.startsWith('mcp__')) return 'Using ' + short.slice(5).split('__')[0];
  return labels[short] || 'Using tool';
}
const active = s => ['thinking', 'tool', 'permission', 'waiting', 'compacting'].includes(s);
function reduce(previous, event, p, ts = Date.now() / 1000) {
  if (!p.session_id) return null;
  const prior = previous || {};
  if (['done', 'interrupted', 'error'].includes(prior.state) && !['start', 'prompt', 'stop', 'interrupt'].includes(event)) return null;
  // A delayed tool or stop from the previous turn must not complete a newer turn.
  if (!['start', 'prompt'].includes(event) && p.turn_id && prior.turnId && p.turn_id !== prior.turnId) return null;
  const s = { ...prior, sessionId: String(p.session_id), cwd: p.cwd || prior.cwd || '',
    transcript: p.transcript_path || prior.transcript || '', turnId: p.turn_id || prior.turnId || '',
    project: p.cwd ? path.basename(p.cwd) : prior.project || '',
    state: prior.state || 'idle', label: prior.label || '', started: prior.started || false,
    startedAt: prior.startedAt || 0, ts, activeTools: { ...prior.activeTools }, activeAgents: { ...prior.activeAgents },
    model: p.model || prior.model || '', lastEvent: event };
  function working() {
    const tools = Object.values(s.activeTools);
    const permission = tools.find(t => t.permission);
    const input = tools.find(t => /request_user_input/.test(t.name));
    const t = tools.at(-1);
    s.state = permission ? 'permission' : input ? 'waiting' : t ? 'tool' : 'thinking';
    s.label = permission ? 'Awaiting permission' : input ? 'Needs input' : t ? toolLabel(t.name) : 'Thinking…';
    s.tool = t?.name || '';
  }
  function clear() { s.activeTools = {}; s.activeAgents = {}; s.tool = ''; }
  switch (event) {
    case 'start':
      // Compact/resume during a running turn must not erase a live timer.
      if (active(prior.state) && p.source === 'compact') return s;
      clear(); s.state = 'idle'; s.label = ''; s.startedAt = 0; s.started = false; break;
    case 'prompt':
      if (!(p.turn_id && p.turn_id === prior.turnId && active(prior.state))) {
        clear(); s.startedAt = ts; s.completedAt = 0; s.completedDuration = 0;
      }
      s.state = 'thinking'; s.label = 'Thinking…'; s.started = true; break;
    case 'pre': case 'permission': {
      const name = String(p.tool_name || 'tool');
      const key = String(p.tool_use_id || p.tool_call_id || name);
      s.activeTools[key] = { name, permission: event === 'permission' };
      s.started = true; if (!s.startedAt) s.startedAt = ts; working(); break;
    }
    case 'post': {
      const key = String(p.tool_use_id || p.tool_call_id || p.tool_name || 'tool');
      delete s.activeTools[key]; s.started = true; working(); break;
    }
    case 'agent-start':
      s.activeAgents[String(p.agent_id || p.agent_type || 'agent')] = String(p.agent_type || 'agent');
      s.started = true; if (!s.startedAt) s.startedAt = ts; working(); break;
    case 'agent-stop':
      delete s.activeAgents[String(p.agent_id || p.agent_type || 'agent')]; working(); break;
    case 'compact': s.state = 'compacting'; s.label = 'Compacting context'; s.started = true; break;
    case 'compacted': working(); break;
    case 'interrupt': clear(); s.state = 'interrupted'; s.label = 'Interrupted'; s.startedAt = 0; break;
    case 'error': clear(); s.state = 'error'; s.label = 'Failed'; s.startedAt = 0; break;
    case 'stop':
      clear(); s.state = 'done'; s.label = 'Done';
      // Duplicate events don't generate another completion or change the measured duration.
      s.completedAt = prior.state === 'done' ? prior.completedAt : ts;
      s.completedDuration = prior.state === 'done' ? prior.completedDuration : s.startedAt ? Math.max(0, ts - s.startedAt) : 0;
      s.startedAt = 0; break;
    default: return null;
  }
  return s;
}
function owner() {
  let pid = process.ppid;
  for (let i = 0; i < 10 && pid > 1; i++) {
    const r = cp.spawnSync('/bin/ps', ['-p', String(pid), '-o', 'ppid=', '-o', 'comm='], { encoding: 'utf8' });
    const m = (r.stdout || '').trim().match(/^(\d+)\s+(.+)$/);
    if (!m) break;
    if (/codex(?:$|[ /-])/i.test(m[2])) return { pid, entrypoint: process.env.CODEX_ENTRYPOINT === 'cli' || process.env.TERM_PROGRAM ? 'cli' : 'codex-app' };
    pid = Number(m[1]);
  }
  return { pid: 0, entrypoint: process.env.TERM_PROGRAM ? 'cli' : 'codex-app' };
}
function apply(event, p) {
  if (!p.session_id) return;
  const file = statePath(p.session_id);
  withLock(file, () => {
    if (event === 'end') { try { fs.unlinkSync(file); } catch {} return; }
    const previous = readJSON(file);
    const next = reduce(previous, event, p);
    if (!next) return;
    const host = event !== 'start' && previous.pid ? { pid: previous.pid, entrypoint: previous.entrypoint } : owner();
    writeAtomic(file, { ...next, ...host, term_program: process.env.TERM_PROGRAM || previous.term_program || '', source: 'hooks' });
  });
}
function launch(event) {
  if (process.env.CODEX_STATUSBAR_NO_LAUNCH === '1') return;
  const marker = path.join(root, 'quit-intent');
  if (event === 'start') { try { fs.unlinkSync(marker); } catch {} }
  if (fs.existsSync(marker) || event === 'end') return;
  try {
    if (cp.spawnSync('/usr/bin/pgrep', ['-x', 'CodexStatusBar']).status !== 0)
      cp.spawn('/usr/bin/open', ['-g', '-b', 'com.felixradtke.codexstatusbar'], { detached: true, stdio: 'ignore' }).unref();
  } catch {}
}
module.exports = { root, codexHome, stateDir, statePath, safeId, readJSON, writeAtomic, withLock, reduce, apply, launch, toolLabel, active };
