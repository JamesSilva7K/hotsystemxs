import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Share2,
  Smartphone,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { notifications } from '../lib/notifications';
import { Modal } from './Modal';
import { useToast } from './Toast';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstalled?: () => void;
}

export function PwaInstallModal({
  open,
  onClose,
  deferredPrompt,
  onInstalled,
}: PwaInstallModalProps) {
  const { notify } = useToast();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('android');
  const [installing, setInstalling] = useState(false);
  const [pushStatus, setPushStatus] = useState<'granted' | 'default' | 'denied' | 'unsupported'>('default');
  const [soundOn, setSoundOn] = useState(() => notifications.isSoundEnabled);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus('unsupported');
    }

    return notifications.onSoundChange(setSoundOn);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      notify(
        'info',
        'Instalação Manual',
        platform === 'ios'
          ? 'No iPhone: Toque em Compartilhar e depois em "Adicionar à Tela de Início".'
          : 'Toque no menu de 3 pontinhos do navegador e escolha "Instalar aplicativo".'
      );
      return;
    }

    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        notify('success', 'App Instalado com Sucesso!', 'O Hot System foi adicionado à tela inicial do seu aparelho.');
        onInstalled?.();
        onClose();
      }
    } catch (e) {
      console.warn('Erro ao disparar prompt de instalação:', e);
    } finally {
      setInstalling(false);
    }
  };

  const handleRequestPush = async () => {
    const granted = await notifications.requestPermission();
    if (granted) {
      setPushStatus('granted');
      notify('success', 'Notificações Ativadas!', 'Seu aparelho receberá alertas a cada venda e PIX confirmado.');
      notifications.notifySale({
        valor: 97.0,
        leadName: 'Cliente Teste VIP',
        botName: 'Modelo Hot',
        tipo: 'Venda de Teste Aprovada',
      });
    } else {
      setPushStatus(Notification.permission);
      notify(
        'error',
        'Permissão Negada',
        'Para ativar, abra as configurações do navegador no celular e permita notificações para este site.'
      );
    }
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    notifications.setSoundEnabled(next);
    notify(
      'info',
      next ? 'Som de Vendas Ativado 🔔' : 'Som de Vendas Silenciado 🔕',
      next ? 'A caixa registradora tocará em toda compra aprovada.' : 'Alertas sonoros desativados.'
    );
  };

  const handleTestSound = () => {
    notifications.playSaleChime();
    notify('success', '🔔 Som de Venda Testado!', 'Tocou a sineta de caixa registradora / PIX com sucesso.');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Instalar App no Celular & Notificações"
      description="Crie o atalho na tela inicial do seu celular e receba notificações na tela com som a cada venda confirmada."
      size="lg"
    >
      <div className="space-y-6">
        {/* Banner de Destaque com Ícone Oficial */}
        <div className="relative overflow-hidden rounded-2xl border border-[#2a3345] bg-gradient-to-br from-[#121622] via-[#0d1017] to-[#07090e] p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-[#d4f933]/40 bg-[#0b0d11] shadow-xl shadow-[#d4f933]/15">
              <img src="/icon-192.png" alt="Hot System" className="h-12 w-12 rounded-xl object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white sm:text-lg">Hot System VIP</span>
                <span className="rounded-full bg-[#d4f933] px-2 py-0.2 text-[10px] font-black text-black">
                  PWA APP
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8c9aae]">
                Acesso direto com 1 toque na tela do seu aparelho, tela cheia e alertas instantâneos de vendas.
              </p>
            </div>
          </div>
        </div>

        {/* 1. SEÇÃO DE INSTALAÇÃO DO ATALHO NO CELULAR */}
        <div className="rounded-2xl border border-[#202737] bg-[#0c1017] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#d4f933]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                1. Atalho na Área de Trabalho do Celular
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#6d7b8f]">
              {platform === 'ios' ? 'Apple iOS' : platform === 'android' ? 'Google Android' : 'Desktop'}
            </span>
          </div>

          {/* Opção A: Android com prompt automático pronto */}
          {deferredPrompt && (
            <div className="space-y-3">
              <p className="text-xs text-[#95a3b8]">
                Seu navegador já suporta a instalação direta em 1 clique!
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="btn-primary w-full py-3 text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#d4f933]/20"
              >
                <Download className="h-4 w-4" />
                {installing ? 'Instalando no Aparelho...' : 'Criar Atalho na Área de Trabalho Agora'}
              </button>
            </div>
          )}

          {/* Opção B: Guia para iPhone / iPad (Safari) */}
          {platform === 'ios' && (
            <div className="space-y-3">
              <p className="text-xs text-[#b8c5d8]">
                No iOS/iPhone a Apple exige que o atalho seja adicionado pelo menu de compartilhamento do Safari:
              </p>
              <div className="grid gap-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl border border-[#1d2534] bg-[#10141f] p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-white">Toque no botão Compartilhar</span>
                    <p className="text-[11px] text-[#78869c]">
                      É o ícone quadrado com a setinha para cima <Share2 className="inline h-3 w-3 text-sky-400" /> na barra inferior do Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#1d2534] bg-[#10141f] p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#d4f933]/15 text-[#d4f933] font-bold text-xs">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-white">Selecione "Adicionar à Tela de Início"</span>
                    <p className="text-[11px] text-[#78869c]">
                      Role o menu para baixo até encontrar a opção com ícone de [+] quadrado.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#1d2534] bg-[#10141f] p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-white">Toque em "Adicionar"</span>
                    <p className="text-[11px] text-[#78869c]">
                      No canto superior direito. O ícone oficial do Hot System aparecerá na tela do seu iPhone!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opção C: Guia para Android / Chrome quando o prompt já foi dispensado */}
          {platform === 'android' && !deferredPrompt && (
            <div className="space-y-3">
              <p className="text-xs text-[#b8c5d8]">
                Para fixar o app no Android via Chrome ou Samsung Internet:
              </p>
              <div className="grid gap-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl border border-[#1d2534] bg-[#10141f] p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#d4f933]/15 text-[#d4f933] font-bold text-xs">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-white">Toque nos 3 Pontinhos (⋮)</span>
                    <p className="text-[11px] text-[#78869c]">
                      No canto superior direito do navegador Chrome ou inferior no Samsung Internet.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#1d2534] bg-[#10141f] p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#d4f933]/15 text-[#d4f933] font-bold text-xs">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-white">Toque em "Instalar aplicativo" ou "Adicionar à tela inicial"</span>
                    <p className="text-[11px] text-[#78869c]">
                      O sistema criará o ícone na sua área de trabalho imediatamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opção D: Desktop */}
          {platform === 'desktop' && !deferredPrompt && (
            <p className="text-xs text-[#7e8d9f]">
              Dica: No Chrome / Edge do computador, você também pode clicar no ícone de instalação <Download className="inline h-3 w-3 text-[#d4f933]" /> na barra de endereços (ao lado do link do site) para instalar como aplicativo de desktop.
            </p>
          )}
        </div>

        {/* 2. SEÇÃO DE NOTIFICAÇÕES NA TELA E SOM DE VENDA */}
        <div className="rounded-2xl border border-[#202737] bg-[#0c1017] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#d4f933]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                2. Notificações na Tela do Aparelho & Som de Confirmação
              </span>
            </div>
            {pushStatus === 'granted' ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Permitido no Aparelho
              </span>
            ) : pushStatus === 'denied' ? (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                Bloqueado no Navegador
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                Aguardando Permissão
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Permissão de Push */}
            <div className="rounded-xl border border-[#1d2534] bg-[#10141f] p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-[#d4f933]" /> Notificações Visuais na Tela
                </span>
                <p className="mt-1 text-[11px] text-[#7a889e]">
                  Exibe o card com o valor do PIX, nome do cliente e horário direto na tela de bloqueio e barra de notificações do celular.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequestPush}
                className={`mt-3 btn-secondary text-xs w-full justify-center ${
                  pushStatus === 'granted' ? 'border-emerald-500/30 text-emerald-400' : ''
                }`}
              >
                {pushStatus === 'granted' ? '✓ Notificações Ativas (Testar)' : 'Permitir Notificações no Aparelho'}
              </button>
            </div>

            {/* Controle de Som de Venda */}
            <div className="rounded-xl border border-[#1d2534] bg-[#10141f] p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {soundOn ? (
                      <Volume2 className="h-3.5 w-3.5 text-[#d4f933]" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5 text-[#6c798d]" />
                    )}
                    Som de Vendas / Caixa Registradora
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.2 text-[9px] font-bold ${
                      soundOn
                        ? 'bg-[#d4f933]/15 text-[#d4f933]'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {soundOn ? 'Ativado' : 'Silenciado'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#7a889e]">
                  Toca a sineta de PIX e moedas a cada confirmação de compra vinda do webhook SyncPay.
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`btn-secondary flex-1 text-xs justify-center ${
                    soundOn ? 'border-[#d4f933]/40 text-white' : 'text-[#7e8c9f]'
                  }`}
                >
                  {soundOn ? 'Desativar Som' : 'Ativar Som'}
                </button>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="btn-primary px-3 text-xs"
                  title="Testar como soa a venda agora"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Testar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-end border-t border-[#1e2533] pt-4">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
