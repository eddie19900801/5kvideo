import fs from 'node:fs';
import path from 'node:path';

const dataDirectory = path.resolve(process.env.DATA_DIRECTORY || './server/data');
const ids = new Set(process.argv.slice(2).map(String).filter(Boolean));
if (!ids.size) throw new Error('Provide at least one public collected-video id');

const catalogFile = path.join(dataDirectory, 'collected-catalog.json');
const taxonomyFile = path.join(dataDirectory, 'collected-taxonomy.json');
const unavailableFile = path.join(dataDirectory, 'collected-unavailable.json');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const videos = Array.isArray(catalog.videos) ? catalog.videos : [];
const publicId = video => video.externalSource?.sourceKey === 'hsckm3u8'
  ? String(video.externalSource?.remoteId || video.id)
  : `${video.externalSource?.sourceKey || 'external'}~${video.externalSource?.remoteId || video.id}`;
const removed = videos.filter(video => ids.has(publicId(video)));
if (!removed.length) throw new Error('No matching collected videos found');

fs.writeFileSync(`${catalogFile}.broken-${stamp}.bak.json`, JSON.stringify({ videos: removed }, null, 2));
const temporary = `${catalogFile}.${process.pid}.tmp`;
fs.writeFileSync(temporary, JSON.stringify({ ...catalog, videos: videos.filter(video => !ids.has(publicId(video))) }, null, 2));
fs.renameSync(temporary, catalogFile);

if (fs.existsSync(taxonomyFile)) {
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyFile, 'utf8'));
  for (const id of ids) delete taxonomy.assignments?.[id];
  const taxonomyTemporary = `${taxonomyFile}.${process.pid}.tmp`;
  fs.writeFileSync(taxonomyTemporary, JSON.stringify(taxonomy));
  fs.renameSync(taxonomyTemporary, taxonomyFile);
}

let unavailable = { ids: [] };
try { unavailable = JSON.parse(fs.readFileSync(unavailableFile, 'utf8')); } catch { /* first entry */ }
unavailable.ids = [...new Set([...(unavailable.ids || []).map(String), ...ids])];
fs.writeFileSync(unavailableFile, JSON.stringify(unavailable, null, 2));

console.log(JSON.stringify({ removed: removed.map(publicId), remaining: videos.length - removed.length }));
