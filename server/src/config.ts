import path from 'node:path';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
  throw new Error('生产环境必须配置 JWT_SECRET');
}

export const config = Object.freeze({
  port: Number(process.env.PORT || 4000),
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 1),
  webOrigins: (process.env.WEB_ORIGINS || 'http://localhost:3000,http://localhost:5174')
    .split(',').map(value => value.trim()).filter(Boolean),
  mediaDir: path.resolve(process.env.MEDIA_DIR || './data/media'),
  chunkDir: path.resolve(process.env.CHUNK_DIR || './data/chunks'),
  playbackSecret: process.env.PLAYBACK_SECRET || process.env.JWT_SECRET || 'dev-playback-secret',
  r2UploadSecret: process.env.R2_UPLOAD_SECRET || '',
  r2WorkerOrigin: (process.env.R2_WORKER_ORIGIN || 'https://media.5k.ag').replace(/\/$/, ''),
  r2Bucket: process.env.R2_BUCKET || '5kag',
  coverEncryptionSecret: process.env.COVER_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-cover-encryption-secret',
});
