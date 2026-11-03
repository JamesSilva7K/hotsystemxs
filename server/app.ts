import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { BotCommand, Campaign, LeadStatus, Settings } from '../shared/types.js';
import {
  AVATAR_DIR,
  HOST,
  IS_PRODUCTION,
  PANEL_PASSWORD,
  POLLING_ENABLED,
  POLL_INTERVAL_MS,
  PORT,
  PUBLIC_BASE_URL,
  TRUST_PROXY,
  VERSION,
} from './config.js';
import {
  createSession,
  encryptSecret,
  randomToken,
  safeEqual,
  verifySession,
} from './security.js';
import { newId, store, type StoredBot } from './store.js';
import {
  deleteWebhook,
  downloadBotAvatar,
  getChat,
  getChatMember,
  getChatMemberCount,
  getMe,
  getMyCommands,
  getMyDescription,
  getWebhookInfo,
  isValidTokenFormat,
  normalizeTelegramError,
  setMyCommands,
  setWebhook,
} from './telegram.js';
import { broadcastToAudience, deliverMessage, executeCampaign } from './messaging.js';
import { getLocalizedCommands, normalizeLang } from './i18n.js';
import { registerAdminRoutes, registerPublicRoutes } from './routes.js';
import { processTelegramUpdate, syncAllBots, syncBotUpdates } from './updates.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(ROOT_DIR, 'data', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch {
  // Best-effort directory creation
}

const app = express();
app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

// Em serverless cada invocação precisa do estado mais recente do banco.
app.use(async (_req, _res, next) => {
  try {
    await store.ready();
    await store.ensureFresh();
    next();
  } catch (error) {
    next(error);
  }
});

// Grava o documento remoto antes de a resposta sair, senão a Vercel congela a função.
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    store
      .flushAsync()
      .catch((error) => console.error('[store] falha ao gravar estado:', error))
      .finally(() => originalJson(body));
    return res;
  }) as typeof res.json;
  next();
});

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    try {
      cookies[rawKey] = decodeURIComponent(rawValue.join('='));
    } catch {
      cookies[rawKey] = rawValue.join('=');
    }
  }
  return cookies;
}

function isAuthenticated(req: Request): boolean {
  if (!PANEL_PASSWORD) return true;
  return verifySession(parseCookies(req.headers.cookie).hs_session);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthenticated(req)) return next();
  return res.status(401).json({ error: 'Autenticação necessária.' });
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function allowLogin(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || record.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  record.count += 1;
  return record.count <= 10;
}

const connectAttempts = new Map<string, { count: number; resetAt: number }>();
function allowConnect(ip: string): boolean {
  const now = Date.now();
  const record = connectAttempts.get(ip);
  if (!record || record.resetAt < now) {
    connectAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  record.count += 1;
  return record.count <= 10;
}

function zodMessage(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}

function botOr404(id: string, res: Response) {
  const bot = store.findBot(id);
  if (!bot) {
    res.status(404).json({ error: 'Bot não encontrado.' });
    return null;
  }
  return bot;
}

// ---------- Autenticação opcional ----------

app.get('/api/auth/status', (req, res) => {
  res.json({
    passwordProtected: Boolean(PANEL_PASSWORD),
    authenticated: isAuthenticated(req),
  });
});

app.post('/api/auth/login', (req, res) => {
  if (!PANEL_PASSWORD) return res.json({ ok: true });
  const ip = req.ip || 'unknown';
  if (!allowLogin(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 10 minutos.' });
  }
  const password = String(req.body?.password || '');
  if (!safeEqual(password, PANEL_PASSWORD)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  const secure = req.secure || (req.headers['x-forwarded-proto'] || '').toString() === 'https';
  res.setHeader(
    'Set-Cookie',
    `hs_session=${createSession()}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${
      secure ? '; Secure' : ''
    }`
  );
  return res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'hs_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

// ---------- Webhook público ----------

app.post(
  '/api/telegram/webhook/:botId',
  asyncHandler(async (req, res) => {
    const bot = store.findBot(req.params.botId);
    if (!bot) return res.sendStatus(404);
    const expected = store.getWebhookSecret(bot);
    const received = String(req.headers['x-telegram-bot-api-secret-token'] || '');
    if (!expected || !received || !safeEqual(received, expected)) {
      return res.sendStatus(401);
    }
    if (!req.body || typeof req.body.update_id !== 'number') {
      return res.status(400).json({ error: 'Update inválido.' });
    }
    try {
      await processTelegramUpdate(bot.id, req.body);
    } catch (error) {
      console.error('[webhook] falha ao processar update:', error);
    }
    return res.json({ ok: true });
  })
);

// ---------- Saúde ----------

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    polling: POLLING_ENABLED,
    storage: 'ok',
  });
});

registerPublicRoutes(app);

app.use('/api', requireAuth);

registerAdminRoutes(app);

app.get('/api/state', (_req, res) => {
  res.json(store.getPublicState());
});

// ---------- Bots ----------

const tokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, 'Informe o token completo do @BotFather.')
    .max(200, 'Token muito longo.'),
  language: z.string().trim().max(10).optional(),
  niche: z.string().trim().max(50).optional(),
});

