import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  RotateCcw,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Webhook,
} from 'lucide-react';
import type { AppState } from '@shared/types';
import { api } from '../lib/api';
import { formatFullDate, formatNumber } from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface SettingsViewProps {
  state: AppState;
  refresh: () => Promise<void>;
  onLogout: () => void;
}

export function SettingsView({ state, refresh, onLogout }: SettingsViewProps) {
  const { notify } = useToast();
  const [operatorName, setOperatorName] = useState(state.settings.operatorName);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(state.settings.autoReplyEnabled);
  const [welcomeMessage, setWelcomeMessage] = useState(state.settings.welcomeMessage);
  const [notifyNewLeads, setNotifyNewLeads] = useState(state.settings.notifyNewLeads);
  const [adminChatId, setAdminChatId] = useState(state.settings.adminChatId);
  const [publicBaseUrl, setPublicBaseUrl] = useState(state.settings.publicBaseUrl);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState('');
  const [clearing, setClearing] = useState(false);
  const [legacyKeys, setLegacyKeys] = useState<string[]>(() =>
    typeof window === 'undefined'
      ? []
      : Object.keys(window.localStorage).filter((key) => key.startsWith('telebot_'))
  );

  useEffect(() => {
    if (dirty) return;
    setOperatorName(state.settings.operatorName);
    setAutoReplyEnabled(state.settings.autoReplyEnabled);
    setWelcomeMessage(state.settings.welcomeMessage);
    setNotifyNewLeads(state.settings.notifyNewLeads);
    setAdminChatId(state.settings.adminChatId);
    setPublicBaseUrl(state.settings.publicBaseUrl);
  }, [state.settings, dirty]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        operatorName,
        autoReplyEnabled,
        welcomeMessage,
        notifyNewLeads,
        adminChatId,
        publicBaseUrl,
      });
      notify('success', 'Ajustes salvos', 'As alterações valem para os próximos eventos.');
      setDirty(false);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao salvar', error instanceof Error ? error.message : 'Revise os campos.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetConfirm = async () => {
    const word = clearConfirm.trim().toUpperCase();
    if (word !== 'REINICIAR' && word !== 'LIMPAR') {
      notify('error', 'Palavra de confirmação incorreta', 'Digite REINICIAR para confirmar.');
      return;
    }
    setClearing(true);
    try {
      await api.clearData(word);
      setClearConfirm('');
      setResetModalOpen(false);
      notify('success', 'Sistema reiniciado com sucesso', 'Leads, conversas e vendas zerados. Bots e credenciais 100% preservados.');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao reiniciar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setClearing(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      onLogout();
    }
  };

  const clearLegacyLocalData = () => {
    if (legacyKeys.length === 0) return;
    if (!window.confirm('Remover as chaves antigas do painel neste navegador? Exporte o JSON antes se precisar guardar algo.')) {
      return;
    }
    for (const key of legacyKeys) window.localStorage.removeItem(key);
    setLegacyKeys([]);
    notify('success', 'Dados antigos removidos', 'As chaves da versão anterior foram apagadas deste navegador.');
  };

  return (
    <div className="grid gap-5 pb-20 xl:grid-cols-[1.15fr_0.85fr] md:pb-6">
      <form onSubmit={save} onChange={() => setDirty(true)} className="space-y-5">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4f933]/10 text-[#d4f933]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Atendimento automático</h2>
              <p className="text-[11px] text-[#768398]">Resposta inicial enviada somente em conversa privada.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="operator-name">Nome do operador</label>
              <input
                id="operator-name"
                value={operatorName}
                onChange={(event) => setOperatorName(event.target.value)}
                className="input"
                maxLength={80}
              />
            </div>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
              <div>
                <div className="text-sm font-semibold text-white">Boas-vindas automáticas</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#768398]">
                  Envia uma única vez para cada novo lead e também responde a /start, /menu e /ajuda.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoReplyEnabled}
                onChange={(event) => setAutoReplyEnabled(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#d4f933]"
              />
            </label>

            <div>
              <label className="label" htmlFor="welcome-message">Mensagem de boas-vindas</label>
              <textarea
                id="welcome-message"
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                className="input min-h-32 resize-y leading-relaxed"
                maxLength={4096}
                disabled={!autoReplyEnabled}
              />
              <p className="mt-1 text-[10px] text-[#657287]">
                Variáveis disponíveis: <span className="mono text-[#9aa6ba]">{'{nome}'}</span>,{' '}
                <span className="mono text-[#9aa6ba]">{'{username}'}</span> e{' '}
                <span className="mono text-[#9aa6ba]">{'{bot}'}</span>.
              </p>
            </div>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
              <div>
                <div className="text-sm font-semibold text-white">Notificar novos leads</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#768398]">
                  Envia um aviso pelo próprio bot para o seu chat de administrador.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyNewLeads}
                onChange={(event) => setNotifyNewLeads(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#d4f933]"
              />
            </label>

            <div>
              <label className="label" htmlFor="admin-chat">Chat ID do administrador</label>
              <input
                id="admin-chat"
                value={adminChatId}
                onChange={(event) => setAdminChatId(event.target.value)}
                className="input mono"
                placeholder="Ex.: 123456789"
                disabled={!notifyNewLeads}
              />
              <p className="mt-1 text-[10px] text-[#657287]">
                Use seu ID numérico, não o @username. O bot precisa poder iniciar conversa com você.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4f933]/10 text-[#d4f933]">
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Webhook</h2>
              <p className="text-[11px] text-[#768398]">Opcional. Sem webhook, o long polling continua funcionando.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="public-url">URL pública HTTPS</label>
              <input
                id="public-url"
                value={publicBaseUrl}
                onChange={(event) => setPublicBaseUrl(event.target.value)}
                className="input mono"
                placeholder="https://painel.seudominio.com"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-[#657287]">
                Para ativar webhook, publique o sistema atrás de HTTPS (proxy reverso) e informe a URL.
                O endereço do webhook é gerado automaticamente por bot.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando' : 'Salvar ajustes'}
          </button>
        </div>
      </form>

      <div className="space-y-5">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-[#d4f933]" />
            <h2 className="text-sm font-bold text-white">Servidor</h2>
          </div>
          <div className="mt-4 space-y-2.5 text-xs">
            {[
              ['Versão', state.server.version],
              ['Armazenamento', state.server.storage],
              ['Polling', state.server.pollingEnabled ? 'Ativo' : 'Desativado'],
              ['Senha do painel', state.server.passwordProtected ? 'Ativa' : 'Desativada'],
              ['Horário do servidor', formatFullDate(state.server.now)],
              ['Bots', formatNumber(state.bots.length)],
              ['Leads', formatNumber(state.leads.length)],
              ['Mensagens', formatNumber(state.messages.length)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 border-b border-[#1c2331] pb-2 last:border-0 last:pb-0">
                <span className="text-[#758196]">{label}</span>
                <span className="text-right font-medium text-[#d3dbe7]">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#d4f933]" />
            <h2 className="text-sm font-bold text-white">Dados</h2>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#768398]">
            Exporte um JSON com bots sem tokens, leads, chats, mensagens e campanhas. Ideal para backup manual.
          </p>
          <a href="/api/export" className="btn-secondary mt-3 w-full text-xs">
            <Download className="h-3.5 w-3.5" /> Exportar JSON
          </a>

          {legacyKeys.length > 0 && (
            <button type="button" onClick={clearLegacyLocalData} className="btn-ghost mt-2 w-full text-[11px] text-amber-300 hover:bg-amber-400/10">
              <Trash2 className="h-3.5 w-3.5" />
              Remover {legacyKeys.length} chave(s) da versão anterior
            </button>
          )}

          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <RotateCcw className="h-4 w-4" /> Reinicialização Segura do Painel
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#a8b3c7]">
              Permite zerar leads, conversas e métricas para recomeçar o ciclo de vendas, mantendo intactos seus bots, credenciais e integrações.
            </p>
            <button
              type="button"
              onClick={() => {
                setClearConfirm('');
                setResetModalOpen(true);
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
              Opções de Reinicialização...
            </button>
          </div>
        </section>

        {/* Modal de Reinicialização Segura com Explicação Passo a Passo */}
        <Modal
          open={resetModalOpen}
          onClose={() => !clearing && setResetModalOpen(false)}
          title="Reinicialização do Sistema"
          description="Entenda exatamente o que acontecerá antes de confirmar."
          size="lg"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                disabled={clearing}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                disabled={clearing || (clearConfirm.trim().toUpperCase() !== 'REINICIAR' && clearConfirm.trim().toUpperCase() !== 'LIMPAR')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500 bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-40"
              >
                {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Confirmar Reinicialização
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Aviso de Backup */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#d4f933]/30 bg-[#d4f933]/5 p-3.5">
              <div className="flex items-center gap-2.5">
                <Download className="h-4 w-4 shrink-0 text-[#d4f933]" />
                <span className="text-xs text-[#d3dbe7]">Deseja guardar uma cópia antes de reiniciar?</span>
              </div>
              <a
                href="/api/export"
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d4f933]/40 bg-[#d4f933]/15 px-2.5 py-1 text-[11px] font-bold text-[#d4f933] transition hover:bg-[#d4f933]/25"
              >
                <Download className="h-3 w-3" /> Baixar Backup
              </a>
            </div>

            {/* Comparativo: O que fica e o que sai */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> 100% PRESERVADO (INTACTO)
                </div>
                <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-[#9caac1]">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span> Bots do Telegram e tokens de API
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span> Credenciais SyncPay (Client ID/Secret)
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span> Produtos, preços e links de entrega
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span> Mensagens de boas-vindas e regras
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  <ShieldAlert className="h-4 w-4" /> SERÁ ZERADO / APAGADO
                </div>
                <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-[#9caac1]">
                  <li className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">✕</span> {formatNumber(state.leads.length)} leads capturados
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">✕</span> {formatNumber(state.messages.length)} mensagens do histórico
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">✕</span> {formatNumber(state.purchases.length)} vendas e pedidos anteriores
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">✕</span> Campanhas e grupos indexados
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirmação textual */}
            <div className="rounded-2xl border border-[#252e3f] bg-[#0d1017] p-4">
              <label className="block text-xs font-semibold text-white">
                Para confirmar todas as ações acima, digite <span className="mono text-rose-300 font-bold">REINICIAR</span>:
              </label>
              <input
                type="text"
                value={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.value)}
                placeholder="Digite REINICIAR"
                className="input mono mt-2 border-rose-500/40 text-center tracking-wider text-rose-200 placeholder:text-rose-200/30 focus:border-rose-400"
                autoFocus
              />
            </div>
          </div>
        </Modal>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#d4f933]" />
            <h2 className="text-sm font-bold text-white">Segurança</h2>
          </div>
          <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-[#768398]">
            <li className="flex gap-2"><LockKeyhole className="mt-0.5 h-3 w-3 shrink-0 text-[#d4f933]" /> Tokens ficam criptografados no servidor e nunca são devolvidos ao navegador.</li>
            <li className="flex gap-2"><KeyRound className="mt-0.5 h-3 w-3 shrink-0 text-[#d4f933]" /> Para expor na internet, defina <span className="mono">PANEL_PASSWORD</span> e use HTTPS.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-[#d4f933]" /> Toda validação vem da API do Telegram, inclusive erros e permissões.</li>
          </ul>
          {state.server.passwordProtected && (
            <button type="button" onClick={logout} className="btn-secondary mt-4 w-full text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sair do painel
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
