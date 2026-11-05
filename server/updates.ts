import type { Lead, MessageLog } from '../shared/types.js';
import { restartFollowUpForLead } from './followups.js';
import { newId, store, type StoredBot } from './store.js';
import {
  getLocalizedConversationReply,
  getLocalizedHelp,
  getLocalizedMenu,
  getLocalizedWelcome,
  normalizeLang,
} from './i18n.js';
import {
  answerCallbackQuery,
  createChatInviteLink,
  getChatMember,
  getChatMemberCount,
  getUpdates,
  normalizeTelegramError,
  sendText,
  TelegramError,
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

async function replyToLead(
  bot: StoredBot,
  token: string,
  lead: Lead,
  text: string,
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
): Promise<boolean> {
  try {
    const result = await sendText(token, lead.telegramUserId, text, buttons);
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

export async function checkAndDeliverVipAccess(
  bot: StoredBot,
  token: string,
  lead: Lead,
  manualTrigger = false
): Promise<{ success: boolean; message?: string }> {
  const reqs = bot.vipRequirements || {
    requireTerms: true,
    requirePayment: true,
    singleUseLink: true,
  };

  const botLang = normalizeLang(bot.language || lead.languageCode);

  if (!bot.vipChannelId) {
    if (manualTrigger) {
      await replyToLead(
        bot,
        token,
        lead,
        botLang === 'en'
          ? '⚠️ VIP Channel is currently being configured by the model. Check back in a few minutes!'
          : botLang === 'es'
          ? '⚠️ El Canal VIP está siendo preparado por la modelo. ¡Vuelve a consultar en unos minutos!'
          : '⚠️ O Canal VIP está sendo configurado pela modelo. Tente novamente em alguns instantes!'
      );
    }
    return { success: false, message: 'Canal VIP não configurado.' };
  }

  // ETAPA 1: Confirmação de Idade (+18) e Termos de Acesso
  if (reqs.requireTerms && !lead.vipTermsAccepted) {
    const termsText =
      botLang === 'en'
        ? `🔞 *AGE & ACCESS VERIFICATION (+18)*\n\nTo access ${bot.firstName}'s exclusive VIP vault, you must confirm you are at least 18 years old and agree to private rules.`
        : botLang === 'es'
        ? `🔞 *VERIFICACIÓN DE EDAD Y TÉRMINOS (+18)*\n\nPara acceder al canal VIP exclusivo de ${bot.firstName}, confirma que tienes 18 años o más y aceptas los términos privados.`
        : `🔞 *VERIFICAÇÃO DE IDADE & TERMOS (+18)*\n\nPara acessar o Canal VIP exclusivo de ${bot.firstName}, confirme que você tem 18 anos ou mais e aceita as diretrizes de acesso privado.`;

    const termsButtons = [
      { text: '🔞 SOU MAIOR DE 18 ANOS E ACEITO', callbackData: 'accept_vip_terms' },
      { text: '❌ RECUSAR', callbackData: 'reject_vip_terms' },
    ];
    await replyToLead(bot, token, lead, termsText, termsButtons);
    return { success: false, message: 'Aguardando termos (+18).' };
  }

  // ETAPA 2: Pagamento Aprovado (PIX ou Cartão)
  if (reqs.requirePayment) {
    const hasApprovedPurchase = store.rawPurchases.some(
      (p) => (p.leadId === lead.id || (lead.username && p.customerEmail.toLowerCase().includes(lead.username.toLowerCase()))) && p.status === 'pago'
    );
    const isClient = lead.status === 'cliente' || hasApprovedPurchase;

    if (!isClient) {
      const payText =
        botLang === 'en'
          ? `🔒 *RESTRICTED VIP ACCESS*\n\nYour payment has not been confirmed yet. Complete your order to unlock your personal one-time invite link to the private channel.`
          : botLang === 'es'
          ? `🔒 *ACCESO VIP RESTRINGIDO*\n\nTu pago aún no ha sido confirmado. Completa tu pedido para desbloquear tu enlace de invitación único y personal al canal VIP.`
          : `🔒 *ACESSO VIP RESTRITO*\n\nIdentificamos que seu pagamento ainda não foi confirmado. Conclua o seu pedido para liberar o link exclusivo de entrada no canal VIP.`;

      const payButtons = [
        { text: '💳 FINALIZAR PAGAMENTO AGORA', url: 'https://syncpayments.com.br' },
        { text: '🔄 JÁ PAGUEI, VERIFICAR', callbackData: 'check_vip_access' },
      ];
      await replyToLead(bot, token, lead, payText, payButtons);
      return { success: false, message: 'Pagamento pendente.' };
    }
  }

  // ETAPA 3: Todas as etapas validadas! Gera o link seguro (anti-vazamento)
  let inviteLink = bot.vipInviteLink;
  if (reqs.singleUseLink && bot.vipChannelId) {
    try {
      const linkRes = await createChatInviteLink(token, bot.vipChannelId, {
        name: `VIP-${lead.telegramUserId}-${Date.now().toString().slice(-4)}`,
        memberLimit: 1, // Anti-vazamento: expira após 1 entrada!
      });
      inviteLink = linkRes.invite_link;
    } catch {
      // Se faltar permissão específica no canal, usa o link estático
      inviteLink = bot.vipInviteLink || 'https://t.me';
    }
  }

  store.updateLead(lead.id, {
    vipUnlocked: true,
    vipUnlockedAt: new Date().toISOString(),
  });

  const successText =
    botLang === 'en'
      ? `🎉 *CONGRATULATIONS! VIP ACCESS GRANTED!*\n\nAll security and purchase verification steps have been approved. Your unique, one-time invite link is ready below. Tap the button to enter the VIP channel immediately:`
      : botLang === 'es'
      ? `🎉 *¡FELICITACIONES! ACCESO VIP CONCEDIDO!*\n\nTodas las etapas de verificación y pago han sido aprobadas con éxito. Tu enlace exclusivo está listo abajo. Toca el botón para entrar:`
      : `🎉 *PARABÉNS! ACESSO VIP LIBERADO COM SUCESSO!*\n\nTodas as etapas exigidas foram 100% validadas e aprovadas! Seu link único e seguro de entrada está pronto abaixo. Clique no botão para entrar no canal agora:`;

  const successButtons = [
    { text: '💎 ENTRAR NO CANAL VIP AGORA', url: inviteLink || 'https://t.me' },
  ];

  await replyToLead(bot, token, lead, successText, successButtons);
  return { success: true };
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

      if (query.data === 'accept_vip_terms') {
        store.updateLead(lead.id, { vipTermsAccepted: true });
        void checkAndDeliverVipAccess(bot, token, { ...lead, vipTermsAccepted: true }, true);
      } else if (query.data === 'check_vip_access' || query.data === 'vip') {
        void checkAndDeliverVipAccess(bot, token, lead, true);
      } else if (query.data === 'menu' || query.data === 'planos') {
        const botLang = normalizeLang(bot.language || lead.languageCode);
        const menuMsg = getLocalizedMenu(botLang, lead.name, bot.firstName);
        void replyToLead(bot, token, lead, menuMsg.text, menuMsg.buttons);
      } else if (query.data === 'teaser_amostra') {
        const botLang = normalizeLang(bot.language || lead.languageCode);
        const teaserText =
          botLang === 'en'
            ? `🔥 *UNLOCKED DM TEASER PREVIEW*\n\nHere is a private preview just for opening this chat with me... My full uncensored 4K videos, tape archives, and personal WhatsApp are waiting for you inside my VIP:`
            : botLang === 'es'
            ? `🔥 *ADELANTO EXCLUSIVO EN DM*\n\nAquí tienes un adelanto privado solo por hablarme directamente... Todos mis vídeos completos sin censura en 4K y mi WhatsApp personal te esperan en mi VIP:`
            : `🔥 *AMOSTRA EXCLUSIVA DESTRAVADA NA DM*\n\nOlha só essa provinha que eu separei só pra você por ter me chamado no privado... Meus vídeos completos em 4K sem tarja nenhuma, arquivos secretos e meu WhatsApp pessoal te esperam no VIP:`;
        const teaserButtons = [
          { text: '💎 QUERO O VIP COMPLETO AGORA', callbackData: 'check_vip_access' },
          { text: '📋 VER TABELA DE VALORES', callbackData: 'menu' },
        ];
        void replyToLead(bot, token, lead, teaserText, teaserButtons);
      }
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
  const rawParts = text.trim().split(/\s+/);
  const normalized = rawParts[0]?.toLowerCase() || '';
  const isStart = normalized === '/start' || normalized.startsWith('/start@');
  const startParam = isStart && rawParts.length > 1 ? rawParts[1].trim() : null;

  const { lead, created } = store.upsertLead({
    botId: bot.id,
    telegramUserId: String(from.id),
    name: leadName(message),
    username: from.username || null,
    sourceChatId: String(message.chat.id),
    sourceChatTitle: sourceTitle(message),
    languageCode: from.language_code || null,
    lastMessageText: text,
    trackingSource: startParam || undefined,
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
  const isMenu = ['/menu', '/planos', '/planes', '/plans'].includes(normalized) || normalized.startsWith('/menu@');
  const isHelp = ['/ajuda', '/help', '/ayuda', '/suporte', '/support'].includes(normalized) || normalized.startsWith('/ajuda@');
  const isVip = ['/vip', '/acesso', '/canal', '/access', '/entrar'].includes(normalized) || normalized.startsWith('/vip@');

  if (message.chat.type === 'private' && settings.autoReplyEnabled) {
    const existingLead = store.rawLeads.find((item) => item.id === lead.id);
    const alreadyReplied = Boolean(existingLead?.tags.includes('boas-vindas-enviada'));
    const botLang = normalizeLang(bot.language || lead.languageCode);

    if (isVip) {
      // Validação segura por etapas para liberação do Canal VIP
      await checkAndDeliverVipAccess(bot, token, lead, true);
    } else if (isStart || (!alreadyReplied && created)) {
      // Onboarding Inteligente da DM baseado na Origem do Lead (Link Rastreado)
      let customText: string | null = null;
      let customButtons: Array<{ text: string; url?: string; callbackData?: string }> | null = null;

      if (startParam) {
        const paramLower = startParam.toLowerCase();
        if (paramLower.includes('previa') || paramLower.includes('free')) {
          customText =
            botLang === 'en'
              ? `🔥 *WELCOME TO MY PRIVATE DM!*\n\nHey babe, so happy you came from my **Preview Group**! That little teaser you saw is nothing compared to what I do in my private VIP... 😏\n\nYour chat with me is completely unlocked here. How do you want to start today?`
              : botLang === 'es'
              ? `🔥 *¡BIENVENIDO A MI DM PRIVADO!*\n\n¡Hola amor! Qué delicia que viniste desde mi **Grupo de Adelantos**. Lo que viste allí no es ni el 10% de lo que hago en mi VIP privado... 😏\n\nTu chat conmigo está 100% desbloqueado aquí. ¿Cómo quieres empezar?`
              : `🔥 *CHAT PRIVADO DESTRAVADO COM SUCESSO!*\n\nOi amor! Vi que você veio do meu **Grupo de Prévias**... que delícia ter você aqui no meu cantinho privado! 🔥🙈\n\nAquilo que você viu lá no grupo grátis não é nem 10% do que eu faço na intimidade do meu VIP com a câmera bem pertinho. Aqui na DM o chat tá 100% liberado pra gente conversar e você ver meus conteúdos sem cortes. Como você quer começar hoje, vida?`;
          customButtons = [
            { text: '💎 VER PLANOS VIP & VÍDEOS COMPLETOS', callbackData: 'menu' },
            { text: '🔞 DESTRAVAR ACESSO VIP (+18)', callbackData: 'check_vip_access' },
            { text: '📸 PROVAR AMOSTRA SECRETA NA DM', callbackData: 'teaser_amostra' },
          ];
        } else if (paramLower.includes('insta')) {
          customText =
            botLang === 'en'
              ? `💋 *DIRECT FROM INSTAGRAM TO MY DM!*\n\nHey sweetie! Thank you for clicking my link in bio. Instagram censors everything, but here in my Telegram VIP there are NO limits and NO filters! Tap below to unlock full access:`
              : botLang === 'es'
              ? `💋 *¡DIRECTO DE INSTAGRAM A MI DM!*\n\n¡Hola vida! Gracias por hacer clic en el enlace de mi biografía. En Instagram lo censuran todo, pero aquí en mi VIP de Telegram no hay límites. Toca abajo para ver mis planes:`
              : `💋 *DIRETO DO INSTAGRAM PRA MINHA DM!*\n\nOi vida! Que bom que você clicou no link da minha bio... Lá na rede vizinha eles barram tudo e colocam censura em qualquer foto provocativa, mas aqui no meu VIP não tem limite nem filtro! Já destravei o seu atendimento na DM com desconto especial pra você:`;
          customButtons = [
            { text: '💎 CONHECER PLANOS VIP', callbackData: 'menu' },
            { text: '🔞 ENTRAR NO VIP AGORA', callbackData: 'check_vip_access' },
          ];
        } else if (paramLower.includes('tiktok')) {
          customText =
            botLang === 'en'
              ? `🎬 *FROM TIKTOK TO MY SECRET DM!*\n\nYou found me on TikTok and made it all the way here! On TikTok they cut everything, but here you get my raw, naughty side. Check my VIP plans below:`
              : botLang === 'es'
              ? `🎬 *¡DE TIKTOK A MI DM SECRETO!*\n\n¡Me encontraste en TikTok y llegaste hasta aquí! En TikTok lo censuran todo, pero aquí tienes mi lado más travieso y sin cortes:`
              : `🎬 *DO TIKTOK PRA MINHA DM SECRETA!*\n\nOi gatinho! Você me achou no TikTok e veio até aqui... adorei a sua coragem! 😈 Lá eles cortam tudo, mas aqui na minha DM você tem o meu lado mais safado, sem censura e com atendimento direto comigo:`;
          customButtons = [
            { text: '💎 VER MEUS VÍDEOS COMPLETOS', callbackData: 'menu' },
            { text: '🔞 DESTRAVAR MEU VIP (+18)', callbackData: 'check_vip_access' },
          ];
        } else if (paramLower.includes('promo') || paramLower.includes('desconto')) {
          customText =
            `🎁 *CUPOM DE 30% OFF ATIVADO COM SUCESSO!*\n\nVocê destravou a tabela promocional exclusiva com desconto imediato para todos os meus planos VIP + Chamada de Vídeo Privada! Escolha abaixo antes que expire:`;
          customButtons = [
            { text: '🎁 VER PLANOS COM 30% OFF', callbackData: 'menu' },
            { text: '🔞 DESTRAVAR VIP AGORA', callbackData: 'check_vip_access' },
          ];
        }
      }

      const localized = getLocalizedWelcome(botLang, lead.name, bot.firstName, bot.username);
      const textToSend = customText || (settings.welcomeMessage.trim()
        ? renderWelcome(settings.welcomeMessage, lead, bot)
        : localized.text);
      const buttonsToSend = customButtons || localized.buttons;

      const sent = await replyToLead(bot, token, lead, textToSend, buttonsToSend);
      if (sent) {
        store.updateLead(lead.id, {
          tags: Array.from(new Set([...(existingLead?.tags || []), 'boas-vindas-enviada', 'dm-destravada'])),
          dmUnlocked: true,
          dmUnlockedAt: new Date().toISOString(),
        });
      }
    } else if (isMenu) {
      // Apresentação de Planos e Conteúdos VIP
      const menuMsg = getLocalizedMenu(botLang, lead.name, bot.firstName);
      await replyToLead(bot, token, lead, menuMsg.text, menuMsg.buttons);
    } else if (isHelp) {
      // Suporte e Ajuda
      const helpMsg = getLocalizedHelp(botLang, lead.name, bot.firstName);
      await replyToLead(bot, token, lead, helpMsg.text, helpMsg.buttons);
    } else if (existingLead && !text.startsWith('/')) {
      // Conversação e engajamento dinâmico no idioma da modelo
      const replyMsg = getLocalizedConversationReply(botLang, lead.name, bot.firstName);
      await replyToLead(bot, token, lead, replyMsg.text, replyMsg.buttons);
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

export async function syncBotUpdates(
  botId: string,
  timeoutSeconds = 0
): Promise<{
  ok: boolean;
  processed: number;
  leads: number;
  error?: string;
  retryAfter?: number;
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
      const updates = await getUpdates(token, bot.offset, 100, timeoutSeconds);
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
      const retryAfter = error instanceof TelegramError && error.retryAfter ? error.retryAfter : undefined;
      store.updateBot(bot.id, {
        status: 'degraded',
        lastError: message,
        lastSyncAt: new Date().toISOString(),
      });
      return { ok: false, processed: 0, leads: 0, error: message, retryAfter };
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
