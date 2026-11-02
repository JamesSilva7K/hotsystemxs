import type { Lead, MessageLog } from '../shared/types.js';
import { restartFollowUpForLead } from './followups.js';
import { newId, store, type StoredBot } from './store.js';
import {
  answerCallbackQuery,
  getChatMember,
  getChatMemberCount,
  getUpdates,
  normalizeTelegramError,
  sendText,
  type TelegramMessage,
  type TelegramUpdate,
} from './telegram.js';

const syncLocks = new Map<string, Promise<unknown>>();

function leadName(message: TelegramMessage): string {
  const from = message.from;
  if (!from) return message.chat.title || 'Contato Telegram';
  return [from.first_name, from.last_name].filter(Boolean).join(' ').trim() || `Usuário ${from.id}`;
}

function messageText(message: TelegramMessage): string {
  if (message.text) return message.text;
  if (message.caption) return message.caption;
  if (message.new_chat_members?.length) return '[entrada de membros]';
  return '[mídia recebida]';
}

function sourceTitle(message: TelegramMessage): string {
  if (message.chat.type === 'private') return 'Conversa privada';
  if (message.chat.type === 'channel') return message.chat.title || 'Canal';
  return message.chat.title || 'Grupo';
}

function renderWelcome(template: string, lead: Lead, bot: StoredBot): string {
  return template
    .replaceAll('{nome}', lead.name.split(' ')[0] || lead.name)
    .replaceAll('{username}', lead.username ? `@${lead.username}` : lead.name)
    .replaceAll('{bot}', bot.firstName);
}

function logOutbound(
  botId: string,
  chatId: string,
  leadId: string | null,
  text: string,
  status: 'enviado' | 'falhou',
  telegramMessageId: string | null,
  error: string | null
): void {
  const message: MessageLog = {
    id: newId('msg'),
    botId,
    leadId,
    chatId,
    direction: 'out',
    text: text.slice(0, 2_000),
    status,
    telegramMessageId,
    error,
    createdAt: new Date().toISOString(),
  };
  store.addMessage(message);
}

async function replyToLead(bot: StoredBot, token: string, lead: Lead, text: string): Promise<boolean> {
  try {
    const result = await sendText(token, lead.telegramUserId, text);
    logOutbound(bot.id, lead.telegramUserId, lead.id, text, 'enviado', String(result.message_id), null);
    return true;
  } catch (error) {
    logOutbound(bot.id, lead.telegramUserId, lead.id, text, 'falhou', null, normalizeTelegramError(error));
    return false;
  }
}

async function notifyAdmin(bot: StoredBot, token: string, lead: Lead): Promise<void> {
  const settings = store.settings;
  if (!settings.notifyNewLeads || !settings.adminChatId) return;
  if (settings.adminChatId === lead.telegramUserId) return;
  const username = lead.username ? `@${lead.username}` : 'sem username';
  const text = [
    'Novo lead captado',
    `Bot: ${bot.firstName} (@${bot.username})`,
    `Nome: ${lead.name}`,
    `Telegram: ${username} · ID ${lead.telegramUserId}`,
    `Origem: ${lead.sourceChatTitle}`,
  ].join('\n');
  try {
    await sendText(token, settings.adminChatId, text);
  } catch {
    // Admin notifications must never break update processing.
  }
}

async function upsertChatFromUpdate(bot: StoredBot, token: string, message: TelegramMessage): Promise<void> {
  if (message.chat.type === 'private') return;
  const existing = store.rawChats.find(
    (chat) => chat.botId === bot.id && chat.telegramChatId === String(message.chat.id)
  );
  const membersCount = existing
    ? existing.membersCount
    : await getChatMemberCount(token, String(message.chat.id));
  const member = existing
    ? null
    : await getChatMember(token, String(message.chat.id), bot.id);
  store.upsertChat({
    botId: bot.id,
    telegramChatId: String(message.chat.id),
    title: message.chat.title || 'Chat Telegram',
    type: message.chat.type === 'channel' ? 'channel' : message.chat.type,
    username: message.chat.username || null,
    membersCount,
    isAdmin: existing
      ? existing.isAdmin
      : Boolean(member && ['administrator', 'creator'].includes(member.status)),
    isActive: true,
  });
}

