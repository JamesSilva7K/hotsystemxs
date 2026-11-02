import type { FollowUpSequence, Lead, LeadFollowUp, MessageTemplate } from '../shared/types.js';
import { deliverMessage } from './messaging.js';
import { store } from './store.js';
import { contextForLead, pickWeighted, renderTemplate } from './templates.js';

export interface FollowUpRunResult {
  sent: number;
  failed: number;
  stopped: number;
  rescheduled: number;
  skipped: string | null;
}

export function isWithinWindow(sequence: FollowUpSequence, now: Date): boolean {
  if (!sequence.active) return false;
  const iso = now.toISOString();
  if (sequence.startsAt && iso < sequence.startsAt) return false;
  if (sequence.endsAt && iso > sequence.endsAt) return false;
  return true;
}

/** Hora cheia no fuso configurado (a Vercel roda em UTC). */
export function hourInZone(date: Date, timeZone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: timeZone || 'America/Sao_Paulo',
    }).format(date);
    return Number(formatted.replace(/\D/g, '')) % 24;
  } catch {
    return date.getHours();
  }
}

export function inQuietHours(sequence: FollowUpSequence, now: Date, timeZone: string): boolean {
  const start = sequence.quietHoursStart ?? 0;
  const end = sequence.quietHoursEnd ?? 0;
  if (start === end) return false;
  const hour = hourInZone(now, timeZone);
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/** Próximo instante permitido (sai do horário de silêncio). */
export function nextAllowedTime(sequence: FollowUpSequence, now: Date, timeZone: string): Date {
  const candidate = new Date(now.getTime());
  for (let i = 0; i < 24 * 60; i += 1) {
    if (!inQuietHours(sequence, candidate, timeZone)) return candidate;
    candidate.setTime(candidate.getTime() + 60_000);
  }
  return candidate;
}

export function buildFollowUp(sequence: FollowUpSequence, now: Date, stepIndex = 0): LeadFollowUp {
  const step = sequence.steps[stepIndex];
  const delayMinutes = Math.max(0, step?.delayMinutes ?? 60);
  return {
    sequenceId: sequence.id,
    stepIndex,
    nextRunAt: new Date(now.getTime() + delayMinutes * 60_000).toISOString(),
    attempts: 0,
    lastSentAt: null,
    startedAt: now.toISOString(),
    stoppedReason: null,
  };
}

export function pickSequenceForBot(botId: string, now = new Date()): FollowUpSequence | null {
  return (
    store.rawSequences.find(
      (sequence) =>
        sequence.botId === botId && sequence.active && sequence.steps.length > 0 && isWithinWindow(sequence, now)
    ) || null
  );
}

/** Chamado quando o lead responde: reinicia a contagem do zero. */
export function restartFollowUpForLead(leadId: string, now = new Date()): void {
  const lead = store.findLeadById(leadId);
  if (!lead) return;
  const clear = () => {
    if (lead.followUp) store.setLeadFollowUp(lead.id, null);
  };
  if (!store.settings.followUpEnabled) return clear();
  if (lead.status === 'cliente' || lead.status === 'arquivado') return clear();
  const sequence = pickSequenceForBot(lead.botId, now);
  if (!sequence) return clear();
  const current = lead.followUp;
  if (current?.sequenceId === sequence.id && current.nextRunAt && !current.stoppedReason) {
    // Já existe uma sequência viva: só reancora o próximo envio.
    store.setLeadFollowUp(lead.id, { ...current, nextRunAt: buildFollowUp(sequence, now).nextRunAt, stoppedReason: null });
    return;
  }
  store.setLeadFollowUp(lead.id, buildFollowUp(sequence, now));
}

export function stopFollowUpForLead(leadId: string, reason: string): void {
  const lead = store.findLeadById(leadId);
  if (!lead?.followUp) return;
  store.setLeadFollowUp(lead.id, {
    ...lead.followUp,
    nextRunAt: null,
    stoppedReason: reason,
  });
}

function isPermanentFailure(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('bloqueou') ||
    lower.includes('não encontrado') ||
    lower.includes('inválido') ||
    lower.includes('chat not found') ||
    lower.includes('peer_id_invalid')
  );
}

