#!/usr/bin/env node
const { apply, launch } = require('./core');
let raw = '';
process.stdin.setEncoding('utf8');
const timeout = setTimeout(() => process.exit(0), 4000);
process.stdin.on('data', chunk => { raw += chunk; if (raw.length > 16 * 1024 * 1024) process.exit(0); });
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try { const p = JSON.parse(raw); apply(process.argv[2], p); launch(process.argv[2]); }
  catch { /* Observational hooks must never interfere with the Codex turn. */ }
});
