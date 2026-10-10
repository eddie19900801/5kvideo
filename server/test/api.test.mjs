import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let origin;
let server;
let temporaryDirectory;

async function api(route, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), '5k-server-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATA_FILE = path.join(temporaryDirectory, 'db.json');
  process.env.JWT_SECRET = 'automated-test-secret';
  process.env.ADMIN_INITIAL_PASSWORD = 'automated-admin-password';
  process.env.MEDIA_DIR = path.join(temporaryDirectory, 'media');
  process.env.CHUNK_DIR = path.join(temporaryDirectory, 'chunks');
  const { app } = await import('../dist/index.js');
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

test('guest can bind, update profile and password, then log in again', async () => {
  const guest = await api('/api/v1/auth/guest', { method: 'POST' });
  assert.equal(guest.response.status, 200);
  const guestId = guest.payload.data.user.id;

  const registration = await api('/api/v1/auth/register', {
    method: 'POST', token: guest.payload.data.token,
    body: { account: 'test_user', password: 'old-password', username: '测试用户' },
  });
  assert.equal(registration.response.status, 200);
  assert.equal(registration.payload.data.user.id, guestId);

  const token = registration.payload.data.token;
  const profile = await api('/api/v1/me/profile', { method: 'PATCH', token, body: { username: '新昵称' } });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.payload.data.username, '新昵称');

  const password = await api('/api/v1/me/password', {
    method: 'PUT', token, body: { oldPassword: 'old-password', newPassword: 'new-password' },
  });
  assert.equal(password.response.status, 200);

  const login = await api('/api/v1/auth/login', { method: 'POST', body: { account: 'test_user', password: 'new-password' } });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.data.user.id, guestId);
});

test('favorites and history are isolated by content mode', async () => {
  const login = await api('/api/v1/auth/login', { method: 'POST', body: { account: 'test_user', password: 'new-password' } });
  const token = login.payload.data.token;

  assert.equal((await api('/api/v1/videos/demo-1/favorite', { method: 'PUT', token, body: { mode: 'adult' } })).response.status, 200);
  assert.equal((await api('/api/v1/videos/demo-1/progress', { method: 'PUT', token, body: { progress: 30, duration: 634, mode: 'adult' } })).response.status, 200);

  const normalFavorites = await api('/api/v1/me/favorites?mode=normal', { token });
  const adultFavorites = await api('/api/v1/me/favorites?mode=adult', { token });
  const normalHistory = await api('/api/v1/me/history?mode=normal', { token });
  const adultHistory = await api('/api/v1/me/history?mode=adult', { token });
  assert.equal(normalFavorites.payload.data.length, 0);
  assert.equal(adultFavorites.payload.data.length, 1);
  assert.equal(normalHistory.payload.data.length, 0);
  assert.equal(adultHistory.payload.data.length, 1);

  const view = await api('/api/v1/videos/demo-1/view', { method: 'POST', token });
  assert.equal(view.response.status, 200);
  assert.equal(view.payload.data.counted, true);

  assert.equal((await api('/api/v1/videos/demo-1/favorite?mode=adult', { method: 'DELETE', token })).response.status, 200);
  assert.equal((await api('/api/v1/videos/demo-1/progress?mode=adult', { method: 'DELETE', token })).response.status, 200);
  assert.equal((await api('/api/v1/me/favorites?mode=adult', { token })).payload.data.length, 0);
  assert.equal((await api('/api/v1/me/history?mode=adult', { token })).payload.data.length, 0);
});