app.post(
  '/api/bots',
  asyncHandler(async (req, res) => {
    if (!allowConnect(req.ip || 'unknown')) {
      return res.status(429).json({ error: 'Muitas tentativas de conexão. Aguarde um minuto.' });
    }
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const token = parsed.data.token;
    if (!isValidTokenFormat(token)) {
      return res.status(400).json({
        error: 'Formato de token inválido. O token deve parecer com 123456789:AA... e vir do @BotFather.',
      });
    }

    try {
      const me = await getMe(token);
      if (me.is_bot !== true) {
        return res.status(400).json({ error: 'O token informado não pertence a um bot.' });
      }
      const [description, commands, webhook, avatarFile] = await Promise.all([
        getMyDescription(token),
        getMyCommands(token),
        getWebhookInfo(token).catch(() => null),
        downloadBotAvatar(token, String(me.id)),
      ]);
      const selectedLang = normalizeLang(parsed.data.language);
      const localizedCommands = getLocalizedCommands(selectedLang);
      await setMyCommands(token, localizedCommands).catch(() => undefined);

      const bot = store.upsertBot({
        id: String(me.id),
        token,
        username: me.username || `bot_${me.id}`,
        firstName: me.first_name || 'Bot Telegram',
        description: description || 'Bot conectado à API oficial do Telegram.',
        avatarFile,
        canJoinGroups: me.can_join_groups ?? true,
        canReadAllGroupMessages: me.can_read_all_group_messages ?? false,
        supportsInlineQueries: me.supports_inline_queries ?? false,
        commands: localizedCommands.length > 0 ? localizedCommands : commands,
        webhookUrl: webhook?.url || null,
        pendingUpdates: webhook?.pending_update_count || 0,
        language: selectedLang,
        niche: parsed.data.niche,
      });
      const publicBot = store.getPublicState().bots.find((item) => item.id === bot.id);
      return res.status(201).json({ ok: true, bot: publicBot });
    } catch (error) {
      return res.status(400).json({ error: normalizeTelegramError(error) });
    }
  })
);

app.get('/api/bots/:id/avatar', (req, res) => {
  const id = req.params.id.replace(/[^0-9]/g, '');
  const file = path.join(AVATAR_DIR, `${id}.jpg`);
  if (!id || !fs.existsSync(file)) return res.sendStatus(404);
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.sendFile(file);
});

app.post(
  '/api/bots/:id/refresh',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const token = store.getBotToken(bot.id);
    if (!token) return res.status(409).json({ error: 'Token ilegível. Reconecte o bot.' });
    try {
      const started = Date.now();
      const me = await getMe(token);
      const [description, commands, webhook, avatarFile] = await Promise.all([
        getMyDescription(token),
        getMyCommands(token),
        getWebhookInfo(token).catch(() => null),
        downloadBotAvatar(token, bot.id),
      ]);
      store.updateBot(bot.id, {
        username: me.username || bot.username,
        firstName: me.first_name || bot.firstName,
        description: description || bot.description,
        commands,
        avatarFile: avatarFile || bot.avatarFile,
        webhookUrl: webhook?.url || null,
        pendingUpdates: webhook?.pending_update_count || 0,
        canJoinGroups: me.can_join_groups ?? bot.canJoinGroups,
        canReadAllGroupMessages: me.can_read_all_group_messages ?? bot.canReadAllGroupMessages,
        supportsInlineQueries: me.supports_inline_queries ?? bot.supportsInlineQueries,
        status: 'online',
        lastError: null,
      });
      return res.json({
        ok: true,
        latencyMs: Date.now() - started,
        bot: store.getPublicState().bots.find((item) => item.id === bot.id),
      });
    } catch (error) {
      const message = normalizeTelegramError(error);
      store.updateBot(bot.id, { status: 'degraded', lastError: message });
      return res.status(502).json({ error: message });
    }
  })
);

