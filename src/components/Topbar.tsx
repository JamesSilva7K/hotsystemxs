import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  ChevronDown,
  Download,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Bot } from '@shared/types';
import type { NavTab } from '../lib/nav';
import { NAV_ITEMS } from '../lib/nav';
import { Dot } from './StatusBadge';
import { relativeTime } from '../lib/format';
import { notifications } from '../lib/notifications';
import { PwaInstallModal, type BeforeInstallPromptEvent } from './PwaInstallModal';
import { useToast } from './Toast';

interface TopbarProps {
  tab: NavTab;
  bots: Bot[];
  selectedBotId: string;
  onSelectBot: (id: string) => void;
  onSync: () => void;
  syncing: boolean;
  lastSync: string | null;
  connected: boolean;
}

export function Topbar({
  tab,
  bots,
  selectedBotId,
  onSelectBot,
  onSync,
  syncing,
  lastSync,
  connected,
}: TopbarProps) {
  const { notify } = useToast();
  const meta = NAV_ITEMS.find((item) => item.id === tab) || NAV_ITEMS[0];
  const selected = bots.find((bot) => bot.id === selectedBotId);

  const [soundActive, setSoundActive] = useState(() => notifications.isSoundEnabled);
  const [pushActive, setPushActive] = useState(() => notifications.isPushEnabled);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  useEffect(() => {
    // Detectar se já está instalado como PWA
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const unsubSound = notifications.onSoundChange(setSoundActive);
    const unsubPush = notifications.onPushChange(setPushActive);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      unsubSound();
      unsubPush();
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    notifications.setSoundEnabled(next);
    notify(
      'info',
      next ? 'Som de Vendas Ativado 🔔' : 'Som de Vendas Silenciado 🔕',
      next ? 'A sineta tocará a cada confirmação de compra.' : 'Alertas sonoros de compras desativados.'
    );
  };

  const handleBellClick = async () => {
    if (Notification.permission === 'granted') {
      setPwaModalOpen(true);
    } else {
      const granted = await notifications.requestPermission();
      if (granted) {
        setPushActive(true);
        notify('success', 'Notificações na Tela Ativadas!', 'Você receberá alertas em tempo real no seu celular.');
      } else {
        setPwaModalOpen(true);
      }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#1b202b] bg-[#0b0d11]/88 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
                {meta.title}
              </h1>
              <span className="hidden items-center gap-1.5 rounded-full border border-[#293246] bg-[#11151d] px-2 py-0.5 text-[10px] font-semibold text-[#9aa5b9] sm:inline-flex">
                <Dot tone={connected ? 'lime' : 'slate'} />
                {connected ? 'Servidor online' : 'Sem conexão'}
              </span>
            </div>
            <p className="hidden truncate text-xs text-[#7e899d] sm:block">{meta.subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Botão de Instalação PWA no Celular / Atalho Área de Trabalho */}
            <button
              type="button"
              onClick={() => setPwaModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#293246] bg-[#121722] px-2.5 py-1.5 text-xs font-semibold text-[#c8d3e6] transition hover:border-[#d4f933] hover:text-[#d4f933] sm:px-3 sm:py-2"
              title="Criar atalho na tela inicial do celular ou instalar app"
            >
              <Smartphone className="h-3.5 w-3.5 text-[#d4f933]" />
              <span className="hidden sm:inline">
                {isInstalled ? 'App no Celular' : 'Instalar no Celular'}
              </span>
              <span className="sm:hidden">App</span>
            </button>

            {/* Botão de Sino de Notificações na Tela */}
            <button
              type="button"
              onClick={handleBellClick}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition sm:h-10 sm:w-10 ${
                pushActive
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-[#293246] bg-[#121722] text-[#6f7d94] hover:text-white'
              }`}
              title={
                pushActive
                  ? 'Notificações na Tela do Aparelho: Ativadas. Clique para testar ou configurar.'
                  : 'Notificações na Tela: Clique para ativar alertas de vendas no seu celular.'
              }
            >
              <Bell className="h-4 w-4" />
              {pushActive && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              )}
            </button>

            {/* Botão de Alternar Som de Venda (Caixa Registradora / PIX) */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition sm:h-10 sm:w-10 ${
                soundActive
                  ? 'border-[#d4f933]/40 bg-[#d4f933]/15 text-[#d4f933]'
                  : 'border-[#293246] bg-[#121722] text-[#6f7d94] hover:text-white'
              }`}
              title={
                soundActive
                  ? 'Som de Vendas: ATIVADO. Clique para silenciar o som.'
                  : 'Som de Vendas: SILENCIADO. Clique para ativar a sineta de compras.'
              }
            >
              {soundActive ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundActive && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#d4f933] shadow-[0_0_8px_#d4f933]" />
              )}
            </button>

            {bots.length > 0 && (
              <div className="relative block">
                <select
                  value={selectedBotId}
                  onChange={(event) => onSelectBot(event.target.value)}
                  className="h-9 max-w-[128px] appearance-none rounded-xl border border-[#293246] bg-[#121722] pl-3 pr-8 text-[11px] font-semibold text-[#dce2ee] focus:border-[#d4f933] focus:outline-none sm:h-10 sm:max-w-[200px] sm:pr-9 sm:text-xs"
                  aria-label="Filtrar por bot"
                >
                  <option value="all">Todos os bots</option>
                  {bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      @{bot.username}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#77839a]" />
              </div>
            )}

            {selected && (
              <span className="hidden items-center gap-1.5 rounded-xl border border-[#293246] bg-[#121722] px-2.5 py-2 text-[11px] font-medium text-[#a7b1c4] lg:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5 text-[#d4f933]" />
                @{selected.username}
              </span>
            )}

            <button
              type="button"
              onClick={onSync}
              disabled={syncing || bots.length === 0}
              className="btn-secondary h-10 px-3 text-xs"
              title={lastSync ? `Última sincronização: ${relativeTime(lastSync)}` : 'Sincronizar agora'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando' : 'Sincronizar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal de Instalação e Notificações no Aparelho */}
      <PwaInstallModal
        open={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstalled={() => setIsInstalled(true)}
      />
    </>
  );
}