test('admin video patch rejects unknown fields', async () => {
  const login = await api('/api/v1/auth/login', { method: 'POST', body: { account: 'admin', password: 'automated-admin-password' } });
  assert.equal(login.response.status, 200);
  const result = await api('/api/v1/admin/videos/demo-1', {
    method: 'PATCH', token: login.payload.data.token, body: { id: 'forged-id', unexpected: true },
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.payload.error.code, 'VALIDATION_ERROR');
});

test('admin video repository flow creates, updates and offlines videos', async () => {
  const login = await api('/api/v1/auth/login', {
    method: 'POST', body: { account: 'admin', password: 'automated-admin-password' },
  });
  const token = login.payload.data.token;
  const created = await api('/api/v1/admin/videos', {
    method: 'POST', token,
    body: {
      title: 'Repository 测试视频',
      description: '',
      thumbnail: 'https://example.com/cover.jpg',
      playbackUrl: 'https://example.com/video.m3u8',
      duration: 120.4,
      tags: ['Repository标签', 'Repository标签'],
      aspectRatio: 'landscape',
      isAdult: false,
      status: 'draft',
    },
  });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.payload.data.tags, ['Repository标签']);
  const id = created.payload.data.id;

  const updated = await api(`/api/v1/admin/videos/${id}`, {
    method: 'PATCH', token, body: { title: 'Repository 已更新', status: 'published' },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.id, id);
  assert.equal(updated.payload.data.title, 'Repository 已更新');

  const detail = await api(`/api/v1/videos/${id}`);
  assert.equal(detail.response.status, 200);
  assert.equal((await api(`/api/v1/admin/videos/${id}`, { method: 'DELETE', token })).response.status, 200);
  assert.equal((await api(`/api/v1/videos/${id}`)).response.status, 404);
  assert.equal((await api(`/api/v1/admin/videos/${id}/permanent`, { method: 'DELETE', token })).response.status, 200);
});

test('public video responses use signed playback URLs and reject unsigned streams', async () => {
  const list = await api('/api/v1/videos?adult=false');
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data.length, 1);
  assert.match(list.payload.data[0].playbackUrl, /\/api\/v1\/videos\/demo-1\/stream\.m3u8\?expires=/);

  const detail = await api('/api/v1/videos/demo-1');
  assert.equal(detail.response.status, 200);
  assert.match(detail.payload.data.playbackUrl, /signature=/);
  assert.match(detail.payload.data.playbackUrl, /viewer=/);
  assert.match(detail.payload.data.playbackUrl, /mode=normal/);

  const playbackCookie = detail.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(playbackCookie);
  const boundPlayback = await fetch(detail.payload.data.playbackUrl, { headers: { Cookie: playbackCookie } });
  assert.notEqual(boundPlayback.status, 403);
  const stolenPlayback = await fetch(detail.payload.data.playbackUrl);
  assert.equal(stolenPlayback.status, 403);
  const wrongModeUrl = new URL(detail.payload.data.playbackUrl);
  wrongModeUrl.searchParams.set('mode', 'adult');
  assert.equal((await fetch(wrongModeUrl, { headers: { Cookie: playbackCookie } })).status, 403);

  const unsigned = await api('/api/v1/videos/demo-1/stream.m3u8');
  assert.equal(unsigned.response.status, 403);
  assert.equal(unsigned.payload.error.code, 'PLAYBACK_FORBIDDEN');

  const playback = await api('/api/v1/videos/demo-1/playback');
  assert.equal(playback.response.status, 200);
  assert.equal(playback.payload.data.type, 'hls');
  assert.ok(new Date(playback.payload.data.expiresAt).getTime() > Date.now());
});

test('admin catalog and media routes preserve authorization and validation', async () => {
  assert.equal((await api('/api/v1/admin/videos')).response.status, 401);
  const login = await api('/api/v1/auth/login', { method: 'POST', body: { account: 'admin', password: 'automated-admin-password' } });
  const token = login.payload.data.token;

  const videos = await api('/api/v1/admin/videos', { token });
  assert.equal(videos.response.status, 200);
  assert.equal(videos.payload.data.length, 1);

  const created = await api('/api/v1/admin/tags', { method: 'POST', token, body: { name: '自动测试标签' } });
  assert.equal(created.response.status, 201);
  const duplicate = await api('/api/v1/admin/tags', { method: 'POST', token, body: { name: '自动测试标签' } });
  assert.equal(duplicate.response.status, 409);
  assert.equal((await api(`/api/v1/admin/tags/${created.payload.data.id}`, { method: 'DELETE', token })).response.status, 200);

  const missingCover = await api('/api/v1/admin/videos/demo-1/cover', { method: 'POST', token });
  assert.equal(missingCover.response.status, 400);
  assert.equal(missingCover.payload.error.code, 'COVER_REQUIRED');
});

