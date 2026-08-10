import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dataDir = '/app/data';
const mediaDir = path.join(dataDir, 'media');
const dbFile = path.join(dataDir, 'db.json');
const ffmpeg = '/app/node_modules/ffmpeg-static/ffmpeg';
const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
const backup = `${dbFile}.before-hls-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(dbFile, backup);

let migrated = 0;
for (const video of db.videos) {
  const url = new URL(video.playbackUrl);
  if (!url.pathname.startsWith('/media/') || !url.pathname.endsWith('.mp4')) continue;
  const relative = decodeURIComponent(url.pathname.slice('/media/'.length));
  const source = path.resolve(mediaDir, ...relative.split('/'));
  if (!source.startsWith(`${mediaDir}${path.sep}`) || !fs.existsSync(source)) continue;
  const directory = `${source.slice(0, -path.extname(source).length)}-hls`;
  const playlist = path.join(directory, 'index.m3u8');
  fs.mkdirSync(directory, { recursive: true });
  const result = spawnSync(ffmpeg, ['-y', '-i', source, '-c', 'copy', '-start_number', '0', '-hls_time', '4', '-hls_list_size', '0', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments', '-hls_segment_filename', path.join(directory, 'segment-%05d.ts'), playlist], { stdio: 'inherit' });
  if (result.status !== 0 || !fs.existsSync(playlist)) throw new Error(`HLS conversion failed: ${video.id}`);
  const hlsRelative = path.relative(mediaDir, playlist).split(path.sep).join('/');
  video.playbackUrl = `${url.origin}/media/${hlsRelative}`;
  migrated++;
}

fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
console.log(JSON.stringify({ migrated, backup }));
