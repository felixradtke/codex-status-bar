const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { safeId } = require('../hooks/core');
test('concurrent hook processes never lose parallel tool updates', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-concurrency-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, CODEX_STATUSBAR_ROOT: root, CODEX_STATUSBAR_NO_LAUNCH: '1' };
  const run = (event, extra = {}) => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.resolve(__dirname, '../hooks/update.js'), event], { env, stdio: ['pipe', 'ignore', 'pipe'] });
    p.on('error', reject); p.on('exit', code => code === 0 ? resolve() : reject(new Error('hook failed')));
    p.stdin.end(JSON.stringify({ session_id: 's', turn_id: 't', ...extra }));
  });
  await run('prompt');
  await Promise.all(Array.from({ length: 12 }, (_, i) => run('pre', { tool_name: 'exec_command', tool_use_id: String(i) })));
  const file = path.join(root, 'state.d', safeId('s') + '.json');
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(file)).activeTools).length, 12);
  await Promise.all(Array.from({ length: 11 }, (_, i) => run('post', { tool_use_id: String(i) })));
  assert.equal(JSON.parse(fs.readFileSync(file)).state, 'tool');
  await run('post', { tool_use_id: '11' }); assert.equal(JSON.parse(fs.readFileSync(file)).state, 'thinking');
});
