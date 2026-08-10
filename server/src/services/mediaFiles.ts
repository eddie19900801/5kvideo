import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

export function datedMediaFile(originalName: string, fallbackExt: string) {
  const now = new Date();
  const year = String(now.getFullYear()), month = String(now.getMonth() + 1).padStart(2, '0'), day = String(now.getDate()).padStart(2, '0');
  const clock = `${year}${month}${day}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const candidate = path.extname(originalName).toLowerCase();
  const ext = /^\.[a-z0-9]{1,8}$/.test(candidate) ? candidate : fallbackExt;
  const relative = path.posix.join(year, month, day, `${clock}-${randomUUID().slice(0, 8)}${ext}`);
  const absolute = path.join(config.mediaDir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  return { relative, absolute };
}