async function processTelegramUpdateInner(botId: string, update: TelegramUpdate): Promise<void> {
  if (store.hasSeenUpdate(update.update_id)) return;
  const markSeen = () => store.markUpdateSeen(update.update_id);

  const bot = store.findBot(botId);
  if (!bot) {
    markSeen();
    return;
  }
  const token = store.getBotToken(bot.id);
  if (!token) {
    store.updateBot(bot.id, {
      status: 'offline',
      lastError: 'Token ilegível. Reconecte o bot para gerar uma nova chave.',
    });
    markSeen();
    return;
  }

  if (update.callback_query) {
    const query = update.callback_query;
    await answerCallbackQuery(token, query.id, 'Recebido');
    const from = query.from;
    if (from && !from.is_bot) {
      const chat = query.message?.chat;
      const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
      const text = `[botão] ${query.data || 'sem dados'}`;
      const { lead, created } = store.upsertLead({
        botId: bot.id,
        telegramUserId: String(from.id),
        name: fullName || `Usuário ${from.id}`,
        username: from.username || null,
        sourceChatId: chat ? String(chat.id) : String(from.id),
        sourceChatTitle: chat && chat.type !== 'private' ? chat.title || 'Grupo' : 'Conversa privada',
        languageCode: from.language_code || null,
        lastMessageText: text,
      });
      store.addMessage({
        id: newId('msg'),
        botId: bot.id,
        leadId: lead.id,
        chatId: chat ? String(chat.id) : String(from.id),
        direction: 'in',
        text,
        status: 'entregue',
        telegramMessageId: query.message ? String(query.message.message_id) : null,
        error: null,
        createdAt: new Date().toISOString(),
      });
      if (created) void notifyAdmin(bot, token, lead);
      restartFollowUpForLead(lead.id);
    }
    markSeen();
    return;
  }

  if (update.my_chat_member) {
    const chat = update.my_chat_member.chat;
    const status = update.my_chat_member.new_chat_member.status;
    if (chat.type !== 'private') {
      store.upsertChat({
        botId: bot.id,
        telegramChatId: String(chat.id),
        title: chat.title || 'Chat Telegram',
        type: chat.type === 'channel' ? 'channel' : chat.type === 'supergroup' ? 'supergroup' : 'group',
        username: chat.username || null,
        membersCount: await getChatMemberCount(token, String(chat.id)),
        isAdmin: status === 'administrator',
        isActive: status !== 'left' && status !== 'kicked',
      });
    }
    markSeen();
    return;
  }

  if (update.chat_member) {
    const chat = update.chat_member.chat;
    if (chat.type !== 'private') {
      const existing = store.rawChats.find(
        (item) => item.botId === bot.id && item.telegramChatId === String(chat.id)
      );
      if (existing) {
        store.upsertChat({
          ...existing,
          botId: bot.id,
          telegramChatId: String(chat.id),
          title: existing.title,
          type: existing.type,
        });
      }
    }
  }

  const message = update.message || update.edited_message || update.channel_post;
  if (!message) {
    markSeen();
    return;
  }

  await upsertChatFromUpdate(bot, token, message);

  const from = message.from;
  if (!from || from.is_bot) {
    markSeen();
    return;
  }

  const text = messageText(message);
  const { lead, created } = store.upsertLead({
    botId: bot.id,
    telegramUserId: String(from.id),
    name: leadName(message),
    username: from.username || null,
    sourceChatId: String(message.chat.id),
    sourceChatTitle: sourceTitle(message),
    languageCode: from.language_code || null,
    lastMessageText: text,
  });

  store.addMessage({
    id: newId('msg'),
    botId: bot.id,
    leadId: lead.id,
    chatId: String(message.chat.id),
    direction: 'in',
    text: text.slice(0, 2_000),
    status: 'entregue',
    telegramMessageId: String(message.message_id),
    error: null,
    createdAt: new Date().toISOString(),
  });

  if (created) {
    void notifyAdmin(bot, token, lead);
  }

  // Qualquer mensagem do lead reancora a sequência de recuperação.
  restartFollowUpForLead(lead.id);

  const settings = store.settings;
  const normalized = text.trim().toLowerCase().split(/\s+/)[0] || '';
  const isStart = normalized === '/start' || normalized.startsWith('/start@');
  const isHelp = ['/ajuda', '/help', '/menu'].includes(normalized);

  if (message.chat.type === 'private' && settings.autoReplyEnabled) {
    const existingLead = store.rawLeads.find((item) => item.id === lead.id);
    const alreadyReplied = Boolean(existingLead?.tags.includes('boas-vindas-enviada'));
    if (isStart || isHelp || (!alreadyReplied && created)) {
      const welcome =
        settings.welcomeMessage.trim() ||
        'Olá, {nome}! Recebemos sua mensagem e já vamos te atender por aqui.';
      const sent = await replyToLead(bot, token, lead, renderWelcome(welcome, lead, bot));
      if (sent) {
        store.updateLead(lead.id, {
          tags: Array.from(new Set([...(existingLead?.tags || []), 'boas-vindas-enviada'])),
        });
      }
    }
  }

  markSeen();
}

