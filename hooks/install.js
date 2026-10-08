#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { root, codexHome, writeAtomic } = require('./core');
const settingsPath = path.join(codexHome, 'hooks.json');
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const events = { SessionStart: 'start', SessionEnd: 'end', UserPromptSubmit: 'prompt', PreToolUse: 'pre',
  PostToolUse: 'post', PermissionRequest: 'permission', SubagentStart: 'agent-start', SubagentStop: 'agent-stop',
  PreCompact: 'compact', PostCompact: 'compacted', Stop: 'stop', Interrupt: 'interrupt' };
// Parse and validate before touching an existing configuration or runtime.
let config = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
if (!config || Array.isArray(config) || typeof config !== 'object') throw new Error('hooks.json must be an object');
if (config.hooks && (typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error('hooks must be an object');
config.hooks ||= {};
for (const entries of Object.values(config.hooks)) if (!Array.isArray(entries)) throw new Error('Hook events must be arrays');
if (fs.existsSync(settingsPath) && !fs.existsSync(settingsPath + '.bak-codex-status-bar'))
  fs.copyFileSync(settingsPath, settingsPath + '.bak-codex-status-bar', fs.constants.COPYFILE_EXCL);
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
for (const script of ['core.js', 'update.js', 'lifecycle.js', 'monitor.js', 'uninstall.js']) {
  const dest = path.join(root, script), src = path.join(__dirname, script);
  if (src !== dest) fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o600);
}
// A stable shell wrapper resolves Homebrew/Volta/asdf Node on every event. A last-known
// executable covers nvm/fnm installs without making that versioned path the first choice.
const runtime = '#!/bin/sh\nPATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.asdf/shims${PATH:+:$PATH}"\n' +
  'export PATH\nif command -v node >/dev/null 2>&1; then exec node "$@"; fi\n' +
  'exec ' + quote(process.execPath) + ' "$@"\n';
fs.writeFileSync(path.join(root, 'node.sh'), runtime, { mode: 0o700 });
const dest = path.join(root, 'update.js');
const prefix = quote(path.join(root, 'node.sh')) + ' ' + quote(dest) + ' ';
for (const [event, arg] of Object.entries(events)) {
  const entries = (config.hooks[event] || []).map(e => ({ ...e, hooks: (e.hooks || []).filter(h => !String(h.command || '').startsWith(prefix)) })).filter(e => e.hooks.length);
  entries.push({ hooks: [{ type: 'command', command: prefix + arg, timeout: 5 }] });
  config.hooks[event] = entries;
}
writeAtomic(settingsPath, config);
console.log('Installed Codex Status Bar hooks. Review and trust them in Codex /hooks, then start a new turn.');