app.delete(
  '/api/bots/:id',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const token = store.getBotToken(bot.id);
    if (token) {
      await deleteWebhook(token).catch(() => undefined);
    }
    store.removeBot(bot.id);
    return res.json({ ok: true });
  })
);

app.patch(
  '/api/bots/:id',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const updateSchema = z.object({
      language: z.enum(['pt', 'en', 'es']).optional(),
      niche: z.string().trim().max(50).optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });

    const updates: Partial<StoredBot> = {};
    if (parsed.data.language) {
      updates.language = parsed.data.language;
      const token = store.getBotToken(bot.id);
      if (token) {
        const localizedCommands = getLocalizedCommands(parsed.data.language);
        await setMyCommands(token, localizedCommands).catch(() => undefined);
        updates.commands = localizedCommands;
      }
    }
    if (parsed.data.niche) updates.niche = parsed.data.niche;

    store.updateBot(bot.id, updates);
    const updated = store.getPublicState().bots.find((b) => b.id === bot.id);
    return res.json({ ok: true, bot: updated });
  })
);

app.post(
  '/api/bots/:id/sync',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const result = await syncBotUpdates(bot.id);
    if (!result.ok) return res.status(409).json({ error: result.error });
    return res.json({ ...result, state: store.getPublicState() });
  })
);

app.post(
  '/api/bots/sync-all',
  asyncHandler(async (_req, res) => {
    const results = await syncAllBots();
    return res.json({ ok: true, results, state: store.getPublicState() });
  })
);

const webhookSchema = z.object({
  publicBaseUrl: z.string().trim().url('Informe uma URL pública válida.').optional(),
});

app.post(
  '/api/bots/:id/webhook',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const parsed = webhookSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const base = (parsed.data.publicBaseUrl || store.settings.publicBaseUrl || PUBLIC_BASE_URL).replace(
      /\/$/,
      ''
    );
    if (!/^https:\/\//i.test(base)) {
      return res.status(400).json({
        error: 'O Telegram exige uma URL pública HTTPS. Configure a URL pública em Ajustes.',
      });
    }
    const token = store.getBotToken(bot.id);
    if (!token) return res.status(409).json({ error: 'Token ilegível. Reconecte o bot.' });
    const secret = randomToken(32);
    const url = `${base}/api/telegram/webhook/${encodeURIComponent(bot.id)}`;
    try {
      await setWebhook(token, url, secret);
      store.updateBot(bot.id, {
        webhookUrl: url,
        webhookSecretEnc: encryptSecret(secret),
        status: 'online',
        lastError: null,
        pendingUpdates: 0,
      });
      if (base !== store.settings.publicBaseUrl) store.updateSettings({ publicBaseUrl: base });
      return res.json({ ok: true, webhookUrl: url });
    } catch (error) {
      return res.status(502).json({ error: normalizeTelegramError(error) });
    }
  })
);

app.delete(
  '/api/bots/:id/webhook',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const token = store.getBotToken(bot.id);
    if (!token) return res.status(409).json({ error: 'Token ilegível. Reconecte o bot.' });
    try {
      await deleteWebhook(token);
      store.updateBot(bot.id, { webhookUrl: null, webhookSecretEnc: null });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(502).json({ error: normalizeTelegramError(error) });
    }
  })
);

const commandsSchema = z.object({
  commands: z
    .array(
      z.object({
        command: z.string().regex(/^[a-z0-9_]{1,32}$/i, 'Comando inválido.'),
        description: z.string().min(1).max(256),
      })
    )
    .max(50)
    .optional(),
});

app.post(
  '/api/bots/:id/commands',
  asyncHandler(async (req, res) => {
    const bot = botOr404(req.params.id, res);
    if (!bot) return;
    const parsed = commandsSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const token = store.getBotToken(bot.id);
    if (!token) return res.status(409).json({ error: 'Token ilegível. Reconecte o bot.' });
    const botLang = normalizeLang(bot.language);
    const defaults: BotCommand[] = getLocalizedCommands(botLang);
    const commands: BotCommand[] = parsed.data.commands || [
      ...defaults,
      ...bot.commands.filter(
        (existing) => !defaults.some((command) => command.command === existing.command)
      ),
    ].slice(0, 100);
    try {
      await setMyCommands(token, commands);
      store.updateBot(bot.id, { commands });
      return res.json({ ok: true, commands });
    } catch (error) {
      return res.status(502).json({ error: normalizeTelegramError(error) });
    }
  })
);

