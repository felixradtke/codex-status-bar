const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reduce } = require('../hooks/core');
const payload = { session_id: 's', turn_id: 't', cwd: '/project' };
const step = (s, event, p = {}, ts = 100) => reduce(s, event, { ...payload, ...p }, ts);
test('complete, interrupted and failed are distinct; silence never causes completion', () => {
  const running = step({}, 'prompt');
  const done = step(running, 'stop', {}, 200); assert.equal(done.state, 'done'); assert.equal(done.completedDuration, 100);
  assert.equal(step(running, 'interrupt').state, 'interrupted');
  assert.equal(step(running, 'error').state, 'error');
  assert.equal(step(running, 'pre', { tool_name: 'exec_command' }, 100000).state, 'tool');
});
test('parallel tools retain working state until the last result; approval has priority', () => {
  let s = step({}, 'prompt');
  s = step(s, 'pre', { tool_name: 'exec_command', tool_use_id: 'a' });
  s = step(s, 'pre', { tool_name: 'apply_patch', tool_use_id: 'b' });
  s = step(s, 'permission', { tool_name: 'exec_command', tool_use_id: 'a' });
  s = step(s, 'post', { tool_name: 'apply_patch', tool_use_id: 'b' }); assert.equal(s.state, 'permission');
  s = step(s, 'post', { tool_name: 'exec_command', tool_use_id: 'a' }); assert.equal(s.state, 'thinking');
});
test('steering same turn and approval waits preserve the timer', () => {
  let s = step({}, 'prompt', {}, 100);
  s = step(s, 'permission', { tool_name: 'exec_command' }, 150); assert.equal(s.startedAt, 100);
  s = step(s, 'prompt', {}, 160); assert.equal(s.startedAt, 100);
  s = step(s, 'stop', {}, 200); assert.equal(s.completedDuration, 100);
  assert.equal(step(s, 'stop', {}, 300).completedAt, 200);
});
test('old turn completion cannot finish a newer turn', () => {
  const s = step({}, 'prompt', { turn_id: 'new' });
  assert.equal(step(s, 'stop', { turn_id: 'old' }), null);
});
test('input requests and compaction are visible, and reset on completion', () => {
  let s = step({}, 'prompt'); s = step(s, 'pre', { tool_name: 'request_user_input', tool_use_id: 'a' });
  assert.equal(s.state, 'waiting'); s = step(s, 'post', { tool_use_id: 'a' }); assert.equal(s.state, 'thinking');
  s = step(s, 'compact'); assert.equal(s.state, 'compacting');
  s = step(s, 'compacted'); assert.equal(s.state, 'thinking');
});
test('invalid/missing identity cannot overwrite another session and no content is retained', () => {
  assert.equal(reduce({}, 'prompt', {}), null);
  const s = step({}, 'pre', { tool_name: 'apply_patch', prompt: 'secret', tool_input: { secret: 'data' }, last_assistant_message: 'secret' });
  assert.ok(!JSON.stringify(s).includes('secret'));
});
test('late tool results after completion cannot revive the task', () => {
  const done = step(step({}, 'prompt'), 'stop');
  assert.equal(step(done, 'post', { tool_use_id: 'late' }), null);
});
