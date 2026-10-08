const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex $`\"' test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = path.join(dir, 'config'), root = path.join(dir, 'status');
  fs.mkdirSync(config);
  const env = { ...process.env, CODEX_STATUSBAR_CONFIG_ROOT: config, CODEX_STATUSBAR_ROOT: root, CODEX_STATUSBAR_NO_LAUNCH: '1' };
  const run = script => execFileSync(process.execPath, [path.resolve(__dirname, '../hooks/' + script)], { env, stdio: 'pipe' });
  const file = path.join(config, 'hooks.json');
  const read = () => JSON.parse(fs.readFileSync(file));
  return { dir, config, root, env, run, file, read };
}
test('install and uninstall preserve unrelated hooks/settings and back up once', t => {
  const f = fixture(t);
  const original = { custom: true, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo keep' }, { type: 'prompt', prompt: 'keep too' }] }] } };
  fs.writeFileSync(f.file, JSON.stringify(original));
  f.run('install.js'); const first = f.read(); f.run('install.js'); assert.deepEqual(f.read(), first);
  assert.equal(Object.keys(first.hooks).length, 12);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file + '.bak-codex-status-bar')), original);
  f.run('uninstall.js'); assert.deepEqual(f.read(), original);
});
test('quoted paths execute correctly, including shell metacharacters', t => {
  const f = fixture(t); f.run('install.js');
  const command = f.read().hooks.UserPromptSubmit[0].hooks[0].command;
  execFileSync('/bin/sh', ['-c', command], { env: f.env, input: JSON.stringify({ session_id: '../../unsafe/id', turn_id: 't', cwd: '/test' }) });
  const files = fs.readdirSync(path.join(f.root, 'state.d')).filter(x => x.endsWith('.json'));
  assert.equal(files.length, 1); assert.match(files[0], /^[a-f0-9]{64}\.json$/);
  const state = JSON.parse(fs.readFileSync(path.join(f.root, 'state.d', files[0])));
  assert.equal(state.state, 'thinking'); assert.equal(state.sessionId, '../../unsafe/id');
  assert.ok(!(command.includes('/Cellar/')));
});
test('malformed config is left untouched', t => {
  const f = fixture(t); fs.writeFileSync(f.file, '{broken');
  assert.throws(() => f.run('install.js')); assert.equal(fs.readFileSync(f.file, 'utf8'), '{broken');
  assert.equal(fs.existsSync(f.root), false);
});
test('runtime wrapper never searches current directory with empty inherited PATH', t => {
  const f = fixture(t); f.run('install.js');
  const wrapper = fs.readFileSync(path.join(f.root, 'node.sh'), 'utf8');
  assert.ok(wrapper.includes('${PATH:+:$PATH}'));
  fs.writeFileSync(path.join(f.dir, 'node'), '#!/bin/sh\ntouch SHOULD_NOT_EXIST\n', { mode: 0o755 });
  const command = f.read().hooks.Stop[0].hooks[0].command;
  execFileSync('/bin/sh', ['-c', command], { cwd: f.dir, env: { ...f.env, PATH: '' }, input: JSON.stringify({ session_id: 'test' }) });
  assert.equal(fs.existsSync(path.join(f.dir, 'SHOULD_NOT_EXIST')), false);
});