const updateQueues = new Map<string, Promise<void>>();

async function processAndTouch(botId: string, update: TelegramUpdate): Promise<void> {
  await processTelegramUpdateInner(botId, update);
  const bot = store.findBot(botId);
  if (bot) {
    store.updateBot(botId, {
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      status: 'online',
    });
  }
}

export function processTelegramUpdate(botId: string, update: TelegramUpdate): Promise<void> {
  const previous = updateQueues.get(botId) || Promise.resolve();
  const current = previous.then(
    () => processAndTouch(botId, update),
    () => processAndTouch(botId, update)
  );
  const queued = current.catch(() => undefined);
  updateQueues.set(botId, queued);
  void queued.finally(() => {
    if (updateQueues.get(botId) === queued) updateQueues.delete(botId);
  });
  return current;
}

export async function syncBotUpdates(botId: string): Promise<{
  ok: boolean;
  processed: number;
  leads: number;
  error?: string;
}> {
  const existing = syncLocks.get(botId);
  if (existing) {
    await existing.catch(() => undefined);
  }
  const run = (async () => {
    const bot = store.findBot(botId);
    if (!bot) return { ok: false, processed: 0, leads: 0, error: 'Bot não encontrado.' };
    if (bot.webhookUrl) {
      return {
        ok: false,
        processed: 0,
        leads: 0,
        error:
          'Este bot está usando webhook. As atualizações chegam automaticamente pela URL configurada; não use polling enquanto o webhook estiver ativo.',
      };
    }
    const token = store.getBotToken(bot.id);
    if (!token) {
      return { ok: false, processed: 0, leads: 0, error: 'Token ilegível. Reconecte o bot.' };
    }
    const beforeLeads = store.rawLeads.length;
    try {
      const updates = await getUpdates(token, bot.offset);
      for (const update of updates) {
        await processTelegramUpdate(bot.id, update);
      }
      const nextOffset =
        updates.length > 0
          ? Math.max(...updates.map((update) => update.update_id)) + 1
          : bot.offset;
      store.updateBot(bot.id, {
        offset: nextOffset,
        lastUpdateId: nextOffset > 0 ? nextOffset - 1 : 0,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        status: 'online',
        pendingUpdates: 0,
      });
      return {
        ok: true,
        processed: updates.length,
        leads: Math.max(0, store.rawLeads.length - beforeLeads),
      };
    } catch (error) {
      const message = normalizeTelegramError(error);
      store.updateBot(bot.id, {
        status: 'degraded',
        lastError: message,
        lastSyncAt: new Date().toISOString(),
      });
      return { ok: false, processed: 0, leads: 0, error: message };
    }
  })();
  syncLocks.set(botId, run);
  try {
    return await run;
  } finally {
    if (syncLocks.get(botId) === run) syncLocks.delete(botId);
  }
}

export async function syncAllBots(): Promise<
  Array<{ botId: string; username: string; ok: boolean; processed: number; leads: number; error?: string }>
> {
  const results = [];
  for (const bot of store.rawBots) {
    if (bot.webhookUrl) {
      results.push({
        botId: bot.id,
        username: bot.username,
        ok: true,
        processed: 0,
        leads: 0,
      });
      continue;
    }
    const result = await syncBotUpdates(bot.id);
    results.push({ botId: bot.id, username: bot.username, ...result });
  }
  return results;
}
