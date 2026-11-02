import React, { useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  Bot as BotIcon,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import type { AppState, Lead } from '@shared/types';
import type { NavTab } from '../lib/nav';
import { formatNumber, plural, relativeTime, statusLabel, truncate } from '../lib/format';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

interface DashboardProps {
  state: AppState;
  selectedBotId: string;
  onNavigate: (tab: NavTab) => void;
  onSync: () => void;
  syncing: boolean;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function Dashboard({ state, selectedBotId, onNavigate, onSync, syncing }: DashboardProps) {
  const bots = selectedBotId === 'all' ? state.bots : state.bots.filter((bot) => bot.id === selectedBotId);
  const leads = useMemo(
    () =>
      selectedBotId === 'all'
        ? state.leads
        : state.leads.filter((lead) => lead.botId === selectedBotId),
    [state.leads, selectedBotId]
  );
  const messages = useMemo(
    () =>
      selectedBotId === 'all'
        ? state.messages
        : state.messages.filter((message) => message.botId === selectedBotId),
    [state.messages, selectedBotId]
  );

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const newLeads = leads.filter((lead) => lead.firstContactAt >= sevenDaysAgo).length;
  const activeLeads = leads.filter((lead) => lead.lastMessageAt >= sevenDaysAgo).length;
  const qualified = leads.filter((lead) => lead.status === 'qualificado' || lead.status === 'cliente').length;
  const sent7d = messages.filter(
    (message) => message.direction === 'out' && message.createdAt >= sevenDaysAgo
  ).length;
  const received7d = messages.filter(
    (message) => message.direction === 'in' && message.createdAt >= sevenDaysAgo
  ).length;

  const days = useMemo(() => {
    const result: Array<{ label: string; date: string; leads: number; messages: number }> = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(now - offset * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      result.push({
        date: key,
        label: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date),
        leads: leads.filter((lead) => dayKey(lead.firstContactAt) === key).length,
        messages: messages.filter((message) => dayKey(message.createdAt) === key).length,
      });
    }
    return result;
  }, [leads, messages, now]);
  const maxDay = Math.max(...days.map((day) => day.leads), 1);

  const statusCounts = [
    { status: 'novo' as const, count: leads.filter((lead) => lead.status === 'novo').length },
    { status: 'interessado' as const, count: leads.filter((lead) => lead.status === 'interessado').length },
    { status: 'qualificado' as const, count: leads.filter((lead) => lead.status === 'qualificado').length },
    { status: 'cliente' as const, count: leads.filter((lead) => lead.status === 'cliente').length },
  ];

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of leads) map.set(lead.sourceChatTitle, (map.get(lead.sourceChatTitle) || 0) + 1);
    return Array.from(map.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [leads]);

  const recentLeads = [...leads]
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .slice(0, 6);
  const recentMessages = messages.slice(0, 7);
  const lastSync = state.bots
    .map((bot) => bot.lastSyncAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  if (state.bots.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card relative overflow-hidden p-7 sm:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#d4f933]/6 blur-3xl" />
          <div className="relative">
            <span className="badge border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]">
              <Zap className="h-3 w-3" />
              Primeiro acesso
            </span>
            <h2 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Conecte seu bot e comece a captar leads reais.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#929db0]">
              O Hot System lê as conversas pela API oficial do Telegram, cria o CRM automaticamente e
              mantém tudo sincronizado no servidor. Todos os números vêm do histórico real.
            </p>
            <button type="button" onClick={() => onNavigate('bots')} className="btn-primary mt-6">
              <Plus className="h-4 w-4" />
              Conectar primeiro bot
            </button>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                ['1', 'Valide o token', 'O servidor chama getMe e confirma o bot no Telegram.'],
                ['2', 'Capture conversas', 'Mensagens recebidas criam leads e histórico reais.'],
                ['3', 'Ative e escale', 'Envie mensagens e campanhas com resultado por destinatário.'],
              ].map(([step, title, text]) => (
                <div key={step} className="rounded-2xl border border-[#242c3b] bg-[#0d1017] p-4">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#d4f933] text-xs font-extrabold text-black">
                    {step}
                  </div>
                  <div className="text-sm font-bold text-white">{title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#7f8b9f]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <BotIcon className="h-4 w-4 text-[#d4f933]" /> Token do @BotFather
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#8591a5]">
              Envie <span className="mono text-[#c6cfdd]">/newbot</span> para o @BotFather, copie o token e
              cole em Bots. O token fica criptografado no servidor e nunca retorna ao navegador.
            </p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <CalendarClock className="h-4 w-4 text-[#d4f933]" /> Sincronização automática
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#8591a5]">
              Sem domínio público, o sistema usa long polling seguro. Com HTTPS, você pode ativar webhook
              em um clique e receber atualizações em tempo real.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#2a3345] bg-gradient-to-br from-[#151b25] via-[#11151d] to-[#0d1015] p-5 sm:p-7">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#d4f933]/8 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#d4f933]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4f933] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d4f933]" />
              </span>
              Operação ativa
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
              {bots.length === 1 ? `@${bots[0].username}` : `${bots.length} bots conectados`} prontos para captar.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8e9aaf]">
              {newLeads > 0
                ? `${plural(newLeads, 'novo lead', 'novos leads')} nos últimos 7 dias. ${plural(
                    activeLeads,
                    'contato',
                    'contatos'
                  )} com conversa ativa.`
                : 'Nenhum lead novo nos últimos 7 dias. Compartilhe o link do bot ou dispare uma campanha para reativar a base.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {bots.length === 1 && (
              <a
                href={`https://t.me/${bots[0].username}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir bot
              </a>
            )}
            <button type="button" onClick={onSync} disabled={syncing} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando' : 'Sincronizar agora'}
            </button>
            <button type="button" onClick={() => onNavigate('messages')} className="btn-primary">
              <Send className="h-4 w-4" />
              Enviar mensagem
            </button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-[#69758b]">
          <span>Última sincronização: {relativeTime(lastSync)}</span>
          <span className="hidden sm:inline">·</span>
          <span>{state.server.pollingEnabled ? 'Long polling ativo' : 'Polling desativado'}</span>
          <span className="hidden sm:inline">·</span>
          <span>{state.server.passwordProtected ? 'Painel protegido por senha' : 'Painel local sem senha'}</span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Leads totais', value: leads.length, icon: Users, detail: `${plural(newLeads, 'novo', 'novos')} em 7 dias` },
          { label: 'Conversas ativas', value: activeLeads, icon: MessageSquare, detail: `${plural(received7d, 'mensagem recebida', 'mensagens recebidas')}` },
          { label: 'Qualificados', value: qualified, icon: TrendingUp, detail: 'prontos para abordagem' },
          { label: 'Enviadas em 7 dias', value: sent7d, icon: Send, detail: `${plural(messages.length, 'evento', 'eventos')} no histórico` },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8994a8]">{card.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a3345] bg-[#181e29] text-[#d4f933]">
                <card.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">
              {formatNumber(card.value)}
            </div>
            <div className="mt-1 text-[11px] text-[#6f7c91]">{card.detail}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Captação dos últimos 14 dias</h3>
              <p className="mt-0.5 text-[11px] text-[#768297]">Novos leads por dia, direto do histórico real.</p>
            </div>
            <span className="badge border-[#2b3447] bg-[#161b25] text-[#9aa6ba]">
              <Activity className="h-3 w-3" />
              {newLeads} em 7 dias
            </span>
          </div>
          <div className="mt-7 flex h-48 items-end gap-1.5 sm:gap-2.5">
            {days.map((day, index) => (
              <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <div className="relative w-full max-w-8 flex-1 overflow-hidden rounded-t-lg bg-[#1a202c]">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-lg bg-gradient-to-t from-[#a8cc24] to-[#d4f933] transition-all group-hover:brightness-110"
                    style={{ height: `${Math.max(4, (day.leads / maxDay) * 100)}%` }}
                    title={`${day.leads} leads`}
                  />
                </div>
                <span className={`text-[9px] ${index % 2 === 0 ? 'text-[#7d899e]' : 'text-transparent'} sm:text-[10px]`}>
                  {index % 2 === 0 ? day.label : '·'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#1d2432] pt-3 text-[11px] text-[#69758b]">
            <span>Total: {formatNumber(leads.length)} leads</span>
            <span>{received7d} recebidas / {sent7d} enviadas em 7 dias</span>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Saúde dos bots</h3>
            <button type="button" onClick={() => onNavigate('bots')} className="text-[11px] font-semibold text-[#d4f933] hover:underline">
              Gerenciar
            </button>
          </div>
          <div className="mt-4 space-y-2.5">
            {bots.map((bot) => (
              <div key={bot.id} className="flex items-center gap-3 rounded-2xl border border-[#242c3b] bg-[#0e1118] p-3">
                <Avatar src={bot.avatarUrl} name={bot.firstName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">{bot.firstName}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        bot.status === 'online' ? 'bg-[#d4f933]' : bot.status === 'degraded' ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                    />
                  </div>
                  <div className="truncate text-[11px] text-[#758196]">@{bot.username} · {bot.leadsCount} leads</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-[#929eb2]">
                    {bot.webhookUrl ? 'Webhook' : 'Polling'}
                  </div>
                  <div className="text-[10px] text-[#5f6b7f]">{relativeTime(bot.lastSyncAt)}</div>
                </div>
              </div>
            ))}
          </div>
          {sources.length > 0 && (
            <div className="mt-5 border-t border-[#1d2432] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#768297]">Principais origens</div>
              <div className="mt-2 space-y-2">
                {sources.map((source) => (
                  <div key={source.source} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-[#b1bac9]">{source.source}</span>
                    <span className="mono text-[#d4f933]">{source.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <div>
              <h3 className="text-sm font-bold text-white">Leads recentes</h3>
              <p className="mt-0.5 text-[11px] text-[#768297]">Ordenados pela última mensagem.</p>
            </div>
            <button type="button" onClick={() => onNavigate('leads')} className="btn-ghost text-xs">
              Ver CRM <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentLeads.length === 0 ? (
            <EmptyLeads onNavigate={onNavigate} />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-[#1d2432] bg-[#0e1118] text-[10px] uppercase tracking-wider text-[#68758a]">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold sm:px-6">Lead</th>
                    <th className="px-3 py-2.5 font-semibold">Origem</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 text-right font-semibold sm:px-6">Última ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a202c]">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="transition hover:bg-[#171c26]">
                      <td className="px-5 py-3 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={lead.avatarUrl} name={lead.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-white">{lead.name}</div>
                            <div className="truncate text-[10px] text-[#79859a]">
                              {lead.username ? `@${lead.username}` : lead.telegramUserId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[130px] truncate px-3 py-3 text-[#8793a7]">{lead.sourceChatTitle}</td>
                      <td className="px-3 py-3"><StatusBadge status={lead.status} /></td>
                      <td className="px-5 py-3 text-right text-[11px] text-[#748095] sm:px-6">
                        {relativeTime(lead.lastMessageAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Atividade recente</h3>
            <span className="badge border-[#2b3447] bg-[#161b25] text-[#9aa6ba]">
              {plural(messages.length, 'evento', 'eventos')}
            </span>
          </div>
          {recentMessages.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-[#293246] p-5 text-center text-xs text-[#728096]">
              As mensagens aparecerão aqui assim que o bot receber ou enviar algo.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentMessages.map((message) => {
                const lead = state.leads.find((item) => item.id === message.leadId);
                return (
                  <div key={message.id} className="flex gap-3">
                    <div
                      className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        message.direction === 'in'
                          ? 'bg-sky-400/10 text-sky-300'
                          : message.status === 'falhou'
                          ? 'bg-rose-400/10 text-rose-300'
                          : 'bg-[#d4f933]/10 text-[#d4f933]'
                      }`}
                    >
                      {message.direction === 'in' ? <MessageSquare className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[#d9dfea]">
                          {lead?.name || (message.direction === 'in' ? 'Contato' : 'Envio')}
                          {message.direction === 'out' && message.status === 'falhou' && (
                            <span className="ml-1.5 text-[10px] font-medium text-rose-300">falhou</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#5f6b7f]">{relativeTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#7e8a9e]">
                        {truncate(message.text, 90)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" onClick={() => onNavigate('campaigns')} className="btn-secondary mt-5 w-full text-xs">
            <CalendarClock className="h-3.5 w-3.5" />
            Abrir campanhas
          </button>
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        {statusCounts.map((item) => (
          <div key={item.status} className="rounded-2xl border border-[#222a39] bg-[#10141c] p-4">
            <div className="text-[11px] text-[#7b879b]">{statusLabel(item.status)}</div>
            <div className="mt-1 text-xl font-bold text-white">{formatNumber(item.count)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

function EmptyLeads({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  return (
    <div className="m-5 rounded-2xl border border-dashed border-[#2a3345] p-8 text-center">
      <UserPlus className="mx-auto h-7 w-7 text-[#6f7c91]" />
      <div className="mt-2 text-sm font-semibold text-white">Nenhum lead captado ainda</div>
      <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-[#758196]">
        Envie uma mensagem para o seu bot no Telegram ou sincronize para importar conversas pendentes.
      </p>
      <button type="button" onClick={() => onNavigate('bots')} className="btn-secondary mt-3 text-xs">
        <BotIcon className="h-3.5 w-3.5" /> Ver bots
      </button>
    </div>
  );
}
