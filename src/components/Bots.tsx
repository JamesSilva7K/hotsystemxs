import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot as BotIcon,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Command,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Hash,
  Image as ImageIcon,
  Instagram,
  Laptop,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  PhoneCall,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Video,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import type { AppState, BotFunnelStageConfig, BotOperatingMode } from '@shared/types';
import { api } from '../lib/api';
import { formatBRL, formatFullDate, formatNumber, relativeTime } from '../lib/format';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { Dot } from './StatusBadge';
import { useToast } from './Toast';
import { FlagBrasil, FlagEspanha, FlagUSA, LanguageSelector, type LanguageCode } from './LanguageSelector';
import type { NavTab } from '../lib/nav';

function IconTikTok({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.86-4.49V8.65a8.21 8.21 0 0 0 4.91 1.62v-3.58h-1z" />
    </svg>
  );
}

function IconWhatsApp({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29" />
    </svg>
  );
}

function IconTwitterX({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface BotsProps {
  state: AppState;
  refresh: () => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

const DEFAULT_FUNNEL_STAGES: BotFunnelStageConfig[] = [
  {
    id: 'welcome',
    name: '1. Boas-vindas Personalizada (/start)',
    description: 'Apresentação sedutora da modelo no idioma nativo do bot.',
    enabled: true,
    order: 1,
  },
  {
    id: 'age_gate',
    name: '2. Verificação de Idade & Termos (+18)',
    description: 'Bloqueio de segurança com botões interativos.',
    enabled: true,
    order: 2,
  },
  {
    id: 'teaser_sample',
    name: '3. Amostra Sensorial & Provocação (Foto/Áudio Teaser)',
    description: 'Disponibiliza prévia provocativa para despertar o desejo do lead.',
    enabled: true,
    order: 3,
  },
  {
    id: 'plans_checkout',
    name: '4. Apresentação de Planos VIP & Checkout',
    description: 'Mostra valores em R$ ou USD/EUR com botões de compra direta.',
    enabled: true,
    order: 4,
  },
  {
    id: 'payment_validation',
    name: '5. Validação de Pagamento Automática (SyncPay)',
    description: 'Verificação de PIX ou cartão aprovado antes de liberar acessos.',
    enabled: true,
    order: 5,
  },
  {
    id: 'vip_delivery',
    name: '6. Liberação do Canal VIP Anti-Vazamento',
    description: 'Entrega link de uso único que expira após 1 entrada.',
    enabled: true,
    order: 6,
  },
  {
    id: 'followup_recovery',
    name: '7. Recuperação Agressiva de Lead (25% a 40% OFF)',
    description: 'Dispara ofertas de desconto progressivas caso o lead hesite.',
    enabled: true,
    order: 7,
  },
];

const PREVIEW_TEASERS = [
  {
    id: 'prev_teaser_sensorial',
    title: 'Provocação Sensorial (Vídeo Sem Tarja)',
    badge: 'Mais Cliques',
    badgeIcon: 'flame',
    body: 'Gravei um vídeo novo aqui na cama que ficou tão quente que nem o Telegram aguentaria aberto sem censura... 🔥🙈\n\nQuem quiser ver a versão completa sem tarja e sem cortes, clica no botão abaixo e me chama no meu chat privado agora! 👇',
    ctaText: 'DESTRAVAR VÍDEO COMPLETO NA DM',
    tag: 'previas_free',
  },
  {
    id: 'prev_escassez_vagas',
    title: 'Vagas Relâmpago com Desconto (Escassez)',
    badge: '35% OFF',
    badgeIcon: 'tag',
    body: 'Meninos, vou abrir apenas 5 vagas com 35% de desconto no meu VIP pros 5 primeiros que me chamarem no privado nos próximos minutos! ⏳🎁\n\nQuem entrar agora leva todos os meus conteúdos acumulados + meu WhatsApp pessoal.',
    ctaText: 'GARANTIR MINHA VAGA COM DESCONTO',
    tag: 'previas_desconto',
  },
  {
    id: 'prev_enquete_recompensa',
    title: 'Enquete com Foto Exclusiva de Recompensa',
    badge: 'Interativo',
    badgeIcon: 'sparkles',
    body: 'Qual lingerie você prefere que eu use hoje à noite? 😈💋\n\n1️⃣ Calcinha de renda vermelha\n2️⃣ Fio dental preto transparente\n3️⃣ Nenhuma (completamente nua)\n\nQuem vier me contar no privado ganha uma foto exclusiva de prévia agora mesmo!',
    ctaText: 'RESGATAR FOTO DE PRÉVIA NA DM',
    tag: 'previas_enquete',
  },
  {
    id: 'prev_audio_gemido',
    title: 'Áudio Proibido & Barulho Molhado',
    badge: 'Sensorial',
    badgeIcon: 'zap',
    body: 'Acabei de gravar um áudio deitada na cama me tocando enquanto pensava em vocês... 💦🤤\n\nSe de fone de ouvido já dá arrepio na espinha, imagina ver o vídeo completo na íntegra no meu canal VIP. Vem falar comigo no privado:',
    ctaText: 'ME CHAMAR NO PRIVADO',
    tag: 'previas_audio',
  },
  {
    id: 'prev_chamada_video',
    title: 'Bônus Chamada de Vídeo Privativa',
    badge: 'VIP + Chamada',
    badgeIcon: 'phone',
    body: 'Tô sozinha no quarto e hoje quero companhia... Quem fechar plano vitalício hoje ganha uma chamada de vídeo comigo na hora! ☎️🔥\n\nCorre e me manda uma mensagem na DM antes que eu feche a agenda:',
    ctaText: 'ME CHAMAR NA DM PRA CHAMADA',
    tag: 'previas_chamada',
  },
];

const SOCIAL_PLATFORMS = [
  {
    id: 'bio_insta',
    name: 'Instagram (Bio)',
    iconType: 'instagram',
    tag: 'bio_insta',
    bioTemplate: (link: string, name: string) =>
      `💋 ${name} | Conteúdos Proibidos sem Censura 🔥\n🔞 Chamadas de vídeo & arquivos secretos\n👇 Fale comigo no Telegram privado:\n${link}`,
  },
  {
    id: 'insta_stories',
    name: 'Instagram (Stories / Link)',
    iconType: 'camera',
    tag: 'insta_stories',
    bioTemplate: (link: string, _name: string) =>
      `🔞 Arrasta pra cima ou toca no link pra ver o vídeo completo sem tarja comigo:\n${link}`,
  },
  {
    id: 'tiktok',
    name: 'TikTok (Bio)',
    iconType: 'tiktok',
    tag: 'tiktok',
    bioTemplate: (link: string, _name: string) => `✨ Sem cortes e sem filtros no Telegram 👇\n${link}`,
  },
  {
    id: 'twitter_x',
    name: 'Twitter / X',
    iconType: 'twitter',
    tag: 'twitter_x',
    bioTemplate: (link: string, _name: string) =>
      `🔥 Meus vídeos mais pesados e sem tarja liberados no Telegram privado 👇\n${link}`,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp / Status',
    iconType: 'whatsapp',
    tag: 'whatsapp',
    bioTemplate: (link: string, _name: string) => `Oi amor, meu Telegram secreto sem censura tá aqui 👇\n${link}`,
  },
  {
    id: 'previas_free',
    name: 'Grupo de Prévias (CTA DM)',
    iconType: 'radio',
    tag: 'previas_free',
    bioTemplate: (link: string, _name: string) =>
      `👉 Destrave o chat privado diretamente comigo no Telegram:\n${link}`,
  },
];

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
  const [vipChannelInput, setVipChannelInput] = useState('');
  const [validatingVip, setValidatingVip] = useState(false);
  const [vipValidationResult, setVipValidationResult] = useState<{
    title: string;
    membersCount: number;
    isAdmin: boolean;
  } | null>(null);
  const [vipReqs, setVipReqs] = useState({
    requireTerms: true,
    requirePayment: true,
    singleUseLink: true,
  });
  const [operatingMode, setOperatingMode] = useState<BotOperatingMode>('conversational_sales');
  const [funnelStages, setFunnelStages] = useState<BotFunnelStageConfig[]>(DEFAULT_FUNNEL_STAGES);

  // Estados de Grupo de Prévias & Agendamento
  const [previewGroupInput, setPreviewGroupInput] = useState('');
  const [validatingPreview, setValidatingPreview] = useState(false);
  const [previewValidationResult, setPreviewValidationResult] = useState<{
    title: string;
    membersCount: number;
    isAdmin: boolean;
  } | null>(null);
  const [previewScheduleMode, setPreviewScheduleMode] = useState<'interval' | 'hours' | 'off'>('off');
  const [previewScheduleIntervalHours, setPreviewScheduleIntervalHours] = useState<number>(4);
  const [previewScheduleHours, setPreviewScheduleHours] = useState<string[]>(['12:00', '18:00', '22:30']);
  const [sendingPreviewTeaser, setSendingPreviewTeaser] = useState(false);
  const [selectedTeaserTemplateId, setSelectedTeaserTemplateId] = useState<string>('prev_teaser_sensorial');

  // Estados do Gerador de Links Rastreados para Redes Sociais
  const [socialPlatform, setSocialPlatform] = useState<string>('bio_insta');
  const [copiedSocialLink, setCopiedSocialLink] = useState(false);
  const [copiedBioText, setCopiedBioText] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [botModalCategory, setBotModalCategory] = useState<
    'dm_welcome' | 'plans_upsell' | 'preview_group' | 'recovery' | 'vip_channel' | 'bio_profile'
  >('dm_welcome');
  const [smartPreviewMode, setSmartPreviewMode] = useState<'telegram' | 'mobile_bio'>('telegram');
  const [activePreviewCopy, setActivePreviewCopy] = useState<{
    title: string;
    body: string;
    tag: string;
    discount?: string;
    mediaType?: 'photo' | 'video' | 'audio';
    buttons: Array<{ text: string; iconType?: 'sparkles' | 'flame' | 'card' | 'send'; primary?: boolean }>;
  }>({
    title: 'Modelo 1: 30% OFF (Cerveja no Bar)',
    body: 'Tá com medo de pagar caro? 30% OFF = você gasta menos que uma cerveja no bar e ainda leva minha buc3t4 virando o olho na tela do celular. 🍺➡️💦',
    tag: 'recupera_30off',
    discount: '30% OFF',
    mediaType: 'video',
    buttons: [
      { text: 'MENSAL + BÔNUS por R$ 13.93 (30% OFF)', iconType: 'sparkles', primary: true },
      { text: '1 DIA NO PARAÍSO por R$ 6.93 (30% OFF)', iconType: 'flame', primary: false },
    ],
  });

  const openBot = state.bots.find((bot) => bot.id === openBotId) || null;

  useEffect(() => {
    if (openBot) {
      setVipChannelInput(openBot.vipChannelId || '');
      setOperatingMode(openBot.operatingMode || 'conversational_sales');
      setFunnelStages(
        openBot.funnelStages && openBot.funnelStages.length > 0 ? openBot.funnelStages : DEFAULT_FUNNEL_STAGES
      );
      setVipReqs(
        openBot.vipRequirements || {
          requireTerms: true,
          requirePayment: true,
          singleUseLink: true,
        }
      );
      setVipValidationResult(
        openBot.vipChannelId && openBot.vipChannelTitle
          ? {
              title: openBot.vipChannelTitle,
              membersCount: 0,
              isAdmin: true,
            }
          : null
      );
      // Sincroniza Grupo de Prévias
      setPreviewGroupInput(openBot.previewGroupId || '');
      setPreviewScheduleMode(openBot.previewScheduleMode || 'off');
      setPreviewScheduleIntervalHours(openBot.previewScheduleIntervalHours || 4);
      setPreviewScheduleHours(openBot.previewScheduleHours || ['12:00', '18:00', '22:30']);
      setPreviewValidationResult(
        openBot.previewGroupId && openBot.previewGroupTitle
          ? {
              title: openBot.previewGroupTitle,
              membersCount: 0,
              isAdmin: true,
            }
          : null
      );
    }
  }, [
    openBot?.id,
    openBot?.vipChannelId,
    openBot?.vipChannelTitle,
    openBot?.operatingMode,
    openBot?.funnelStages,
    openBot?.previewGroupId,
    openBot?.previewGroupTitle,
    openBot?.previewScheduleMode,
    openBot?.previewScheduleIntervalHours,
    openBot?.previewScheduleHours,
  ]);

  const handleToggleFunnelStage = async (stageId: string) => {
    if (!openBot) return;
    const updated = funnelStages.map((s) => (s.id === stageId ? { ...s, enabled: !s.enabled } : s));
    setFunnelStages(updated);
    try {
      await api.updateBot(openBot.id, { funnelStages: updated });
      notify('success', 'Etapa Atualizada', 'O funil do bot foi recalculado com sucesso.');
      await refresh();
    } catch {
      setFunnelStages(funnelStages);
    }
  };

  const handleChangeOperatingMode = async (mode: BotOperatingMode) => {
    if (!openBot) return;
    setOperatingMode(mode);
    try {
      await api.updateBot(openBot.id, { operatingMode: mode });
      notify('success', 'Modo do Bot Atualizado', 'O comportamento do bot foi ajustado.');
      await refresh();
    } catch {
      setOperatingMode(openBot.operatingMode || 'conversational_sales');
    }
  };

  const handleSaveVipChannel = async () => {
    if (!openBot) return;
    setValidatingVip(true);
    try {
      if (vipChannelInput.trim()) {
        const valRes = await api.validateVipChannel(openBot.id, vipChannelInput.trim());
        setVipValidationResult({
          title: valRes.channel.title,
          membersCount: valRes.channel.membersCount,
          isAdmin: valRes.channel.isAdmin,
        });
        await api.updateBot(openBot.id, {
          vipChannelId: valRes.channel.id,
          vipChannelTitle: valRes.channel.title,
          vipRequirements: vipReqs,
        });
        notify(
          'success',
          'Canal VIP Validado!',
          `${valRes.channel.title} foi conectado com sucesso e blindado com funil de liberação segura.`
        );
      } else {
        await api.updateBot(openBot.id, {
          vipChannelId: null,
          vipChannelTitle: null,
          vipRequirements: vipReqs,
        });
        setVipValidationResult(null);
        notify('info', 'Canal VIP Removido', 'A liberação automática foi desativada.');
      }
      await refresh();
    } catch (err) {
      notify('error', 'Falha na validação', err instanceof Error ? err.message : 'Verifique se o bot é administrador do canal.');
    } finally {
      setValidatingVip(false);
    }
  };

  const handleToggleVipReq = async (key: 'requireTerms' | 'requirePayment' | 'singleUseLink') => {
    if (!openBot) return;
    const nextReqs = { ...vipReqs, [key]: !vipReqs[key] };
    setVipReqs(nextReqs);
    try {
      await api.updateBot(openBot.id, { vipRequirements: nextReqs });
      notify('success', 'Regra Atualizada', 'Critério de liberação do canal VIP atualizado.');
      await refresh();
    } catch {
      setVipReqs(vipReqs);
    }
  };

  const handleSavePreviewGroup = async () => {
    if (!openBot) return;
    setValidatingPreview(true);
    try {
      if (previewGroupInput.trim()) {
        const valRes = await api.validatePreviewGroup(openBot.id, previewGroupInput.trim());
        setPreviewValidationResult({
          title: valRes.group.title,
          membersCount: valRes.group.membersCount,
          isAdmin: valRes.group.isAdmin,
        });
        await api.updateBot(openBot.id, {
          previewGroupId: valRes.group.id,
          previewGroupTitle: valRes.group.title,
          previewGroupInviteLink: valRes.group.inviteLink,
          previewScheduleMode,
          previewScheduleIntervalHours,
          previewScheduleHours,
        });
        notify(
          'success',
          'Grupo de Prévias Validado!',
          `${valRes.group.title} conectado com sucesso para agendamentos automáticos.`
        );
      } else {
        await api.updateBot(openBot.id, {
          previewGroupId: null,
          previewGroupTitle: null,
          previewGroupInviteLink: null,
          previewScheduleMode: 'off',
        });
        setPreviewValidationResult(null);
        notify('info', 'Grupo de Prévias Removido', 'Os envios automáticos de prévias foram pausados.');
      }
      await refresh();
    } catch (err) {
      notify(
        'error',
        'Falha na validação',
        err instanceof Error ? err.message : 'Verifique se o bot é administrador do grupo de prévias.'
      );
    } finally {
      setValidatingPreview(false);
    }
  };

  const handleUpdateScheduleConfig = async (
    mode: 'interval' | 'hours' | 'off',
    interval = previewScheduleIntervalHours,
    hours = previewScheduleHours
  ) => {
    if (!openBot) return;
    setPreviewScheduleMode(mode);
    setPreviewScheduleIntervalHours(interval);
    setPreviewScheduleHours(hours);
    try {
      await api.updateBot(openBot.id, {
        previewScheduleMode: mode,
        previewScheduleIntervalHours: interval,
        previewScheduleHours: hours,
      });
      notify(
        'success',
        'Agendador Atualizado',
        mode === 'off'
          ? 'Envios automáticos desativados.'
          : mode === 'interval'
          ? `Disparos automáticos a cada ${interval} horas.`
          : `Disparos fixos nos horários: ${hours.join(', ')}.`
      );
      await refresh();
    } catch {
      // Revert on error
    }
  };

  const handleSendTeaserNow = async () => {
    if (!openBot) return;
    if (!openBot.previewGroupId && !previewGroupInput.trim()) {
      notify('error', 'Sem Grupo de Prévias', 'Vincule um grupo de prévias antes de disparar teasers.');
      return;
    }
    setSendingPreviewTeaser(true);
    try {
      const res = await api.sendPreviewTeaserNow(openBot.id, selectedTeaserTemplateId);
      if (res.ok) {
        notify('success', 'Prévia Disparada! 🚀', 'A mensagem com botão direto para a DM foi postada no grupo.');
        await refresh();
      }
    } catch (err) {
      notify('error', 'Erro ao disparar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setSendingPreviewTeaser(false);
    }
  };
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
      <section className="card relative z-20">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-7 relative z-20">
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
          <div className="rounded-b-3xl border-t border-[#222a39] bg-[#0e1118] p-5 lg:rounded-r-3xl lg:rounded-bl-none lg:border-l lg:border-t-0 sm:p-7">
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
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#5f6c81]">
                      <span className="mono">ID {bot.id}</span>
                      <span>•</span>
                      <span className="text-[#8495ac]">Criado {relativeTime(bot.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className="flex items-center gap-1 rounded-md border border-[#2b3447] bg-[#0c1017] px-1.5 py-1 text-[10px] font-bold text-[#b4c3d8]"
                    title={`Idioma: ${bot.language === 'en' ? 'Inglês (EUA)' : bot.language === 'es' ? 'Espanhol' : 'Português (Brasil)'}`}
                  >
                    {bot.language === 'en' ? (
                      <FlagUSA className="h-3 w-4" />
                    ) : bot.language === 'es' ? (
                      <FlagEspanha className="h-3 w-4" />
                    ) : (
                      <FlagBrasil className="h-3 w-4" />
                    )}
                    <span className="uppercase">{bot.language || 'pt'}</span>
                  </span>
                  <span
                    className={`badge ${
                      bot.webhookUrl
                        ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
                        : 'border-[#2b3447] bg-[#171c26] text-[#95a1b5]'
                    }`}
                  >
                    {bot.webhookUrl ? <Webhook className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
                    {bot.webhookUrl ? 'Webhook' : 'Polling'}
                  </span>
                </div>
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
                  <div className="text-[10px] text-[#6b778c]">
                    {(bot.groupsCount || 0) + (bot.channelsCount || 0) > 0
                      ? `${bot.groupsCount || 0}G · ${bot.channelsCount || 0}C`
                      : 'chats'}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{formatNumber(bot.commands.length)}</div>
                  <div className="text-[10px] text-[#6b778c]">comandos</div>
                </div>
              </div>

              {bot.vipChannelId && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200">
                  <div className="flex items-center gap-1.5 truncate">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                    <span className="truncate font-semibold">VIP: {bot.vipChannelTitle || bot.vipChannelId}</span>
                  </div>
                  <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                    Funil Seguro 🛡️
                  </span>
                </div>
              )}

              {bot.lastError && (
                <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-2.5 text-[10px] leading-relaxed text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2">{bot.lastError}</span>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="text-[10px] text-[#657186]">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {bot.lastSyncAt ? `Sincronizado ${relativeTime(bot.lastSyncAt)}` : 'Sincronizado agora'}
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
                  <span>Última sync {openBot.lastSyncAt ? relativeTime(openBot.lastSyncAt) : 'Agora mesmo'}</span>
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

            {/* Categorias de Configuração & Operação do Bot */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#202738] bg-[#0c0f16] p-1.5 shadow-md">
              {[
                { id: 'dm_welcome', label: '1. Boas-Vindas & DM', icon: MessageSquare },
                { id: 'plans_upsell', label: '2. Planos & Upsell', icon: Sparkles },
                { id: 'preview_group', label: '3. Grupo de Prévias', icon: Radio },
                { id: 'recovery', label: '4. Recuperação', icon: Zap },
                { id: 'vip_channel', label: '5. Canal VIP', icon: ShieldCheck },
                { id: 'bio_profile', label: '6. Bio Link / Perfil', icon: Globe },
              ].map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBotModalCategory(cat.id as typeof botModalCategory)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      botModalCategory === cat.id
                        ? 'bg-[#d4f933] text-black shadow-md shadow-[#d4f933]/20'
                        : 'text-[#8594ab] hover:bg-[#151a24] hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* CONTEÚDO CATEGORIZADO */}
            {/* 1. Boas-Vindas & DM */}
            {botModalCategory === 'dm_welcome' && (
              <div className="space-y-4">
                {/* Configuração de Idioma e Nicho do Bot Ativo */}
                <div className="rounded-2xl border border-[#232d3d] bg-[#10141d] p-4">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#8da0b6]">
                    Idioma de Atendimento & Comunicação da Modelo
                  </label>
                  <p className="mt-0.5 text-xs text-[#718096]">
                    A modelo responderá leads automaticamente neste idioma em todas as boas-vindas, comandos (/start, /menu, /ajuda) e conversas.
                  </p>
                  <div className="mt-2.5 max-w-xs">
                    <LanguageSelector
                      value={(openBot.language as LanguageCode) || 'pt'}
                      onChange={async (newLang) => {
                        try {
                          await api.updateBot(openBot.id, { language: newLang });
                          notify(
                            'success',
                            'Idioma Atualizado!',
                            `A modelo agora se comunica em ${
                              newLang === 'en' ? 'Inglês (EUA)' : newLang === 'es' ? 'Espanhol' : 'Português (Brasil)'
                            }.`
                          );
                          await refresh();
                        } catch (err) {
                          notify('error', 'Falha ao alterar idioma', err instanceof Error ? err.message : 'Tente novamente.');
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Modo de Operação do Bot */}
                <div className="space-y-3 rounded-2xl border border-[#232d3d] bg-[#10141d] p-4 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2330] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4f933]/15 text-[#d4f933]">
                        <SlidersHorizontal className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                          Modo de Operação da Modelo
                        </h3>
                        <p className="text-[11px] text-[#718096]">
                          Escolha como a modelo se comporta no Telegram.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#d4f933]/30 bg-[#d4f933]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#d4f933]">
                      {operatingMode === 'conversational_sales'
                        ? 'Conversacional & Vendas'
                        : operatingMode === 'strict_funnel'
                        ? 'Funil Estrito VIP'
                        : 'Apenas Transmissão'}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#8da0b6]">
                      Modo de Operação Ativo:
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void handleChangeOperatingMode('conversational_sales')}
                        className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
                          operatingMode === 'conversational_sales'
                            ? 'border-[#d4f933] bg-[#d4f933]/10 text-white shadow-[0_0_15px_rgba(212,249,51,0.15)]'
                            : 'border-[#222a39] bg-[#0c1017] text-[#8c9bb0] hover:border-[#344055]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <MessageSquare className="h-3.5 w-3.5 text-[#d4f933]" />
                            Conversacional
                          </div>
                          <span className="rounded bg-[#d4f933]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#d4f933]">
                            🔥 Mais Vendas
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#7c8b9e]">
                          A modelo cria conexão íntima, envia amostras e conduz o lead para compra naturalmente.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleChangeOperatingMode('strict_funnel')}
                        className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
                          operatingMode === 'strict_funnel'
                            ? 'border-purple-500 bg-purple-500/15 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                            : 'border-[#222a39] bg-[#0c1017] text-[#8c9bb0] hover:border-[#344055]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                            Funil Estrito VIP
                          </div>
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                            🛡️ Blindado
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#7c8b9e]">
                          Passo a passo rígido: exige maioridade +18 e pagamento antes de liberar qualquer mídia ou acesso.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleChangeOperatingMode('broadcast_only')}
                        className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
                          operatingMode === 'broadcast_only'
                            ? 'border-amber-400 bg-amber-400/10 text-white shadow-[0_0_15px_rgba(212,249,51,0.15)]'
                            : 'border-[#222a39] bg-[#0c1017] text-[#8c9bb0] hover:border-[#344055]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <Radio className="h-3.5 w-3.5 text-amber-400" />
                            Transmissão
                          </div>
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                            📢 Disparo
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-[#7c8b9e]">
                          Não responde chats 1-a-1. Focado puramente em disparos e campanhas em massa nos canais/grupos.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ações do bot & Webhook */}
                <div className="rounded-2xl border border-[#232d3d] bg-[#10141d] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#7f8ca1]">Ações & Diagnóstico do bot</h3>
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

                {/* Gerador de Links Rastreados para Redes Sociais & DM da Modelo 🔗 */}
                <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-[#0d1612] p-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                          Gerador de Link do Telegram 100% Real para Redes Sociais
                        </h3>
                        <p className="text-[11px] text-[#8fa89b]">
                          Gere links validados para Instagram, TikTok e WhatsApp que destravam o chat privado da modelo com tracking.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      ● Link Oficial Validado na API
                    </span>
                  </div>

                  {/* Seletor de Redes Sociais */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#8da699]">
                      Selecione onde você vai divulgar:
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SOCIAL_PLATFORMS.map((plat) => (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => setSocialPlatform(plat.id)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                            socialPlatform === plat.id
                              ? 'border-emerald-400 bg-emerald-500/20 text-white shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                              : 'border-[#1b2b23] bg-[#08100c] text-[#7d9689] hover:border-emerald-500/40'
                          }`}
                        >
                          {plat.iconType === 'instagram' && <Instagram className="h-3.5 w-3.5 text-pink-400" />}
                          {plat.iconType === 'camera' && <Camera className="h-3.5 w-3.5 text-purple-400" />}
                          {plat.iconType === 'tiktok' && <IconTikTok className="h-3.5 w-3.5 text-white" />}
                          {plat.iconType === 'twitter' && <IconTwitterX className="h-3.5 w-3.5 text-sky-400" />}
                          {plat.iconType === 'whatsapp' && <IconWhatsApp className="h-3.5 w-3.5 text-emerald-400" />}
                          {plat.iconType === 'radio' && <Radio className="h-3.5 w-3.5 text-amber-400" />}
                          <span>{plat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Caixa de Link Gerado & Ações */}
                  {(() => {
                    const activePlat = SOCIAL_PLATFORMS.find((p) => p.id === socialPlatform) || SOCIAL_PLATFORMS[0];
                    const officialLink = `https://t.me/${openBot.username}?start=${activePlat.tag}`;
                    const readyBio = activePlat.bioTemplate(officialLink, openBot.firstName);

                    return (
                      <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-[#080f0b] p-3.5">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-[#8ea89a] mb-1">
                            <span>Link Oficial Formatado (Rastreamento Automático):</span>
                            <span className="text-[10px] text-emerald-400 font-bold">Origem: ?start={activePlat.tag}</span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              readOnly
                              value={officialLink}
                              className="input mono text-xs border-emerald-500/30 bg-[#050b07] text-[#d4f933] font-bold flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(officialLink);
                                setCopiedSocialLink(true);
                                setTimeout(() => setCopiedSocialLink(false), 2000);
                                notify('success', 'Link Copiado!', 'Cole na bio ou stories do seu perfil.');
                              }}
                              className="btn-primary shrink-0 bg-emerald-600 text-white hover:bg-emerald-500 border-none text-xs font-bold px-3"
                            >
                              {copiedSocialLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedSocialLink ? 'Copiado!' : 'Copiar Link'}
                            </button>
                            <a
                              href={officialLink}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary text-xs shrink-0 flex items-center gap-1"
                            >
                              Testar <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Texto de Bio / Post Pronto */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-[#8ea89a] mb-1">
                            <span>Texto Pronto para a Bio do seu Perfil:</span>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(readyBio);
                                setCopiedBioText(true);
                                setTimeout(() => setCopiedBioText(false), 2000);
                                notify('success', 'Texto da Bio Copiado!', 'Cole diretamente na bio da sua rede social.');
                              }}
                              className="text-[10px] text-emerald-400 font-bold hover:underline flex items-center gap-1"
                            >
                              {copiedBioText ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copiedBioText ? 'Bio Copiada!' : 'Copiar Texto da Bio'}
                            </button>
                          </div>
                          <div className="rounded-lg border border-emerald-500/20 bg-[#040805] p-2.5 text-xs text-[#b9d5c6] whitespace-pre-line font-sans">
                            {readyBio}
                          </div>
                        </div>

                        {/* QR Code Rápido */}
                        <div className="pt-1 flex items-center justify-between border-t border-emerald-500/10">
                          <button
                            type="button"
                            onClick={() => setShowQrCode(!showQrCode)}
                            className="btn-ghost text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
                          >
                            <QrCode className="h-4 w-4" />
                            {showQrCode ? 'Ocultar QR Code' : 'Exibir QR Code para Stories/Artes'}
                          </button>
                          <span className="text-[10px] text-[#698274]">
                            Quando o lead escaneia, a DM destrava direto no Telegram
                          </span>
                        </div>

                        {showQrCode && (
                          <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-emerald-500/30 bg-[#050c08] p-4 text-center sm:text-left">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                                officialLink
                              )}&bgcolor=050c08&color=10b981&margin=1`}
                              alt="QR Code Telegram"
                              className="h-36 w-36 rounded-xl border border-emerald-500/40 p-1 shadow-lg shadow-emerald-500/10"
                            />
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-bold text-white">QR Code Direto para a DM da Modelo</h4>
                              <p className="text-[11px] text-[#7d9789] leading-relaxed">
                                Salve este QR Code para adicionar em fotos, vídeos, stories ou cartazes. Ao apontar a câmera do celular, o lead é jogado direto para o Telegram da modelo com o chat destravado.
                              </p>
                              <a
                                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                                  officialLink
                                )}&margin=1`}
                                target="_blank"
                                download={`qrcode_${openBot.username}_${activePlat.tag}.png`}
                                rel="noreferrer"
                                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                              >
                                <ExternalLink className="h-3 w-3" /> Baixar Imagem em Alta Resolução (HD)
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
              </div>
            )}

            {/* 2. Planos & Upsell */}
            {botModalCategory === 'plans_upsell' && (
              <div className="space-y-4">
                <div className="space-y-3.5 rounded-2xl border border-purple-500/30 bg-[#120f1d] p-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                          Etapas do Funil de Conversão & Upsell
                        </h3>
                        <p className="text-[11px] text-[#9a8ca8]">
                          Ative ou desative cada etapa do processo de atração, sedução e venda da modelo.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                      {funnelStages.filter((s) => s.enabled).length} de {funnelStages.length} etapas ativas
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {funnelStages.map((stage) => (
                      <div
                        key={stage.id}
                        onClick={() => void handleToggleFunnelStage(stage.id)}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                          stage.enabled
                            ? 'border-purple-500/50 bg-purple-500/15 text-white'
                            : 'border-[#272138] bg-[#0c0914] text-[#7d6f8d] hover:border-purple-500/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={stage.enabled}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-purple-500 text-purple-600 focus:ring-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold">{stage.name}</div>
                          <p className="mt-0.5 text-[10px] text-[#9c8eae]">{stage.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#232d3d] bg-[#10141d] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Planos e Preços Disponíveis ({state.products.length})
                      </h3>
                      <p className="text-[11px] text-[#718096]">
                        Estes planos são oferecidos no comando /menu e nos botões de checkout.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBotId(null);
                        onNavigate('vendas');
                      }}
                      className="btn-ghost text-xs text-[#d4f933] hover:underline"
                    >
                      Gerenciar na Aba Vendas →
                    </button>
                  </div>
                  {state.products.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#293246] p-4 text-center text-xs text-[#718096]">
                      Nenhum produto cadastrado ainda. Crie planos e assinaturas na aba Vendas.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {state.products.map((prod) => (
                        <div key={prod.id} className="rounded-xl border border-[#252e3f] bg-[#0d1017] p-3">
                          <div className="text-xs font-bold text-white truncate">{prod.name}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="mono text-xs font-bold text-[#d4f933]">{formatBRL(prod.priceCents)}</span>
                            <span className="text-[10px] text-[#718096]">{prod.active ? 'Ativo' : 'Inativo'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Grupo de Prévias */}
            {botModalCategory === 'preview_group' && (
              <div className="space-y-4">
                <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-[#14100c] p-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                          Grupo de Prévias Grátis & Agendamento Automático
                        </h3>
                        <p className="text-[11px] text-[#a89885]">
                          Dispare teasers e provocações programadas no grupo grátis com botão direto para a DM da modelo.
                        </p>
                      </div>
                    </div>
                    {openBot.previewGroupId && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                        {previewScheduleMode === 'interval'
                          ? `Ativo · A cada ${previewScheduleIntervalHours}h`
                          : previewScheduleMode === 'hours'
                          ? `Ativo · ${previewScheduleHours.length} horários fixos`
                          : 'Conectado · Envio Manual'}
                      </span>
                    )}
                  </div>

                  {/* Input para vincular Grupo de Prévias */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#c7b7a3]">
                      ID do Grupo ou Canal de Prévias Grátis (-100... ou @canal):
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8d7c67]" />
                        <input
                          value={previewGroupInput}
                          onChange={(e) => setPreviewGroupInput(e.target.value)}
                          placeholder="-100192837482 ou @seucanalprevias"
                          className="input mono pl-9 text-xs border-amber-500/30 bg-[#0d0a08] text-white focus:border-amber-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSavePreviewGroup}
                        disabled={validatingPreview}
                        className="btn-primary shrink-0 bg-amber-600 text-white hover:bg-amber-500 border-none text-xs font-bold shadow-md shadow-amber-600/30"
                      >
                        {validatingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Validar & Salvar Grupo
                      </button>
                    </div>
                    {previewValidationResult && (
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="font-bold">{previewValidationResult.title}</span>
                            {previewValidationResult.membersCount > 0 && (
                              <span className="ml-2 text-[10px] text-amber-300/80">
                                {formatNumber(previewValidationResult.membersCount)} membros reais
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          {previewValidationResult.isAdmin ? 'Admin Confirmado' : 'Membro'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Seletor de Modo de Horário / Intervalo Automático */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#b8a692]">
                      Modo de Agendamento Automático:
                    </label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void handleUpdateScheduleConfig('interval')}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                          previewScheduleMode === 'interval'
                            ? 'border-amber-400 bg-amber-500/20 text-white shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                            : 'border-[#2d241c] bg-[#0d0a08] text-[#8e7e6c] hover:border-[#4d3e30]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-white">Intervalo Regular</span>
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                            ⚡ Contínuo
                          </span>
                        </div>
                        <p className="text-[10px] text-[#9d8d7b]">Dispara teasers automaticamente a cada X horas.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleUpdateScheduleConfig('hours')}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                          previewScheduleMode === 'hours'
                            ? 'border-amber-400 bg-amber-500/20 text-white shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                            : 'border-[#2d241c] bg-[#0d0a08] text-[#8e7e6c] hover:border-[#4d3e30]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-white">Horários Nobres</span>
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                            🎯 Pico de Conversão
                          </span>
                        </div>
                        <p className="text-[10px] text-[#9d8d7b]">Posta nos horários de maior tesão e atividade.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleUpdateScheduleConfig('off')}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                          previewScheduleMode === 'off'
                            ? 'border-gray-500 bg-gray-500/20 text-white'
                            : 'border-[#2d241c] bg-[#0d0a08] text-[#8e7e6c] hover:border-[#4d3e30]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-white">Desativado</span>
                          <span className="rounded bg-gray-500/20 px-1.5 py-0.2 text-[9px] font-bold text-gray-400">
                            Pausado
                          </span>
                        </div>
                        <p className="text-[10px] text-[#9d8d7b]">Envios apenas manuais pelo painel.</p>
                      </button>
                    </div>

                    {/* Opções de Intervalo */}
                    {previewScheduleMode === 'interval' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-[#0d0a08] p-2.5">
                        <span className="text-[11px] text-[#c7b7a3]">Disparar a cada:</span>
                        {[2, 3, 4, 6, 8, 12].map((hours) => (
                          <button
                            key={hours}
                            type="button"
                            onClick={() => void handleUpdateScheduleConfig('interval', hours)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                              previewScheduleIntervalHours === hours
                                ? 'bg-amber-500 text-black shadow'
                                : 'bg-[#1e1710] text-[#a89885] hover:bg-[#2c2217]'
                            }`}
                          >
                            {hours}h
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Opções de Horários Nobres */}
                    {previewScheduleMode === 'hours' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-[#0d0a08] p-2.5">
                        <span className="text-[11px] text-[#c7b7a3]">Horários configurados:</span>
                        {['12:00', '18:00', '21:00', '22:30', '00:00'].map((hour) => {
                          const isActive = previewScheduleHours.includes(hour);
                          return (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => {
                                const updated = isActive
                                  ? previewScheduleHours.filter((h) => h !== hour)
                                  : [...previewScheduleHours, hour];
                                void handleUpdateScheduleConfig('hours', previewScheduleIntervalHours, updated);
                              }}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                isActive
                                  ? 'bg-amber-500 text-black shadow'
                                  : 'bg-[#1e1710] text-[#8e7e6c] hover:bg-[#2c2217]'
                              }`}
                            >
                              {hour} {isActive ? '✓' : '+'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Biblioteca de Modelos de Mensagens de Prévia & Disparo Imediato */}
                  <div className="space-y-2 rounded-xl border border-amber-500/20 bg-[#0a0806] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        Modelos de Mensagem de Prévia (Alta Conversão):
                      </span>
                      <button
                        type="button"
                        onClick={handleSendTeaserNow}
                        disabled={sendingPreviewTeaser || !openBot.previewGroupId}
                        className="btn-primary bg-amber-500 text-black hover:bg-amber-400 border-none text-xs font-bold px-3 py-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {sendingPreviewTeaser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Disparar Prévia Agora
                      </button>
                    </div>

                    {/* Seletor de Templates de Prévia */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PREVIEW_TEASERS.map((teaser) => (
                        <div
                          key={teaser.id}
                          onClick={() => {
                            setSelectedTeaserTemplateId(teaser.id);
                            setActivePreviewCopy({
                              title: teaser.title,
                              body: teaser.body,
                              tag: teaser.tag,
                              discount: teaser.badge,
                              mediaType: teaser.id.includes('video') ? 'video' : teaser.id.includes('audio') ? 'audio' : 'photo',
                              buttons: [{ text: teaser.ctaText, iconType: 'sparkles', primary: true }],
                            });
                          }}
                          className={`cursor-pointer rounded-xl border p-2.5 transition ${
                            selectedTeaserTemplateId === teaser.id
                              ? 'border-amber-400 bg-amber-500/15 text-white shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                              : 'border-[#2d2217] bg-[#100d09] text-[#8d7c69] hover:border-amber-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{teaser.title}</span>
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                              {teaser.badgeIcon === 'flame' && <Flame className="h-3 w-3 text-amber-400" />}
                              {teaser.badgeIcon === 'tag' && <Tag className="h-3 w-3 text-amber-400" />}
                              {teaser.badgeIcon === 'sparkles' && <Sparkles className="h-3 w-3 text-amber-400" />}
                              {teaser.badgeIcon === 'zap' && <Zap className="h-3 w-3 text-amber-400" />}
                              {teaser.badgeIcon === 'phone' && <PhoneCall className="h-3 w-3 text-amber-400" />}
                              {teaser.badge}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#9f8e7b]">
                            {teaser.body}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[9px] text-amber-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Botão: {teaser.ctaText}
                            </span>
                            <span className="text-emerald-400 font-mono">Tag: ?start={teaser.tag}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Recuperação Agressiva de Leads */}
            {botModalCategory === 'recovery' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1612] p-4 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                          Modelos de Mensagem de Recuperação de Lead (Alta Conversão)
                        </h3>
                        <p className="text-[11px] text-[#8fa89b]">
                          Cópias agressivas de recuperação com desconto e botões de compra direta no estilo do Telegram.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBotId(null);
                        onNavigate('campaigns');
                      }}
                      className="btn-ghost text-xs text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      Automações & Disparos <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Modelo 1: 30% OFF (Sensorial & Desejo) */}
                    <div
                      onClick={() =>
                        setActivePreviewCopy({
                          title: 'Modelo 1: 30% OFF (Cerveja no Bar)',
                          body: 'Tá com medo de pagar caro? 30% OFF = você gasta menos que uma cerveja no bar e ainda leva minha buc3t4 virando o olho na tela do celular. 🍺➡️💦',
                          tag: 'recupera_30off',
                          discount: '30% OFF',
                          mediaType: 'video',
                          buttons: [
                            { text: 'MENSAL + BÔNUS por R$ 13.93 (30% OFF)', iconType: 'sparkles', primary: true },
                            { text: '1 DIA NO PARAÍSO por R$ 6.93 (30% OFF)', iconType: 'flame', primary: false },
                          ],
                        })
                      }
                      className="space-y-2.5 rounded-xl border border-[#1b2f24] bg-[#07120c] p-3.5 cursor-pointer hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Modelo 1: 30% OFF (Cerveja no Bar)</span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          <Flame className="h-3 w-3 text-emerald-400" /> Campeão de Vendas
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-[#0a1710] p-3 text-xs leading-relaxed text-[#c2dfd1]">
                        Tá com medo de pagar caro? 30% OFF = você gasta menos que uma cerveja no bar e ainda leva minha buc3t4 virando o olho na tela do celular. 🍺➡️💦
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <Sparkles className="h-3.5 w-3.5 text-[#d4f933]" /> MENSAL + BÔNUS por R$ 13.93 (30% OFF)
                        </div>
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <Flame className="h-3.5 w-3.5 text-rose-300" /> 1 DIA NO PARAÍSO por R$ 6.93 (30% OFF)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(
                            'Tá com medo de pagar caro? 30% OFF = você gasta menos que uma cerveja no bar e ainda leva minha buc3t4 virando o olho na tela do celular. 🍺➡️💦'
                          );
                          notify('success', 'Copy Copiado!', 'Texto de recuperação copiado para a área de transferência.');
                        }}
                        className="btn-secondary w-full text-xs justify-center"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar Copy do Modelo
                      </button>
                    </div>

                    {/* Modelo 2: 25% OFF (Barulho Molhado & WhatsApp) */}
                    <div
                      onClick={() =>
                        setActivePreviewCopy({
                          title: 'Modelo 2: 25% OFF (Áudio Molhado)',
                          body: 'Quer ouvir o barulho molhado? Eu gravei o som da minha buc3t4 sendo lambida com a língua dele (meu dedo). 25% OFF e você recebe o audio e o video no WhatsApp agora...',
                          tag: 'recupera_25off',
                          discount: '25% OFF',
                          mediaType: 'audio',
                          buttons: [
                            { text: 'MENSAL + BÔNUS por R$ 14.93 (25% OFF)', iconType: 'sparkles', primary: true },
                            { text: '1 DIA NO PARAÍSO por R$ 7.43 (25% OFF)', iconType: 'flame', primary: false },
                          ],
                        })
                      }
                      className="space-y-2.5 rounded-xl border border-[#1b2f24] bg-[#07120c] p-3.5 cursor-pointer hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Modelo 2: 25% OFF (Áudio Molhado)</span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          <Sparkles className="h-3 w-3 text-emerald-400" /> Alta Conversão
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-[#0a1710] p-3 text-xs leading-relaxed text-[#c2dfd1]">
                        Quer ouvir o barulho molhado? Eu gravei o som da minha buc3t4 sendo lambida com a língua dele (meu dedo). 25% OFF e você recebe o audio e o video no WhatsApp agora...
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <Sparkles className="h-3.5 w-3.5 text-[#d4f933]" /> MENSAL + BÔNUS por R$ 14.93 (25% OFF)
                        </div>
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <Flame className="h-3.5 w-3.5 text-rose-300" /> 1 DIA NO PARAÍSO por R$ 7.43 (25% OFF)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(
                            'Quer ouvir o barulho molhado? Eu gravei o som da minha buc3t4 sendo lambida com a língua dele (meu dedo). 25% OFF e você recebe o audio e o video no WhatsApp agora...'
                          );
                          notify('success', 'Copy Copiado!', 'Texto de recuperação copiado para a área de transferência.');
                        }}
                        className="btn-secondary w-full text-xs justify-center"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar Copy do Modelo
                      </button>
                    </div>

                    {/* Modelo 3: 40% OFF (Escassez Relâmpago) */}
                    <div
                      onClick={() =>
                        setActivePreviewCopy({
                          title: 'Modelo 3: 40% OFF (Última Chamada)',
                          body: 'Sumiu vida? O sistema vai cancelar seu acesso promocional... Liberei 40% OFF só até a meia-noite pra você ver meus vídeos pelada e me mandar direct na hora. ⏳🥵',
                          tag: 'recupera_40off',
                          discount: '40% OFF',
                          mediaType: 'photo',
                          buttons: [
                            { text: 'MENSAL + BÔNUS por R$ 11.90 (40% OFF)', iconType: 'sparkles', primary: true },
                            { text: '1 DIA NO PARAÍSO por R$ 5.90 (40% OFF)', iconType: 'flame', primary: false },
                          ],
                        })
                      }
                      className="space-y-2.5 rounded-xl border border-[#1b2f24] bg-[#07120c] p-3.5 cursor-pointer hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Modelo 3: 40% OFF (Última Chamada)</span>
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                          <Clock className="h-3 w-3 text-amber-400" /> Escassez Relâmpago
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-[#0a1710] p-3 text-xs leading-relaxed text-[#c2dfd1]">
                        Sumiu vida? O sistema vai cancelar seu acesso promocional... Liberei 40% OFF só até a meia-noite pra você ver meus vídeos pelada e me mandar direct na hora. ⏳🥵
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <Sparkles className="h-3.5 w-3.5 text-[#d4f933]" /> MENSAL + BÔNUS por R$ 11.90 (40% OFF)
                        </div>
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <Flame className="h-3.5 w-3.5 text-rose-300" /> 1 DIA NO PARAÍSO por R$ 5.90 (40% OFF)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(
                            'Sumiu vida? O sistema vai cancelar seu acesso promocional... Liberei 40% OFF só até a meia-noite pra você ver meus vídeos pelada e me mandar direct na hora. ⏳🥵'
                          );
                          notify('success', 'Copy Copiado!', 'Texto de recuperação copiado.');
                        }}
                        className="btn-secondary w-full text-xs justify-center"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar Copy do Modelo
                      </button>
                    </div>

                    {/* Modelo 4: PIX Pendente */}
                    <div
                      onClick={() =>
                        setActivePreviewCopy({
                          title: 'Modelo 4: PIX Gerado Pendente',
                          body: 'Vi que você gerou a chave PIX mas ainda não confirmou... Se pagar agora, eu te mando um áudio gemendo seu nome no WhatsApp além do link VIP instantâneo! 💦💋',
                          tag: 'pix_pendente',
                          discount: 'Bônus Áudio',
                          mediaType: 'audio',
                          buttons: [
                            { text: 'COPIAR CÓDIGO PIX AGORA', iconType: 'card', primary: true },
                            { text: 'ENVIAR COMPROVANTE NA DM', iconType: 'send', primary: false },
                          ],
                        })
                      }
                      className="space-y-2.5 rounded-xl border border-[#1b2f24] bg-[#07120c] p-3.5 cursor-pointer hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Modelo 4: PIX Gerado Pendente</span>
                        <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">
                          <Zap className="h-3 w-3 text-purple-400" /> Resgate de Carrinho
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-[#0a1710] p-3 text-xs leading-relaxed text-[#c2dfd1]">
                        Vi que você gerou a chave PIX mas ainda não confirmou... Se pagar agora, eu te mando um áudio gemendo seu nome no WhatsApp além do link VIP instantâneo! 💦💋
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e6d30] py-2 text-xs font-bold text-white shadow">
                          <CreditCard className="h-3.5 w-3.5 text-[#d4f933]" /> COPIAR CÓDIGO PIX AGORA
                        </div>
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1f4a21] py-2 text-xs font-bold text-white shadow">
                          <Send className="h-3.5 w-3.5 text-emerald-300" /> ENVIAR COMPROVANTE NA DM
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(
                            'Vi que você gerou a chave PIX mas ainda não confirmou... Se pagar agora, eu te mando um áudio gemendo seu nome no WhatsApp além do link VIP instantâneo! 💦💋'
                          );
                          notify('success', 'Copy Copiado!', 'Texto de recuperação copiado.');
                        }}
                        className="btn-secondary w-full text-xs justify-center"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar Copy do Modelo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulador Inteligente de Preview (Multi-Modo & Detecção de Conteúdo) */}
                <div className="rounded-2xl border border-[#233328] bg-[#09110d] p-4 shadow-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2b20] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                        <Eye className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                          Visualizador Inteligente de Preview (Simulador em Tempo Real)
                        </h4>
                        <p className="text-[10px] text-[#789484]">
                          Reconhece o formato da mensagem, mídias e botões com precisão milimétrica.
                        </p>
                      </div>
                    </div>

                    {/* Seletor de Modo de Preview Vetorizado */}
                    <div className="flex items-center gap-1 rounded-xl border border-[#1e2f24] bg-[#050c08] p-1">
                      <button
                        type="button"
                        onClick={() => setSmartPreviewMode('telegram')}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          smartPreviewMode === 'telegram'
                            ? 'bg-emerald-500 text-black shadow'
                            : 'text-[#7d998a] hover:text-white'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Telegram DM Real</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSmartPreviewMode('mobile_bio')}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          smartPreviewMode === 'mobile_bio'
                            ? 'bg-emerald-500 text-black shadow'
                            : 'text-[#7d998a] hover:text-white'
                        }`}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>Mobile Bio Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Indicadores de Reconhecimento Inteligente */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="text-[#6d8a7a] font-semibold">Reconhecimento Automático:</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-bold text-sky-300">
                      <Tag className="h-3 w-3" /> Tag: ?start={activePreviewCopy.tag}
                    </span>
                    {activePreviewCopy.discount && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-bold text-emerald-300">
                        <Sparkles className="h-3 w-3" /> Desconto: {activePreviewCopy.discount}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 font-bold text-purple-300">
                      <ShieldCheck className="h-3 w-3" /> Checkout SyncPay Blindado
                    </span>
                  </div>

                  {/* Renderização Realista Conforme Modo Escolhido */}
                  {smartPreviewMode === 'telegram' ? (
                    <div className="rounded-xl border border-[#1b2b20] bg-[#060e0a] p-4">
                      <div className="flex items-start gap-3 max-w-lg mx-auto">
                        <Avatar src={openBot.avatarUrl} name={openBot.firstName} size="sm" />
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1">
                              {openBot.firstName}
                              <CheckCircle2 className="h-3 w-3 fill-sky-400 text-white" />
                            </span>
                            <span className="text-[10px] text-[#557062]">14:38</span>
                          </div>

                          <div className="rounded-2xl rounded-tl-sm border border-[#1f382a] bg-[#0c1f15] p-3 text-xs leading-relaxed text-[#d7ede2] whitespace-pre-line shadow">
                            {activePreviewCopy.body}
                          </div>

                          {/* Botões Inline do Telegram Real */}
                          <div className="space-y-1.5 pt-1">
                            {activePreviewCopy.buttons.map((btn, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold shadow transition cursor-pointer ${
                                  btn.primary
                                    ? 'bg-[#2b6b2e] text-white hover:bg-[#348038]'
                                    : 'bg-[#204a23] text-[#d4f933] hover:bg-[#285c2b]'
                                }`}
                              >
                                {btn.iconType === 'sparkles' && <Sparkles className="h-3.5 w-3.5 text-[#d4f933]" />}
                                {btn.iconType === 'flame' && <Flame className="h-3.5 w-3.5 text-rose-300" />}
                                {btn.iconType === 'card' && <CreditCard className="h-3.5 w-3.5 text-emerald-300" />}
                                {btn.iconType === 'send' && <Send className="h-3.5 w-3.5 text-sky-300" />}
                                <span>{btn.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Preview Mobile Bio Link */
                    <div className="rounded-xl border border-[#1b2b20] bg-[#060e0a] p-4 text-center">
                      <div className="mx-auto max-w-[280px] rounded-2xl border border-white/10 bg-[#0a0d14] p-3 shadow-2xl space-y-2.5">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#10141d]">
                          <img
                            src={openBot.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                          <div className="absolute inset-x-0 bottom-2 text-center">
                            <span className="text-xs font-bold text-white flex items-center justify-center gap-1">
                              {openBot.firstName} <CheckCircle2 className="h-3 w-3 fill-sky-400 text-white" />
                            </span>
                            <span className="text-[10px] text-white/70">@{openBot.username}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {activePreviewCopy.buttons.map((btn, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-white/15 bg-white/5 py-2 px-2 text-[10px] font-bold text-white flex items-center justify-center gap-1.5"
                            >
                              <Link2 className="h-3 w-3 text-[#d4f933]" />
                              <span className="truncate">{btn.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Canal VIP & Comunidades */}
            {botModalCategory === 'vip_channel' && (
              <div className="space-y-4">
                {/* Canal de Enviaveis / VIP & Funil de Liberação Segura 🛡️ */}
                <div className="space-y-3.5 rounded-2xl border border-purple-500/30 bg-[#120f1d] p-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                          Canal de Enviaveis / VIP & Funil de Liberação Segura
                        </h3>
                        <p className="text-[11px] text-[#9a8ca8]">
                          O lead só recebe o botão do canal VIP após passar por 100% das etapas configuradas abaixo.
                        </p>
                      </div>
                    </div>
                    {openBot.vipChannelId && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        Ativo e Protegido
                      </span>
                    )}
                  </div>

                  {/* Input para vincular canal VIP */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#b8a8c8]">
                      ID do Canal VIP no Telegram (-100... ou @canal):
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7f6f8f]" />
                        <input
                          value={vipChannelInput}
                          onChange={(e) => setVipChannelInput(e.target.value)}
                          placeholder="-100192837482 ou @seucanalvip"
                          className="input mono pl-9 text-xs border-purple-500/30 bg-[#0c0914] text-white focus:border-purple-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveVipChannel}
                        disabled={validatingVip}
                        className="btn-primary shrink-0 bg-purple-600 text-white hover:bg-purple-500 border-none text-xs font-bold shadow-md shadow-purple-600/30"
                      >
                        {validatingVip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        Validar & Salvar Canal
                      </button>
                    </div>
                    {vipValidationResult && (
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="font-bold">{vipValidationResult.title}</span>
                            {vipValidationResult.membersCount > 0 && (
                              <span className="ml-2 text-[10px] text-emerald-300/80">
                                {formatNumber(vipValidationResult.membersCount)} membros
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          {vipValidationResult.isAdmin ? 'Admin Confirmado' : 'Membro'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Etapas Obrigatórias para Liberação do Acesso */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#9d8dae]">
                      Etapas Obrigatórias de Validação:
                    </span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div
                        onClick={() => handleToggleVipReq('requireTerms')}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                          vipReqs.requireTerms
                            ? 'border-purple-500/50 bg-purple-500/15 text-white'
                            : 'border-[#272138] bg-[#0c0914] text-[#7d6f8d] hover:border-purple-500/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={vipReqs.requireTerms}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-purple-500 text-purple-600 focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-bold">1. Confirmação +18</div>
                          <p className="text-[10px] text-[#9c8eae]">Exige que o lead aceite termos de maioridade.</p>
                        </div>
                      </div>

                      <div
                        onClick={() => handleToggleVipReq('requirePayment')}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                          vipReqs.requirePayment
                            ? 'border-purple-500/50 bg-purple-500/15 text-white'
                            : 'border-[#272138] bg-[#0c0914] text-[#7d6f8d] hover:border-purple-500/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={vipReqs.requirePayment}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-purple-500 text-purple-600 focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-bold">2. Pagamento Real</div>
                          <p className="text-[10px] text-[#9c8eae]">Libera somente após PIX ou cartão aprovado.</p>
                        </div>
                      </div>

                      <div
                        onClick={() => handleToggleVipReq('singleUseLink')}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                          vipReqs.singleUseLink
                            ? 'border-purple-500/50 bg-purple-500/15 text-white'
                            : 'border-[#272138] bg-[#0c0914] text-[#7d6f8d] hover:border-purple-500/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={vipReqs.singleUseLink}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-purple-500 text-purple-600 focus:ring-0"
                        />
                        <div>
                          <div className="text-xs font-bold">3. Anti-Vazamento</div>
                          <p className="text-[10px] text-[#9c8eae]">Gera link de uso único (1 membro por link).</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Prévia do Botão que o Lead Recebe no Telegram */}
                  <div className="rounded-xl border border-purple-500/20 bg-[#0a0812] p-3">
                    <div className="flex items-center justify-between text-[10px] text-[#8e7e9f] mb-1.5">
                      <span>Prévia do Botão Seguro no Telegram:</span>
                      <span className="text-emerald-400 font-bold">● Apenas após cumprir todas as etapas</span>
                    </div>
                    <div className="flex items-center justify-center rounded-xl bg-[#3b7c3d] px-4 py-2.5 text-xs font-bold text-white shadow">
                      💎 ENTRAR NO CANAL VIP AGORA
                    </div>
                  </div>
                </div>

                {/* Comunidades Vinculadas */}
                <div className="rounded-2xl border border-[#232d3d] bg-[#10141d] p-4">
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
              </div>
            )}

            {/* 6. Bio Link / Perfil */}
            {botModalCategory === 'bio_profile' && (
              <div className="space-y-4">
                {(() => {
                  const linkedProfile =
                    state.profiles?.find(
                      (p) =>
                        p.botId === openBot.id ||
                        p.handle.toLowerCase().replace('@', '') === openBot.username.toLowerCase()
                    ) || state.profiles?.[0];

                  if (!linkedProfile) {
                    return (
                      <div className="rounded-2xl border border-dashed border-[#293246] p-6 text-center space-y-3">
                        <Globe className="h-8 w-8 text-[#d4f933] mx-auto" />
                        <div>
                          <h4 className="text-sm font-bold text-white">Nenhum Bio Link vinculado a esta modelo</h4>
                          <p className="mt-1 text-xs text-[#718096]">
                            Crie uma página de perfil dark moderna no estilo das fotos com fotos de fundo, selo azul verificado e links para redes sociais.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenBotId(null);
                            onNavigate('profiles');
                          }}
                          className="btn-primary text-xs mx-auto"
                        >
                          Ir para Aba Bio Links & Criar Perfil →
                        </button>
                      </div>
                    );
                  }

                  const profileUrl = `${window.location.origin}/p/${linkedProfile.slug}`;
                  const ctrValue =
                    linkedProfile.metrics.views > 0
                      ? ((linkedProfile.metrics.clicks / linkedProfile.metrics.views) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <div className="space-y-4">
                      {/* Cartão de Resumo do Perfil */}
                      <div className="rounded-2xl border border-[#263143] bg-[#0c1017] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={linkedProfile.avatarUrl || openBot.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
                              alt={linkedProfile.name}
                              className="h-12 w-12 rounded-full object-cover border border-[#3b475c]"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-white">{linkedProfile.name}</span>
                                {linkedProfile.verified && (
                                  <span className="text-sky-400">✓</span>
                                )}
                              </div>
                              <span className="mono text-xs text-[#7f90a6]">{linkedProfile.handle}</span>
                            </div>
                          </div>
                          <span className={`badge ${linkedProfile.active ? 'border-[#d4f933]/30 bg-[#d4f933]/10 text-[#d4f933]' : 'border-slate-500/30 bg-slate-500/10 text-slate-400'}`}>
                            {linkedProfile.active ? 'Página Pública Ativa' : 'Pausada'}
                          </span>
                        </div>

                        {/* Métricas Reais do Perfil */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                          <div className="rounded-xl border border-[#202738] bg-[#07090e] p-2.5 text-center">
                            <div className="text-[10px] uppercase tracking-wider text-[#6b7b91]">Visualizações</div>
                            <div className="mono mt-1 text-base font-bold text-white">
                              {formatNumber(linkedProfile.metrics.views)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[#202738] bg-[#07090e] p-2.5 text-center">
                            <div className="text-[10px] uppercase tracking-wider text-[#6b7b91]">Visitantes Únicos</div>
                            <div className="mono mt-1 text-base font-bold text-[#d4f933]">
                              {formatNumber(linkedProfile.metrics.uniqueVisitors)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[#202738] bg-[#07090e] p-2.5 text-center">
                            <div className="text-[10px] uppercase tracking-wider text-[#6b7b91]">Cliques nos Links</div>
                            <div className="mono mt-1 text-base font-bold text-sky-400">
                              {formatNumber(linkedProfile.metrics.clicks)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[#202738] bg-[#07090e] p-2.5 text-center">
                            <div className="text-[10px] uppercase tracking-wider text-[#6b7b91]">CTR %</div>
                            <div className="mono mt-1 text-base font-bold text-emerald-400">
                              {ctrValue}%
                            </div>
                          </div>
                        </div>

                        {/* URL Pública e Ações */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1a2230]">
                          <input
                            readOnly
                            value={profileUrl}
                            className="input mono text-xs flex-1 border-[#293548] bg-[#06080c] text-[#d4f933]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(profileUrl);
                              notify('success', 'Link Copiado!', 'Cole na bio das redes sociais.');
                            }}
                            className="btn-secondary text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar Link
                          </button>
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary text-xs"
                          >
                            Ver Página <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenBotId(null);
                            onNavigate('profiles');
                          }}
                          className="btn-ghost text-xs text-[#d4f933] hover:underline"
                        >
                          Editar Fotos, Degradês e Botões na Aba Bio Links & Perfis →
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

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
