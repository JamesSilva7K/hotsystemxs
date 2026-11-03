import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import type { AppState, Lead } from '@shared/types';
import { api } from '../lib/api';
import { formatDate, formatNumber, plural, relativeTime, truncate } from '../lib/format';
import { Avatar } from './Avatar';
import { TelegramPreview, type InlinePreviewButton } from './TelegramPreview';
import { useToast } from './Toast';

interface MessagesProps {
  state: AppState;
  selectedBotId: string;
  initialLead: Lead | null;
  onConsumeLead: () => void;
  refresh: () => Promise<void>;
  onNavigate?: (tab: string) => void;
}

type Mode = 'audience' | 'lead' | 'chat';
type Audience = 'all' | 'novo' | 'interessado' | 'qualificado' | 'cliente';

interface MessageButton {
  id: number;
  text: string;
  url: string;
  color?: 'default' | 'green' | 'red' | 'purple' | 'amber';
  row?: number;
}

const TEMPLATES = [
  {
    name: 'Upsell Premiado (Hot 🔥)',
    text: `😱🔥 Eitaaaa! Sua compra foi PREMIADA Nº #75 🎉🎉🎉\n\n✨ + 265 vídeos extras meu mais N0VINHAA+18 perdendo a virgindade...\n😈 Spoilers, áudios e vídeos que não posto no grupo\n\n🎁 BÔNUS ESPECIAL:\n✅ Meu WPP pessoal\n✅ Grupo lives, no grupo de live já tem + de 15 lives gravadas 😈\n\n➡️ Só por R$7,90 e acesso vitalício IMEDIATO!`,
    buttons: [
      { id: 1, text: '🔥 ADICIONAR', url: 'https://syncpayments.com.br', color: 'green' as const, row: 0 },
      { id: 2, text: '❌ RECUSAR', url: 'https://t.me', color: 'red' as const, row: 0 },
    ],
  },
  {
    name: 'Cobrança PIX Copia e Cola ⚡',
    text: `✅ Como realizar o pagamento:\n\n1. Abra o aplicativo do seu banco.\n2. Selecione a opção "Pagar" ou "PIX".\n3. Escolha "PIX Copia e Cola".\n4. Cole a chave que está abaixo e finalize o pagamento com segurança.\n\nCopie o código abaixo:\n\n\`00020126870014br.gov.bcb.pix2565pix.basspago.com.br/qr/v3/at/8698aa5a-9b67-4dda-b9a4-d3161d3b7d655204000053039865802BR5920SYNC_TECNOLOGIA_LTDA6008BRASILIA62070503***6304373F\`\n\nApós efetuar o pagamento, o seu acesso é liberado automaticamente. 🎁`,
    buttons: [
      { id: 1, text: '📋 Copiar Código PIX', url: 'https://t.me', color: 'purple' as const, row: 0 },
    ],
  },
  {
    name: 'Boas-vindas VIP com Áudio 💋',
    text: `Oiii, que bom te ver por aqui amor! 😈\n\nAcabei de soltar uma prévia exclusiva que você nunca viu em lugar nenhum.\n\nClica aqui embaixo para desbloquear o meu VIP completo com chamada de vídeo! 👇`,
    buttons: [
      { id: 1, text: '💋 ACESSAR VIP COMPLETO', url: 'https://syncpayments.com.br', color: 'green' as const, row: 0 },
    ],
  },
];