// ---------- Chats ----------

const chatSchema = z.object({
  botId: z.string().min(1),
  chatId: z.string().trim().min(1, 'Informe o ID ou @username do canal/grupo.'),
});

app.post(
  '/api/chats',
  asyncHandler(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const bot = botOr404(parsed.data.botId, res);
    if (!bot) return;
    const token = store.getBotToken(bot.id);
    if (!token) return res.status(409).json({ error: 'Token ilegível. Reconecte o bot.' });
    try {
      const chat = await getChat(token, parsed.data.chatId);
      if (chat.type === 'private') {
        return res.status(400).json({ error: 'Use um canal, grupo ou supergrupo.' });
      }
      const [membersCount, member] = await Promise.all([
        getChatMemberCount(token, String(chat.id)),
        getChatMember(token, String(chat.id), bot.id),
      ]);
      const isAdmin = Boolean(
        member && ['administrator', 'creator'].includes(member.status)
      );
      const saved = store.upsertChat({
        botId: bot.id,
        telegramChatId: String(chat.id),
        title: chat.title || 'Chat Telegram',
        type: chat.type,
        username: chat.username || null,
        membersCount,
        isAdmin,
        isActive: true,
      });
      return res.status(201).json({
        ok: true,
        chat: saved,
        warning: isAdmin ? null : 'O bot não é administrador deste chat. O envio pode falhar.',
      });
    } catch (error) {
      return res.status(400).json({ error: normalizeTelegramError(error) });
    }
  })
);

app.delete('/api/chats/:id', (req, res) => {
  if (!store.removeChat(req.params.id)) return res.status(404).json({ error: 'Chat não encontrado.' });
  return res.json({ ok: true });
});

// ---------- Leads ----------

const leadPatchSchema = z.object({
  status: z.enum(['novo', 'interessado', 'qualificado', 'cliente', 'arquivado']).optional(),
  notes: z.string().max(2_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

app.patch('/api/leads/:id', (req, res) => {
  const parsed = leadPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
  const lead = store.updateLead(req.params.id, parsed.data);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
  return res.json({ ok: true, lead });
});

app.delete('/api/leads/:id', (req, res) => {
  const lead = store.rawLeads.find((item) => item.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
  store.updateLead(lead.id, { status: 'arquivado' as LeadStatus });
  return res.json({ ok: true });
});

// ---------- Upload de Mídia (Foto, Vídeo, GIF) ----------

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  dataUrl: z.string().min(10),
  mediaType: z.enum(['photo', 'video', 'animation']).optional(),
});

app.post(
  '/api/upload',
  asyncHandler(async (req, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });

    const matches = parsed.data.dataUrl.match(/^data:([a-zA-Z0-9/+=.-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Formato de arquivo inválido. Envie um base64 válido.' });
    }

    const mime = matches[1].toLowerCase();
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 45 * 1024 * 1024) {
      return res.status(413).json({ error: 'Arquivo excede o limite de 45MB.' });
    }

    let ext = path.extname(parsed.data.filename).replace('.', '').toLowerCase();
    if (!ext) {
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('mp4')) ext = 'mp4';
      else if (mime.includes('webm')) ext = 'webm';
      else ext = 'bin';
    }

    let detectedType: 'photo' | 'video' | 'animation' = 'photo';
    if (parsed.data.mediaType) {
      detectedType = parsed.data.mediaType;
    } else if (mime.includes('video') || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) {
      detectedType = 'video';
    } else if (mime.includes('gif') || ext === 'gif') {
      detectedType = 'animation';
    }

    const safeName = `media_${Date.now()}_${randomToken().slice(0, 8)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    await fs.promises.writeFile(filePath, buffer);

    const proto = (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).toString();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
    const fullUrl = host ? `${proto}://${host}/uploads/${safeName}` : `/uploads/${safeName}`;

    return res.json({
      ok: true,
      url: `/uploads/${safeName}`,
      fullUrl,
      filename: safeName,
      size: buffer.length,
      mediaType: detectedType,
    });
  })
);

// ---------- Mensagens ----------

const buttonSchema = z.object({
  text: z.string().trim().min(1).max(64),
  url: z.string().trim().url().optional(),
  callbackData: z.string().trim().max(64).optional(),
});

const mediaGridItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().trim().min(1),
  type: z.enum(['photo', 'video']),
  position: z.enum(['main-left', 'top-right', 'bottom-right', 'auto']).optional(),
  order: z.number().optional(),
});

