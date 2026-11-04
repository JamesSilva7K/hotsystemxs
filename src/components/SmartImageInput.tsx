import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';

interface SmartImageInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  aspectHint?: string;
  required?: boolean;
}

export function SmartImageInput({
  label,
  value,
  onChange,
  placeholder = 'https://.../foto.jpg',
  aspectHint,
  required,
}: SmartImageInputProps) {
  const [mode, setMode] = useState<'url' | 'upload' | 'paste'>('url');
  const [status, setStatus] = useState<'empty' | 'validating' | 'valid' | 'error'>('empty');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Reconhecimento inteligente e validação da imagem em tempo real
  useEffect(() => {
    if (!value || !value.trim()) {
      setStatus('empty');
      setDimensions(null);
      return;
    }

    setStatus('validating');
    let isCancelled = false;
    const img = new window.Image();

    img.onload = () => {
      if (isCancelled) return;
      setStatus('valid');
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      if (isCancelled) return;
      setStatus('error');
      setDimensions(null);
    };

    img.src = value;

    return () => {
      isCancelled = true;
    };
  }, [value]);

  // Leitura de arquivo local
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP, etc.).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) onChange(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
      return;
    }
    const text = e.dataTransfer.getData('text');
    if (text && /^https?:\/\//i.test(text.trim())) {
      onChange(text.trim());
    }
  };

  // Captura inteligente de Copia e Cola (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            e.preventDefault();
            return;
          }
        }
      }
    }
    const pastedText = e.clipboardData?.getData('text');
    if (pastedText && /^https?:\/\//i.test(pastedText.trim())) {
      onChange(pastedText.trim());
      e.preventDefault();
    }
  };

  const hasImage = Boolean(value && value.trim());

  return (
    <div className="space-y-2 rounded-xl border border-[#1f2736] bg-[#090c13] p-3">
      {/* Cabeçalho do campo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-[#d4f933]" />
            <span>{label}</span>
            {required && <span className="text-rose-400">*</span>}
          </label>
          {aspectHint && <p className="text-[10px] text-[#6b7b91]">{aspectHint}</p>}
        </div>

        {/* Alternador de Métodos (URL, Anexar, Copiar & Colar) */}
        {!hasImage && (
          <div className="flex items-center gap-1 rounded-lg border border-[#212a3a] bg-[#06080c] p-0.5">
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                mode === 'url'
                  ? 'bg-[#d4f933] text-black shadow-sm'
                  : 'text-[#7d8ea6] hover:text-white'
              }`}
            >
              <LinkIcon className="h-3 w-3" /> URL Web
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                mode === 'upload'
                  ? 'bg-[#d4f933] text-black shadow-sm'
                  : 'text-[#7d8ea6] hover:text-white'
              }`}
            >
              <Upload className="h-3 w-3" /> Anexar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('paste');
                setTimeout(() => pasteAreaRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                mode === 'paste'
                  ? 'bg-[#d4f933] text-black shadow-sm'
                  : 'text-[#7d8ea6] hover:text-white'
              }`}
            >
              <Clipboard className="h-3 w-3" /> Copiar & Colar
            </button>
          </div>
        )}
      </div>

      {/* Exibição quando uma foto já está carregada */}
      {hasImage ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#273244] bg-[#0f141f] p-2.5">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[#3b475d] bg-black">
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
            {status === 'validating' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="h-4 w-4 animate-spin text-[#d4f933]" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              {status === 'valid' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Imagem Válida Reconhecida
                </span>
              )}
              {status === 'validating' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando imagem...
                </span>
              )}
              {status === 'error' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Erro ao carregar imagem
                </span>
              )}
            </div>

            {dimensions && (
              <div className="mono text-[10px] text-[#8fa0b6]">
                {dimensions.width} × {dimensions.height} px ·{' '}
                {dimensions.width > dimensions.height
                  ? 'Paisagem (16:9 / Horizontal)'
                  : dimensions.width === dimensions.height
                  ? 'Quadrado (1:1)'
                  : 'Retrato (Vertical 4:5)'}
              </div>
            )}

            <div className="mono truncate text-[9px] text-[#637286]">
              {value.startsWith('data:') ? 'Arquivo Anexado Localmente / Clipboard' : value}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange('')}
            className="btn-secondary shrink-0 text-[11px] py-1.5 px-2.5 text-rose-300 hover:bg-rose-500/10 hover:border-rose-400/40"
            title="Remover ou trocar imagem"
          >
            <Trash2 className="h-3.5 w-3.5" /> Trocar
          </button>
        </div>
      ) : (
        /* Modos de Inserção quando vazio */
        <div>
          {mode === 'url' && (
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={placeholder}
                  className="input pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) onChange(text.trim());
                    } catch {
                      // clipboard permission denied
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#78889e] hover:text-[#d4f933]"
                  title="Colar da Área de Transferência"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-[#637286]">
                Cole o link direto da imagem (Unsplash, Imgur, CDN, etc.).
              </p>
            </div>
          )}

          {mode === 'upload' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border border-dashed p-4 text-center transition ${
                dragOver
                  ? 'border-[#d4f933] bg-[#d4f933]/10'
                  : 'border-[#293548] bg-[#0c1017] hover:border-[#3d4f6c]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="mx-auto h-6 w-6 text-[#d4f933] mb-1.5" />
              <div className="text-xs font-bold text-white">
                Clique para selecionar ou arraste sua foto aqui
              </div>
              <p className="mt-0.5 text-[10px] text-[#78889e]">
                Formatos aceitos: JPG, PNG, WEBP ou GIF (Qualquer resolução)
              </p>
            </div>
          )}

          {mode === 'paste' && (
            <div
              ref={pasteAreaRef}
              tabIndex={0}
              onPaste={handlePaste}
              className="cursor-pointer rounded-xl border border-dashed border-[#d4f933]/40 bg-[#d4f933]/5 p-4 text-center outline-none focus:border-[#d4f933] focus:ring-1 focus:ring-[#d4f933]"
            >
              <Clipboard className="mx-auto h-6 w-6 text-[#d4f933] mb-1.5 animate-pulse" />
              <div className="text-xs font-bold text-white">
                Pressione <span className="mono rounded bg-[#d4f933] px-1.5 py-0.5 text-black">Ctrl + V</span> agora
              </div>
              <p className="mt-1 text-[10px] text-[#a0b2c8]">
                Copie qualquer imagem da internet ou printscreen e cole diretamente aqui.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

