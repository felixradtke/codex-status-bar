const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyRecord, readRecords } = require('../hooks/monitor');
const record = (type, payload, time = 100000) => ({ type, payload, timestamp: new Date(time).toISOString() });
function context() {
  const c = { file: '/rollout.jsonl', partial: '' };
  applyRecord(record('session_meta', { id: 's', originator: 'Codex Desktop', cwd: '/p' }), c); return c;
}
test('desktop task and tool lifecycle handles both Codex tool formats', () => {
  const c = context();
  applyRecord(record('event_msg', { type: 'task_started', turn_id: 't' }), c);
  for (const type of ['custom_tool_call', 'function_call']) {
    applyRecord(record('response_item', { type, name: 'exec_command', call_id: 'a' }), c); assert.equal(c.state.state, 'tool');
    applyRecord(record('response_item', { type: type + '_output', call_id: 'a' }), c); assert.equal(c.state.state, 'thinking');
  }
  applyRecord(record('event_msg', { type: 'task_complete', turn_id: 't' }, 110000), c);
  assert.equal(c.state.state, 'done'); assert.equal(c.state.completedDuration, 10);
});
test('a JSON record split across filesystem writes is not lost', () => {
  const c = context(); const line = JSON.stringify(record('event_msg', { type: 'task_started', turn_id: 't' })) + '\n';
  assert.equal(readRecords(Buffer.from(line.slice(0, 29)), c), false);
  assert.equal(readRecords(Buffer.from(line.slice(29)), c), true); assert.equal(c.state.state, 'thinking');
});
test('interrupts do not emit completion and tool outputs match the correct parallel call', () => {
  const c = context(); applyRecord(record('event_msg', { type: 'task_started', turn_id: 't' }), c);
  for (const id of ['a', 'b']) applyRecord(record('response_item', { type: 'function_call', name: 'apply_patch', call_id: id }), c);
  applyRecord(record('response_item', { type: 'function_call_output', call_id: 'a' }), c); assert.equal(c.state.state, 'tool');
  applyRecord(record('event_msg', { type: 'turn_aborted' }), c); assert.equal(c.state.state, 'interrupted'); assert.equal(c.state.completedAt, 0);
});
test('does not monitor CLI as desktop or retain prompt/response content', () => {
  const c = { file: '/x' }; applyRecord(record('session_meta', { id: 's', originator: 'codex_cli_rs' }), c);
  assert.equal(applyRecord(record('event_msg', { type: 'task_started' }), c), false);
  const d = context(); applyRecord(record('response_item', { type: 'message', content: 'secret' }), d);
  assert.ok(!JSON.stringify(d).includes('secret'));
});
test('UTF-8 split across chunks preserves the record and tool name', () => {
  const c = context();
  const b = Buffer.from(JSON.stringify(record('response_item', { type: 'function_call', name: 'mcp__étude__read', call_id: 'a' })) + '\n');
  const split = b.indexOf(Buffer.from('é')) + 1;
  readRecords(b.subarray(0, split), c); readRecords(b.subarray(split), c);
  assert.equal(c.state.tool, 'mcp__étude__read');
});
test('desktop subagent rollouts do not become duplicate parent tasks', () => {
  const c = {};
  applyRecord(record('session_meta', { id: 'child', originator: 'Codex Desktop', source: { subagent: {} } }), c);
  assert.equal(applyRecord(record('event_msg', { type: 'task_started' }), c), false);
});
