import fs from 'node:fs';
import path from 'node:path';
import type { BotCommand } from '../shared/types.js';
export type { BotCommand };
import { AVATAR_DIR } from './config.js';

const API_ROOT = 'https://api.telegram.org';

export class TelegramError extends Error {
  code: number;
  retryAfter: number | null;

  constructor(code: number, description: string, retryAfter: number | null = null) {
    super(description);
    this.name = 'TelegramError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  invite_link?: string;
  photo?: { small_file_id: string; big_file_id: string };
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: {
    chat: TelegramChat;
    from: TelegramUser;
    date: number;
    new_chat_member: { status: string; user: TelegramUser };
  };
  chat_member?: {
    chat: TelegramChat;
    from: TelegramUser;
    date: number;
    new_chat_member: { status: string; user: TelegramUser };
  };
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

export function isValidTokenFormat(token: string): boolean {
  return /^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(token.trim());
}

export async function callTelegram<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
  timeoutMs = 20_000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_ROOT}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });
    let data: TelegramResponse<T>;
    try {
      data = (await response.json()) as TelegramResponse<T>;
    } catch {
      throw new TelegramError(response.status, 'Resposta inválida da API do Telegram.');
    }
    if (!data.ok) {
      throw new TelegramError(
        data.error_code || response.status,
        data.description || 'A API do Telegram recusou a operação.',
        data.parameters?.retry_after || null
      );
    }
    return data.result as T;
  } catch (error) {
    if (error instanceof TelegramError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TelegramError(0, 'Tempo esgotado ao contatar a API do Telegram.');
    }
    throw new TelegramError(0, 'Falha de conexão com a API do Telegram. Verifique a rede do servidor.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMe(token: string) {
  return callTelegram<TelegramUser>(token, 'getMe');
}

export async function getWebhookInfo(token: string) {
  return callTelegram<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  }>(token, 'getWebhookInfo');
}

export async function getMyCommands(token: string) {
  try {
    return await callTelegram<BotCommand[]>(token, 'getMyCommands');
  } catch {
    return [];
  }
}

export async function getMyDescription(token: string) {
  try {
    const result = await callTelegram<{ description: string }>(token, 'getMyDescription');
    return result.description || '';
  } catch {
    return '';
  }
}

export async function setMyCommands(
  token: string,
  commands: BotCommand[]
): Promise<void> {
  await callTelegram(token, 'setMyCommands', { commands });
}

export async function deleteWebhook(token: string): Promise<void> {
  await callTelegram(token, 'deleteWebhook', { drop_pending_updates: false });
}

export async function setWebhook(
  token: string,
  url: string,
  secretToken: string
): Promise<void> {
  await callTelegram(token, 'setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member', 'chat_member'],
    max_connections: 40,
  });
}

export async function getUpdates(
  token: string,
  offset: number,
  limit = 100
): Promise<TelegramUpdate[]> {
  return callTelegram<TelegramUpdate[]>(
    token,
    'getUpdates',
    {
      offset,
      limit,
      timeout: 0,
      allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member', 'chat_member'],
    },
    25_000
  );
}

export async function getChat(token: string, chatId: string): Promise<TelegramChat> {
  return callTelegram<TelegramChat>(token, 'getChat', { chat_id: chatId });
}

export async function getChatMemberCount(token: string, chatId: string): Promise<number> {
  try {
    return await callTelegram<number>(token, 'getChatMemberCount', { chat_id: chatId });
  } catch {
    return 0;
  }
}

