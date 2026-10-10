import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('feedback is visible only to administrators and does not inflate playback failures', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), '5k-feedback-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATA_FILE = path.join(directory, 'db.json');
  process.env.MEDIA_DIR = path.join(directory, 'media');
  process.env.CHUNK_DIR = path.join(directory, 'chunks');
  process.env.JWT_SECRET = 'feedback-test-secret';
  process.env.ADMIN_INITIAL_PASSWORD = 'feedback-test-password';
  const { app } = await import('../dist/index.js');
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const response = await fetch(`${base}/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [{ eventName: 'content_feedback', installId: 'feedback-test-device', sessionId: 'feedback-test-session', videoId: 'demo-1', metadata: { reason: '无法播放', note: '加载后没有画面', title: 'Test video' } }] }) });
    assert.equal(response.status, 200);
    assert.equal((await fetch(`${base}/admin/analytics?days=7`)).status, 401);
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'admin', password: 'feedback-test-password' }) });
    const token = (await login.json()).data.token;
    const report = await (await fetch(`${base}/admin/analytics?days=7`, { headers: { Authorization: `Bearer ${token}` } })).json();
    assert.equal(report.data.userFeedback.length, 1);
    assert.equal(report.data.userFeedback[0].reason, '无法播放');
    assert.equal(report.data.userFeedback[0].videoId, 'demo-1');
    assert.equal(report.data.quality.playbackErrors, 0);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('5k-feedback-test-'));
    await rm(resolved, { recursive: true, force: true });
  }
});
