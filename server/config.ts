import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'));
export const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
export const STORE_FILE = path.join(DATA_DIR, 'state.json');

export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '127.0.0.1';
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
export const PANEL_PASSWORD = process.env.PANEL_PASSWORD || '';
export const SESSION_SECRET = process.env.SESSION_SECRET || '';
export const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
export const POLL_INTERVAL_MS = Math.max(10_000, Number(process.env.POLL_INTERVAL_MS || 25_000));
export const POLLING_ENABLED = process.env.TELEGRAM_POLLING !== 'false';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const VERSION = '2.1.0';

/** Vercel injeta VERCEL=1 em todas as funções. */
export const IS_SERVERLESS = Boolean(process.env.VERCEL);
/** Endereço público do deploy, usado nos webhooks quando PUBLIC_BASE_URL não é fixado. */
export const DEPLOY_URL =
  PUBLIC_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : '');

export const CRON_SECRET = process.env.CRON_SECRET || '';

/** Vercel KV (Upstash Redis REST API) — Armazenamento nativo do Vercel Storage. */
function findRestApiUrl(): string {
  if (process.env.KV_REST_API_URL) return process.env.KV_REST_API_URL;
  if (process.env.UPSTASH_REDIS_REST_URL) return process.env.UPSTASH_REDIS_REST_URL;
  if (process.env.STORAGE_REST_API_URL) return process.env.STORAGE_REST_API_URL;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('_REST_API_URL') && value) return value;
  }
  return '';
}

function findRestApiToken(): string {
  if (process.env.KV_REST_API_TOKEN) return process.env.KV_REST_API_TOKEN;
  if (process.env.UPSTASH_REDIS_REST_TOKEN) return process.env.UPSTASH_REDIS_REST_TOKEN;
  if (process.env.STORAGE_REST_API_TOKEN) return process.env.STORAGE_REST_API_TOKEN;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('_REST_API_TOKEN') && !key.includes('READ_ONLY') && value) return value;
  }
  return '';
}

export const VERCEL_KV_URL = findRestApiUrl().replace(/\/$/, '');
export const VERCEL_KV_TOKEN = findRestApiToken();
export const VERCEL_KV_KEY = process.env.VERCEL_KV_KEY || 'hot_system_state';
export const HAS_VERCEL_KV = Boolean(VERCEL_KV_URL && VERCEL_KV_TOKEN);

/** Supabase: persistência alternativa para Vercel (PostgREST, sem pool de conexões). */
export const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
export const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';
export const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'hot_state';

/** SyncPay — API oficial (https://api.syncpayments.com.br). */
export const SYNCPAY_API_BASE = (process.env.SYNCPAY_API_BASE || 'https://api.syncpayments.com.br').replace(/\/$/, '');
export const SYNCPAY_CLIENT_ID = process.env.SYNCPAY_CLIENT_ID || '';
export const SYNCPAY_CLIENT_SECRET = process.env.SYNCPAY_CLIENT_SECRET || '';
export const SYNCPAY_WEBHOOK_TOKEN = process.env.SYNCPAY_WEBHOOK_TOKEN || '';

export const HAS_REMOTE_STORE = Boolean(HAS_VERCEL_KV || (SUPABASE_URL && SUPABASE_KEY));
