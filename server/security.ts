import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PANEL_PASSWORD, SESSION_SECRET, VERCEL_KV_TOKEN } from './config.js';

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadOrCreateKey(filename: string, bytes = 32): Buffer {
  ensureDataDir();
  const file = path.join(DATA_DIR, filename);
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8').trim();
    const value = Buffer.from(raw, 'hex');
    if (value.length >= bytes) return value.subarray(0, bytes);
    throw new Error(`Arquivo de chave inválido: ${filename}`);
  }
  const value = crypto.randomBytes(bytes);
  fs.writeFileSync(file, value.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  return value;
}

function getEncryptionSecret(): string {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  if (VERCEL_KV_TOKEN) return `vkv-${VERCEL_KV_TOKEN}`;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return `supa-${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (PANEL_PASSWORD) return `pwd-${PANEL_PASSWORD}`;
  return '';
}

function getSessionSecret(): string {
  if (SESSION_SECRET) return SESSION_SECRET;
  if (process.env.APP_SECRET) return `sess-${process.env.APP_SECRET}`;
  if (VERCEL_KV_TOKEN) return `sess-kv-${VERCEL_KV_TOKEN}`;
  if (PANEL_PASSWORD) return `sess-pwd-${PANEL_PASSWORD}`;
  return '';
}

const encSecret = getEncryptionSecret();
const encryptionKey = encSecret
  ? crypto.scryptSync(encSecret, 'hot-system-store-v1', 32)
  : loadOrCreateKey('.store-key');

const sessSecret = getSessionSecret();
const sessionBase = sessSecret
  ? crypto.createHash('sha256').update(sessSecret).digest()
  : loadOrCreateKey('.session-key');

const sessionKey = crypto
  .createHash('sha256')
  .update(Buffer.concat([sessionBase, Buffer.from(PANEL_PASSWORD, 'utf8')]))
  .digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivRaw, tagRaw, dataRaw] = payload.split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) {
    throw new Error('Token armazenado em formato desconhecido.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(ivRaw, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sign(value: string): string {
  return crypto.createHmac('sha256', sessionKey).update(value).digest('base64url');
}

export function createSession(): string {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifySession(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [issuedAt, signature] = cookieValue.split('.');
  if (!issuedAt || !signature) return false;
  if (!safeEqual(signature, sign(issuedAt))) return false;
  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age < 30 * 24 * 60 * 60 * 1000;
}
