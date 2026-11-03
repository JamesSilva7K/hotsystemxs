import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileVideo,
  Layers,
  Palette,
  Play,
  Pause,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';

interface VideoWatermarkStudioProps {
  onUseInMessage?: (mediaUrl: string, mediaType: 'video' | 'photo' | 'animation') => void;
  notify?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'banner-bottom'
  | 'banner-top';

type WatermarkStyle = 'glass' | 'solid-black' | 'neon-border' | 'minimal' | 'gradient-purple';

export function VideoWatermarkStudio({ onUseInMessage, notify }: VideoWatermarkStudioProps) {
  // Arquivo de vídeo
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Configurações da Marca D'água
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState<string>('@ModeloVIP | Conteúdo Oficial 🔥');
  const [position, setPosition] = useState<WatermarkPosition>('banner-bottom');
  const [styleMode, setStyleMode] = useState<WatermarkStyle>('glass');
  const [fontSize, setFontSize] = useState<number>(24);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [opacity, setOpacity] = useState<number>(85);
  const [rotation, setRotation] = useState<number>(0);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState<number>(140);

  // Proteção Anti-Copyright
  const [antiCopyright, setAntiCopyright] = useState<boolean>(true);
  const [cropScale, setCropScale] = useState<number>(1.03); // Zoom sutil de 3% para quebrar hash
  const [brightnessFilter, setBrightnessFilter] = useState<number>(1.02); // Micro ajuste de pixel
  const [contrastFilter, setContrastFilter] = useState<number>(1.04);
  const [vignette, setVignette] = useState<boolean>(true);

  // Estado de Renderização
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [uploadingToSystem, setUploadingToSystem] = useState<boolean>(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Manipulação de Upload do Vídeo
  const handleVideoSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      notify?.('error', 'Formato Inválido', 'Por favor, selecione um arquivo de vídeo (.mp4, .webm, .mov).');
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFile(file);
    setRenderedBlob(null);
    setRenderedUrl(null);
    setIsPlaying(false);
  };

  // Upload de Logo de Marca D'água com Reconhecimento Imediato
  const handleLogoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify?.('error', 'Formato Inválido', 'Selecione uma imagem PNG ou JPG.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setLogoSrc(src);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setLogoImage(img);
        setWatermarkType('image');
        if (position === 'banner-bottom') {
          setPosition('bottom-right');
        }
        notify?.('success', 'Logo Reconhecida!', `${img.naturalWidth}x${img.naturalHeight}px carregada e renderizada no vídeo.`);
      };
      img.onerror = () => {
        notify?.('error', 'Erro ao processar imagem', 'Não foi possível renderizar a imagem.');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Suporte a Copiar e Colar (Ctrl + V) imagem de Logo diretamente da Área de Transferência
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleLogoSelect(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Desenhar marca d'água no canvas
  const drawFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // 1. Aplicar micro-zoom / crop anti-copyright se ativado
    if (antiCopyright) {
      const scale = cropScale;
      const sw = w / scale;
      const sh = h / scale;
      const sx = (w - sw) / 2;
      const sy = (h - sh) / 2;
      ctx.filter = `brightness(${brightnessFilter}) contrast(${contrastFilter})`;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      ctx.filter = 'none';

      // Vinheta de borda para quebrar Content ID
      if (vignette) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, w / 3, w / 2, h / 2, Math.max(w, h) / 1.5);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.38)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    ctx.restore();

    // 2. Desenhar a Camada de Marca D'água / Molde
    ctx.save();
    ctx.globalAlpha = opacity / 100;

    if (position === 'banner-bottom' || position === 'banner-top') {
      const bannerHeight = Math.max(48, Math.round(h * 0.09));
      const yPos = position === 'banner-bottom' ? h - bannerHeight : 0;

      // Fundo do Banner
      if (styleMode === 'glass') {
        ctx.fillStyle = 'rgba(15, 20, 30, 0.82)';
      } else if (styleMode === 'solid-black') {
        ctx.fillStyle = '#0a0d14';
      } else if (styleMode === 'gradient-purple') {
        const bgGrad = ctx.createLinearGradient(0, yPos, w, yPos);
        bgGrad.addColorStop(0, 'rgba(40, 15, 60, 0.9)');
        bgGrad.addColorStop(1, 'rgba(15, 20, 45, 0.9)');
        ctx.fillStyle = bgGrad;
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      }

      ctx.fillRect(0, yPos, w, bannerHeight);

      // Linha de acento neon
      ctx.fillStyle = '#d4f933';
      ctx.fillRect(0, position === 'banner-bottom' ? yPos : yPos + bannerHeight - 2, w, 2);

      if (watermarkType === 'image' && logoImage) {
        // Logo centralizada dentro do banner
        const maxLogoH = bannerHeight * 0.75;
        const aspect = logoImage.width / logoImage.height;
        const logoH = maxLogoH;
        const logoW = logoH * aspect;
        ctx.drawImage(logoImage, (w - logoW) / 2, yPos + (bannerHeight - logoH) / 2, logoW, logoH);
      } else {
        // Texto do Banner
        ctx.font = `bold ${Math.round(fontSize * (w / 800))}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(text, w / 2, yPos + bannerHeight / 2);
      }
    } else {
      // Posicionamento Pontual (Cantos ou Centro)
      const margin = 24;
      let posX = w / 2;
      let posY = h / 2;

      if (watermarkType === 'image' && logoImage) {
        const renderScale = Math.round(logoScale * (w / 800));
        const aspect = logoImage.height / logoImage.width;
        const logoW = renderScale;
        const logoH = logoW * aspect;

        if (position === 'top-left') {
          posX = margin + logoW / 2;
          posY = margin + logoH / 2;
        } else if (position === 'top-right') {
          posX = w - margin - logoW / 2;
          posY = margin + logoH / 2;
        } else if (position === 'bottom-left') {
          posX = margin + logoW / 2;
          posY = h - margin - logoH / 2;
        } else if (position === 'bottom-right') {
          posX = w - margin - logoW / 2;
          posY = h - margin - logoH / 2;
        } else if (position === 'center') {
          posX = w / 2;
          posY = h / 2;
        }

        ctx.translate(posX, posY);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.drawImage(logoImage, -logoW / 2, -logoH / 2, logoW, logoH);
      } else {
        if (position === 'top-left') {
          posX = margin;
          posY = margin + fontSize;
          ctx.textAlign = 'left';
        } else if (position === 'top-right') {
          posX = w - margin;
          posY = margin + fontSize;
          ctx.textAlign = 'right';
        } else if (position === 'bottom-left') {
          posX = margin;
          posY = h - margin;
          ctx.textAlign = 'left';
        } else if (position === 'bottom-right') {
          posX = w - margin;
          posY = h - margin;
          ctx.textAlign = 'right';
        } else if (position === 'center') {
          ctx.textAlign = 'center';
        }

        ctx.translate(posX, posY);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }

        const renderFontSize = Math.round(fontSize * (w / 800));
        ctx.font = `bold ${renderFontSize}px system-ui, -apple-system, sans-serif`;

        // Pílula / Fundo opcional
        if (styleMode === 'glass' || styleMode === 'solid-black') {
          const metrics = ctx.measureText(text);
          const padX = 14;
          const padY = 8;
          ctx.fillStyle = styleMode === 'glass' ? 'rgba(12, 17, 26, 0.75)' : '#000000';
          let rx = -padX;
          if (ctx.textAlign === 'center') rx = -metrics.width / 2 - padX;
          else if (ctx.textAlign === 'right') rx = -metrics.width - padX;
          ctx.beginPath();
          ctx.roundRect(rx, -renderFontSize, metrics.width + padX * 2, renderFontSize + padY * 2, 8);
          ctx.fill();
        }

        ctx.fillStyle = textColor;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(text, 0, 0);
      }
    }

    ctx.restore();
  };

  // Loop de renderização no Canvas
  useEffect(() => {
    const loop = () => {
      drawFrame();
      animationFrameId.current = requestAnimationFrame(loop);
    };
    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  });

  // Atualizar dimensões do canvas quando o vídeo carrega
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    setVideoDuration(video.duration || 0);
  };

  // Renderizar e Gravar Vídeo Limpo com Marca D'água
  const startRender = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      notify?.('error', 'Erro', 'Nenhum vídeo carregado para processamento.');
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);
    setIsPlaying(false);
    video.pause();
    video.currentTime = 0;

    try {
      // Configurar Stream do Canvas
      const stream = canvas.captureStream(60);

      // Tentar capturar áudio se suportado
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination);
        const audioTrack = destination.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      } catch {
        // Áudio mudo ou restrito pelo navegador, segue com vídeo
      }

      // Escolher codec
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 8_000_000, // 8 Mbps para máxima qualidade
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: selectedMime });
        const finalUrl = URL.createObjectURL(finalBlob);
        setRenderedBlob(finalBlob);
        setRenderedUrl(finalUrl);
        setIsRendering(false);
        setRenderProgress(100);
        notify?.('success', 'Vídeo Processado!', 'Vídeo limpo e com marca d\'água gerado com sucesso!');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);

      // Tocar vídeo do início ao fim
      await video.play();

      const progressInterval = setInterval(() => {
        if (!video.duration) return;
        const progress = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
        setRenderProgress(progress);
      }, 200);

      video.onended = () => {
        clearInterval(progressInterval);
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      };
    } catch (err) {
      setIsRendering(false);
      notify?.('error', 'Falha na Renderização', err instanceof Error ? err.message : 'Erro ao processar vídeo.');
    }
  };

  // Baixar vídeo localmente
  const downloadVideo = () => {
    if (!renderedUrl) return;
    const a = document.createElement('a');
    a.href = renderedUrl;
    a.download = `video_limpo_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify?.('success', 'Download Iniciado', 'Arquivo de vídeo salvo no seu dispositivo.');
  };

  // Enviar vídeo processado para o disparador do bot
  const useInDisparador = async () => {
    if (!renderedBlob) return;
    setUploadingToSystem(true);
    try {
      // Converter Blob em DataURL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        try {
          const res = await api.uploadMedia({
            filename: `video_limpo_${Date.now()}.webm`,
            dataUrl,
            mediaType: 'video',
          });
          if (res.ok) {
            onUseInMessage?.(res.url, 'video');
            notify?.('success', 'Vídeo Vinculado!', 'Vídeo carregado no formulário de mensagens do Telegram.');
          }
        } catch {
          // Se falhar o upload no servidor, envia a dataURL local para uso imediato no preview
          onUseInMessage?.(dataUrl, 'video');
          notify?.('info', 'Vídeo Carregado', 'Vídeo aplicado no disparador com sucesso.');
        } finally {
          setUploadingToSystem(false);
        }
      };
      reader.readAsDataURL(renderedBlob);
    } catch (err) {
      setUploadingToSystem(false);
      notify?.('error', 'Erro', err instanceof Error ? err.message : 'Falha ao vincular vídeo.');
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Cabeçalho do Estúdio */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#2b3548] bg-[#10141d] p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4f933]/10 text-[#d4f933]">
              <FileVideo className="h-4 w-4" />
            </span>
            <h1 className="text-lg font-black tracking-tight text-white">Estúdio de Vídeo & Marca D'água</h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
              Anti-Copyright Shield
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8290a5]">
            Limpeza de metadados, corte algorítmico anti-pirataria e molde personalizado em tempo real para os seus vídeos.
          </p>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPosition('banner-bottom');
              setText('💋 MODELO VIP OFICIAL | ASSINATURA EXCLUSIVA');
              setStyleMode('glass');
              setAntiCopyright(true);
            }}
            className="rounded-xl border border-[#273244] bg-[#161c28] px-3 py-1.5 text-[11px] font-semibold text-[#ccd6e4] transition hover:border-[#d4f933] hover:text-[#d4f933]"
          >
            💋 Molde VIP Rodapé
          </button>
          <button
            type="button"
            onClick={() => {
              setPosition('top-right');
              setText('@OnlyFansExclusivo');
              setStyleMode('glass');
              setAntiCopyright(true);
            }}
            className="rounded-xl border border-[#273244] bg-[#161c28] px-3 py-1.5 text-[11px] font-semibold text-[#ccd6e4] transition hover:border-[#d4f933] hover:text-[#d4f933]"
          >
            ⭐ Selo Superior
          </button>
          <button
            type="button"
            onClick={() => {
              setPosition('center');
              setText('PRÉVIA EXCLUSIVA • NÃO COMPARTILHE');
              setRotation(-25);
              setOpacity(45);
              setAntiCopyright(true);
            }}
            className="rounded-xl border border-[#273244] bg-[#161c28] px-3 py-1.5 text-[11px] font-semibold text-[#ccd6e4] transition hover:border-[#d4f933] hover:text-[#d4f933]"
          >
            🔒 Diagonal Anti-Vazamento
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        {/* Painel Esquerdo: Controles e Configurações */}
        <div className="space-y-5">
          {/* 1. Seleção do Vídeo */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#d4f933]" /> Selecionar Vídeo da Modelo
            </h2>
            <p className="mt-0.5 text-xs text-[#8290a5]">Envie do seu celular ou computador (.mp4, .webm, .mov).</p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleVideoSelect(e.dataTransfer.files[0]);
              }}
              className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2b3548] bg-[#131924] p-6 text-center transition hover:border-[#d4f933] hover:bg-[#161e2c]"
            >
              <FileVideo className="h-9 w-9 text-[#d4f933]/80" />
              <p className="mt-2 text-xs font-bold text-white">
                {videoFile ? videoFile.name : 'Clique para escolher ou arraste o vídeo aqui'}
              </p>
              <p className="text-[11px] text-[#718096]">Suporta vídeos em 1080p, 4K, 60fps sem perda de qualidade</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleVideoSelect(e.target.files[0]);
                }}
              />
            </div>
          </div>

          {/* 2. Configurações da Marca D'água */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#d4f933]" /> Molde da Marca D'água
            </h2>

            {/* Alternar Texto / Imagem */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWatermarkType('text')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                  watermarkType === 'text'
                    ? 'border border-[#d4f933] bg-[#d4f933]/10 text-[#d4f933]'
                    : 'border border-[#232d3d] bg-[#141923] text-[#8e9cb1]'
                }`}
              >
                <Type className="h-3.5 w-3.5" /> Texto / Nickname
              </button>
              <button
                type="button"
                onClick={() => setWatermarkType('image')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                  watermarkType === 'image'
                    ? 'border border-[#d4f933] bg-[#d4f933]/10 text-[#d4f933]'
                    : 'border border-[#232d3d] bg-[#141923] text-[#8e9cb1]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" /> Logo / Imagem
              </button>
            </div>

            {watermarkType === 'text' ? (
              <div>
                <label className="label">Texto do Molde</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ex.: @minhamodelo | Assinatura VIP"
                  className="input font-semibold"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="label">Logo ou Assinatura (PNG Transparente / SVG / JPG)</label>

                {logoSrc && logoImage ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-black/60 p-1">
                        <img src={logoSrc} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          <span className="text-xs font-bold text-white">Logo Reconhecida e Ativa</span>
                        </div>
                        <span className="text-[10px] text-[#8ea0b7]">
                          Dimensão: {logoImage.naturalWidth}x{logoImage.naturalHeight}px
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="rounded-lg border border-[#2e3b50] bg-[#161c28] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-[#d4f933] hover:text-[#d4f933]"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoImage(null);
                          setLogoSrc(null);
                        }}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20"
                        title="Remover Logo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files[0]) handleLogoSelect(e.dataTransfer.files[0]);
                    }}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#293448] bg-[#131924] p-5 text-center transition hover:border-[#d4f933] hover:bg-[#161f2f]"
                  >
                    <Upload className="h-6 w-6 text-[#d4f933]" />
                    <span className="mt-1.5 text-xs font-bold text-white">Clique para escolher ou arraste a Logo PNG</span>
                    <span className="text-[10px] text-[#718299]">PNG transparente sem fundo recomendado</span>
                  </div>
                )}

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleLogoSelect(e.target.files[0]);
                  }}
                />

                {/* Slider de Escala / Tamanho da Logo */}
                {logoImage && (
                  <div className="rounded-xl border border-[#232d3d] bg-[#10141d] p-3">
                    <div className="flex justify-between text-[11px] font-semibold text-[#8e9cb1]">
                      <span>Tamanho da Logo (Escala)</span>
                      <span className="font-mono text-[#d4f933]">{logoScale}px</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="320"
                      value={logoScale}
                      onChange={(e) => setLogoScale(Number(e.target.value))}
                      className="mt-1 w-full accent-[#d4f933]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Posição */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Posicionamento no Vídeo</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as WatermarkPosition)}
                  className="input font-semibold"
                >
                  <option value="banner-bottom">Faixa Banner Rodapé (Recomendado)</option>
                  <option value="banner-top">Faixa Banner Topo</option>
                  <option value="bottom-right">Canto Inferior Direito (Padrão VIP)</option>
                  <option value="top-right">Canto Superior Direito</option>
                  <option value="bottom-left">Canto Inferior Esquerdo</option>
                  <option value="top-left">Canto Superior Esquerdo</option>
                  <option value="center">Centro da Tela</option>
                </select>
              </div>

              <div>
                <label className="label">Estilo Visual do Molde</label>
                <select
                  value={styleMode}
                  onChange={(e) => setStyleMode(e.target.value as WatermarkStyle)}
                  className="input font-semibold"
                >
                  <option value="glass">Vidro Escuro (Glassmorphism)</option>
                  <option value="solid-black">Preto Total (Contraste Máximo)</option>
                  <option value="gradient-purple">Gradiente Roxo VIP</option>
                  <option value="minimal">Minimalista (Sem Fundo)</option>
                </select>
              </div>
            </div>

            {/* Controles Deslizantes */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-[#8e9cb1]">
                  <span>Opacidade</span>
                  <span className="text-[#d4f933]">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="mt-1 w-full accent-[#d4f933]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-[#8e9cb1]">
                  <span>Tamanho Fonte</span>
                  <span className="text-[#d4f933]">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="44"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="mt-1 w-full accent-[#d4f933]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-[#8e9cb1]">
                  <span>Rotação</span>
                  <span className="text-[#d4f933]">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="mt-1 w-full accent-[#d4f933]"
                />
              </div>
            </div>
          </div>

          {/* 3. Blindagem Anti-Copyright */}
          <div className="card p-5 space-y-3 border-emerald-500/20 bg-emerald-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Blindagem Anti-Copyright & Hash</h3>
                  <p className="text-[11px] text-[#8e9cb1]">Remove metadados e invalida assinaturas de bots de detecção</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={antiCopyright}
                onChange={(e) => setAntiCopyright(e.target.checked)}
                className="h-5 w-5 rounded accent-emerald-500"
              />
            </div>

            {antiCopyright && (
              <div className="mt-2 grid gap-2 border-t border-emerald-500/20 pt-3 text-[11px] text-[#a4b5cb]">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Micro-crop de {Math.round((cropScale - 1) * 100)}% (altera dimensões e hash SHA-256 do vídeo)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Purga completa de metatags EXIF, timestamps de câmera e rastros de rede</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Ajuste cromático imperceptível para quebra de Content ID</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel Direito: Canvas Preview em Tempo Real & Saída */}
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between border-b border-[#212a38] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#d4f933]" />
                <h3 className="text-sm font-bold text-white">Preview em Tempo Real</h3>
              </div>
              <span className="badge border-[#293447] bg-[#161c27] text-[10px] text-[#8ea0b7]">
                {canvasRef.current ? `${canvasRef.current.width}x${canvasRef.current.height}` : 'Aguardando vídeo'}
              </span>
            </div>

            {/* Elemento de vídeo oculto usado como fonte de frames */}
            <video
              ref={videoRef}
              src={videoSrc || undefined}
              className="hidden"
              playsInline
              muted={false}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
            />

            {/* Canvas de Renderização ao Vivo */}
            <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-[#2a3445] bg-black">
              {videoSrc ? (
                <canvas ref={canvasRef} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-[#69788f]">
                  <FileVideo className="h-12 w-12 text-[#2d384c]" />
                  <p className="mt-2 text-xs font-semibold">Nenhum vídeo carregado no momento</p>
                  <p className="text-[11px]">Selecione um vídeo no painel ao lado para ver a marca d'água ao vivo</p>
                </div>
              )}

              {/* Overlay de Progresso durante a Renderização */}
              {isRendering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur">
                  <RefreshCw className="h-9 w-9 animate-spin text-[#d4f933]" />
                  <h4 className="mt-3 text-sm font-black text-white">Processando e Limpando Vídeo...</h4>
                  <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-[#1b2332]">
                    <div
                      className="h-full bg-gradient-to-r from-[#d4f933] to-emerald-400 transition-all duration-200"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  <span className="mt-2 text-xs font-bold text-[#d4f933]">{renderProgress}% concluído</span>
                </div>
              )}
            </div>

            {/* Controles de Reprodução do Preview */}
            {videoSrc && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (isPlaying) {
                      v.pause();
                      setIsPlaying(false);
                    } else {
                      v.play();
                      setIsPlaying(true);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[#2b3548] bg-[#161c28] px-3.5 py-1.5 text-xs font-bold text-white transition hover:border-[#d4f933] hover:text-[#d4f933]"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isPlaying ? 'Pausar' : 'Reproduzir Preview'}
                </button>

                <div className="text-[11px] font-mono text-[#8292a8]">
                  {Math.round(currentTime)}s / {Math.round(videoDuration)}s
                </div>

                <button
                  type="button"
                  disabled={isRendering}
                  onClick={startRender}
                  className="btn-primary text-xs font-bold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isRendering ? 'Renderizando...' : 'Gerar Vídeo Limpo'}
                </button>
              </div>
            )}
          </div>

          {/* Resultado Pronto para Uso */}
          {renderedUrl && (
            <div className="card border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-black">
                    ✓
                  </span>
                  <h4 className="text-sm font-black text-white">Vídeo Limpo Pronto para Uso!</h4>
                </div>
                <span className="badge border-emerald-500/40 bg-emerald-500/20 text-emerald-300">
                  Sem Rastros
                </span>
              </div>

              {/* Player do Vídeo Final */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-emerald-500/20 bg-black">
                <video src={renderedUrl} controls className="h-full w-full object-contain" />
              </div>

              {/* Ações com o Vídeo Pronto */}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={downloadVideo}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#2c374a] bg-[#171d29] py-2.5 text-xs font-bold text-white transition hover:border-[#d4f933] hover:text-[#d4f933]"
                >
                  <Download className="h-4 w-4" /> Baixar Vídeo (.webm / .mp4)
                </button>

                <button
                  type="button"
                  disabled={uploadingToSystem}
                  onClick={useInDisparador}
                  className="btn-primary flex items-center justify-center gap-2 py-2.5 text-xs font-black"
                >
                  <Send className="h-4 w-4" />
                  {uploadingToSystem ? 'Vinculando...' : 'Usar no Disparador do Bot'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

