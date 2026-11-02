import React, { useMemo, useState } from 'react';
import {
  Archive,
  Download,
  ExternalLink,
  MessageSquare,
  Search,
  Send,
  Tag,
  UserRound,
  Users,
} from 'lucide-react';
import type { AppState, Lead, LeadStatus } from '@shared/types';
import { api } from '../lib/api';
import {
  downloadCsv,
  formatFullDate,
  formatNumber,
  relativeTime,
  statusLabel,
  truncate,
} from '../lib/format';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { useToast } from './Toast';
import { LEAD_STATUSES } from '../lib/format';

interface LeadsProps {
  state: AppState;
  selectedBotId: string;
  refresh: () => Promise<void>;
  onCompose: (lead: Lead) => void;
}

export function Leads({ state, selectedBotId, refresh, onCompose }: LeadsProps) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<LeadStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState<LeadStatus>('novo');

  const scoped = useMemo(
    () => (selectedBotId === 'all' ? state.leads : state.leads.filter((lead) => lead.botId === selectedBotId)),
    [state.leads, selectedBotId]
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return scoped.filter((lead) => {
      if (status !== 'all' && lead.status !== status) return false;
      if (!term) return true;
      return (
        lead.name.toLowerCase().includes(term) ||
        (lead.username || '').toLowerCase().includes(term) ||
        lead.telegramUserId.includes(term) ||
        lead.sourceChatTitle.toLowerCase().includes(term) ||
        lead.lastMessageText.toLowerCase().includes(term)
      );
    });
  }, [scoped, query, status]);

  const selectedLead = state.leads.find((lead) => lead.id === openId) || null;
  const selectedMessages = useMemo(
    () => (selectedLead ? state.messages.filter((message) => message.leadId === selectedLead.id).slice(0, 30) : []),
    [state.messages, selectedLead]
  );

  const openLead = (lead: Lead) => {
    setOpenId(lead.id);
    setNotes(lead.notes);
    setTags(lead.tags.join(', '));
    setEditStatus(lead.status);
  };

  const saveLead = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      await api.updateLead(selectedLead.id, {
        status: editStatus,
        notes,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      notify('success', 'Lead atualizado', 'Status, tags e anotações salvos.');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao salvar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const archiveLead = async () => {
    if (!selectedLead) return;
    if (!window.confirm('Arquivar este lead? Ele deixa de aparecer nas campanhas, mas o histórico é preservado.')) return;
    setSaving(true);
    try {
      await api.deleteLead(selectedLead.id);
      notify('success', 'Lead arquivado', 'O histórico de mensagens foi mantido.');
      setOpenId(null);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao arquivar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Nome', 'Username', 'Telegram ID', 'Status', 'Origem', 'Mensagens', 'Primeiro contato', 'Última mensagem'],
      ...filtered.map((lead) => [
        lead.name,
        lead.username ? `@${lead.username}` : '',
        lead.telegramUserId,
        statusLabel(lead.status),
        lead.sourceChatTitle,
        lead.messagesCount,
        lead.firstContactAt,
        lead.lastMessageAt,
      ]),
    ]);
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Users className="h-5 w-5 text-[#d4f933]" />
              Base de leads
              <span className="badge border-[#2b3447] bg-[#171c26] text-[#a4afc1]">
                {formatNumber(filtered.length)} de {formatNumber(scoped.length)}
              </span>
            </h2>
            <p className="mt-1 text-xs text-[#8290a5]">
              Contatos reais captados pelas mensagens. O status é controlado por você, sem inferência automática.
            </p>
          </div>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="btn-secondary self-start text-xs">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#1e2634] pt-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#252e3f] bg-[#0d1017] p-1">
            {(['all', ...LEAD_STATUSES] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                  status === item ? 'bg-[#d4f933] text-black' : 'text-[#7f8ca1] hover:text-white'
                }`}
              >
                {item === 'all' ? 'Todos' : statusLabel(item)}
              </button>
            ))}
          </div>
          <div className="relative w-full xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#68758b]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input pl-9 text-xs"
              placeholder="Buscar nome, @username, ID ou mensagem"
              aria-label="Buscar leads"
            />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserRound className="mx-auto h-9 w-9 text-[#5d6a7f]" />
            <h3 className="mt-3 text-sm font-bold text-white">Nenhum lead encontrado</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#7b879b]">
              {scoped.length === 0
                ? 'Envie uma mensagem para o bot no Telegram ou use Sincronizar para importar conversas pendentes.'
                : 'Ajuste a busca ou o filtro de status para ver outros contatos.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="border-b border-[#1e2634] bg-[#0e1118] text-[10px] uppercase tracking-[0.08em] text-[#68758a]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Última mensagem</th>
                  <th className="px-4 py-3 font-semibold">Atividade</th>
                  <th className="px-5 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a202c]">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="group transition hover:bg-[#161b25]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={lead.avatarUrl} name={lead.name} size="md" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white group-hover:text-[#d4f933]">{lead.name}</div>
                          <div className="mono truncate text-[10px] text-[#7b879b]">
                            {lead.username ? `@${lead.username}` : `ID ${lead.telegramUserId}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[150px] px-4 py-3.5">
                      <div className="truncate text-[#b0bac9]">{lead.sourceChatTitle}</div>
                      <div className="mono text-[10px] text-[#626e82]">ID {lead.telegramUserId}</div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={lead.status} /></td>
                    <td className="max-w-[240px] px-4 py-3.5">
                      <p className="truncate text-[#aab5c6]">{truncate(lead.lastMessageText, 55)}</p>
                      <div className="mt-0.5 text-[10px] text-[#626e82]">
                        {lead.messagesCount} mensagens · {relativeTime(lead.lastMessageAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-[#77849a]">{relativeTime(lead.lastMessageAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button type="button" onClick={() => openLead(lead)} className="btn-ghost text-xs">
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(selectedLead)}
        onClose={() => setOpenId(null)}
        title={selectedLead?.name || 'Lead'}
        description="Ficha do contato, histórico e classificação no CRM."
        size="lg"
        footer={
          selectedLead ? (
            <>
              <button type="button" onClick={archiveLead} disabled={saving} className="btn-ghost mr-auto text-xs text-rose-300 hover:bg-rose-400/10">
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </button>
              <button type="button" onClick={() => setOpenId(null)} className="btn-secondary text-xs">Fechar</button>
              <button type="button" onClick={saveLead} disabled={saving} className="btn-primary text-xs">
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          ) : null
        }
      >
        {selectedLead && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
              <Avatar src={selectedLead.avatarUrl} name={selectedLead.name} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-white">{selectedLead.name}</div>
                <div className="mono text-xs text-[#d4f933]">
                  {selectedLead.username ? `@${selectedLead.username}` : `ID ${selectedLead.telegramUserId}`}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#6f7c91]">
                  <span>Primeiro contato: {formatFullDate(selectedLead.firstContactAt)}</span>
                  <span>Última ação: {formatFullDate(selectedLead.lastMessageAt)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedLead.username && (
                  <a
                    href={`https://t.me/${selectedLead.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs"
                  >
                    Telegram <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onCompose(selectedLead);
                    setOpenId(null);
                  }}
                  className="btn-primary text-xs"
                >
                  <Send className="h-3.5 w-3.5" /> Mensagem
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Mensagens', formatNumber(selectedLead.messagesCount)],
                ['Origem', selectedLead.sourceChatTitle],
                ['ID Telegram', selectedLead.telegramUserId],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#252e3f] bg-[#0d1017] p-3">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[#6f7c91]">{label}</div>
                  <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="lead-status">Status no funil</label>
                <select
                  id="lead-status"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as LeadStatus)}
                  className="input"
                >
                  {LEAD_STATUSES.map((item) => (
                    <option key={item} value={item}>{statusLabel(item)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="lead-tags">
                  <Tag className="mr-1 inline h-3 w-3" /> Tags
                </label>
                <input
                  id="lead-tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="input"
                  placeholder="vip, interesse, indicação"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="lead-notes">Anotações</label>
              <textarea
                id="lead-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input min-h-24 resize-y"
                placeholder="Contexto da conversa, objeções, próximo passo…"
              />
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#7f8ca1]">
                <MessageSquare className="h-3.5 w-3.5" /> Histórico recente
              </h3>
              {selectedMessages.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#293246] p-4 text-center text-[11px] text-[#748196]">
                  Nenhuma mensagem registrada para este lead.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {selectedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl border p-2.5 ${
                        message.direction === 'in'
                          ? 'border-[#252e3f] bg-[#0e1118]'
                          : message.status === 'falhou'
                          ? 'border-rose-400/20 bg-rose-400/5'
                          : 'border-[#d4f933]/15 bg-[#d4f933]/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-semibold text-[#9eabbd]">
                          {message.direction === 'in' ? 'Recebida' : message.status === 'falhou' ? 'Falhou' : 'Enviada'}
                        </span>
                        <span className="text-[#5f6c81]">{formatFullDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-[#c0c9d7]">
                        {message.text}
                      </p>
                      {message.error && <p className="mt-1 text-[10px] text-rose-300">{message.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