const sendSchema = z
  .object({
    botId: z.string().min(1),
    chatId: z.string().trim().min(1),
    text: z.string().trim().min(1).max(4_096),
    imageUrl: z.string().trim().max(500_000).optional().or(z.literal('')),
    mediaType: z.enum(['photo', 'video', 'animation']).optional(),
    mediaGrid: z.array(mediaGridItemSchema).max(10).optional(),
    buttons: z.array(buttonSchema).max(12).optional(),
  })
  .refine((data) => (!data.imageUrl && (!data.mediaGrid || data.mediaGrid.length === 0)) || data.text.length <= 1_024, {
    message: 'Com mídia anexada, a legenda deve ter no máximo 1024 caracteres.',
    path: ['text'],
  });

app.post(
  '/api/messages/send',
  asyncHandler(async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    const bot = botOr404(parsed.data.botId, res);
    if (!bot) return;
    const lead = store.rawLeads.find(
      (item) =>
        item.botId === bot.id &&
        (item.telegramUserId === parsed.data.chatId || item.username === parsed.data.chatId)
    );

    const proto = (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).toString();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();

    let finalImageUrl = parsed.data.imageUrl || undefined;
    if (finalImageUrl && finalImageUrl.startsWith('/uploads/') && host) {
      finalImageUrl = `${proto}://${host}${finalImageUrl}`;
    }

    const finalMediaGrid = parsed.data.mediaGrid?.map((item) => {
      let u = item.url;
      if (u.startsWith('/uploads/') && host) u = `${proto}://${host}${u}`;
      return { url: u, type: item.type };
    });

    const result = await deliverMessage(bot.id, parsed.data.chatId, parsed.data.text, {
      imageUrl: finalImageUrl,
      mediaType: parsed.data.mediaType,
      mediaGrid: finalMediaGrid,
      buttons: parsed.data.buttons,
      leadId: lead?.id || null,
    });
    if (!result.ok) return res.status(502).json({ error: result.error });
    return res.json(result);
  })
);

const broadcastSchema = z
  .object({
    botId: z.string().min(1),
    audience: z.enum(['all', 'novo', 'interessado', 'qualificado', 'cliente', 'arquivado']),
    text: z.string().trim().min(1).max(4_096),
    imageUrl: z.string().trim().max(500_000).optional().or(z.literal('')),
    mediaType: z.enum(['photo', 'video', 'animation']).optional(),
    mediaGrid: z.array(mediaGridItemSchema).max(10).optional(),
    buttons: z.array(buttonSchema).max(12).optional(),
  })
  .refine((data) => (!data.imageUrl && (!data.mediaGrid || data.mediaGrid.length === 0)) || data.text.length <= 1_024, {
    message: 'Com mídia anexada, a legenda deve ter no máximo 1024 caracteres.',
    path: ['text'],
  });

app.post(
  '/api/messages/broadcast',
  asyncHandler(async (req, res) => {
    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
    if (!store.findBot(parsed.data.botId)) return res.status(404).json({ error: 'Bot não encontrado.' });

    const proto = (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).toString();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();

    let finalImageUrl = parsed.data.imageUrl || undefined;
    if (finalImageUrl && finalImageUrl.startsWith('/uploads/') && host) {
      finalImageUrl = `${proto}://${host}${finalImageUrl}`;
    }

    const finalMediaGrid = parsed.data.mediaGrid?.map((item) => {
      let u = item.url;
      if (u.startsWith('/uploads/') && host) u = `${proto}://${host}${u}`;
      return { url: u, type: item.type };
    });

    const result = await broadcastToAudience({
      botId: parsed.data.botId,
      audience: parsed.data.audience,
      text: parsed.data.text,
      imageUrl: finalImageUrl,
      mediaType: parsed.data.mediaType,
      mediaGrid: finalMediaGrid,
      buttons: parsed.data.buttons,
    });
    return res.json(result);
  })
);

// ---------- Campanhas ----------

const campaignSchema = z.object({
  botId: z.string().min(1),
  title: z.string().trim().min(1, 'Informe um título.').max(80),
  content: z.string().trim().min(1, 'Escreva a mensagem.').max(4_096),
  audience: z.enum(['all', 'novo', 'interessado', 'qualificado', 'cliente', 'arquivado']),
  chatIds: z.array(z.string().trim().min(1)).max(50).optional(),
  scheduledFor: z.string().datetime({ offset: true }),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  recurrence: z.enum(['once', 'daily', 'weekly']),
});