test('admin upload tasks enforce configuration, ownership metadata and chunk bounds', async () => {
  assert.equal((await api('/api/v1/admin/videos/upload/init', {
    method: 'POST', body: { originalName: 'video.mp4', totalChunks: 1 },
  })).response.status, 401);

  const login = await api('/api/v1/auth/login', {
    method: 'POST', body: { account: 'admin', password: 'automated-admin-password' },
  });
  const token = login.payload.data.token;
  const r2 = await api('/api/v1/admin/r2/uploads/prepare', {
    method: 'POST', token, body: { taskId: crypto.randomUUID(), files: [] },
  });
  assert.equal(r2.response.status, 503);
  assert.equal(r2.payload.error.code, 'R2_NOT_CONFIGURED');

  const initialized = await api('/api/v1/admin/videos/upload/init', {
    method: 'POST', token, body: { originalName: 'video.mp4', totalChunks: 1 },
  });
  assert.equal(initialized.response.status, 200);
  const uploadId = initialized.payload.data.uploadId;
  const metadata = JSON.parse(await readFile(path.join(process.env.CHUNK_DIR, uploadId, 'meta.json'), 'utf8'));
  assert.equal(metadata.adminId, login.payload.data.user.id);
  assert.equal(metadata.totalChunks, 1);

  const form = new FormData();
  form.set('uploadId', uploadId);
  form.set('index', '1');
  form.set('chunk', new Blob(['invalid-index']), 'chunk.part');
  const invalidChunk = await fetch(`${origin}/api/v1/admin/videos/upload/chunk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(invalidChunk.status, 400);
  assert.equal((await invalidChunk.json()).error.code, 'INVALID_CHUNK');

  const jobs = await api('/api/v1/admin/media-jobs', { token });
  assert.equal(jobs.response.status, 200);
  assert.ok(Array.isArray(jobs.payload.data));
  assert.equal((await api(`/api/v1/admin/media-jobs/${crypto.randomUUID()}/retry`, { method: 'POST', token })).response.status, 404);
});

test('analytics ingestion validates events and admin reporting remains protected', async () => {
  assert.equal((await api('/api/v1/admin/analytics')).response.status, 401);
  const userLogin = await api('/api/v1/auth/login', {
    method: 'POST', body: { account: 'test_user', password: 'new-password' },
  });
  const invalid = await api('/api/v1/analytics/events', {
    method: 'POST', token: userLogin.payload.data.token,
    body: { events: [{ eventName: 'INVALID EVENT', installId: 'install-123', sessionId: 'session-123' }] },
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.payload.error.code, 'INVALID_ANALYTICS');

  const accepted = await api('/api/v1/analytics/events', {
    method: 'POST', token: userLogin.payload.data.token,
    body: { events: [{ eventName: 'video_play', installId: 'install-123', sessionId: 'session-123', videoId: 'demo-1' }] },
  });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.payload.data.accepted, 1);

  const adminLogin = await api('/api/v1/auth/login', {
    method: 'POST', body: { account: 'admin', password: 'automated-admin-password' },
  });
  const report = await api('/api/v1/admin/analytics?days=7', { token: adminLogin.payload.data.token });
  assert.equal(report.response.status, 200);
  assert.equal(report.payload.data.days, 7);
  assert.ok(report.payload.data.overview.plays >= 1);
});

test('public metadata routes expose normalized tag usage without authentication', async () => {
  const tags = await api('/api/v1/tags');
  assert.equal(tags.response.status, 200);
  assert.ok(tags.payload.data.some(tag => tag.name === '推荐' && tag.usageCount === 1));

  const chapterTags = await api('/api/v1/chapter-tags');
  assert.equal(chapterTags.response.status, 200);
  assert.ok(Array.isArray(chapterTags.payload.data));
});

test('playback URL issuance is rate limited', async () => {
  let limited = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    const response = await fetch(`${origin}/api/v1/videos/demo-1/playback`);
    if (response.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true);
});