export async function getChatMember(
  token: string,
  chatId: string,
  userId: string
): Promise<{ status: string } | null> {
  try {
    return await callTelegram<{ status: string }>(token, 'getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });
  } catch {
    return null;
  }
}

export async function getUserProfilePhotos(
  token: string,
  userId: string
): Promise<Array<{ file_id: string }>> {
  try {
    const result = await callTelegram<{
      total_count: number;
      photos: Array<Array<{ file_id: string; width: number; height: number }>>;
    }>(token, 'getUserProfilePhotos', { user_id: userId, limit: 1 });
    return result.photos?.[0] || [];
  } catch {
    return [];
  }
}

export async function downloadBotAvatar(token: string, userId: string): Promise<string | null> {
  const photos = await getUserProfilePhotos(token, userId);
  const photo = photos[photos.length - 1];
  if (!photo) return null;
  try {
    const file = await callTelegram<{ file_path: string }>(token, 'getFile', {
      file_id: photo.file_id,
    });
    if (!file.file_path) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${API_ROOT}/file/bot${token}/${file.file_path}`, {
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 5 * 1024 * 1024) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const target = path.join(AVATAR_DIR, `${userId}.jpg`);
      fs.writeFileSync(target, buffer);
      return `${userId}.jpg`;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

function buildReplyMarkup(
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
): Record<string, unknown> | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  type KeyboardButton = { text: string; url?: string; callback_data?: string };
  const rows: Array<KeyboardButton | null> = buttons.slice(0, 12).map((button) => {
    const text = String(button.text || '').trim().slice(0, 64);
    if (!text) return null;
    if (button.url && /^https?:\/\//i.test(button.url)) {
      return { text, url: button.url };
    }
    const data = String(button.callbackData || '').trim().slice(0, 64);
    if (!data) return null;
    return { text, callback_data: data };
  });
  const filtered = rows.filter((row): row is KeyboardButton => row !== null);
  return filtered.length ? { inline_keyboard: filtered.map((row) => [row]) } : undefined;
}

/**
 * Converte a sintaxe simples das mensagens para HTML aceito pelo Telegram:
 * **negrito**, `código` e _itálico_. Tudo é escapado antes, então nenhum texto
 * do lead consegue injetar tags.
 */
export function toTelegramHtml(input: string): string {
  const escaped = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?;:])/g, '$1<i>$2</i>');
}

export async function sendText(
  token: string,
  chatId: string,
  text: string,
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
): Promise<{ message_id: number }> {
  const markup = buildReplyMarkup(buttons);
  try {
    return await callTelegram<{ message_id: number }>(token, 'sendMessage', {
      chat_id: chatId,
      text: toTelegramHtml(text),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: markup,
    });
  } catch (error) {
    // Uma tag inesperada não pode impedir a entrega: reenvia como texto puro.
    if (error instanceof TelegramError && error.code === 400) {
      return callTelegram<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text: text.slice(0, 4_096),
        disable_web_page_preview: true,
        reply_markup: markup,
      });
    }
    throw error;
  }
}

export async function sendPhoto(
  token: string,
  chatId: string,
  photoUrl: string,
  caption: string,
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
): Promise<{ message_id: number }> {
  const markup = buildReplyMarkup(buttons);
  const safeCaption = caption.slice(0, 1024);
  try {
    return await callTelegram<{ message_id: number }>(token, 'sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption: toTelegramHtml(safeCaption),
      parse_mode: 'HTML',
      reply_markup: markup,
    });
  } catch (error) {
    if (error instanceof TelegramError && error.code === 400) {
      return callTelegram<{ message_id: number }>(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption: safeCaption,
        reply_markup: markup,
      });
    }
    throw error;
  }
}

export async function sendVideo(
  token: string,
  chatId: string,
  videoUrl: string,
  caption: string,
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
): Promise<{ message_id: number }> {
  const markup = buildReplyMarkup(buttons);
  const safeCaption = caption.slice(0, 1024);
  try {
    return await callTelegram<{ message_id: number }>(token, 'sendVideo', {
      chat_id: chatId,
      video: videoUrl,
      caption: toTelegramHtml(safeCaption),
      parse_mode: 'HTML',
      reply_markup: markup,
      supports_streaming: true,
    });
  } catch (error) {
    if (error instanceof TelegramError && error.code === 400) {
      return callTelegram<{ message_id: number }>(token, 'sendVideo', {
        chat_id: chatId,
        video: videoUrl,
        caption: safeCaption,
        reply_markup: markup,
        supports_streaming: true,
      });
    }
    throw error;
  }
}

export async function sendAnimation(
  token: string,
  chatId: string,
  animationUrl: string,
  caption: string,
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
): Promise<{ message_id: number }> {
  const markup = buildReplyMarkup(buttons);
  const safeCaption = caption.slice(0, 1024);
  try {
    return await callTelegram<{ message_id: number }>(token, 'sendAnimation', {
      chat_id: chatId,
      animation: animationUrl,
      caption: toTelegramHtml(safeCaption),
      parse_mode: 'HTML',
      reply_markup: markup,
    });
  } catch (error) {
    if (error instanceof TelegramError && error.code === 400) {
      return callTelegram<{ message_id: number }>(token, 'sendAnimation', {
        chat_id: chatId,
        animation: animationUrl,
        caption: safeCaption,
        reply_markup: markup,
      });
    }
    throw error;
  }
}

export interface InputMediaItem {
  type: 'photo' | 'video';
  media: string;
  caption?: string;
  parse_mode?: string;
  supports_streaming?: boolean;
}

export async function sendMediaGroup(
  token: string,
  chatId: string,
  media: InputMediaItem[]
): Promise<Array<{ message_id: number }>> {
  return await callTelegram<Array<{ message_id: number }>>(token, 'sendMediaGroup', {
    chat_id: chatId,
    media,
  });
}

export async function sendRichMessage(
  token: string,
  chatId: string,
  text: string,
  options: {
    imageUrl?: string;
    mediaType?: 'photo' | 'video' | 'animation';
    mediaGrid?: Array<{ url: string; type: 'photo' | 'video' }>;
    buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
  } = {}
): Promise<{ message_id: number }> {
  // Álbum / Grid com múltiplas fotos/vídeos
  if (options.mediaGrid && options.mediaGrid.length >= 2) {
    const validItems = options.mediaGrid.filter((item) => /^https?:\/\//i.test(item.url));
    if (validItems.length >= 2) {
      const inputMedia: InputMediaItem[] = validItems.slice(0, 10).map((item, idx) => ({
        type: item.type === 'video' ? 'video' : 'photo',
        media: item.url,
        caption: idx === 0 ? toTelegramHtml(text.slice(0, 1024)) : undefined,
        parse_mode: idx === 0 ? 'HTML' : undefined,
        supports_streaming: item.type === 'video' ? true : undefined,
      }));

      try {
        const albumResult = await sendMediaGroup(token, chatId, inputMedia);
        // Se houver botões interativos, envia a mensagem complementar com os botões logo abaixo do grid
        if (options.buttons && options.buttons.length > 0) {
          await sendText(token, chatId, text, options.buttons);
        }
        return albumResult[0] || { message_id: 0 };
      } catch (err) {
        // Fallback: se o Telegram rejeitar o media group, envia o primeiro item normalmente
        const first = validItems[0];
        if (first.type === 'video') {
          return await sendVideo(token, chatId, first.url, text, options.buttons);
        }
        return await sendPhoto(token, chatId, first.url, text, options.buttons);
      }
    }
  }

  // Mídia individual
  if (options.imageUrl && /^https?:\/\//i.test(options.imageUrl)) {
    const url = options.imageUrl.toLowerCase();
    const isVideo = options.mediaType === 'video' || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);
    const isAnimation = options.mediaType === 'animation' || /\.gif(\?.*)?$/i.test(url);
    try {
      if (isVideo) {
        return await sendVideo(token, chatId, options.imageUrl, text, options.buttons);
      }
      if (isAnimation) {
        return await sendAnimation(token, chatId, options.imageUrl, text, options.buttons);
      }
      return await sendPhoto(token, chatId, options.imageUrl, text, options.buttons);
    } catch (error) {
      if (error instanceof TelegramError && error.code === 400) {
        return sendText(token, chatId, text, options.buttons);
      }
      throw error;
    }
  }
  return sendText(token, chatId, text, options.buttons);
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await callTelegram(token, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text?.slice(0, 200),
      show_alert: false,
    });
  } catch {
    // Callback answers are best-effort.
  }
}

export function normalizeTelegramError(error: unknown): string {
  if (error instanceof TelegramError) {
    const description = error.message;
    const lower = description.toLowerCase();
    if (error.code === 401 || lower.includes('unauthorized')) {
      return 'Token inválido ou revogado pelo Telegram. Gere um novo token no @BotFather.';
    }
    if (error.code === 404 || lower === 'not found') {
      return 'Bot não encontrado no Telegram. Confirme o token e tente novamente.';
    }
    if (error.code === 403 && lower.includes('blocked')) {
      return 'O usuário bloqueou o bot. Ele precisa desbloquear e iniciar uma conversa.';
    }
    if (error.code === 403 && lower.includes('not enough rights')) {
      return 'O bot não tem permissão suficiente neste chat. Promova-o a administrador.';
    }
    if (error.code === 400 && lower.includes('chat not found')) {
      return 'Chat não encontrado. Confirme o ID e se o bot participa do canal ou grupo.';
    }
    if (error.code === 400 && (lower.includes('peer_id_invalid') || lower.includes('user not found'))) {
      return 'Destinatário inválido ou não encontrado pelo Telegram.';
    }
    if (error.code === 400 && lower.includes('button')) {
      return 'Um dos botões foi recusado pelo Telegram. Revise o texto e a URL.';
    }
    if (error.code === 429 || error.retryAfter) {
      return `Limite de requisições do Telegram atingido. Tente novamente em ${error.retryAfter || 30}s.`;
    }
    return description;
  }
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido na API do Telegram.';
}