export function Messages({ state, selectedBotId, initialLead, onConsumeLead, refresh, onNavigate }: MessagesProps) {
  const { notify } = useToast();
  const defaultBotId =
    selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '';
  const [botId, setBotId] = useState(defaultBotId);
  const [mode, setMode] = useState<Mode>('audience');
  const [audience, setAudience] = useState<Audience>('all');
  const [leadId, setLeadId] = useState('');
  const [chatId, setChatId] = useState('');
  const [text, setText] = useState(TEMPLATES[0].text);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'animation' | 'none'>('none');
  const [buttons, setButtons] = useState<MessageButton[]>(TEMPLATES[0].buttons);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const bot = state.bots.find((item) => item.id === botId) || state.bots[0] || null;
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

  const recipientCount = useMemo(() => {
    if (mode === 'audience') {
      if (audience === 'all') return scopedLeads.length;
      return scopedLeads.filter((lead) => lead.status === audience).length;
    }
    if (mode === 'lead') return leadId ? 1 : 0;
    return chatId ? 1 : 0;
  }, [mode, audience, scopedLeads, leadId, chatId]);

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setText(tpl.text);
    setButtons([...tpl.buttons]);
    notify('info', 'Modelo aplicado', tpl.name);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bot) {
      notify('error', 'Nenhum bot conectado', 'Conecte um bot antes de enviar.');
      return;
    }
    if (!text.trim()) {
      notify('error', 'Mensagem vazia', 'Escreva o texto antes de enviar.');
      return;
    }
    const cleanButtons = buttons
      .map((button) => ({ text: button.text.trim(), url: button.url.trim() }))
      .filter((button) => button.text && button.url);

    setSending(true);
    setLastResult(null);
    try {
      if (mode === 'audience') {
        const result = await api.broadcast({
          botId: bot.id,
          audience,
          text: text.trim(),
          imageUrl: mediaUrl.trim() || undefined,
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
          const l = scopedLeads.find((item) => item.id === leadId);
          if (!l) {
            notify('error', 'Selecione um lead', 'Escolha o destinatário na lista.');
            return;
          }
          target = l.telegramUserId;
        }
        const result = await api.sendMessage({
          botId: bot.id,
          chatId: target,
          text: text.trim(),
          imageUrl: mediaUrl.trim() || undefined,
          buttons: cleanButtons.length ? cleanButtons : undefined,
          leadId: mode === 'lead' ? leadId : undefined,
        });
        if (result.ok) {
          notify('success', 'Mensagem entregue', `Enviada com sucesso no Telegram.`);
          setText('');
        } else {
          notify('error', 'Falha no envio', result.error || 'Erro no envio.');
        }
      }
      await refresh();
    } catch (error) {
      notify('error', 'Falha no envio', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const selectedLead = scopedLeads.find((lead) => lead.id === leadId) || null;
  const charLimit = mediaUrl.trim() ? 1_024 : 4_096;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Barra Superior com Seleção de Modelos Rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2b3548] bg-[#10141d] p-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#d4f933]" />
          <span className="text-xs font-bold text-white">Modelos de Mensagem Prontos:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="rounded-xl border border-[#273244] bg-[#161c28] px-3 py-1.5 text-[11px] font-semibold text-[#ccd6e4] transition hover:border-[#d4f933]/50 hover:bg-[#d4f933]/10 hover:text-[#d4f933]"
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Coluna do Formulário de Envio */}
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d2533] pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Criar Envio / Transmissão</h2>
              <p className="mt-0.5 text-xs text-[#8290a5]">Envie textos, fotos, vídeos e botões reais diretamente no Telegram.</p>
            </div>
            <span className="badge border-[#2b3447] bg-[#171c26] text-[#a4afc1]">
              <Users className="h-3 w-3" /> {formatNumber(recipientCount)} destino(s)
            </span>
          </div>

          <form onSubmit={send} className="mt-5 space-y-4">
            {state.bots.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="message-bot">Modelo / Bot Remetente</label>
                  <select
                    id="message-bot"
                    value={botId}
                    onChange={(event) => setBotId(event.target.value)}
                    className="input font-semibold"
                  >
                    {state.bots.map((item) => (
                      <option key={item.id} value={item.id}>
                        @{item.username} ({item.firstName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Tipo de Destino</span>
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#252e3f] bg-[#0d1017] p-1">
                    {([
                      ['audience', 'Audiência'],
                      ['lead', 'Lead Único'],
                      ['chat', 'Canal / Grupo'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${
                          mode === value ? 'bg-[#d4f933] text-black shadow' : 'text-[#7f8ca1] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Nenhum bot conectado no momento. Conecte sua primeira Modelo na aba <b>Bots</b> para disparar mensagens reais.
              </div>
            )}

            {mode === 'audience' && (
              <div>
                <label className="label" htmlFor="message-audience">Segmento de Leads</label>
                <select
                  id="message-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  className="input"
                >
                  <option value="all">Todos os leads ativos ({scopedLeads.length})</option>
                  <option value="novo">Leads novos ({scopedLeads.filter((l) => l.status === 'novo').length})</option>
                  <option value="interessado">Leads interessados ({scopedLeads.filter((l) => l.status === 'interessado').length})</option>
                  <option value="qualificado">Leads qualificados ({scopedLeads.filter((l) => l.status === 'qualificado').length})</option>
                  <option value="cliente">Clientes pagantes ({scopedLeads.filter((l) => l.status === 'cliente').length})</option>
                </select>
              </div>
            )}

            {mode === 'lead' && (
              <div>
                <label className="label" htmlFor="message-lead">Selecionar Lead</label>
                <select
                  id="message-lead"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione um lead...</option>
                  {scopedLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.username ? `(@${l.username})` : ''} · {l.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode === 'chat' && (
              <div>
                <label className="label" htmlFor="message-chat">Selecionar Grupo / Canal</label>
                <select
                  id="message-chat"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione o canal ou grupo...</option>
                  {scopedChats.map((c) => (
                    <option key={c.id} value={c.telegramChatId}>
                      {c.title} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Texto da Mensagem */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0" htmlFor="message-text">Texto da Mensagem</label>
                <span className={`text-[10px] ${text.length > charLimit ? 'text-rose-400 font-bold' : 'text-[#77859c]'}`}>
                  {text.length}/{charLimit} caracteres
                </span>
              </div>
              <textarea
                id="message-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="input min-h-[140px] resize-y font-sans leading-relaxed"
              />
            </div>

            {/* Anexo de Mídia (Foto / Vídeo / GIF) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="media-url">URL da Mídia (Opcional)</label>
                <input
                  id="media-url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://exemplo.com/foto.jpg ou .mp4"
                  className="input mono text-xs"
                />
              </div>
              <div>
                <label className="label">Tipo de Mídia</label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as typeof mediaType)}
                  className="input"
                >
                  <option value="none">Sem mídia (Apenas texto)</option>
                  <option value="photo">Foto (JPEG/PNG)</option>
                  <option value="video">Vídeo (MP4)</option>
                  <option value="animation">GIF / Animação</option>
                </select>
              </div>
            </div>

            {/* Botões Inline com Configuração de Cores e Posição */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">Botões Interativos no Telegram</span>
                  <p className="text-[10px] text-[#717e94]">Posicione lado a lado (mesma linha) ou empilhados.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setButtons((curr) => [
                      ...curr,
                      { id: Date.now(), text: '🔥 ADICIONAR', url: 'https://', color: 'green', row: 0 },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2b3548] bg-[#141a24] px-2.5 py-1 text-[11px] font-semibold text-[#d4f933] transition hover:bg-[#d4f933]/15"
                >
                  <Plus className="h-3 w-3" /> Adicionar Botão
                </button>
              </div>

              {buttons.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#293246] p-3 text-center text-[11px] text-[#657287]">
                  Nenhum botão configurado. Clique em "Adicionar Botão" para incluir links ou ações.
                </p>
              ) : (
                <div className="space-y-2">
                  {buttons.map((btn) => (
                    <div key={btn.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#232b3c] bg-[#0c1017] p-2.5">
                      <input
                        value={btn.text}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) => (b.id === btn.id ? { ...b, text: e.target.value } : b))
                          )
                        }
                        placeholder="Texto (ex: 🔥 ADICIONAR)"
                        className="input min-w-[130px] flex-1 text-xs"
                      />
                      <input
                        value={btn.url}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) => (b.id === btn.id ? { ...b, url: e.target.value } : b))
                          )
                        }
                        placeholder="https://..."
                        className="input min-w-[140px] flex-1 font-mono text-xs"
                      />
                      <select
                        value={btn.color || 'default'}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) =>
                              b.id === btn.id ? { ...b, color: e.target.value as MessageButton['color'] } : b
                            )
                          )
                        }
                        className="input w-28 text-xs font-semibold"
                      >
                        <option value="green">Verde 🔥</option>
                        <option value="red">Vermelho ❌</option>
                        <option value="purple">Roxo 📋</option>
                        <option value="amber">Dourado ⭐</option>
                        <option value="default">Padrão</option>
                      </select>
                      <select
                        value={btn.row ?? 0}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) => (b.id === btn.id ? { ...b, row: Number(e.target.value) } : b))
                          )
                        }
                        className="input w-24 text-xs"
                        title="Linha do botão (0 = Linha 1, 1 = Linha 2)"
                      >
                        <option value={0}>Linha 1</option>
                        <option value={1}>Linha 2</option>
                        <option value={2}>Linha 3</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setButtons((curr) => curr.filter((b) => b.id !== btn.id))}
                        className="rounded-lg p-1.5 text-[#6f7c91] hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lastResult && (
              <div className="flex items-start gap-2 rounded-xl border border-[#d4f933]/30 bg-[#d4f933]/10 p-3 text-xs text-[#d4f933]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {lastResult}
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !text.trim() || !bot}
              className="btn-primary w-full py-3 text-sm font-bold shadow-lg shadow-[#d4f933]/20"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Disparando no Telegram...' : mode === 'audience' ? 'Enviar para a Audiência' : 'Enviar Mensagem Agora'}
            </button>
          </form>
        </section>

        {/* Coluna da Prévia Real do Telegram (Mockup Telegram) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-white">Visualização em Tempo Real</span>
            <span className="rounded-full bg-[#2b5278]/40 px-2 py-0.5 text-[10px] font-bold text-[#7fc0f4]">
              Telegram Live Mockup
            </span>
          </div>

          <TelegramPreview
            botName={bot ? `@${bot.username}` : 'Modelo Hot VIP 💋'}
            botAvatar={bot?.avatarUrl}
            text={text}
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            buttons={buttons.map((b) => ({
              text: b.text,
              url: b.url,
              color: b.color,
              row: b.row,
            }))}
            socialProof={
              text.includes('PIX') || text.includes('000201')
                ? '💬 Diego disse: "pqp que gostosa do caralho naquele vídeo com o amigo do ex marido 😈"'
                : undefined
            }
          />

          {/* Histórico Recente de Envios */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1d2533] px-5 py-3.5">
              <h3 className="text-xs font-bold text-white">Últimos Envios</h3>
              <span className="text-[10px] text-[#667387]">{plural(scopedMessages.length, 'evento', 'eventos')}</span>
            </div>
            {scopedMessages.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-[#748196]">
                Nenhuma mensagem registrada ainda.
              </p>
            ) : (
              <div className="max-h-[220px] divide-y divide-[#1a202c] overflow-y-auto">
                {scopedMessages.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex items-start gap-2.5 px-4 py-2.5 text-xs hover:bg-[#161b25]">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1a2130]">
                      {m.status === 'falhou' ? (
                        <AlertCircle className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Send className="h-3 w-3 text-[#d4f933]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#cad4e2]">{truncate(m.text, 65)}</p>
                      <p className="text-[10px] text-[#67758c]">
                        {m.direction === 'in' ? 'Recebida' : m.status} · {relativeTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
