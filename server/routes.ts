import type { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type {
  FollowUpSequence,
  LeadStatus,
  MessageTemplate,
  Product,
  Purchase,
  TemplateCategory,
} from '../shared/types.js';
import { CRON_SECRET, VERSION } from './config.js';
import { buildFollowUp, isWithinWindow, restartFollowUpForLead, runFollowUps, stopFollowUpForLead } from './followups.js';
import { runDueCampaigns, runDuePreviewMessages } from './messaging.js';
import {
  applySyncPayWebhook,
  checkWebhookToken,
  confirmPayment,
  createCharge,
  formatCents,
  reconcilePurchase,
  registerManualPurchase,
  resendDelivery,
  webhookUrl,
} from './purchases.js';
import { encryptSecret, randomToken, safeEqual } from './security.js';
import { newId, store } from './store.js';
import { generateVariants, renderTemplate, contextForLead } from './templates.js';
import { getAccessToken, isConfigured, normalizeError } from './syncpay.js';

const templateCategories = [
  'abertura',
  'reengajamento',
  'oferta',
  'prova_social',
  'fechamento',
  'recuperacao',
] as const;
const leadStatuses = ['novo', 'interessado', 'qualificado', 'cliente', 'arquivado'] as const;

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

function zodMessage(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}

function centsFromInput(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  return Math.round(numeric);
}

// ---------- Rotas públicas (sem sessão) ----------

export function registerPublicRoutes(app: Express): void {
  app.post(
    '/api/payments/webhook/syncpay/:token?',
    asyncHandler(async (req, res) => {
      const headerToken = req.headers.authorization;
      const pathToken = typeof req.params.token === 'string' ? req.params.token : '';
      const valid =
        checkWebhookToken(headerToken) || (pathToken ? checkWebhookToken(`Bearer ${pathToken}`) : false);
      if (!valid) {
        return res.status(401).json({ ok: false, error: 'Webhook não autorizado.' });
      }
      try {
        const result = await applySyncPayWebhook(req.body || {});
        return res.json({ ...result, ok: true });
      } catch (error) {
        console.error('[webhook] syncpay:', error);
        // Devolve 200 para a SyncPay não reenfileirar um payload que já falhou aqui.
        return res.json({ ok: false, error: (error as Error).message });
      }
    })
  );

  const cronHandler = asyncHandler(async (req, res) => {
    const provided =
      String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
      String(req.query.key || '');
    if (CRON_SECRET && !safeEqual(provided, CRON_SECRET)) {
      return res.status(401).json({ ok: false, error: 'Chave de cron inválida.' });
    }
    const started = Date.now();
    const campaigns = await runDueCampaigns();
    const previews = await runDuePreviewMessages();
    const followUps = await runFollowUps(new Date(), 20);
    return res.json({
      ok: true,
      version: VERSION,
      campaigns,
      previews,
      followUps,
      ms: Date.now() - started,
      next: store.getPublicState().automation.nextRunAt,
    });
  });
  app.get('/api/cron/tick', cronHandler);
  app.post('/api/cron/tick', cronHandler);

  // ---------- Rotas Públicas dos Perfis / Bio Links das Modelos (/p/:slug) ----------
  app.get(
    '/api/public/profiles/:slug',
    asyncHandler(async (req, res) => {
      const slug = String(req.params.slug || '').trim();
      const profile = store.findProfileBySlug(slug);
      if (!profile) {
        return res.status(404).json({ error: 'Perfil não encontrado.' });
      }
      const isUnique = req.query.unique === '1' || req.headers['x-unique-visit'] === '1';
      const updated = store.recordProfileView(slug, isUnique);
      return res.json({ ok: true, profile: updated || profile });
    })
  );

  app.post(
    '/api/public/profiles/:slug/click',
    asyncHandler(async (req, res) => {
      const slug = String(req.params.slug || '').trim();
      const buttonId = String(req.body?.buttonId || '').trim();
      if (!buttonId) {
        return res.status(400).json({ error: 'buttonId é obrigatório.' });
      }
      const result = store.recordProfileClick(slug, buttonId);
      if (!result) {
        return res.status(404).json({ error: 'Perfil ou botão não encontrado.' });
      }
      return res.json({ ok: true, clicks: result.button.clicks });
    })
  );

  app.post(
    '/api/public/profiles/:slug/exit',
    asyncHandler(async (req, res) => {
      const slug = String(req.params.slug || '').trim();
      store.recordProfileExit(slug);
      return res.json({ ok: true });
    })
  );
}

// ---------- Rotas administrativas ----------

export function registerAdminRoutes(app: Express): void {
  // Integrações
  const integrationSchema = z.object({
    clientId: z.string().trim().max(100).optional(),
    clientSecret: z.string().trim().max(200).optional(),
    enabled: z.boolean().optional(),
  });

  app.post(
    '/api/integrations/syncpay',
    asyncHandler(async (req, res) => {
      const parsed = integrationSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      const patch: Parameters<typeof store.updateIntegrations>[0] = {};
      if (parsed.data.clientId !== undefined) {
        const id = parsed.data.clientId;
        if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          return res.status(400).json({ error: 'Client ID da SyncPay deve ser um UUID válido.' });
        }
        patch.clientId = id;
      }
      if (parsed.data.clientSecret !== undefined && parsed.data.clientSecret !== '') {
        patch.clientSecretEnc = encryptSecret(parsed.data.clientSecret);
      }
      if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
      store.updateIntegrations(patch);
      return res.json({ ok: true, integrations: store.getPublicState().integrations });
    })
  );

  app.post(
    '/api/integrations/syncpay/test',
    asyncHandler(async (_req, res) => {
      if (!isConfigured()) {
        return res.status(400).json({ error: 'Informe Client ID e Client Secret da SyncPay primeiro.' });
      }
      const started = Date.now();
      try {
        await getAccessToken();
        return res.json({ ok: true, latencyMs: Date.now() - started });
      } catch (error) {
        const normalized = normalizeError(error);
        return res.status(502).json({ error: normalized.message, details: normalized.details });
      }
    })
  );

  app.post('/api/integrations/syncpay/rotate-webhook', (_req, res) => {
    const token = randomToken(24);
    store.updateIntegrations({ webhookToken: token });
    return res.json({ ok: true, webhookUrl: webhookUrl(), integrations: store.getPublicState().integrations });
  });

  // Templates
  const buttonSchema = z.object({
    text: z.string().trim().min(1).max(64),
    url: z.string().trim().optional(),
    callbackData: z.string().trim().max(64).optional(),
    color: z.enum(['default', 'green', 'red', 'purple', 'amber']).optional(),
    row: z.number().int().min(0).max(10).optional(),
  });

  const mediaGridItemSchema = z.object({
    id: z.string(),
    url: z.string().trim(),
    type: z.enum(['photo', 'video']),
    position: z.enum(['main-left', 'top-right', 'bottom-right', 'auto']).optional(),
  });

  const templateSchema = z.object({
    name: z.string().trim().min(1, 'Informe um nome.').max(80),
    category: z.enum(templateCategories),
    body: z.string().trim().min(1, 'Escreva a mensagem.').max(4_096),
    buttons: z.array(buttonSchema).max(10).optional(),
    mediaUrl: z.string().trim().nullable().optional(),
    mediaType: z.enum(['photo', 'video', 'animation', 'none']).optional(),
    mediaMode: z.enum(['single', 'grid', 'none']).optional(),
    mediaGrid: z.array(mediaGridItemSchema).max(10).optional(),
    weight: z.number().int().min(1).max(50).optional(),
    active: z.boolean().optional(),
    tags: z.array(z.string().trim().max(30)).max(10).optional(),
  });

  app.post('/api/templates', (req, res) => {
    const parsed = templateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const now = new Date().toISOString();
    const template: MessageTemplate = {
      id: newId('tpl'),
      name: parsed.data.name,
      category: parsed.data.category,
      body: parsed.data.body,
      buttons: parsed.data.buttons || [],
      mediaUrl: parsed.data.mediaUrl || null,
      mediaType: parsed.data.mediaType || 'none',
      mediaMode: parsed.data.mediaMode || 'single',
      mediaGrid: parsed.data.mediaGrid || [],
      active: parsed.data.active !== false,
      weight: parsed.data.weight || 1,
      variantOf: null,
      tags: parsed.data.tags || [],
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.addTemplate(template);
    return res.status(201).json({ ok: true, template });
  });

  app.patch('/api/templates/:id', (req, res) => {
    const parsed = templateSchema.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const template = store.updateTemplate(req.params.id, parsed.data as Partial<MessageTemplate>);
    if (!template) return res.status(404).json({ error: 'Template não encontrado.' });
    return res.json({ ok: true, template });
  });

  app.delete('/api/templates/:id', (req, res) => {
    if (!store.removeTemplate(req.params.id)) {
      return res.status(404).json({ error: 'Template não encontrado.' });
    }
    return res.json({ ok: true });
  });

  app.post(
    '/api/templates/preview',
    asyncHandler(async (req, res) => {
      const schema = z.object({
        body: z.string().min(1).max(4_096),
        leadId: z.string().optional().nullable(),
        productId: z.string().optional().nullable(),
        botId: z.string().optional().nullable(),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      const lead = parsed.data.leadId ? store.findLeadById(parsed.data.leadId) : null;
      const product = parsed.data.productId ? store.findProduct(parsed.data.productId) : null;
      const bot = parsed.data.botId ? store.findBot(parsed.data.botId) : store.rawBots[0];
      const context = contextForLead(
        lead || { name: 'Cliente Exemplo', username: null },
        bot,
        product
      );
      return res.json({ ok: true, text: renderTemplate(parsed.data.body, context) });
    })
  );

  const generateSchema = z.object({
    brief: z.string().trim().min(3, 'Descreva a oferta em poucas palavras.').max(400),
    category: z.enum(templateCategories),
    count: z.number().int().min(1).max(20).default(5),
    productId: z.string().nullable().optional(),
    save: z.boolean().default(true),
  });

  app.post('/api/templates/generate', (req, res) => {
    const parsed = generateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const product = parsed.data.productId ? store.findProduct(parsed.data.productId) : null;
    const variants = generateVariants({
      brief: parsed.data.brief,
      category: parsed.data.category as TemplateCategory,
      count: parsed.data.count,
      product: product || null,
    });
    const now = new Date().toISOString();
    const created: MessageTemplate[] = [];
    if (parsed.data.save) {
      for (const variant of variants) {
        const template: MessageTemplate = {
          id: newId('tpl'),
          name: variant.name,
          category: variant.category,
          body: variant.body,
          buttons: variant.buttons,
          mediaUrl: null,
          active: true,
          weight: 1,
          variantOf: null,
          tags: ['gerado'],
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        store.addTemplate(template);
        created.push(template);
      }
    }
    return res.json({ ok: true, variants, created, saved: parsed.data.save });
  });

  // Sequências
  const stepSchema = z.object({
    delayMinutes: z.number().int().min(0).max(60 * 24 * 30),
    templateId: z.string().trim().min(1),
  });

  const sequenceSchema = z.object({
    botId: z.string().min(1),
    name: z.string().trim().min(1, 'Informe um nome.').max(80),
    productId: z.string().nullable().optional(),
    active: z.boolean().optional(),
    steps: z.array(stepSchema).min(1, 'Adicione pelo menos um passo.').max(10),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    quietHoursStart: z.number().int().min(0).max(23).optional(),
    quietHoursEnd: z.number().int().min(0).max(23).optional(),
    maxMessagesPerLead: z.number().int().min(1).max(20).optional(),
    stopOnStatus: z.array(z.enum(leadStatuses)).max(5).optional(),
  });

  function validateSequence(input: z.infer<typeof sequenceSchema>): string | null {
    if (!store.findBot(input.botId)) return 'Bot não encontrado.';
    for (const step of input.steps) {
      if (!store.findTemplate(step.templateId)) return 'Um dos passos aponta para um template inexistente.';
    }
    if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
      return 'A data de término precisa ser depois da data de início.';
    }
    return null;
  }

  app.post('/api/sequences', (req, res) => {
    const parsed = sequenceSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const invalid = validateSequence(parsed.data);
    if (invalid) return res.status(400).json({ error: invalid });
    const now = new Date().toISOString();
    const sequence: FollowUpSequence = {
      id: newId('seq'),
      botId: parsed.data.botId,
      name: parsed.data.name,
      steps: parsed.data.steps,
      active: parsed.data.active !== false,
      productId: parsed.data.productId || null,
      startsAt: parsed.data.startsAt || null,
      endsAt: parsed.data.endsAt || null,
      quietHoursStart: parsed.data.quietHoursStart ?? 8,
      quietHoursEnd: parsed.data.quietHoursEnd ?? 22,
      maxMessagesPerLead: parsed.data.maxMessagesPerLead ?? 3,
      stopOnStatus: parsed.data.stopOnStatus || ['cliente', 'arquivado'],
      createdAt: now,
      updatedAt: now,
    };
    store.addSequence(sequence);
    return res.status(201).json({ ok: true, sequence });
  });

  app.patch('/api/sequences/:id', (req, res) => {
    const parsed = sequenceSchema.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const existing = store.findSequence(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Sequência não encontrada.' });
    const merged = { ...existing, ...parsed.data } as z.infer<typeof sequenceSchema>;
    const invalid = validateSequence(merged);
    if (invalid) return res.status(400).json({ error: invalid });
    const sequence = store.updateSequence(req.params.id, parsed.data as Partial<FollowUpSequence>);
    return res.json({ ok: true, sequence });
  });

  app.delete('/api/sequences/:id', (req, res) => {
    if (!store.removeSequence(req.params.id)) {
      return res.status(404).json({ error: 'Sequência não encontrada.' });
    }
    return res.json({ ok: true });
  });

  app.post(
    '/api/sequences/:id/preview',
    asyncHandler(async (req, res) => {
      const sequence = store.findSequence(req.params.id);
      if (!sequence) return res.status(404).json({ error: 'Sequência não encontrada.' });
      const product = sequence.productId ? store.findProduct(sequence.productId) : null;
      const bot = store.findBot(sequence.botId);
      const previews = sequence.steps.map((step) => {
        const template = store.findTemplate(step.templateId);
        return {
          delayMinutes: step.delayMinutes,
          templateId: step.templateId,
          templateName: template?.name || 'Template removido',
          text: template
            ? renderTemplate(
                template.body,
                contextForLead({ name: 'Cliente Exemplo', username: 'cliente' }, bot, product)
              )
            : '',
        };
      });
      return res.json({ ok: true, previews });
    })
  );

  // Produtos
  const productSchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome do produto.').max(80),
    description: z.string().trim().max(500).optional(),
    priceCents: z.number().int().min(100, 'Preço mínimo de R$ 1,00.').max(100_000_000),
    pixCode: z.string().trim().max(1_500).nullable().optional(),
    checkoutUrl: z.string().trim().url().nullable().optional(),
    deliveryText: z.string().trim().max(4_096).optional(),
    active: z.boolean().optional(),
  });

  app.post('/api/products', (req, res) => {
    const parsed = productSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const now = new Date().toISOString();
    const product: Product = {
      id: newId('prod'),
      name: parsed.data.name,
      description: parsed.data.description || '',
      priceCents: parsed.data.priceCents,
      currency: 'BRL',
      pixCode: parsed.data.pixCode || null,
      checkoutUrl: parsed.data.checkoutUrl || null,
      deliveryText: parsed.data.deliveryText || '',
      active: parsed.data.active !== false,
      createdAt: now,
      updatedAt: now,
    };
    store.addProduct(product);
    return res.status(201).json({ ok: true, product });
  });

  app.patch('/api/products/:id', (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const product = store.updateProduct(req.params.id, parsed.data as Partial<Product>);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json({ ok: true, product });
  });

  app.delete('/api/products/:id', (req, res) => {
    if (!store.removeProduct(req.params.id)) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    return res.json({ ok: true });
  });

  // Cobranças Pix (SyncPay)
  const chargeSchema = z.object({
    botId: z.string().min(1),
    leadId: z.string().nullable().optional(),
    productId: z.string().min(1),
    customerName: z.string().trim().max(120).optional(),
    customerEmail: z.string().trim().max(160).optional(),
    customerDocument: z.string().trim().max(20).optional(),
    customerPhone: z.string().trim().max(20).optional(),
  });

  app.post(
    '/api/charges',
    asyncHandler(async (req, res) => {
      const parsed = chargeSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      if (!isConfigured()) {
        return res.status(400).json({ error: 'Configure a SyncPay em Integrações antes de gerar cobranças.' });
      }
      try {
        const result = await createCharge(parsed.data);
        return res.status(201).json({
          ok: true,
          purchase: result.purchase,
          pixCode: result.pixCode,
          amount: formatCents(result.purchase.amountCents),
          warning: result.warning,
        });
      } catch (error) {
        return res.status(502).json({ error: (error as Error).message });
      }
    })
  );

  // Compras
  const purchaseSchema = z.object({
    botId: z.string().min(1),
    leadId: z.string().nullable().optional(),
    productId: z.string().nullable().optional(),
    amountCents: z.number().int().min(0).max(100_000_000),
    status: z.enum(['pendente', 'pago', 'cancelado', 'reembolsado']).optional(),
    method: z.enum(['pix', 'cartao', 'outro']).optional(),
    customerName: z.string().trim().max(120).optional(),
    customerEmail: z.string().trim().max(160).optional(),
    customerDocument: z.string().trim().max(20).optional(),
    notes: z.string().trim().max(1_000).optional(),
    externalId: z.string().trim().max(120).nullable().optional(),
  });

  app.post(
    '/api/purchases',
    asyncHandler(async (req, res) => {
      const parsed = purchaseSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      if (!store.findBot(parsed.data.botId)) {
        return res.status(404).json({ error: 'Bot não encontrado.' });
      }
      try {
        const purchase = registerManualPurchase(parsed.data);
        if (purchase.status === 'pago') {
          await confirmPayment(purchase.id, { deliver: true });
        }
        const fresh = store.rawPurchases.find((item) => item.id === purchase.id) || purchase;
        return res.status(201).json({ ok: true, purchase: fresh });
      } catch (error) {
        return res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  app.patch(
    '/api/purchases/:id',
    asyncHandler(async (req, res) => {
      const schema = z.object({
        status: z.enum(['pendente', 'pago', 'cancelado', 'reembolsado']).optional(),
        notes: z.string().trim().max(1_000).optional(),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      const existing = store.rawPurchases.find((item) => item.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Compra não encontrada.' });
      if (parsed.data.notes !== undefined) {
        store.updatePurchase(existing.id, { notes: parsed.data.notes });
      }
      if (parsed.data.status === 'pago') {
        const result = await confirmPayment(existing.id, { deliver: true });
        return res.json({
          ok: true,
          purchase: result.purchase,
          delivered: result.delivered,
          deliveryError: result.deliveryError,
        });
      }
      if (parsed.data.status) {
        const purchase = store.updatePurchase(existing.id, {
          status: parsed.data.status,
          ...(parsed.data.status === 'reembolsado'
            ? { refundedAt: new Date().toISOString() }
            : {}),
        });
        return res.json({ ok: true, purchase });
      }
      return res.json({ ok: true, purchase: store.rawPurchases.find((item) => item.id === existing.id) });
    })
  );

  app.post(
    '/api/purchases/:id/reconcile',
    asyncHandler(async (req, res) => {
      if (!isConfigured()) {
        return res.status(400).json({ error: 'Configure a SyncPay em Integrações primeiro.' });
      }
      try {
        const purchase = await reconcilePurchase(req.params.id);
        if (!purchase) return res.status(404).json({ error: 'Compra não encontrada.' });
        return res.json({ ok: true, purchase });
      } catch (error) {
        const normalized = normalizeError(error);
        return res.status(502).json({ error: normalized.message });
      }
    })
  );

  app.post(
    '/api/purchases/:id/deliver',
    asyncHandler(async (req, res) => {
      const result = await resendDelivery(req.params.id);
      if (!result.ok) return res.status(502).json({ error: result.error || 'Falha ao entregar.' });
      return res.json({ ok: true });
    })
  );

  // Controle manual do follow-up de um lead
  app.patch('/api/leads/:id/followup', (req, res) => {
    const schema = z.object({
      action: z.enum(['start', 'stop']),
      sequenceId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const lead = store.findLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
    if (parsed.data.action === 'stop') {
      stopFollowUpForLead(lead.id, 'Interrompido manualmente pelo operador.');
      return res.json({ ok: true, lead: store.findLeadById(lead.id) });
    }
    const sequence = parsed.data.sequenceId
      ? store.findSequence(parsed.data.sequenceId)
      : store.rawSequences.find(
          (item) => item.botId === lead.botId && item.active && isWithinWindow(item, new Date())
        );
    if (!sequence) return res.status(400).json({ error: 'Nenhuma sequência ativa para este bot.' });
    store.setLeadFollowUp(lead.id, buildFollowUp(sequence, new Date()));
    return res.json({ ok: true, lead: store.findLeadById(lead.id) });
  });

  // Executa o ciclo de automação agora (útil para testar sem esperar o cron)
  app.post(
    '/api/automation/run',
    asyncHandler(async (_req, res) => {
      const started = Date.now();
      const campaigns = await runDueCampaigns();
      const followUps = await runFollowUps(new Date(), 20);
      return res.json({
        ok: true,
        campaigns,
        followUps,
        ms: Date.now() - started,
        automation: store.getPublicState().automation,
      });
    })
  );

  app.post(
    '/api/leads/:id/followup',
    asyncHandler(async (req, res) => {
      const lead = store.findLeadById(req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
      restartFollowUpForLead(lead.id);
      return res.json({ ok: true, lead: store.findLeadById(lead.id) });
    })
  );

  // ---------- Gerenciamento dos Perfis / Bio Links das Modelos ----------
  const profileButtonSchema = z.object({
    id: z.string().optional(),
    title: z.string().trim().min(1, 'Título do botão é obrigatório.').max(100),
    subtitle: z.string().trim().max(150).optional(),
    url: z.string().trim().min(1, 'URL é obrigatória.'),
    imageUrl: z.string().trim().optional(),
    badge: z.string().trim().max(40).optional(),
    clicks: z.number().int().nonnegative().optional(),
    order: z.number().int().optional(),
    active: z.boolean().optional(),
  });

  const createProfileSchema = z.object({
    botId: z.string().min(1, 'Selecione o bot Telegram vinculado.'),
    slug: z.string().trim().min(2, 'Slug precisa ter pelo menos 2 caracteres.').max(60),
    name: z.string().trim().min(1, 'Nome da modelo é obrigatório.').max(100),
    verified: z.boolean().optional(),
    handle: z.string().trim().min(1, 'Handle/Instagram/TikTok é obrigatório.').max(50),
    bio: z.string().trim().max(500).optional(),
    followersCount: z.string().trim().max(30).optional(),
    bannerUrl: z.string().trim().min(1, 'Foto de capa (banner) é obrigatória.'),
    avatarUrl: z.string().trim().optional(),
    overlayGradient: z.enum(['dark-fade', 'smooth-black', 'violet-glow', 'rose-glow']).optional(),
    socialLinks: z
      .object({
        instagram: z.string().trim().optional(),
        tiktok: z.string().trim().optional(),
        telegram: z.string().trim().optional(),
        twitter: z.string().trim().optional(),
        whatsapp: z.string().trim().optional(),
      })
      .optional(),
    buttons: z.array(profileButtonSchema).optional(),
    active: z.boolean().optional(),
  });

  app.post(
    '/api/profiles',
    asyncHandler(async (req, res) => {
      const parsed = createProfileSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      const profile = store.upsertProfile(parsed.data);
      return res.json({ ok: true, profile });
    })
  );

  app.patch(
    '/api/profiles/:id',
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || '').trim();
      const existing = store.findProfile(id);
      if (!existing) return res.status(404).json({ error: 'Perfil não encontrado.' });
      const parsed = createProfileSchema.partial().safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
      const profile = store.upsertProfile({
        botId: parsed.data.botId || existing.botId,
        slug: parsed.data.slug || existing.slug,
        name: parsed.data.name || existing.name,
        handle: parsed.data.handle || existing.handle,
        bannerUrl: parsed.data.bannerUrl || existing.bannerUrl,
        verified: parsed.data.verified ?? existing.verified,
        bio: parsed.data.bio ?? existing.bio,
        followersCount: parsed.data.followersCount || existing.followersCount,
        avatarUrl: parsed.data.avatarUrl ?? existing.avatarUrl,
        overlayGradient: parsed.data.overlayGradient || existing.overlayGradient,
        socialLinks: parsed.data.socialLinks || existing.socialLinks,
        buttons: parsed.data.buttons || existing.buttons,
        active: parsed.data.active ?? existing.active,
        id,
      });
      return res.json({ ok: true, profile });
    })
  );

  app.delete(
    '/api/profiles/:id',
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || '').trim();
      const ok = store.removeProfile(id);
      return res.json({ ok });
    })
  );
}

export function purchaseTotals(purchases: Purchase[]) {
  return purchases.reduce((total, purchase) => total + purchase.amountCents, 0);
}
