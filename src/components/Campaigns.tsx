import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import type { AppState, CampaignAudience } from '@shared/types';
import { api } from '../lib/api';
import {
  audienceLabel,
  formatFullDate,
  formatNumber,
  localDateTimeValue,
  relativeTime,
  toIsoFromLocal,
} from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface CampaignsProps {
  state: AppState;
  selectedBotId: string;
  refresh: () => Promise<void>;
}

const audienceOptions: Array<{ value: CampaignAudience; label: string }> = [
  { value: 'all', label: 'Todos os leads ativos' },
  { value: 'novo', label: 'Leads novos' },
  { value: 'interessado', label: 'Leads interessados' },
  { value: 'qualificado', label: 'Leads qualificados' },
  { value: 'cliente', label: 'Clientes' },
];

export function Campaigns({ state, selectedBotId, refresh }: CampaignsProps) {
  const { notify } = useToast();
  const defaultBotId = selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '';
  const [open, setOpen] = useState(false);
  const [botId, setBotId] = useState(defaultBotId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<CampaignAudience>('all');
  const [scheduledFor, setScheduledFor] = useState(localDateTimeValue(new Date(Date.now() + 3_600_000)));
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'weekly'>('once');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const campaigns = useMemo(
    () =>
      (selectedBotId === 'all'
        ? state.campaigns
        : state.campaigns.filter((campaign) => campaign.botId === selectedBotId)
      ).slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.campaigns, selectedBotId]
  );

  const recipients = state.leads.filter(
    (lead) =>
      lead.botId === botId &&
      lead.status !== 'arquivado' &&
      (audience === 'all' || lead.status === audience)
  ).length;

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!botId) {
      notify('error', 'Nenhum bot disponível', 'Conecte um bot antes de criar campanhas.');
      return;
    }
    setSaving(true);
    try {
      await api.createCampaign({
        botId,
        title: title.trim(),
        content: content.trim(),
        audience,
        scheduledFor: toIsoFromLocal(scheduledFor),
        recurrence,
      });
      notify('success', 'Campanha criada', 'O servidor executará no horário definido.');
      setOpen(false);
      setTitle('');
      setContent('');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao criar', error instanceof Error ? error.message : 'Revise os dados.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, key: string, action: () => Promise<string>) => {
    setBusy(key);
    try {
      const message = await action();
      notify('success', 'Concluído', message);
      await refresh();
    } catch (error) {
      notify('error', 'Ação não concluída', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Campanhas agendadas</h2>
            <p className="mt-1 text-xs text-[#8290a5]">
              Execução no servidor a cada 30 segundos. Cada envio é registrado com sucesso ou erro real do Telegram.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(true)} disabled={state.bots.length === 0} className="btn-primary text-xs">
            <Plus className="h-4 w-4" /> Nova campanha
          </button>
        </div>
        <div className="mt-4 grid gap-2 border-t border-[#1e2634] pt-4 text-[11px] text-[#768398] sm:grid-cols-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[#d4f933]" /> Agendamento único, diário ou semanal</div>
          <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-[#d4f933]" /> Segmentação por status do CRM</div>
          <div className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-[#d4f933]" /> Recorrência calculada no servidor</div>
        </div>
      </section>

      {campaigns.length === 0 ? (
        <section className="card p-12 text-center">
          <CalendarClock className="mx-auto h-9 w-9 text-[#5d6a7f]" />
          <h3 className="mt-3 text-sm font-bold text-white">Nenhuma campanha criada</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#7b879b]">
            Programe uma mensagem para um segmento da sua base. O horário é salvo em UTC e exibido no seu fuso local.
          </p>
          <button type="button" onClick={() => setOpen(true)} disabled={state.bots.length === 0} className="btn-secondary mt-4 text-xs">
            <Plus className="h-3.5 w-3.5" /> Criar primeira campanha
          </button>
        </section>
      ) : (
        <section className="space-y-3">
          {campaigns.map((campaign) => {
            const bot = state.bots.find((item) => item.id === campaign.botId);
            const isPaused = campaign.status === 'pausada';
            return (
              <article key={campaign.id} className="card p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{campaign.title}</h3>
                      <span
                        className={`badge ${
                          campaign.status === 'agendada'
                            ? 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]'
                            : campaign.status === 'pausada'
                            ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                            : 'border-[#2b3447] bg-[#171c26] text-[#9aa6ba]'
                        }`}
                      >
                        {campaign.status === 'agendada' ? 'Agendada' : campaign.status === 'pausada' ? 'Pausada' : 'Concluída'}
                      </span>
                      <span className="badge border-[#2b3447] bg-[#171c26] text-[#9aa6ba]">
                        @{bot?.username || 'bot removido'}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 max-w-3xl text-xs leading-relaxed text-[#9aa5b8]">
                      {campaign.content}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#748196]">
                      <span className="inline-flex items-center gap-1.5 text-[#b9c2d0]">
                        <Clock className="h-3.5 w-3.5 text-[#d4f933]" />
                        {formatFullDate(campaign.scheduledFor)}
                      </span>
                      <span>·</span>
                      <span>{campaign.recurrence === 'once' ? 'Uma vez' : campaign.recurrence === 'daily' ? 'Diária' : 'Semanal'}</span>
                      <span>·</span>
                      <span>Público: <strong className="font-semibold text-[#d4f933]">{audienceLabel(campaign.audience)}</strong></span>
                      <span>·</span>
                      <span>{formatNumber(campaign.sentCount)} enviados / {formatNumber(campaign.failedCount)} falhas</span>
                    </div>
                    {campaign.lastResult && (
                      <div className="mt-2 text-[10px] text-[#657287]">
                        Última execução {relativeTime(campaign.lastRunAt)}: {campaign.lastResult}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(campaign.id, `run-${campaign.id}`, async () => {
                          const result = await api.runCampaign(campaign.id);
                          return `${result.sent} enviadas, ${result.failed} falhas.`;
                        })
                      }
                      disabled={busy === `run-${campaign.id}`}
                      className="btn-secondary text-xs"
                    >
                      {busy === `run-${campaign.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Executar agora
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(campaign.id, `pause-${campaign.id}`, async () => {
                          await api.updateCampaign(campaign.id, { status: isPaused ? 'agendada' : 'pausada' });
                          return isPaused ? 'Campanha retomada.' : 'Campanha pausada.';
                        })
                      }
                      disabled={busy === `pause-${campaign.id}` || campaign.status === 'concluida'}
                      className="btn-secondary text-xs"
                      title={isPaused ? 'Retomar' : 'Pausar'}
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      {isPaused ? 'Retomar' : 'Pausar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('Excluir esta campanha? O histórico de envios é preservado.')) return;
                        void runAction(campaign.id, `delete-${campaign.id}`, async () => {
                          await api.deleteCampaign(campaign.id);
                          return 'Campanha excluída.';
                        });
                      }}
                      disabled={busy === `delete-${campaign.id}`}
                      className="rounded-xl p-2.5 text-[#657287] hover:bg-rose-400/10 hover:text-rose-300"
                      aria-label="Excluir campanha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova campanha"
        description="A mensagem será enviada pela API oficial no horário agendado."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" form="campaign-form" disabled={saving || !title.trim() || !content.trim()} className="btn-primary text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {saving ? 'Criando' : 'Agendar campanha'}
            </button>
          </>
        }
      >
        <form id="campaign-form" onSubmit={create} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="campaign-bot">Bot</label>
              <select id="campaign-bot" value={botId} onChange={(event) => setBotId(event.target.value)} className="input">
                {state.bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>@{bot.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="campaign-audience">Público</label>
              <select
                id="campaign-audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value as CampaignAudience)}
                className="input"
              >
                {audienceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-[#657287]">{formatNumber(recipients)} destinatários agora</p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="campaign-title">Nome da campanha</label>
            <input
              id="campaign-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input"
              placeholder="Ex.: Retomada da base — oferta de sexta"
              maxLength={80}
            />
          </div>

          <div>
            <label className="label" htmlFor="campaign-content">Mensagem</label>
            <textarea
              id="campaign-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="input min-h-36 resize-y leading-relaxed"
              placeholder="Escreva a mensagem da campanha…"
              maxLength={4096}
            />
            <div className="mt-1 text-right text-[10px] text-[#657287]">{content.length}/4096</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="campaign-date">Data e hora local</label>
              <input
                id="campaign-date"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                className="input"
                required
              />
              <p className="mt-1 text-[10px] text-[#657287]">
                Fuso do navegador: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="campaign-recurrence">Recorrência</label>
              <select
                id="campaign-recurrence"
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value as 'once' | 'daily' | 'weekly')}
                className="input"
              >
                <option value="once">Uma vez</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[#252e3f] bg-[#0d1017] p-3 text-[11px] leading-relaxed text-[#768398]">
            A campanha será executada pelo servidor mesmo com o navegador fechado. Limite de 300 destinatários
            por execução para respeitar os limites do Telegram.
          </div>
        </form>
      </Modal>
    </div>
  );
}
