#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { root, codexHome, writeAtomic } = require('./core');
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const file = path.join(codexHome, 'hooks.json');
if (fs.existsSync(file)) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const prefix = quote(path.join(root, 'node.sh')) + ' ' + quote(path.join(root, 'update.js')) + ' ';
  for (const [event, entries] of Object.entries(config.hooks || {})) {
    config.hooks[event] = entries.map(e => ({ ...e, hooks: (e.hooks || []).filter(h => !String(h.command || '').startsWith(prefix)) })).filter(e => e.hooks.length);
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  writeAtomic(file, config);
}
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(root, 'quit-intent'), '');
console.log('Removed only this app’s hooks. Quit Codex Status Bar and delete the app to finish uninstalling.');
