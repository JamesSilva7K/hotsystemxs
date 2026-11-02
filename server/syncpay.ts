import { SYNCPAY_API_BASE, SYNCPAY_CLIENT_ID, SYNCPAY_CLIENT_SECRET } from './config.js';
import type { PurchaseStatus } from '../shared/types.js';
import { store } from './store.js';

export class SyncPayError extends Error {
  status: number;
  details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'SyncPayError';
    this.status = status;
    this.details = details;
  }
}

interface Credentials {
  clientId: string;
  clientSecret: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
  clientId: string;
}

let cachedToken: CachedToken | null = null;

export function resolveCredentials(): Credentials | null {
  const integration = store.integrations.syncpay;
  const secret = store.syncpaySecret;
  if (integration.clientId && secret) {
    return { clientId: integration.clientId, clientSecret: secret };
  }
  if (SYNCPAY_CLIENT_ID && SYNCPAY_CLIENT_SECRET) {
    return { clientId: SYNCPAY_CLIENT_ID, clientSecret: SYNCPAY_CLIENT_SECRET };
  }
  return null;
}

export function isConfigured(): boolean {
  return Boolean(resolveCredentials());
}

function parseError(status: number, data: unknown): SyncPayError {
  const payload = (data || {}) as {
    message?: string;
    error?: string;
    error_description?: string;
    errors?: Record<string, string[]>;
  };
  const details: string[] = [];
  if (payload.errors) {
    for (const [field, messages] of Object.entries(payload.errors)) {
      details.push(`${field}: ${Array.isArray(messages) ? messages.join(' ') : String(messages)}`);
    }
  }
  const message =
    payload.error_description ||
    payload.message ||
    payload.error ||
    `SyncPay respondeu ${status}.`;
  return new SyncPayError(status, String(message), details);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

export async function getAccessToken(): Promise<string> {
  const credentials = resolveCredentials();
  if (!credentials) {
    throw new SyncPayError(
      0,
      'SyncPay não configurada. Informe Client ID e Client Secret em Integrações.'
    );
  }
  if (
    cachedToken &&
    cachedToken.clientId === credentials.clientId &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }
  let response: Response;
  try {
    response = await fetch(`${SYNCPAY_API_BASE}/api/partner/v1/auth-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });
  } catch (error) {
    throw new SyncPayError(0, `Falha de rede ao falar com a SyncPay: ${(error as Error).message}`);
  }
  const data = (await readJson(response)) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !data.access_token) {
    throw parseError(response.status, data);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3_600) * 1_000,
    clientId: credentials.clientId,
  };
  return cachedToken.token;
}

async function authorized(
  path: string,
  init: { method: string; body?: unknown },
  retry = true
): Promise<unknown> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${SYNCPAY_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    throw new SyncPayError(0, `Falha de rede ao falar com a SyncPay: ${(error as Error).message}`);
  }
  if (response.status === 401 && retry) {
    cachedToken = null;
    return authorized(path, init, false);
  }
  const data = await readJson(response);
  if (!response.ok) throw parseError(response.status, data);
  return data;
}

export interface CashInCustomer {
  name: string;
  cpf: string;
  email: string;
  phone: string;
}

export async function createPixCashIn(input: {
  amountCents: number;
  description: string;
  customer?: CashInCustomer | null;
  webhookUrl?: string;
}): Promise<{ identifier: string; pixCode: string; message: string }> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new SyncPayError(0, 'Valor da cobrança inválido.');
  }
  const body: Record<string, unknown> = {
    amount: Number((input.amountCents / 100).toFixed(2)),
    description: input.description.slice(0, 140),
  };
  if (input.customer) body.client = input.customer;
  if (input.webhookUrl) body.webhook_url = input.webhookUrl;

  const data = (await authorized('/api/partner/v1/cash-in', {
    method: 'POST',
    body,
  })) as { identifier?: string; pix_code?: string; message?: string };

  if (!data.identifier || !data.pix_code) {
    throw new SyncPayError(0, data.message || 'A SyncPay não retornou o código PIX da cobrança.');
  }
  return {
    identifier: String(data.identifier),
    pixCode: String(data.pix_code),
    message: String(data.message || 'Cobrança criada.'),
  };
}

export async function getTransaction(identifier: string): Promise<{
  referenceId: string;
  amount: number;
  status: string;
  pixCode: string | null;
}> {
  const data = (await authorized(
    `/api/partner/v1/transaction/${encodeURIComponent(identifier)}`,
    { method: 'GET' }
  )) as {
    data?: { reference_id?: string; amount?: number; status?: string; pix_code?: string | null };
  };
  const transaction = data.data;
  if (!transaction?.status) {
    throw new SyncPayError(0, 'Transação não encontrada na SyncPay.');
  }
  return {
    referenceId: String(transaction.reference_id || identifier),
    amount: Number(transaction.amount || 0),
    status: String(transaction.status),
    pixCode: transaction.pix_code ?? null,
  };
}

/** Status da SyncPay -> status interno. */
export function mapStatus(status: string): PurchaseStatus {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed' || normalized === 'paid' || normalized === 'approved') return 'pago';
  if (normalized === 'refunded' || normalized === 'charged_back') return 'reembolsado';
  if (normalized === 'failed' || normalized === 'canceled' || normalized === 'cancelled') {
    return 'cancelado';
  }
  return 'pendente';
}

export function normalizeError(error: unknown): { message: string; details: string[] } {
  if (error instanceof SyncPayError) {
    const suffix = error.details.length > 0 ? ` (${error.details.join(' · ')})` : '';
    return { message: `${error.message}${suffix}`, details: error.details };
  }
  if (error instanceof Error) return { message: error.message, details: [] };
  return { message: 'Erro desconhecido na SyncPay.', details: [] };
}
