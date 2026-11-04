import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Instagram,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Twitter,
} from 'lucide-react';
import type { ModelProfile, ProfileButton } from '@shared/types';
import { api } from '../lib/api';

interface PublicProfileViewProps {
  slug: string;
}

export function PublicProfileView({ slug }: PublicProfileViewProps) {
  const [profile, setProfile] = useState<ModelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `visited_profile_${slug.toLowerCase()}`;
    const hasVisited = Boolean(localStorage.getItem(storageKey));
    const isUnique = !hasVisited;

    if (isUnique) {
      try {
        localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        // storage disabled
      }
    }

    async function load() {
      try {
        setLoading(true);
        const res = await api.getPublicProfile(slug, isUnique);
        if (cancelled) return;
        setProfile(res.profile);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Perfil não encontrado.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    // Registro de saída real (bounce/exit)
    const handleExit = () => {
      try {
        const exitUrl = `/api/public/profiles/${encodeURIComponent(slug)}/exit`;
        if (navigator.sendBeacon) {
          navigator.sendBeacon(exitUrl);
        } else {
          void fetch(exitUrl, { method: 'POST', keepalive: true });
        }
      } catch {
        // best effort
      }
    };

    window.addEventListener('beforeunload', handleExit);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleExit);
    };
  }, [slug]);

  const handleButtonClick = (button: ProfileButton) => {
    try {
      const clickUrl = `/api/public/profiles/${encodeURIComponent(slug)}/click`;
      const payload = JSON.stringify({ buttonId: button.id });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(clickUrl, new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch(clickUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      // best effort
    }

    // Abre o link do Telegram ou checkout
    window.open(button.url, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.name || 'Perfil Oficial',
          text: `Confira o conteúdo exclusivo de ${profile?.name || 'nossa modelo'}`,
          url: window.location.href,
        });
      } catch {
        // dismissed
      }
    } else {
      void navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090e] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#d4f933]" />
          <span className="text-xs uppercase tracking-widest text-[#7b899e]">Carregando perfil...</span>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07090e] p-6 text-center text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Perfil Não Encontrado</h1>
        <p className="mt-2 max-w-sm text-sm text-[#7e8d9f]">
          O link que você tentou acessar não existe ou foi temporariamente desativado.
        </p>
        <a
          href="/"
          className="mt-6 rounded-xl border border-[#2b3342] bg-[#121620] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#1b2230]"
        >
          Voltar ao Início
        </a>
      </div>
    );
  }

  const gradientClass =
    profile.overlayGradient === 'violet-glow'
      ? 'from-transparent via-[#090614]/85 to-[#070510]'
      : profile.overlayGradient === 'rose-glow'
      ? 'from-transparent via-[#13070f]/85 to-[#0e050c]'
      : profile.overlayGradient === 'smooth-black'
      ? 'from-transparent via-black/80 to-black'
      : 'from-transparent via-[#0a0c12]/90 to-[#07090e]';

  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-[#d4f933] selection:text-black">
      {/* Botão Flutuante de Compartilhar */}
      <button
        type="button"
        onClick={handleShare}
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-95"
        title="Compartilhar link"
      >
        <Share2 className="h-4 w-4" />
        {copiedLink && (
          <span className="absolute -bottom-8 right-0 rounded bg-white px-2 py-0.5 text-[10px] font-bold text-black shadow-lg">
            Copiado!
          </span>
        )}
      </button>

      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        {/* Banner de Topo com Foto da Modelo e Fade Degradê Escuro */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0d1017]">
          <img
            src={profile.bannerUrl}
            alt={profile.name}
            className="h-full w-full object-cover object-center"
            onError={(e) => {
              // fallback suave caso a imagem falhe
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {/* Overlay Degradê idêntico ao modelo das fotos */}
          <div className={`absolute inset-0 bg-gradient-to-b ${gradientClass}`} />

          {/* Nome, Handle e Redes Sociais no rodapé do banner */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-4 text-center">
            {profile.avatarUrl && (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="mb-2 h-14 w-14 rounded-full border-2 border-white/20 object-cover shadow-2xl"
              />
            )}

            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl drop-shadow-md">
                {profile.name}
              </h1>
              {profile.verified && (
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow"
                  title="Verificada Oficialmente"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 fill-current" />
                </div>
              )}
            </div>

            <p className="mt-0.5 text-xs font-medium text-white/70 drop-shadow">
              {profile.handle}
            </p>

            {profile.bio && (
              <p className="mt-2 text-xs leading-relaxed text-white/80 drop-shadow max-w-[340px]">
                {profile.bio}
              </p>
            )}

            {/* Ícones Sociais (Instagram, TikTok, Telegram, Twitter, WhatsApp) */}
            <div className="mt-3.5 flex items-center justify-center gap-3">
              {profile.socialLinks?.instagram && (
                <a
                  href={profile.socialLinks.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-md transition hover:scale-110 active:scale-95"
                  title="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}

              {profile.socialLinks?.tiktok && (
                <a
                  href={profile.socialLinks.tiktok}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white border border-white/20 shadow-md transition hover:scale-110 active:scale-95"
                  title="TikTok"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.86-4.49V8.65a8.21 8.21 0 0 0 4.91 1.62v-3.58h-1z" />
                  </svg>
                </a>
              )}

              {profile.socialLinks?.telegram && (
                <a
                  href={profile.socialLinks.telegram}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#24A1DE] text-white shadow-md transition hover:scale-110 active:scale-95"
                  title="Telegram Oficial"
                >
                  <Send className="h-4 w-4" />
                </a>
              )}

              {profile.socialLinks?.twitter && (
                <a
                  href={profile.socialLinks.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white border border-white/20 shadow-md transition hover:scale-110 active:scale-95"
                  title="Twitter / X"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}

              {profile.socialLinks?.whatsapp && (
                <a
                  href={profile.socialLinks.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md transition hover:scale-110 active:scale-95"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Contador de Prova Social / Seguidores */}
            <div className="mt-3 flex items-center justify-center">
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md shadow-sm">
                <span>{profile.followersCount} Total Followers</span>
                <span className="text-white/60">⌄</span>
              </span>
            </div>
          </div>
        </div>

        {/* NOTA IMPORTANTE: Conforme pedido do usuário, a caixa de input de e-mail / Subscribe foi 100% REMOVIDA */}

        {/* Lista de Cards de Botões com Foto de Fundo Provocante e Efeitos */}
        <div className="flex-1 space-y-4 px-4 py-4">
          {profile.buttons
            .filter((btn) => btn.active)
            .sort((a, b) => a.order - b.order)
            .map((button) => (
              <div
                key={button.id}
                onClick={() => handleButtonClick(button)}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-[#121620] shadow-xl transition-all duration-300 hover:scale-[1.015] hover:border-white/30 active:scale-[0.99]"
              >
                {/* Foto Provocante de Fundo do Botão se existir */}
                {button.imageUrl ? (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40 sm:aspect-[16/9]">
                    <img
                      src={button.imageUrl}
                      alt={button.title}
                      className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                    />
                    {/* Degradê escuro sobre a foto para destacar o texto */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />

                    {/* Ícone de Link no Topo Esquerdo */}
                    <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md shadow-md">
                      <LinkIcon className="h-4 w-4" />
                    </div>

                    {/* Badge Opcional no Topo Direito (ex: HOT, 30% OFF) */}
                    {button.badge && (
                      <span className="absolute right-4 top-4 rounded-full border border-[#d4f933]/40 bg-[#d4f933] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black shadow-lg">
                        {button.badge}
                      </span>
                    )}

                    {/* Título e Subtítulo Sobrepostos na Base do Card */}
                    <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                      <h2 className="text-base font-bold text-white drop-shadow-md sm:text-lg">
                        {button.title}
                      </h2>
                      {button.subtitle && (
                        <p className="mt-0.5 text-xs text-white/80 drop-shadow">
                          {button.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  // Card sem foto (botão estilo pill refinado)
                  <div className="flex items-center justify-between p-4.5 bg-gradient-to-r from-[#151a24] to-[#121620] border border-white/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[#d4f933]">
                        <LinkIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white group-hover:text-[#d4f933] transition">
                          {button.title}
                        </h2>
                        {button.subtitle && (
                          <p className="text-[11px] text-[#7d8b9e]">{button.subtitle}</p>
                        )}
                      </div>
                    </div>
                    {button.badge ? (
                      <span className="rounded-full bg-[#d4f933] px-2 py-0.5 text-[10px] font-bold text-black">
                        {button.badge}
                      </span>
                    ) : (
                      <ExternalLink className="h-4 w-4 text-[#5e6c80] group-hover:text-white transition" />
                    )}
                  </div>
                )}
              </div>
            ))}

          {profile.buttons.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#232a39] p-8 text-center text-xs text-[#6e7b8e]">
              Nenhum link configurado para este perfil ainda.
            </div>
          )}
        </div>

        {/* Rodapé Elegante idêntico ao modelo */}
        <footer className="mt-auto px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-3 text-xs text-[#6e7c90]">
            <a href="#privacy" className="hover:text-white transition hover:underline">
              Privacy Policy
            </a>
            <span>|</span>
            <a href="#terms" className="hover:text-white transition hover:underline">
              Terms
            </a>
            <span>|</span>
            <a href="#report" className="hover:text-white transition hover:underline">
              Report
            </a>
          </div>
          <p className="mt-2 text-[10px] text-[#455060]">
            © {new Date().getFullYear()} {profile.name} · All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
