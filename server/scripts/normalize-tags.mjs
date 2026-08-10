import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const dbFile = process.argv[2] || './data/db.json';
const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${dbFile}.before-tag-normalize-${stamp}`;
fs.copyFileSync(dbFile, backup);

const split = (value) => String(value ?? '')
  .replace(/^\s*\[|\]\s*$/g, '')
  .split(/[,，、;；\r\n]+/u)
  .map((tag) => tag.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim())
  .filter(Boolean);

const unique = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

let videoChanges = 0;
for (const video of db.videos ?? []) {
  const before = JSON.stringify(video.tags ?? []);
  video.tags = unique((video.tags ?? []).flatMap(split));
  if (JSON.stringify(video.tags) !== before) videoChanges++;
}

const now = new Date().toISOString();
const catalog = new Map();
for (const item of db.tags ?? []) {
  for (const name of split(item.name)) {
    const key = name.toLocaleLowerCase();
    if (!catalog.has(key)) catalog.set(key, { ...item, name });
  }
}
for (const video of db.videos ?? []) {
  for (const name of video.tags) {
    const key = name.toLocaleLowerCase();
    if (!catalog.has(key)) catalog.set(key, { id: randomUUID(), name, createdAt: now });
  }
}
const oldCatalogCount = (db.tags ?? []).length;
db.tags = [...catalog.values()];
fs.writeFileSync(dbFile, `${JSON.stringify(db, null, 2)}\n`);
console.log(JSON.stringify({ backup, oldCatalogCount, newCatalogCount: db.tags.length, videoChanges }));
