import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import type { AppState, Lead } from '@shared/types';
import { api } from '../lib/api';
import { formatDate, formatNumber, plural, relativeTime, truncate } from '../lib/format';
import { Avatar } from './Avatar';
import { useToast } from './Toast';

interface MessagesProps {
  state: AppState;
  selectedBotId: string;
  initialLead: Lead | null;
  onConsumeLead: () => void;
  refresh: () => Promise<void>;
}

type Mode = 'audience' | 'lead' | 'chat';
type Audience = 'all' | 'novo' | 'interessado' | 'qualificado' | 'cliente';

const audiences: Array<{ value: Audience; label: string }> = [
  { value: 'all', label: 'Todos os leads ativos' },
  { value: 'novo', label: 'Leads novos' },
  { value: 'interessado', label: 'Leads interessados' },
  { value: 'qualificado', label: 'Leads qualificados' },
  { value: 'cliente', label: 'Clientes' },
];

export function Messages({ state, selectedBotId, initialLead, onConsumeLead, refresh }: MessagesProps) {
  const { notify } = useToast();
  const defaultBotId =
    selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '';
  const [botId, setBotId] = useState(defaultBotId);
  const [mode, setMode] = useState<Mode>('audience');
  const [audience, setAudience] = useState<Audience>('all');
  const [leadId, setLeadId] = useState('');
  const [chatId, setChatId] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttons, setButtons] = useState<Array<{ id: number; text: string; url: string }>>([]);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const bot = state.bots.find((item) => item.id === botId) || null;
  const scopedLeads = useMemo(
    () => (bot ? state.leads.filter((lead) => lead.botId === bot.id) : []),
    [state.leads, bot]
  );
  const scopedChats = useMemo(
    () => (bot ? state.chats.filter((chat) => chat.botId === bot.id) : []),
    [state.chats, bot]
  );
  const scopedMessages = useMemo(
    () => (bot ? state.messages.filter((message) => message.botId === bot.id).slice(0, 40) : []),
    [state.messages, bot]
  );

  useEffect(() => {
    if (selectedBotId !== 'all') setBotId(selectedBotId);
  }, [selectedBotId]);

  useEffect(() => {
    if (!botId && state.bots[0]) setBotId(state.bots[0].id);
  }, [botId, state.bots]);

  useEffect(() => {
    if (initialLead) {
      setBotId(initialLead.botId);
      setMode('lead');
      setLeadId(initialLead.id);
      onConsumeLead();
    }
  }, [initialLead, onConsumeLead]);

  useEffect(() => {
    if (mode === 'lead' && !scopedLeads.some((lead) => lead.id === leadId)) {
      setLeadId(scopedLeads[0]?.id || '');
    }
  }, [mode, leadId, scopedLeads]);

  const recipientCount =
    mode === 'audience'
      ? scopedLeads.filter((lead) => lead.status !== 'arquivado' && (audience === 'all' || lead.status === audience)).length
      : 1;

  const resetForm = () => {
    setText('');
    setImageUrl('');
    setButtons([]);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bot) {
      notify('error', 'Nenhum bot selecionado', 'Conecte um bot antes de enviar.');
      return;
    }
    if (!text.trim()) {
      notify('error', 'Mensagem vazia', 'Escreva o texto antes de enviar.');
      return;
    }
    const cleanButtons = buttons
      .map((button) => ({ text: button.text.trim(), url: button.url.trim() }))
      .filter((button) => button.text && button.url);
    if (cleanButtons.some((button) => !/^https?:\/\//i.test(button.url))) {
      notify('error', 'Botão inválido', 'A URL do botão precisa começar com http:// ou https://.');
      return;
    }

    setSending(true);
    setLastResult(null);
    try {
      if (mode === 'audience') {
        const result = await api.broadcast({
          botId: bot.id,
          audience,
          text: text.trim(),
          imageUrl: imageUrl.trim() || undefined,
          buttons: cleanButtons.length ? cleanButtons : undefined,
        });
        const summary = `${result.sent} enviadas · ${result.failed} falhas · ${result.total} destinos`;
        setLastResult(summary);
        if (result.sent > 0) {
          notify('success', 'Transmissão concluída', summary);
        } else {
          notify('error', 'Nenhuma mensagem entregue', result.errors[0] || 'Verifique as permissões do bot.');
        }
      } else {
        let target = chatId.trim();
        if (mode === 'lead') {
          const lead = scopedLeads.find((item) => item.id === leadId);
          target = lead?.telegramUserId || '';
        }
        if (!target) {
          throw new Error('Informe um destinatário válido.');
        }
        await api.sendMessage({
          botId: bot.id,
          chatId: target,
          text: text.trim(),
          imageUrl: imageUrl.trim() || undefined,
          buttons: cleanButtons.length ? cleanButtons : undefined,
        });
        setLastResult('Mensagem entregue pela API do Telegram.');
        notify('success', 'Mensagem enviada', `Destino: ${target}`);
      }
      resetForm();
      await refresh();
    } catch (error) {
      notify('error', 'Falha no envio', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const selectedLead = scopedLeads.find((lead) => lead.id === leadId) || null;
  const charLimit = imageUrl.trim() ? 1_024 : 4_096;

  if (state.bots.length === 0) {
    return (
      <div className="card mx-auto max-w-xl p-10 text-center">
        <MessageSquare className="mx-auto h-9 w-9 text-[#5d6a7f]" />
        <h2 className="mt-3 text-base font-bold text-white">Conecte um bot para enviar mensagens</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#7b879b]">
          O envio usa a API oficial do Telegram e exige um bot conectado e um destinatário que já tenha
          iniciado conversa com ele.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 pb-20 xl:grid-cols-[1.1fr_0.9fr] md:pb-6">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Novo envio</h2>
            <p className="mt-0.5 text-xs text-[#8290a5]">O resultado é registrado por destinatário, direto da API do Telegram.</p>
          </div>
          <span className="badge border-[#2b3447] bg-[#171c26] text-[#a4afc1]">
            <Users className="h-3 w-3" /> {formatNumber(recipientCount)} destino(s)
          </span>
        </div>

        <form onSubmit={send} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="message-bot">Bot remetente</label>
              <select id="message-bot" value={botId} onChange={(event) => setBotId(event.target.value)} className="input">
                {state.bots.map((item) => (
                  <option key={item.id} value={item.id}>@{item.username}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Tipo de destino</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#252e3f] bg-[#0d1017] p-1">
                {([
                  ['audience', 'Audiência'],
                  ['lead', 'Lead'],
                  ['chat', 'Chat'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${
                      mode === value ? 'bg-[#d4f933] text-black' : 'text-[#7f8ca1] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === 'audience' && (
            <div>
              <label className="label" htmlFor="message-audience">Segmento</label>
              <select
                id="message-audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value as Audience)}
                className="input"
              >
                {audiences.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-[#657287]">
                Limite de 100 destinatários por transmissão. Contatos que bloquearam o bot retornam falha real.
              </p>
            </div>
          )}

          {mode === 'lead' && (
            <div>
              <label className="label" htmlFor="message-lead">Lead</label>
              <select id="message-lead" value={leadId} onChange={(event) => setLeadId(event.target.value)} className="input">
                {scopedLeads.length === 0 && <option value="">Nenhum lead neste bot</option>}
                {scopedLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} {lead.username ? `(@${lead.username})` : `· ${lead.telegramUserId}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'chat' && (
            <div>
              <label className="label" htmlFor="message-chat">Chat ID ou @username</label>
              <input
                id="message-chat"
                value={chatId}
                onChange={(event) => setChatId(event.target.value)}
                className="input mono"
                placeholder="-1001234567890 ou @seucanal"
              />
              {scopedChats.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scopedChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => setChatId(chat.telegramChatId)}
                      className="badge border-[#2b3447] bg-[#171c26] text-[#a7b2c4] hover:border-[#d4f933]/40"
                    >
                      {chat.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label" htmlFor="message-text">Mensagem</label>
            <textarea
              id="message-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="input min-h-40 resize-y leading-relaxed"
              placeholder="Escreva a mensagem que será entregue no Telegram…"
              maxLength={charLimit}
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#657287]">
              <span>Texto simples. Sem markdown para evitar erros de entidade.</span>
              <span className={`mono ${text.length >= charLimit ? 'text-amber-300' : ''}`}>
                {text.length}/{charLimit}
              </span>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="message-image">Imagem por URL (opcional)</label>
            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#68758b]" />
              <input
                id="message-image"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                className="input pl-9"
                placeholder="https://…/imagem.jpg"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Botões com link</span>
              <button
                type="button"
                onClick={() => setButtons((current) => [...current, { id: Date.now(), text: '', url: '' }].slice(0, 3))}
                disabled={buttons.length >= 3}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d4f933] disabled:opacity-40"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            {buttons.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#293246] p-2.5 text-[10px] text-[#657287]">
                Nenhum botão. Você pode adicionar até 3 links.
              </p>
            ) : (
              <div className="space-y-2">
                {buttons.map((button) => (
                  <div key={button.id} className="flex gap-2">
                    <input
                      value={button.text}
                      onChange={(event) =>
                        setButtons((current) =>
                          current.map((item) => (item.id === button.id ? { ...item, text: event.target.value } : item))
                        )
                      }
                      className="input w-2/5 text-xs"
                      placeholder="Texto do botão"
                      maxLength={64}
                    />
                    <div className="relative min-w-0 flex-1">
                      <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#68758b]" />
                      <input
                        value={button.url}
                        onChange={(event) =>
                          setButtons((current) =>
                            current.map((item) => (item.id === button.id ? { ...item, url: event.target.value } : item))
                          )
                        }
                        className="input pl-8 text-xs"
                        placeholder="https://…"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setButtons((current) => current.filter((item) => item.id !== button.id))}
                      className="rounded-lg px-2 text-[#6f7c91] hover:bg-rose-400/10 hover:text-rose-300"
                      aria-label="Remover botão"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lastResult && (
            <div className="flex items-start gap-2 rounded-xl border border-[#d4f933]/20 bg-[#d4f933]/5 p-3 text-xs text-[#d4f933]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {lastResult}
            </div>
          )}

          <button type="submit" disabled={sending || !text.trim() || !bot || text.length > charLimit} className="btn-primary w-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Enviando pela API…' : mode === 'audience' ? 'Enviar para o segmento' : 'Enviar mensagem'}
          </button>
        </form>
      </section>

      <div className="space-y-5">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Prévia</h3>
            <span className="badge border-[#2b3447] bg-[#171c26] text-[#9aa6ba]">Telegram</span>
          </div>
          <div className="mt-4 rounded-2xl border border-[#24304a] bg-[#0e1621] p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] text-[#6f7c91]">
              <span className="h-2 w-2 rounded-full bg-[#d4f933]" />
              @{bot?.username || 'bot'} · agora
            </div>
            <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-[#182533] px-3 py-2.5">
              {imageUrl && /^https?:\/\//i.test(imageUrl) && (
                <img src={imageUrl} alt="" className="mb-2 max-h-40 w-full rounded-xl object-cover" />
              )}
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#e6ebf3]">
                {text.trim() || 'Sua mensagem aparece aqui.'}
              </p>
              <div className="mt-1 text-right text-[9px] text-[#6f7c91]">
                {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}
              </div>
            </div>
            {buttons.filter((button) => button.text && button.url).length > 0 && (
              <div className="mt-2 space-y-1">
                {buttons
                  .filter((button) => button.text && button.url)
                  .map((button) => (
                    <div
                      key={button.id}
                      className="rounded-lg border border-[#2a3b55] bg-[#152233] px-3 py-1.5 text-center text-[10px] font-semibold text-[#7fc0f4]"
                    >
                      {button.text}
                    </div>
                  ))}
              </div>
            )}
          </div>
          {mode === 'lead' && selectedLead && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#7b879b]">
              <Avatar src={selectedLead.avatarUrl} name={selectedLead.name} size="sm" />
              Destino: <span className="font-semibold text-white">{selectedLead.name}</span>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <h3 className="text-sm font-bold text-white">Histórico de envios</h3>
            <span className="text-[10px] text-[#667387]">{plural(scopedMessages.length, 'evento', 'eventos')}</span>
          </div>
          {scopedMessages.length === 0 ? (
            <p className="m-5 rounded-xl border border-dashed border-[#293246] p-5 text-center text-[11px] text-[#748196]">
              Nenhuma mensagem registrada para este bot.
            </p>
          ) : (
            <div className="mt-3 max-h-[430px] divide-y divide-[#1a202c] overflow-y-auto">
              {scopedMessages.map((message) => (
                <div key={message.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[#161b25] sm:px-6">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#171c26]">
                    {message.status === 'falhou' ? (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-300" />
                    ) : message.direction === 'in' ? (
                      <MessageSquare className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <Send className="h-3.5 w-3.5 text-[#d4f933]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[#b3bdcc]">{truncate(message.text, 90)}</p>
                    <p className="mt-0.5 text-[10px] text-[#5f6c81]">
                      {message.direction === 'in' ? 'Recebida' : message.status} · {formatDate(message.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#657287]">{relativeTime(message.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
