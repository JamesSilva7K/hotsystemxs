import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot as BotIcon,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Command,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Webhook,
  X,
} from 'lucide-react';
import type { AppState } from '@shared/types';
import { api } from '../lib/api';
import { formatFullDate, formatNumber, relativeTime } from '../lib/format';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { Dot } from './StatusBadge';
import { useToast } from './Toast';
import { LanguageSelector } from './LanguageSelector';
import type { NavTab } from '../lib/nav';

interface BotsProps {
  state: AppState;
  refresh: () => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

export function Bots({ state, refresh, onNavigate }: BotsProps) {
  const { notify } = useToast();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');
  const [niche, setNiche] = useState('Modelo Hot');
  const [connecting, setConnecting] = useState(false);
  const [openBotId, setOpenBotId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newChatId, setNewChatId] = useState('');
  const [copied, setCopied] = useState(false);

  const openBot = state.bots.find((bot) => bot.id === openBotId) || null;
  const webhookBase = state.server.publicBaseUrl || state.settings.publicBaseUrl;
  const botChats = useMemo(
    () => (openBot ? state.chats.filter((chat) => chat.botId === openBot.id) : []),
    [state.chats, openBot]
  );

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim()) return;
    setConnecting(true);
    try {
      const result = await api.connectBot(token.trim(), { language, niche });
      notify('success', 'Bot conectado', `@${result.bot.username} validado com sucesso pela API oficial do Telegram.`);
      setToken('');
      await refresh();
    } catch (error) {
      notify('error', 'Não foi possível conectar', error instanceof Error ? error.message : 'Token inválido.');
    } finally {
      setConnecting(false);
    }
  };

  const run = async (key: string, action: () => Promise<string>) => {
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

  const refreshBot = (id: string) =>
    run(`refresh-${id}`, async () => {
      const result = await api.refreshBot(id);
      return `Dados oficiais atualizados em ${result.latencyMs} ms.`;
    });

  const syncBot = (id: string) =>
    run(`sync-${id}`, async () => {
      const result = await api.syncBot(id);
      return `${result.processed} atualizações processadas, ${result.leads} novos leads.`;
    });

  const setWebhook = (id: string) =>
    run(`webhook-${id}`, async () => {
      await api.setWebhook(id, webhookBase || undefined);
      return 'Webhook HTTPS ativado no Telegram.';
    });

  const removeWebhook = (id: string) =>
    run(`unwebhook-${id}`, async () => {
      await api.removeWebhook(id);
      return 'Webhook removido. O long polling volta a funcionar na próxima sincronização.';
    });

  const installCommands = (id: string) =>
    run(`commands-${id}`, async () => {
      await api.installCommands(id);
      return 'Comandos /start, /menu e /ajuda publicados no bot.';
    });

  const removeBot = (id: string, username: string) => {
    if (!window.confirm(`Remover @${username}? Leads, chats e campanhas desse bot também serão apagados.`)) {
      return;
    }
    void run(`delete-${id}`, async () => {
      await api.deleteBot(id);
      setOpenBotId(null);
      return 'Bot e dados vinculados removidos.';
    });
  };

  const addChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!openBot || !newChatId.trim()) return;
    setBusy('add-chat');
    try {
      const result = await api.addChat({ botId: openBot.id, chatId: newChatId.trim() });
      notify(
        result.warning ? 'info' : 'success',
        'Chat vinculado',
        result.warning || `${result.chat.title} validado no Telegram.`
      );
      setNewChatId('');
      await refresh();
    } catch (error) {
      notify('error', 'Chat não vinculado', error instanceof Error ? error.message : 'Verifique o ID.');
    } finally {
      setBusy(null);
    }
  };

  const removeChat = async (id: string) => {
    if (!window.confirm('Desvincular este chat do painel? O bot continua no Telegram.')) return;
    setBusy(`chat-${id}`);
    try {
      await api.deleteChat(id);
      notify('success', 'Chat desvinculado', 'O histórico de leads foi preservado.');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao desvincular', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <section className="card overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#d4f933]">
              <ShieldCheck className="h-4 w-4" />
              Validação oficial
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white">Conectar bot do Telegram</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8c98ac]">
              O servidor valida o token com <span className="mono text-[#c6cfdc]">getMe</span>, importa a foto,
              comandos e webhook, e guarda o token criptografado. Ele nunca volta para o navegador.
            </p>
            <form onSubmit={connect} className="mt-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68758b]" />
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="Token do @BotFather (ex: 123456789:AA...)"
                    autoComplete="off"
                    spellCheck={false}
                    className="input mono pl-9 pr-10 text-xs"
                    aria-label="Token do bot"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#6f7c91] hover:text-white"
                    aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <button type="submit" disabled={connecting || !token.trim()} className="btn-primary shrink-0">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {connecting ? 'Validando' : 'Conectar Modelo'}
                </button>
              </div>

              {/* Seleção de Idioma e Nicho da Modelo */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#79869c]">Idioma do Atendimento</label>
                  <LanguageSelector value={language} onChange={setLanguage} className="mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#79869c]">Categoria / Nicho</label>
                  <select
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="input mt-1 text-xs font-semibold"
                  >
                    <option value="Modelo Hot">Modelo Hot 💋</option>
                    <option value="OnlyFans VIP">OnlyFans VIP ⭐</option>
                    <option value="Privacy Exclusivo">Privacy Exclusivo 🔒</option>
                    <option value="Vendas & Assinatura">Vendas & Assinatura ⚡</option>
                  </select>
                </div>
              </div>
            </form>
            <p className="mt-2 text-[11px] text-[#616e83]">
              Gere o token enviando <span className="mono text-[#909cb0]">/newbot</span> para o @BotFather no Telegram.
            </p>
          </div>
          <div className="border-t border-[#222a39] bg-[#0e1118] p-5 lg:border-l lg:border-t-0 sm:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#758297]">Como a captação funciona</div>
            <div className="mt-4 space-y-4">
              {[
                ['Token validado', 'Somente bots reais entram no painel.'],
                ['Conversas viram leads', 'Nome, @username e origem são salvos.'],
                ['Envio com resultado', 'Cada mensagem retorna sucesso ou erro do Telegram.'],
              ].map(([title, text], index) => (
                <div key={title} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#d4f933]/10 text-[10px] font-bold text-[#d4f933]">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#dce2ec]">{title}</div>
                    <div className="text-[11px] text-[#738095]">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {state.bots.length === 0 ? (
        <section className="card p-10 text-center">
          <BotIcon className="mx-auto h-9 w-9 text-[#5f6c81]" />
          <h3 className="mt-3 text-base font-bold text-white">Nenhum bot conectado</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#7e8b9f]">
            Cole o token acima para validar seu primeiro bot. A sincronização começa automaticamente assim que
            ele estiver conectado.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.bots.map((bot) => (
            <article key={bot.id} className="card group flex flex-col p-5 transition hover:border-[#3a465d]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative">
                    <Avatar src={bot.avatarUrl} name={bot.firstName} size="lg" />
                    <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-[#12151d] bg-[#12151d]">
                      <Dot tone={bot.status === 'online' ? 'lime' : bot.status === 'degraded' ? 'amber' : 'red'} />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-white">{bot.firstName}</h3>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#d4f933]" />
                    </div>
                    <a
                      href={`https://t.me/${bot.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mono flex items-center gap-1 truncate text-[11px] text-[#d4f933] hover:underline"
                    >
                      @{bot.username}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <div className="mono mt-0.5 text-[10px] text-[#5f6c81]">ID {bot.id}</div>
                  </div>
                </div>
                <span
                  className={`badge shrink-0 ${
                    bot.webhookUrl
                      ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
                      : 'border-[#2b3447] bg-[#171c26] text-[#95a1b5]'
                  }`}
                >
                  {bot.webhookUrl ? <Webhook className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
                  {bot.webhookUrl ? 'Webhook' : 'Polling'}
                </span>
              </div>

              <p className="mt-4 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-[#8490a4]">
                {bot.description || 'Sem descrição pública no Telegram.'}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#222a39] py-3 text-center">
                <div>
                  <div className="text-lg font-bold text-white">{formatNumber(bot.leadsCount)}</div>
                  <div className="text-[10px] text-[#6b778c]">leads</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{formatNumber(bot.chatsCount)}</div>
                  <div className="text-[10px] text-[#6b778c]">chats</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{formatNumber(bot.commands.length)}</div>
                  <div className="text-[10px] text-[#6b778c]">comandos</div>
                </div>
              </div>

              {bot.lastError && (
                <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-2.5 text-[10px] leading-relaxed text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2">{bot.lastError}</span>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="text-[10px] text-[#657186]">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {relativeTime(bot.lastSyncAt)}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenBotId(bot.id)}
                  className="btn-ghost text-xs text-[#d4f933] hover:bg-[#d4f933]/10"
                >
                  Gerenciar <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <Modal
        open={Boolean(openBot)}
        onClose={() => setOpenBotId(null)}
        title={openBot ? `${openBot.firstName} · @${openBot.username}` : 'Bot'}
        description="Diagnóstico oficial e comunidades vinculadas."
        size="lg"
      >
        {openBot && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
              <Avatar src={openBot.avatarUrl} name={openBot.firstName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{openBot.firstName}</span>
                  <span className={`badge ${openBot.status === 'online' ? 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>
                    {openBot.status === 'online' ? 'Online' : openBot.status === 'degraded' ? 'Atenção' : 'Offline'}
                  </span>
                </div>
                <div className="mono mt-0.5 text-[11px] text-[#d4f933]">@{openBot.username}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#6f7c91]">
                  <span>ID {openBot.id}</span>
                  <span>Conectado em {formatFullDate(openBot.createdAt)}</span>
                  <span>Última sync {relativeTime(openBot.lastSyncAt)}</span>
                </div>
              </div>
              <a
                href={`https://t.me/${openBot.username}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs"
              >
                Abrir no Telegram <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {openBot.lastError && (
              <div className="flex gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs leading-relaxed text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{openBot.lastError}</span>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#7f8ca1]">Ações do bot</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void refreshBot(openBot.id)}
                  disabled={busy === `refresh-${openBot.id}`}
                  className="btn-secondary justify-start text-xs"
                >
                  <RefreshCw className={`h-4 w-4 ${busy === `refresh-${openBot.id}` ? 'animate-spin' : ''}`} />
                  Atualizar dados oficiais
                </button>
                {!openBot.webhookUrl && (
                  <button
                    type="button"
                    onClick={() => void syncBot(openBot.id)}
                    disabled={busy === `sync-${openBot.id}`}
                    className="btn-secondary justify-start text-xs"
                  >
                    <RefreshCw className={`h-4 w-4 ${busy === `sync-${openBot.id}` ? 'animate-spin' : ''}`} />
                    Buscar atualizações agora
                  </button>
                )}
                {openBot.webhookUrl ? (
                  <button
                    type="button"
                    onClick={() => void removeWebhook(openBot.id)}
                    disabled={busy === `unwebhook-${openBot.id}`}
                    className="btn-secondary justify-start text-xs"
                  >
                    <X className="h-4 w-4" /> Remover webhook
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setWebhook(openBot.id)}
                    disabled={busy === `webhook-${openBot.id}` || !/^https:\/\//i.test(webhookBase)}
                    className="btn-secondary justify-start text-xs disabled:opacity-50"
                    title={
                      /^https:\/\//i.test(webhookBase)
                        ? 'Ativar webhook HTTPS'
                        : 'Configure uma URL pública HTTPS em Ajustes'
                    }
                  >
                    <Webhook className="h-4 w-4" /> Ativar webhook
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void installCommands(openBot.id)}
                  disabled={busy === `commands-${openBot.id}`}
                  className="btn-secondary justify-start text-xs"
                >
                  <Command className="h-4 w-4" /> Instalar comandos
                </button>
              </div>
              {!openBot.webhookUrl && !/^https:\/\//i.test(webhookBase) && (
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="mt-2 text-[11px] font-medium text-[#d4f933] hover:underline"
                >
                  Configurar URL pública para usar webhook →
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6f7c91]">Webhook</div>
                <div className="mono mt-1 break-all text-[11px] leading-relaxed text-[#aab5c6]">
                  {openBot.webhookUrl || 'Não configurado · long polling ativo'}
                </div>
                {openBot.webhookUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(openBot.webhookUrl || '');
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#d4f933]"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copiado' : 'Copiar URL'}
                  </button>
                )}
              </div>
              <div className="rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6f7c91]">Capacidades</div>
                <div className="mt-2 space-y-1.5 text-[11px] text-[#a3aec0]">
                  <div className="flex items-center justify-between"><span>Entrar em grupos</span><span className="text-[#d4f933]">{openBot.canJoinGroups ? 'Sim' : 'Não'}</span></div>
                  <div className="flex items-center justify-between"><span>Ler mensagens</span><span className="text-[#d4f933]">{openBot.canReadAllGroupMessages ? 'Todas' : 'Comandos'}</span></div>
                  <div className="flex items-center justify-between"><span>Inline queries</span><span className="text-[#d4f933]">{openBot.supportsInlineQueries ? 'Sim' : 'Não'}</span></div>
                  <div className="flex items-center justify-between"><span>Updates pendentes</span><span className="text-[#d4f933]">{openBot.pendingUpdates}</span></div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#7f8ca1]">
                  Comunidades vinculadas ({botChats.length})
                </h3>
              </div>
              <form onSubmit={addChat} className="mb-3 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#68758b]" />
                  <input
                    value={newChatId}
                    onChange={(event) => setNewChatId(event.target.value)}
                    className="input mono pl-9 text-xs"
                    placeholder="-1001234567890 ou @canal"
                    aria-label="ID do canal ou grupo"
                  />
                </div>
                <button type="submit" disabled={busy === 'add-chat' || !newChatId.trim()} className="btn-primary shrink-0 text-xs">
                  {busy === 'add-chat' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Vincular
                </button>
              </form>
              {botChats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#293246] p-4 text-center text-[11px] text-[#748196]">
                  Nenhum canal ou grupo vinculado. Adicione o bot como administrador e informe o ID acima.
                </div>
              ) : (
                <div className="space-y-2">
                  {botChats.map((chat) => (
                    <div key={chat.id} className="flex items-center gap-3 rounded-xl border border-[#252e3f] bg-[#0d1017] p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a202c] text-[#d4f933]">
                        <Hash className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">{chat.title}</div>
                        <div className="mono truncate text-[10px] text-[#6f7c91]">
                          {chat.telegramChatId} · {formatNumber(chat.membersCount)} membros
                        </div>
                      </div>
                      <span className={`badge ${chat.isAdmin ? 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>
                        {chat.isAdmin ? 'Admin' : 'Membro'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeChat(chat.id)}
                        disabled={busy === `chat-${chat.id}`}
                        className="rounded-lg p-1.5 text-[#667186] hover:bg-rose-400/10 hover:text-rose-300"
                        aria-label={`Desvincular ${chat.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#7f8ca1]">Comandos publicados</h3>
              {openBot.commands.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#293246] p-3 text-[11px] text-[#748196]">
                  Nenhum comando publicado. Use “Instalar comandos” para criar /start, /menu e /ajuda.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {openBot.commands.map((command) => (
                    <span key={command.command} className="badge border-[#2b3447] bg-[#171c26] text-[#bdc6d4]">
                      <span className="mono text-[#d4f933]">/{command.command}</span>
                      <span className="font-normal text-[#7b879b]">{command.description}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#222a39] pt-4">
              <button
                type="button"
                onClick={() => removeBot(openBot.id, openBot.username)}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-400/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover bot e dados
              </button>
              <span className="text-[10px] text-[#5f6c81]">Token criptografado no servidor</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
