import type { Campaign, Lead, MessageLog } from '../shared/types.js';
import { newId, store } from './store.js';
import {
  normalizeTelegramError,
  sendRichMessage,
} from './telegram.js';
import { DEFAULT_PREVIEW_TEMPLATES } from './previewTemplates.js';

const MAX_BROADCAST = 100;
const MAX_CAMPAIGN = 300;
const runningCampaigns = new Set<string>();

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function deliverMessage(
  botId: string,
  chatId: string,
  text: string,
  options: {
    imageUrl?: string;
    mediaType?: 'photo' | 'video' | 'animation';
    mediaGrid?: Array<{ url: string; type: 'photo' | 'video' }>;
    buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
    leadId?: string | null;
  } = {}
): Promise<SendResult> {
  const token = store.getBotToken(botId);
  if (!token) return { ok: false, error: 'Bot não encontrado ou token ilegível.' };
  const cleanChatId = String(chatId || '').trim();
  const cleanText = String(text || '').trim();
  if (!cleanChatId) return { ok: false, error: 'Chat de destino ausente.' };
  if (!cleanText) return { ok: false, error: 'Mensagem vazia.' };
  if (cleanText.length > 4_096) return { ok: false, error: 'Mensagem acima do limite de 4096 caracteres.' };

  try {
    const result = await sendRichMessage(token, cleanChatId, cleanText, {
      imageUrl: options.imageUrl,
      mediaType: options.mediaType,
      mediaGrid: options.mediaGrid,
      buttons: options.buttons,
    });
    const now = new Date().toISOString();
    store.addMessage({
      id: newId('msg'),
      botId,
      leadId: options.leadId || null,
      chatId: cleanChatId,
      direction: 'out',
      text: cleanText.slice(0, 2_000),
      status: 'enviado',
      telegramMessageId: String(result.message_id),
      error: null,
      createdAt: now,
    });
    if (options.leadId) store.updateLead(options.leadId, { lastOutboundAt: now });
    return { ok: true, messageId: String(result.message_id) };
  } catch (error) {
    const message = normalizeTelegramError(error);
    store.addMessage({
      id: newId('msg'),
      botId,
      leadId: options.leadId || null,
      chatId: cleanChatId,
      direction: 'out',
      text: cleanText.slice(0, 2_000),
      status: 'falhou',
      telegramMessageId: null,
      error: message,
      createdAt: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }
}

export async function broadcastToAudience(input: {
  botId: string;
  audience: Campaign['audience'];
  text: string;
  imageUrl?: string;
  mediaType?: 'photo' | 'video' | 'animation';
  mediaGrid?: Array<{ url: string; type: 'photo' | 'video' }>;
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
}): Promise<{
  ok: boolean;
  total: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  if (!store.findBot(input.botId)) {
    return { ok: false, total: 0, sent: 0, failed: 0, errors: ['Bot não encontrado.'] };
  }
  const leads = store.rawLeads.filter((lead) => {
    if (lead.botId !== input.botId) return false;
    if (input.audience === 'all') return lead.status !== 'arquivado';
    return lead.status === input.audience;
  });
  const unique = new Map<string, Lead>();
  for (const lead of leads) unique.set(lead.telegramUserId, lead);
  const targets = Array.from(unique.values()).slice(0, MAX_BROADCAST);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const lead of targets) {
    const result = await deliverMessage(input.botId, lead.telegramUserId, input.text, {
      imageUrl: input.imageUrl,
      mediaType: input.mediaType,
      mediaGrid: input.mediaGrid,
      buttons: input.buttons,
      leadId: lead.id,
    });
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (errors.length < 5 && result.error) errors.push(`${lead.name}: ${result.error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return { ok: failed === 0 || sent > 0, total: targets.length, sent, failed, errors };
}

function nextOccurrence(campaign: Campaign, from: Date): string {
  const base = new Date(campaign.scheduledFor);
  if (Number.isNaN(base.getTime())) return new Date(from.getTime() + 86_400_000).toISOString();
  while (base <= from) {
    if (campaign.recurrence === 'daily') base.setUTCDate(base.getUTCDate() + 1);
    else base.setUTCDate(base.getUTCDate() + 7);
  }
  return base.toISOString();
}

function campaignRecipients(campaign: Campaign): Array<{ chatId: string; leadId: string | null }> {
  if (campaign.chatIds.length > 0) {
    return campaign.chatIds.map((chatId) => ({ chatId, leadId: null }));
  }
  const leads = store.rawLeads.filter((lead) => {
    if (lead.botId !== campaign.botId) return false;
    if (campaign.audience === 'all') return lead.status !== 'arquivado';
    return lead.status === campaign.audience;
  });
  const unique = new Map<string, Lead>();
  for (const lead of leads) unique.set(lead.telegramUserId, lead);
  return Array.from(unique.values())
    .slice(0, MAX_CAMPAIGN)
    .map((lead) => ({ chatId: lead.telegramUserId, leadId: lead.id }));
}

export async function executeCampaign(campaignId: string, manual = false): Promise<{
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
}> {
  if (runningCampaigns.has(campaignId)) {
    return { ok: false, sent: 0, failed: 0, error: 'Campanha já está em execução.' };
  }
  const campaign = store.rawCampaigns.find((item) => item.id === campaignId);
  if (!campaign) return { ok: false, sent: 0, failed: 0, error: 'Campanha não encontrada.' };
  if (campaign.status === 'pausada' && !manual) {
    return { ok: false, sent: 0, failed: 0, error: 'Campanha pausada.' };
  }
  const token = store.getBotToken(campaign.botId);
  if (!token) return { ok: false, sent: 0, failed: 0, error: 'Token do bot indisponível.' };

  runningCampaigns.add(campaignId);
  try {
    let sent = 0;
    let failed = 0;
    const recipients = campaignRecipients(campaign);
    for (const recipient of recipients) {
      const result = await deliverMessage(campaign.botId, recipient.chatId, campaign.content, {
        leadId: recipient.leadId,
      });
      if (result.ok) sent += 1;
      else failed += 1;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    const now = new Date();
    const next = campaign.recurrence === 'once' ? null : nextOccurrence(campaign, now);
    const expired = Boolean(campaign.endsAt && (next || now.toISOString()) > campaign.endsAt);
    store.updateCampaign(campaignId, {
      lastRunAt: now.toISOString(),
      lastResult: `${sent} enviadas, ${failed} falhas em ${recipients.length} destinos.`,
      sentCount: campaign.sentCount + sent,
      failedCount: campaign.failedCount + failed,
      status:
        campaign.recurrence === 'once' || expired
          ? 'concluida'
          : campaign.status === 'pausada'
          ? 'pausada'
          : 'agendada',
      ...(next && !expired ? { scheduledFor: next } : {}),
    });
    return { ok: true, sent, failed };
  } finally {
    runningCampaigns.delete(campaignId);
  }
}

let timer: NodeJS.Timeout | null = null;
let ticking = false;

/**
 * Executa as campanhas vencidas respeitando a janela [startsAt, endsAt].
 * Usado pelo agendador local e pelo endpoint /api/cron/tick na Vercel.
 */
export async function runDueCampaigns(now = new Date()): Promise<{
  executed: number;
  sent: number;
  failed: number;
  expired: number;
}> {
  const iso = now.toISOString();
  let expired = 0;
  for (const campaign of store.rawCampaigns) {
    if (campaign.status === 'agendada' && campaign.endsAt && campaign.endsAt < iso) {
      store.updateCampaign(campaign.id, {
        status: 'concluida',
        lastResult: 'Janela de término atingida antes do envio.',
      });
      expired += 1;
    }
  }
  const due = store.rawCampaigns.filter(
    (campaign) =>
      campaign.status === 'agendada' &&
      new Date(campaign.scheduledFor).getTime() <= now.getTime() &&
      (!campaign.startsAt || campaign.startsAt <= iso) &&
      (!campaign.endsAt || campaign.endsAt >= iso) &&
      !runningCampaigns.has(campaign.id)
  );
  let executed = 0;
  let sent = 0;
  let failed = 0;
  for (const campaign of due.slice(0, 3)) {
    const result = await executeCampaign(campaign.id, false);
    if (result.ok) {
      executed += 1;
      sent += result.sent;
      failed += result.failed;
    }
  }
  return { executed, sent, failed, expired };
}

export async function sendPreviewTeaserNow(
  botId: string,
  templateId?: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const bot = store.findBot(botId);
  if (!bot) return { ok: false, error: 'Bot não encontrado.' };
  if (!bot.previewGroupId) {
    return { ok: false, error: 'Grupo de prévias não configurado para este bot.' };
  }

  const template =
    DEFAULT_PREVIEW_TEMPLATES.find((t) => t.id === templateId) ||
    DEFAULT_PREVIEW_TEMPLATES[Math.floor(Math.random() * DEFAULT_PREVIEW_TEMPLATES.length)];

  const startTag = template.suggestedTag || 'previas_free';
  const ctaUrl = `https://t.me/${bot.username}?start=${startTag}`;

  const sendRes = await deliverMessage(bot.id, bot.previewGroupId, template.body, {
    buttons: [
      {
        text: template.ctaText || '👉 FALAR COM A MODELO NA DM',
        url: ctaUrl,
      },
    ],
  });

  if (sendRes.ok) {
    store.updateBot(bot.id, { previewLastSentAt: new Date().toISOString() });
  }

  return sendRes;
}

export async function runDuePreviewMessages(now = new Date()): Promise<{ checked: number; sent: number }> {
  let sent = 0;
  const botsWithPreview = store.rawBots.filter(
    (b) => b.previewGroupId && b.previewScheduleMode && b.previewScheduleMode !== 'off'
  );

  for (const bot of botsWithPreview) {
    const mode = bot.previewScheduleMode;
    const lastSent = bot.previewLastSentAt ? new Date(bot.previewLastSentAt).getTime() : 0;
    let isDue = false;

    if (mode === 'interval') {
      const intervalMs = (bot.previewScheduleIntervalHours || 4) * 3_600_000;
      isDue = now.getTime() - lastSent >= intervalMs;
    } else if (mode === 'hours') {
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(now);

      const notRecentlySent = now.getTime() - lastSent > 45 * 60_000;
      const hoursList = bot.previewScheduleHours || ['12:00', '18:00', '22:30'];
      const matchesHour = hoursList.some((h) => {
        const [targetH, targetM] = h.split(':').map(Number);
        const [nowH, nowM] = timeStr.split(':').map(Number);
        return Math.abs((targetH * 60 + targetM) - (nowH * 60 + nowM)) <= 2;
      });
      isDue = notRecentlySent && matchesHour;
    }

    if (isDue) {
      try {
        const res = await sendPreviewTeaserNow(bot.id);
        if (res.ok) {
          sent += 1;
          console.log(`[preview-schedule] Prévia automática disparada com sucesso no grupo ${bot.previewGroupId} pelo bot @${bot.username}`);
        }
      } catch (err) {
        console.error(`[preview-schedule] Falha ao enviar prévia para @${bot.username}:`, err);
      }
    }
  }

  return { checked: botsWithPreview.length, sent };
}

export function startScheduler(): void {
  if (timer) return;
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runDueCampaigns();
      await runDuePreviewMessages();
    } catch (error) {
      console.error('[scheduler] erro:', error);
    } finally {
      ticking = false;
    }
  };
  timer = setInterval(() => void tick(), 30_000);
  timer.unref?.();
  setTimeout(() => void tick(), 5_000).unref?.();
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
