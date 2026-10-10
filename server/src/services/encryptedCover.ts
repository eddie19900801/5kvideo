import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const MAGIC = Buffer.from('5KIM');
const MIME_CODES: Record<string, number> = { 'image/jpeg': 1, 'image/png': 2, 'image/webp': 3, 'image/gif': 4 };
const CODE_MIMES: Record<number, string> = { 1: 'image/jpeg', 2: 'image/png', 3: 'image/webp', 4: 'image/gif' };
const permanentKey = createHash('sha256').update(config.coverEncryptionSecret).digest();
const clientKey = createHash('sha256').update(`${config.coverEncryptionSecret}:5k-video-cover-client-v1`).digest();

function encryptWithKey(input: Buffer, mime: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([MIME_CODES[mime] || 1]), iv, cipher.getAuthTag(), encrypted]);
}

function decryptWithKey(input: Buffer, key: Buffer) {
  if (input.length < 33 || !input.subarray(0, 4).equals(MAGIC)) throw new Error('封面密文格式无效');
  const decipher = createDecipheriv('aes-256-gcm', key, input.subarray(5, 17));
  decipher.setAuthTag(input.subarray(17, 33));
  return { mime: CODE_MIMES[input[4]] || 'image/jpeg', data: Buffer.concat([decipher.update(input.subarray(33)), decipher.final()]) };
}

export const encryptCoverForStorage = (input: Buffer, mime: string) => encryptWithKey(input, mime, permanentKey);
export const reencryptCoverForBrowser = (input: Buffer) => {
  const decoded = decryptWithKey(input, permanentKey);
  return encryptWithKey(decoded.data, decoded.mime, clientKey);
};
export const browserCoverKey = () => clientKey.toString('base64');
export function encryptedR2ObjectKey(source: string) {
  const prefix = `r2enc://${config.r2Bucket}/`;
  if (!source.startsWith(prefix)) return null;
  const key = source.slice(prefix.length);
  return key && !key.includes('..') ? key : null;
}
