import type { CreateChargeInput, Product, Purchase, RegisterPurchaseInput } from '../shared/types.js';
import { DEPLOY_URL, SYNCPAY_WEBHOOK_TOKEN } from './config.js';
import { stopFollowUpForLead } from './followups.js';
import { deliverMessage } from './messaging.js';
import { newId, store } from './store.js';
import { contextForLead, renderTemplate } from './templates.js';
import { createPixCashIn, getTransaction, mapStatus, normalizeError, type CashInCustomer } from './syncpay.js';

export function formatCents(cents: number): string {
  return (Math.max(0, Math.round(cents)) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function webhookUrl(): string {
  const base = (store.settings.publicBaseUrl || DEPLOY_URL || '').replace(/\/$/, '');
  const token = store.integrations.syncpay.webhookToken;
  if (!base) return '';
  return `${base}/api/payments/webhook/syncpay${token ? `/${token}` : ''}`;
}

export function isValidCpf(value: string): boolean {
  return /^\d{11}$/.test(value.replace(/\D/g, ''));
}

function buildCustomer(input: CreateChargeInput, leadName: string): CashInCustomer | null {
  const name = (input.customerName || leadName || '').trim();
  const cpf = (input.customerDocument || '').replace(/\D/g, '');
  const email = (input.customerEmail || '').trim();
  const phone = (input.customerPhone || '').replace(/\D/g, '');
  if (!cpf && !email && !phone) return null;
  if (!name || !isValidCpf(cpf) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^\d{10,11}$/.test(phone)) {
    throw new Error(
      'Para enviar os dados do cliente à SyncPay, informe nome, CPF (11 dígitos), e-mail válido e telefone com DDD.'
    );
  }
  return { name, cpf, email, phone };
}

export function deliveryTemplate(product: Product | null): string {
  const custom = product?.deliveryText?.trim();
  if (custom) return custom;
  return [
    '✅ Pagamento aprovado, {nome}!',
    '',
    'Seu acesso ao *{produto}* está liberado.',
    '',
    '{link}',
    '',
    'Qualquer dúvida, me chama aqui. 🔓',
  ].join('\n');
}

async function deliverAccess(purchase: Purchase): Promise<{ ok: boolean; error?: string }> {
  const lead = purchase.leadId ? store.findLeadById(purchase.leadId) : null;
  if (!lead) return { ok: false, error: 'Compra sem lead vinculado: entrega manual necessária.' };
  const product = purchase.productId ? store.findProduct(purchase.productId) : null;
  const bot = store.findBot(purchase.botId);
  const text = renderTemplate(deliveryTemplate(product || null), contextForLead(lead, bot, product || null));
  const result = await deliverMessage(purchase.botId, lead.telegramUserId, text, { leadId: lead.id });
  if (result.ok) {
    store.updatePurchase(purchase.id, { deliverySentAt: new Date().toISOString() });
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

/** Marca como pago, promove o lead e entrega o acesso uma única vez. */
export async function confirmPayment(
  purchaseId: string,
  options: { amountCents?: number; deliver?: boolean } = {}
): Promise<{ purchase: Purchase | null; delivered: boolean; deliveryError?: string }> {
  const current = store.rawPurchases.find((item) => item.id === purchaseId);
  if (!current) return { purchase: null, delivered: false };
  const wasPaid = current.status === 'pago';
  const updated = store.updatePurchase(purchaseId, {
    status: 'pago',
    amountCents: options.amountCents && options.amountCents > 0 ? options.amountCents : current.amountCents,
    paidAt: current.paidAt || new Date().toISOString(),
    refundedAt: null,
  });
  if (!updated) return { purchase: null, delivered: false };

  if (updated.leadId) {
    const lead = store.findLeadById(updated.leadId);
    if (lead && lead.status !== 'cliente') {
      store.updateLead(lead.id, { status: 'cliente' });
    }
    stopFollowUpForLead(updated.leadId, 'Compra aprovada.');
  }

  if (wasPaid || options.deliver === false || updated.deliverySentAt) {
    return { purchase: updated, delivered: Boolean(updated.deliverySentAt) };
  }
  const delivery = await deliverAccess(updated);
  const fresh = store.rawPurchases.find((item) => item.id === purchaseId) || updated;
  return { purchase: { ...fresh }, delivered: delivery.ok, deliveryError: delivery.error };
}

export async function createCharge(input: CreateChargeInput): Promise<{
  purchase: Purchase;
  pixCode: string;
  warning?: string;
}> {
  const product = store.findProduct(input.productId);
  if (!product) throw new Error('Produto não encontrado.');
  if (!product.active) throw new Error('Produto inativo.');
  if (product.priceCents <= 0) throw new Error('Produto sem preço definido.');
  const bot = store.findBot(input.botId);
  if (!bot) throw new Error('Bot não encontrado.');
  const lead = input.leadId ? store.findLeadById(input.leadId) : null;
  const customer = buildCustomer(input, lead?.name || input.customerName || '');

  let charge: { identifier: string; pixCode: string; message: string };
  try {
    charge = await createPixCashIn({
      amountCents: product.priceCents,
      description: `${product.name}`.slice(0, 140),
      customer,
      webhookUrl: webhookUrl() || undefined,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    throw new Error(normalized.message);
  }

  const now = new Date().toISOString();
  const purchase: Purchase = {
    id: newId('buy'),
    botId: input.botId,
    leadId: lead?.id || null,
    productId: product.id,
    provider: 'syncpay',
    externalId: charge.identifier,
    amountCents: product.priceCents,
    currency: 'BRL',
    status: 'pendente',
    method: 'pix',
    customerName: customer?.name || lead?.name || '',
    customerEmail: customer?.email || '',
    customerDocument: customer?.cpf || '',
    pixCode: charge.pixCode,
    createdAt: now,
    paidAt: null,
    refundedAt: null,
    deliverySentAt: null,
    notes: '',
  };
  store.addPurchase(purchase);
  return {
    purchase,
    pixCode: charge.pixCode,
    warning: customer
      ? undefined
      : 'Cobrança criada sem dados do cliente (CPF/e-mail/telefone). Alguns gateways exigem esses dados para liberar o PIX.',
  };
}

export function registerManualPurchase(input: RegisterPurchaseInput): Purchase {
  const bot = store.findBot(input.botId);
  if (!bot) throw new Error('Bot não encontrado.');
  const product = input.productId ? store.findProduct(input.productId) : null;
  const lead = input.leadId ? store.findLeadById(input.leadId) : null;
  const now = new Date().toISOString();
  const status = input.status || 'pago';
  const purchase: Purchase = {
    id: newId('buy'),
    botId: input.botId,
    leadId: lead?.id || null,
    productId: product?.id || null,
    provider: 'manual',
    externalId: input.externalId || null,
    amountCents: Math.max(0, Math.round(input.amountCents)),
    currency: 'BRL',
    status,
    method: input.method || 'pix',
    customerName: input.customerName || lead?.name || '',
    customerEmail: input.customerEmail || '',
    customerDocument: input.customerDocument || '',
    pixCode: product?.pixCode || null,
    createdAt: now,
    paidAt: status === 'pago' ? now : null,
    refundedAt: status === 'reembolsado' ? now : null,
    deliverySentAt: null,
    notes: input.notes || '',
  };
  store.addPurchase(purchase);
  return purchase;
}

export interface SyncPayWebhookBody {
  id?: string;
  amount?: number;
  final_amount?: number;
  status?: string;
  payment_method?: string;
  pix_code?: string | null;
  client?: { name?: string | null; email?: string | null; document?: string | null };
  created_at?: string;
  updated_at?: string;
  data?: SyncPayWebhookBody;
}

export function checkWebhookToken(received: string | undefined): boolean {
  const expected = store.integrations.syncpay.webhookToken || SYNCPAY_WEBHOOK_TOKEN;
  if (!expected) return false;
  const value = String(received || '').replace(/^Bearer\s+/i, '').trim();
  if (value.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < value.length; i += 1) mismatch |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function applySyncPayWebhook(body: SyncPayWebhookBody): Promise<{
  ok: boolean;
  ignored?: boolean;
  reason?: string;
  purchase?: Purchase;
  delivered?: boolean;
}> {
  const payload = body.data && typeof body.data === 'object' ? body.data : body;
  const externalId = String(payload.id || '').trim();
  if (!externalId) return { ok: false, reason: 'Webhook sem id da transação.' };
  const purchase = store.findPurchaseByExternalId('syncpay', externalId);
  if (!purchase) {
    return { ok: true, ignored: true, reason: 'Transação não pertence a este painel.' };
  }
  const status = mapStatus(String(payload.status || ''));
  const amountCents =
    typeof payload.final_amount === 'number' && payload.final_amount > 0
      ? Math.round(payload.final_amount * 100)
      : typeof payload.amount === 'number' && payload.amount > 0
      ? Math.round(payload.amount * 100)
      : purchase.amountCents;

  if (status === 'pago') {
    const result = await confirmPayment(purchase.id, { amountCents });
    return { ok: true, purchase: result.purchase || undefined, delivered: result.delivered };
  }
  if (status === 'reembolsado') {
    const updated = store.updatePurchase(purchase.id, {
      status: 'reembolsado',
      refundedAt: new Date().toISOString(),
    });
    return { ok: true, purchase: updated || undefined };
  }
  if (status === 'cancelado') {
    const updated = store.updatePurchase(purchase.id, { status: 'cancelado' });
    return { ok: true, purchase: updated || undefined };
  }
  if (payload.pix_code && payload.pix_code !== purchase.pixCode) {
    store.updatePurchase(purchase.id, { pixCode: payload.pix_code });
  }
  return { ok: true, purchase };
}

/** Reenvia a entrega do acesso (usado quando o envio automático falhou). */
export async function resendDelivery(purchaseId: string): Promise<{ ok: boolean; error?: string }> {
  const purchase = store.rawPurchases.find((item) => item.id === purchaseId);
  if (!purchase) return { ok: false, error: 'Compra não encontrada.' };
  return deliverAccess(purchase);
}

/** Reconciliação manual: consulta a SyncPay e aplica o status atual. */export async function reconcilePurchase(purchaseId: string): Promise<Purchase | null> {
  const purchase = store.rawPurchases.find((item) => item.id === purchaseId);
  if (!purchase) return null;
  if (!purchase.externalId) return purchase;
  const transaction = await getTransaction(purchase.externalId);
  const status = mapStatus(transaction.status);
  if (status === 'pago') {
    const result = await confirmPayment(purchase.id, {
      amountCents: Math.round(transaction.amount * 100),
    });
    return result.purchase;
  }
  return store.updatePurchase(purchase.id, { status }) || purchase;
}
