import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Instagram,
  Link2,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Plus,
  QrCode,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Twitter,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AppState, CreateModelProfileInput, ModelProfile, ProfileButton, ProfileGradient } from '@shared/types';
import { api } from '../lib/api';
import { formatNumber, relativeTime } from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface ProfilesViewProps {
  state: AppState;
  selectedBotId: string;
  refresh: () => Promise<void>;
}

export function ProfilesView({ state, selectedBotId, refresh }: ProfilesViewProps) {
  const { notify } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ModelProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [qrModalSlug, setQrModalSlug] = useState<string | null>(null);

  // Form state
  const [botId, setBotId] = useState('');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [verified, setVerified] = useState(true);
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [followersCount, setFollowersCount] = useState('2.9M');
  const [bannerUrl, setBannerUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [overlayGradient, setOverlayGradient] = useState<ProfileGradient>('dark-fade');
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    tiktok: '',
    telegram: '',
    twitter: '',
    whatsapp: '',
  });
  const [buttons, setButtons] = useState<Array<Omit<ProfileButton, 'clicks'> & { clicks?: number }>>([
    {
      id: 'btn-1',
      title: 'Contenido exclusivo 🙈',
      subtitle: 'Acesse minhas fotos e vídeos secretos sem censura',
      url: '',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      badge: '🔥 EXCLUSIVO',
      order: 0,
      active: true,
      clicks: 0,
    },
  ]);

  const profiles = state.profiles || [];
  const filteredProfiles =
    selectedBotId === 'all' ? profiles : profiles.filter((p) => p.botId === selectedBotId);

  const baseUrl = (state.server.publicBaseUrl || window.location.origin).replace(/\/$/, '');

  const openCreateModal = () => {
    setEditingProfile(null);
    const defaultBot = state.bots[0]?.id || '';
    setBotId(selectedBotId !== 'all' ? selectedBotId : defaultBot);
    setSlug('');
    setName('Valentina Rodríguez');
    setVerified(true);
    setHandle('@valeng');
    setBio('Bem-vindo ao meu paraíso privado. Escolha uma opção abaixo.');
    setFollowersCount('2.9M');
    setBannerUrl(
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=85'
    );
    setAvatarUrl('');
    setOverlayGradient('dark-fade');
    setSocialLinks({
      instagram: 'https://instagram.com',
      tiktok: 'https://tiktok.com',
      telegram: state.bots[0] ? `https://t.me/${state.bots[0].username}` : '',
      twitter: '',
      whatsapp: '',
    });
    setButtons([
      {
        id: 'btn-1',
        title: 'Contenido exclusivo 🙈',
        subtitle: 'Acesso VIP aos meus conteúdos proibidos',
        url: state.bots[0] ? `https://t.me/${state.bots[0].username}?start=bio_exclusivo` : '',
        imageUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        badge: '🔥 HOT',
        order: 0,
        active: true,
        clicks: 0,
      },
      {
        id: 'btn-2',
        title: 'Chamada de Vídeo Privada 📹',
        subtitle: 'Conversa particular direto no meu Telegram',
        url: state.bots[0] ? `https://t.me/${state.bots[0].username}?start=bio_call` : '',
        imageUrl:
          'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
        badge: '30% OFF',
        order: 1,
        active: true,
        clicks: 0,
      },
    ]);
    setModalOpen(true);
  };

  const openEditModal = (profile: ModelProfile) => {
    setEditingProfile(profile);
    setBotId(profile.botId);
    setSlug(profile.slug);
    setName(profile.name);
    setVerified(profile.verified);
    setHandle(profile.handle);
    setBio(profile.bio || '');
    setFollowersCount(profile.followersCount || '2.9M');
    setBannerUrl(profile.bannerUrl);
    setAvatarUrl(profile.avatarUrl || '');
    setOverlayGradient(profile.overlayGradient || 'dark-fade');
    setSocialLinks({
      instagram: profile.socialLinks?.instagram || '',
      tiktok: profile.socialLinks?.tiktok || '',
      telegram: profile.socialLinks?.telegram || '',
      twitter: profile.socialLinks?.twitter || '',
      whatsapp: profile.socialLinks?.whatsapp || '',
    });
    setButtons(
      (profile.buttons || []).map((btn) => ({
        ...btn,
      }))
    );
    setModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botId) {
      notify('error', 'Selecione um Bot', 'É necessário vincular um bot Telegram ao perfil.');
      return;
    }
    if (!slug.trim()) {
      notify('error', 'Slug Obrigatório', 'Informe o slug da URL (ex: valentina).');
      return;
    }
    if (!bannerUrl.trim()) {
      notify('error', 'Foto de Capa Obrigatória', 'Informe a URL da foto de capa da modelo.');
      return;
    }

    setBusy(true);
    try {
      const payload: CreateModelProfileInput = {
        botId,
        slug: slug.trim(),
        name: name.trim(),
        verified,
        handle: handle.trim(),
        bio: bio.trim(),
        followersCount: followersCount.trim() || '2.9M',
        bannerUrl: bannerUrl.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        overlayGradient,
        socialLinks: {
          instagram: socialLinks.instagram.trim() || undefined,
          tiktok: socialLinks.tiktok.trim() || undefined,
          telegram: socialLinks.telegram.trim() || undefined,
          twitter: socialLinks.twitter.trim() || undefined,
          whatsapp: socialLinks.whatsapp.trim() || undefined,
        },
        buttons: buttons.map((b, idx) => ({
          id: b.id,
          title: b.title.trim(),
          subtitle: b.subtitle?.trim() || undefined,
          url: b.url.trim() || `${baseUrl}/p/${slug.trim()}`,
          imageUrl: b.imageUrl?.trim() || undefined,
          badge: b.badge?.trim() || undefined,
          order: idx,
          active: b.active ?? true,
          clicks: b.clicks ?? 0,
        })),
        active: true,
      };

      if (editingProfile) {
        await api.updateProfile(editingProfile.id, payload);
        notify('success', 'Perfil Atualizado!', 'As alterações já estão ativas na página pública.');
      } else {
        await api.createProfile(payload);
        notify('success', 'Perfil Criado!', 'O link da modelo já está pronto para divulgação.');
      }

      setModalOpen(false);
      await refresh();
    } catch (err) {
      notify('error', 'Falha ao Salvar', err instanceof Error ? err.message : 'Verifique os campos.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProfile = async (profile: ModelProfile) => {
    if (!window.confirm(`Deseja realmente excluir o perfil de ${profile.name} (/p/${profile.slug})?`)) {
      return;
    }
    try {
      await api.deleteProfile(profile.id);
      notify('success', 'Perfil Removido', 'O link foi desativado com sucesso.');
      await refresh();
    } catch (err) {
      notify('error', 'Erro ao excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  };

  const handleCopyLink = (targetSlug: string) => {
    const full = `${baseUrl}/p/${targetSlug}`;
    void navigator.clipboard.writeText(full);
    setCopiedSlug(targetSlug);
    notify('success', 'Link Copiado!', full);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const addButton = () => {
    const linkedBot = state.bots.find((b) => b.id === botId);
    setButtons((prev) => [
      ...prev,
      {
        id: `btn-${Date.now()}`,
        title: 'Novo Conteúdo VIP 🔞',
        subtitle: 'Clique para desbloquear na DM da modelo',
        url: linkedBot ? `https://t.me/${linkedBot.username}?start=bio_novo` : '',
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        badge: 'NOVO',
        order: prev.length,
        active: true,
        clicks: 0,
      },
    ]);
  };

  const removeButton = (index: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, patch: Partial<ProfileButton>) => {
    setButtons((prev) =>
      prev.map((btn, i) => (i === index ? { ...btn, ...patch } : btn))
    );
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Banner de Apresentação */}
      <section className="card p-6 border-l-4 border-l-[#d4f933] shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#d4f933]/15 text-[#d4f933]">
                <Globe className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-white sm:text-lg">
                Bio Links & Páginas de Perfil das Modelos
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#8c9bb0] max-w-2xl leading-relaxed">
              Crie páginas de bio estilo Link-in-Bio dark com fotos provocantes, efeitos de degradê, links
              rastreados para o Telegram e <strong>métricas 100% reais</strong> de entradas, saídas e cliques por botão.
              (Campo de e-mail removido conforme suas regras!).
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary flex shrink-0 items-center gap-2 shadow-lg shadow-[#d4f933]/10"
          >
            <Plus className="h-4 w-4" />
            Nova Página de Modelo
          </button>
        </div>
      </section>

      {/* Grid de Perfis Cadastrados */}
      {filteredProfiles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#263042] bg-[#0c1017] p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141a24] text-[#8e9cae]">
            <Globe className="h-7 w-7 text-[#d4f933]" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-white">Nenhum perfil de modelo criado ainda</h3>
          <p className="mt-1 text-xs text-[#6e7d90] max-w-md mx-auto">
            Crie sua primeira página de bio exclusiva para divulgar nas redes sociais (Instagram, TikTok) e atrair
            leads direto para os bots.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary mt-5 inline-flex items-center gap-2 text-xs"
          >
            <Plus className="h-4 w-4" />
            Criar Primeiro Perfil Agora
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.map((p) => {
            const linkedBot = state.bots.find((b) => b.id === p.botId);
            const publicUrl = `${baseUrl}/p/${p.slug}`;
            const ctr =
              p.metrics.views > 0
                ? ((p.metrics.clicks / p.metrics.views) * 100).toFixed(1)
                : '0.0';

            return (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[#232b3b] bg-[#0d1017] shadow-xl transition-all hover:border-[#384660]"
              >
                {/* Header com Banner Preview e Degradê */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/50">
                  <img
                    src={p.bannerUrl}
                    alt={p.name}
                    className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1017] via-[#0d1017]/40 to-transparent" />

                  {/* Badges superiores */}
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className="rounded-full border border-black/40 bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-[#d4f933] backdrop-blur">
                      /p/{p.slug}
                    </span>
                    {linkedBot && (
                      <span className="rounded-full border border-sky-400/30 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300 backdrop-blur">
                        @{linkedBot.username}
                      </span>
                    )}
                  </div>

                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQrModalSlug(p.slug)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black"
                      title="Ver QR Code do Perfil"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black"
                      title="Abrir Página Pública"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Nome e Handle na base da foto */}
                  <div className="absolute inset-x-0 bottom-2 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-white drop-shadow">{p.name}</span>
                      {p.verified && (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3b82f6] text-white">
                          <CheckCircle2 className="h-3 w-3 fill-current" />
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-white/70">{p.handle}</div>
                  </div>
                </div>

                {/* Métricas 100% REAIS da Página */}
                <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-4 gap-2 rounded-2xl border border-[#202736] bg-[#090c12] p-2.5 text-center">
                    <div>
                      <div className="flex items-center justify-center text-[10px] text-[#6d7b8f]">
                        <Eye className="mr-0.5 h-3 w-3" /> Views
                      </div>
                      <div className="text-sm font-bold text-white">{formatNumber(p.metrics.views)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center text-[10px] text-[#6d7b8f]">
                        <Users className="mr-0.5 h-3 w-3" /> Únicos
                      </div>
                      <div className="text-sm font-bold text-white">
                        {formatNumber(p.metrics.uniqueVisitors)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center text-[10px] text-[#6d7b8f]">
                        <MousePointerClick className="mr-0.5 h-3 w-3" /> Cliques
                      </div>
                      <div className="text-sm font-bold text-[#d4f933]">
                        {formatNumber(p.metrics.clicks)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center text-[10px] text-[#6d7b8f]">
                        CTR
                      </div>
                      <div className="text-sm font-bold text-emerald-400">{ctr}%</div>
                    </div>
                  </div>

                  {/* Prévia dos Botões Cadastrados com Cliques Reais */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#758498]">
                      <span>Botões / Cards ({p.buttons.length})</span>
                      <span>Cliques</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {p.buttons.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-xl border border-[#1b2230] bg-[#121620] px-3 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {b.imageUrl ? (
                              <img
                                src={b.imageUrl}
                                alt=""
                                className="h-5 w-5 rounded object-cover shrink-0"
                              />
                            ) : (
                              <Link2 className="h-3.5 w-3.5 text-[#d4f933] shrink-0" />
                            )}
                            <span className="truncate text-white font-medium">{b.title}</span>
                          </div>
                          <span className="mono rounded bg-[#d4f933]/15 px-1.5 py-0.2 text-[10px] font-bold text-[#d4f933]">
                            {b.clicks} cliques
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Barra de Ações do Card */}
                  <div className="pt-2 border-t border-[#1d2432] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(p.slug)}
                      className="btn-ghost flex-1 text-xs text-[#d4f933] hover:bg-[#d4f933]/10"
                    >
                      {copiedSlug === p.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedSlug === p.slug ? 'Copiado!' : 'Copiar Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="btn-secondary text-xs"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProfile(p)}
                      className="rounded-xl p-2 text-[#68768a] hover:bg-rose-500/10 hover:text-rose-400 transition"
                      title="Excluir Perfil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Perfil com PREVIEW AO VIVO */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProfile ? `Editar Perfil · /p/${slug}` : 'Criar Novo Perfil de Modelo'}
        description="Configure as fotos, redes sociais, degradê e os cards de botões com preview instantâneo ao vivo."
        size="xl"
      >
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
            {/* Lado Esquerdo: Campos de Edição */}
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
              {/* Bot Telegram Vinculado */}
              <div className="rounded-2xl border border-[#232b3b] bg-[#0c1017] p-4 space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8fa0b6]">
                  1. Bot Telegram Vinculado & URL Slug
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[10px] text-[#718096]">Bot Telegram:</span>
                    <select
                      value={botId}
                      onChange={(e) => setBotId(e.target.value)}
                      className="input mt-1 text-xs"
                    >
                      {state.bots.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.firstName} (@{b.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#718096]">Link Único (/p/...):</span>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 mono text-[11px] text-[#5e6b7f]">
                        /p/
                      </span>
                      <input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="valentina"
                        className="input mono pl-9 text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações da Modelo */}
              <div className="rounded-2xl border border-[#232b3b] bg-[#0c1017] p-4 space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8fa0b6]">
                  2. Dados da Modelo & Prova Social
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="text-[10px] text-[#718096]">Nome de Exibição:</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Valentina Rodríguez"
                      className="input mt-1 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#718096]">@Handle:</span>
                    <input
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@valeng"
                      className="input mt-1 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#718096]">Contador de Seguidores:</span>
                    <input
                      value={followersCount}
                      onChange={(e) => setFollowersCount(e.target.value)}
                      placeholder="2.9M"
                      className="input mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="verifiedCheck"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="rounded border-[#293345] bg-[#121620] text-[#3b82f6] focus:ring-0"
                  />
                  <label htmlFor="verifiedCheck" className="text-xs text-white cursor-pointer font-medium">
                    Exibir Selo Verificado Oficial Azul (✔️)
                  </label>
                </div>

                <div>
                  <span className="text-[10px] text-[#718096]">Biografia curta (opcional):</span>
                  <input
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Bem-vindo ao meu paraíso secreto."
                    className="input mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Fotos e Efeito Degradê */}
              <div className="rounded-2xl border border-[#232b3b] bg-[#0c1017] p-4 space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8fa0b6]">
                  3. Fotos & Efeito de Degradê Dark
                </label>
                <div>
                  <span className="text-[10px] text-[#718096]">URL da Foto de Capa / Banner (alta resolução):</span>
                  <input
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://.../foto-modelo.jpg"
                    className="input mt-1 text-xs"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[#718096]">Efeito de Degradê de Fundo:</span>
                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { id: 'dark-fade', label: 'Dark Fade' },
                        { id: 'smooth-black', label: 'Pure Black' },
                        { id: 'violet-glow', label: 'Violet Glow' },
                        { id: 'rose-glow', label: 'Rose Glow' },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setOverlayGradient(g.id)}
                        className={`rounded-xl border p-2 text-center text-xs font-semibold transition ${
                          overlayGradient === g.id
                            ? 'border-[#d4f933] bg-[#d4f933]/15 text-white'
                            : 'border-[#202736] bg-[#090c12] text-[#808fa5] hover:border-[#313c50]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Redes Sociais */}
              <div className="rounded-2xl border border-[#232b3b] bg-[#0c1017] p-4 space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8fa0b6]">
                  4. Redes Sociais da Modelo
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-pink-400" />
                    <input
                      value={socialLinks.instagram}
                      onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                      placeholder="https://instagram.com/..."
                      className="input pl-9 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-300">
                      Tk
                    </span>
                    <input
                      value={socialLinks.tiktok}
                      onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
                      placeholder="https://tiktok.com/@..."
                      className="input pl-9 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Send className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-400" />
                    <input
                      value={socialLinks.telegram}
                      onChange={(e) => setSocialLinks({ ...socialLinks, telegram: e.target.value })}
                      placeholder="https://t.me/..."
                      className="input pl-9 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                    <input
                      value={socialLinks.whatsapp}
                      onChange={(e) => setSocialLinks({ ...socialLinks, whatsapp: e.target.value })}
                      placeholder="https://wa.me/..."
                      className="input pl-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Construtor de Cards e Botões com Fotos Provocantes */}
              <div className="rounded-2xl border border-[#232b3b] bg-[#0c1017] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#8fa0b6]">
                    5. Cards de Botões & Destinos
                  </label>
                  <button
                    type="button"
                    onClick={addButton}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-[#d4f933]"
                  >
                    <Plus className="h-3 w-3" /> Adicionar Card
                  </button>
                </div>

                <div className="space-y-3">
                  {buttons.map((btn, index) => (
                    <div
                      key={btn.id || index}
                      className="rounded-2xl border border-[#1f2635] bg-[#121620] p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Card #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeButton(index)}
                          className="text-[#6d7b8f] hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-[10px] text-[#718096]">Título do Card:</span>
                          <input
                            value={btn.title}
                            onChange={(e) => updateButton(index, { title: e.target.value })}
                            placeholder="Contenido exclusivo 🙈"
                            className="input mt-1 text-xs"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#718096]">Badge (opcional):</span>
                          <input
                            value={btn.badge || ''}
                            onChange={(e) => updateButton(index, { badge: e.target.value })}
                            placeholder="🔥 HOT ou 30% OFF"
                            className="input mt-1 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-[#718096]">URL de Destino (Telegram ou Checkout):</span>
                        <input
                          value={btn.url}
                          onChange={(e) => updateButton(index, { url: e.target.value })}
                          placeholder="https://t.me/seubot?start=bio_exclusivo"
                          className="input mt-1 text-xs mono"
                          required
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-[#718096]">Foto de Fundo Provocante do Card:</span>
                        <input
                          value={btn.imageUrl || ''}
                          onChange={(e) => updateButton(index, { imageUrl: e.target.value })}
                          placeholder="https://.../foto-sensual.jpg"
                          className="input mt-1 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lado Direito: PREVIEW AO VIVO DA TELA DO CLIENTE (MÓVEL) */}
            <div className="flex flex-col items-center">
              <span className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8da0b6] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#d4f933]" /> Preview em Tempo Real (Mobile)
              </span>

              {/* Moldura de Smartphone Dark */}
              <div className="w-[320px] rounded-[36px] border-4 border-[#2b3547] bg-[#07090e] shadow-2xl overflow-hidden flex flex-col aspect-[9/18]">
                {/* Top Notch */}
                <div className="h-5 bg-black flex items-center justify-center">
                  <div className="h-3 w-20 rounded-full bg-[#1b2230]" />
                </div>

                {/* Conteúdo Renderizado da Bio */}
                <div className="flex-1 overflow-y-auto no-scrollbar relative">
                  {/* Banner */}
                  <div className="relative aspect-[4/5] w-full bg-[#10141d]">
                    {bannerUrl ? (
                      <img
                        src={bannerUrl}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-[#556377]">
                        Sem Foto
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07090e]/85 to-[#07090e]" />

                    <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-sm font-bold text-white drop-shadow">
                          {name || 'Nome da Modelo'}
                        </span>
                        {verified && (
                          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#3b82f6] text-white">
                            <CheckCircle2 className="h-2.5 w-2.5 fill-current" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-white/70">{handle || '@handle'}</span>

                      {/* Redes Sociais Preview */}
                      <div className="mt-2 flex items-center justify-center gap-2">
                        {socialLinks.instagram && (
                          <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white">
                            <Instagram className="h-3 w-3" />
                          </div>
                        )}
                        {socialLinks.tiktok && (
                          <div className="h-6 w-6 rounded-full bg-black border border-white/20 flex items-center justify-center text-white text-[9px] font-bold">
                            Tk
                          </div>
                        )}
                        {socialLinks.telegram && (
                          <div className="h-6 w-6 rounded-full bg-[#24A1DE] flex items-center justify-center text-white">
                            <Send className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Seguidores Pill */}
                      <div className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-medium text-white">
                        {followersCount || '2.9M'} Total Followers ⌄
                      </div>
                    </div>
                  </div>

                  {/* Cards de Botões Preview */}
                  <div className="p-3 space-y-2.5">
                    {buttons.map((btn, idx) => (
                      <div
                        key={idx}
                        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121620] aspect-[16/10]"
                      >
                        {btn.imageUrl && (
                          <img
                            src={btn.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
                        <div className="absolute left-2.5 top-2.5 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center border border-white/20">
                          <Link2 className="h-3 w-3" />
                        </div>
                        {btn.badge && (
                          <span className="absolute right-2 top-2 rounded-full bg-[#d4f933] px-1.5 py-0.2 text-[8px] font-extrabold text-black">
                            {btn.badge}
                          </span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                          <span className="text-[11px] font-bold text-white drop-shadow">
                            {btn.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé Preview */}
                  <div className="p-3 text-center text-[8px] text-[#556377]">
                    Privacy Policy | Terms | Report
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#1e2533] pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary text-xs flex items-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {editingProfile ? 'Salvar Alterações' : 'Publicar Perfil da Modelo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de QR Code para Compartilhar */}
      <Modal
        open={Boolean(qrModalSlug)}
        onClose={() => setQrModalSlug(null)}
        title="QR Code Oficial da Modelo"
        description="Aponte a câmera do celular para abrir o link instantaneamente."
        size="sm"
      >
        {qrModalSlug && (
          <div className="flex flex-col items-center p-4 text-center">
            <div className="rounded-2xl border-4 border-[#2b3547] bg-white p-4 shadow-2xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${baseUrl}/p/${qrModalSlug}`
                )}`}
                alt="QR Code"
                className="h-48 w-48"
              />
            </div>
            <span className="mono mt-4 text-xs font-bold text-[#d4f933]">
              {baseUrl}/p/{qrModalSlug}
            </span>
            <button
              type="button"
              onClick={() => handleCopyLink(qrModalSlug)}
              className="btn-primary mt-4 w-full text-xs"
            >
              Copiar Link Oficial
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