app.post('/api/campaigns', (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
  if (!store.findBot(parsed.data.botId)) return res.status(404).json({ error: 'Bot não encontrado.' });
  const scheduledFor = new Date(parsed.data.scheduledFor).toISOString();
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : scheduledFor;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null;
  if (endsAt && endsAt <= startsAt) {
    return res.status(400).json({ error: 'A data de término precisa ser depois da data de início.' });
  }
  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: newId('cmp'),
    botId: parsed.data.botId,
    title: parsed.data.title,
    content: parsed.data.content,
    audience: parsed.data.audience,
    chatIds: parsed.data.chatIds || [],
    scheduledFor,
    startsAt,
    endsAt,
    recurrence: parsed.data.recurrence,
    status: 'agendada',
    lastRunAt: null,
    lastResult: null,
    sentCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  store.addCampaign(campaign);
  return res.status(201).json({ ok: true, campaign });
});

const campaignPatchSchema = z.object({
  status: z.enum(['agendada', 'pausada']).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
});

app.patch('/api/campaigns/:id', (req, res) => {
  const parsed = campaignPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
  const patch: Partial<Campaign> = {};
  if (parsed.data.status) patch.status = parsed.data.status;
  if (parsed.data.scheduledFor) patch.scheduledFor = new Date(parsed.data.scheduledFor).toISOString();
  const campaign = store.updateCampaign(req.params.id, patch);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
  return res.json({ ok: true, campaign });
});

app.delete('/api/campaigns/:id', (req, res) => {
  if (!store.removeCampaign(req.params.id)) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }
  return res.json({ ok: true });
});

app.post(
  '/api/campaigns/:id/run',
  asyncHandler(async (req, res) => {
    const result = await executeCampaign(req.params.id, true);
    if (!result.ok) return res.status(409).json({ error: result.error });
    return res.json({ ...result, state: store.getPublicState() });
  })
);

// ---------- Ajustes ----------

const settingsSchema = z.object({
  operatorName: z.string().trim().min(1).max(80).optional(),
  autoReplyEnabled: z.boolean().optional(),
  welcomeMessage: z.string().trim().min(1).max(4_096).optional(),
  notifyNewLeads: z.boolean().optional(),
  adminChatId: z
    .string()
    .trim()
    .max(64)
    .refine(
      (value) => value === '' || /^-?\d{5,20}$/.test(value),
      'Use o ID numérico do chat do administrador.'
    )
    .optional(),
  publicBaseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === '' || /^https?:\/\/.+/i.test(value), 'URL inválida.')
    .optional(),
});

app.patch('/api/settings', (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
  const patch = parsed.data as Partial<Settings>;
  if (patch.publicBaseUrl) patch.publicBaseUrl = patch.publicBaseUrl.replace(/\/$/, '');
  const settings = store.updateSettings(patch);
  return res.json({ ok: true, settings });
});

app.get('/api/export', (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="hot-system-${Date.now()}.json"`);
  res.json(store.getPublicState());
});

app.post(
  '/api/data/clear',
  asyncHandler(async (req, res) => {
    const confirm = String(req.body?.confirm || '').trim().toUpperCase();
    if (confirm !== 'LIMPAR' && confirm !== 'REINICIAR') {
      return res.status(400).json({ error: 'Confirmação inválida. Digite REINICIAR ou LIMPAR.' });
    }
    store.clearOperationalData();
    await store.flushAsync();
    return res.json({ ok: true });
  })
);

// ---------- Frontend ----------

const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const serveBuiltFrontend =
  IS_PRODUCTION || (process.env.NODE_ENV !== 'development' && fs.existsSync(DIST_INDEX));

if (serveBuiltFrontend) {
  if (!fs.existsSync(DIST_INDEX)) {
    console.error('dist/index.html não encontrado. Execute npm run build antes de iniciar.');
    process.exit(1);
  }
  app.use((_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'"
    );
    next();
  });
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(DIST_INDEX);
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Rota não encontrada.' });
  return res.status(404).send('Não encontrado.');
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] erro:', error);
  if (res.headersSent) return;
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Corpo JSON inválido.' });
  }
  const message = error instanceof Error ? error.message : 'Erro interno do servidor.';
  res.status(500).json({ error: message });
});

export { app };

/** Carrega o armazenamento remoto antes de atender a primeira requisição. */
export async function prepare(): Promise<typeof app> {
  await store.ready();
  return app;
}