function templateForStep(templateId: string): MessageTemplate | null {
  const direct = store.findTemplate(templateId);
  if (direct && direct.active) return direct;
  return pickWeighted(
    store.rawTemplates.filter((template) => template.active && template.category === 'reengajamento')
  );
}

/**
 * Processa todos os follow-ups vencidos. Idempotente por lead: cada lead só
 * avança um passo por execução, e o próximo horário é recalculado a partir de agora.
 */
export async function runFollowUps(now = new Date(), limit = 20): Promise<FollowUpRunResult> {
  const result: FollowUpRunResult = { sent: 0, failed: 0, stopped: 0, rescheduled: 0, skipped: null };
  if (!store.settings.followUpEnabled) {
    result.skipped = 'Follow-up desativado nos ajustes.';
    return result;
  }
  const timeZone = store.settings.timezone || 'America/Sao_Paulo';
  const iso = now.toISOString();
  const due = store.rawLeads
    .filter((lead) => lead.followUp?.sequenceId && lead.followUp.nextRunAt && lead.followUp.nextRunAt <= iso)
    .slice(0, limit);

  for (const lead of due) {
    const state = lead.followUp;
    if (!state?.sequenceId) continue;
    const sequence = store.findSequence(state.sequenceId);
    const stop = (reason: string) => {
      store.setLeadFollowUp(lead.id, { ...state, nextRunAt: null, stoppedReason: reason });
      result.stopped += 1;
    };

    if (!sequence || !sequence.active) {
      stop('Sequência removida ou pausada.');
      continue;
    }
    if (!isWithinWindow(sequence, now)) {
      stop('Fora da janela de datas da sequência.');
      continue;
    }
    if (sequence.stopOnStatus.includes(lead.status)) {
      stop(`Lead com status ${lead.status}.`);
      continue;
    }
    if (inQuietHours(sequence, now, timeZone)) {
      store.setLeadFollowUp(lead.id, {
        ...state,
        nextRunAt: nextAllowedTime(sequence, now, timeZone).toISOString(),
      });
      result.rescheduled += 1;
      continue;
    }
    if (state.attempts >= sequence.maxMessagesPerLead) {
      stop('Limite de mensagens por lead atingido.');
      continue;
    }
    const step = sequence.steps[state.stepIndex];
    if (!step) {
      stop('Sequência concluída.');
      continue;
    }
    const bot = store.findBot(lead.botId);
    if (!bot) {
      stop('Bot removido.');
      continue;
    }
    const template = templateForStep(step.templateId);
    if (!template) {
      // Sem template ativo: pula o passo para não travar o lead.
      const nextIndex = state.stepIndex + 1;
      const nextStep = sequence.steps[nextIndex];
      store.setLeadFollowUp(lead.id, {
        ...state,
        stepIndex: nextIndex,
        nextRunAt: nextStep
          ? new Date(now.getTime() + Math.max(1, nextStep.delayMinutes) * 60_000).toISOString()
          : null,
        stoppedReason: nextStep ? null : 'Sequência concluída.',
      });
      continue;
    }

    const product = sequence.productId ? store.findProduct(sequence.productId) : null;
    const text = renderTemplate(template.body, contextForLead(lead as Lead, bot, product));
    const delivery = await deliverMessage(lead.botId, lead.telegramUserId, text, {
      imageUrl: template.mediaUrl || undefined,
      buttons: template.buttons,
      leadId: lead.id,
    });

    if (!delivery.ok) {
      result.failed += 1;
      if (isPermanentFailure(delivery.error)) {
        stop(`Falha permanente: ${delivery.error}`);
      } else {
        store.setLeadFollowUp(lead.id, {
          ...state,
          nextRunAt: new Date(now.getTime() + 45 * 60_000).toISOString(),
        });
        result.rescheduled += 1;
      }
      continue;
    }

    result.sent += 1;
    store.bumpTemplateUsage(template.id);
    const nextIndex = state.stepIndex + 1;
    const nextStep = sequence.steps[nextIndex];
    store.setLeadFollowUp(lead.id, {
      ...state,
      stepIndex: nextIndex,
      attempts: state.attempts + 1,
      lastSentAt: now.toISOString(),
      nextRunAt: nextStep
        ? new Date(now.getTime() + Math.max(1, nextStep.delayMinutes) * 60_000).toISOString()
        : null,
      stoppedReason: nextStep ? null : 'Sequência concluída.',
    });
  }

  return result;
}
