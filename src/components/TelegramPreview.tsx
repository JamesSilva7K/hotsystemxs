import React, { useState } from 'react';
import { Check, CheckCheck, Copy, Flame, MessageCircle, Play, Sparkles, X } from 'lucide-react';

export interface InlinePreviewButton {
  text: string;
  url?: string;
  callbackData?: string;
  color?: 'default' | 'green' | 'red' | 'purple' | 'amber';
  row?: number; // 0 para primeira linha, 1 para segunda, etc.
}

interface TelegramPreviewProps {
  botName?: string;
  botAvatar?: string | null;
  text: string;
  mediaUrl?: string | null;
  mediaType?: 'photo' | 'video' | 'animation' | 'none';
  buttons?: InlinePreviewButton[];
  socialProof?: string;
  className?: string;
}

const BUTTON_COLORS = {
  default: 'bg-[#2b5278] hover:bg-[#32618e] text-white border-transparent',
  green: 'bg-[#2ea043] hover:bg-[#3fb950] text-white border-[#3fb950]/30 shadow-emerald-500/10',
  red: 'bg-[#d03a3a] hover:bg-[#e04545] text-white border-[#f85149]/30 shadow-rose-500/10',
  purple: 'bg-[#6f42c1] hover:bg-[#8250df] text-white border-[#8957e5]/30 shadow-purple-500/10',
  amber: 'bg-[#d29922] hover:bg-[#e3b341] text-black font-bold border-amber-400/40',
};

export function TelegramPreview({
  botName = 'Modelo VIP 💋',
  botAvatar,
  text,
  mediaUrl,
  mediaType = 'none',
  buttons = [],
  socialProof,
  className = '',
}: TelegramPreviewProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  // Agrupa os botões por linha
  const rows: InlinePreviewButton[][] = [];
  buttons.forEach((btn) => {
    const rowIdx = btn.row ?? 0;
    if (!rows[rowIdx]) rows[rowIdx] = [];
    rows[rowIdx].push(btn);
  });
  const buttonRows = rows.filter((r) => r && r.length > 0);

  // Extrai trecho de código caso seja PIX
  const codeMatch = text.match(/```(?:copy)?\s*([\s\S]*?)```/) || text.match(/`([^`\n]{15,})`/);
  const cleanCode = codeMatch ? codeMatch[1].trim() : null;

  return (
    <div
      className={`relative mx-auto flex w-full max-w-[390px] flex-col overflow-hidden rounded-3xl border border-[#2b3548] bg-[#0e1621] text-[#f5f5f5] shadow-2xl ${className}`}
    >
      {/* Header do Chat Telegram */}
      <div className="flex items-center gap-3 border-b border-[#17212b] bg-[#17212b]/90 px-4 py-3 backdrop-blur">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-500/30 bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-400 text-xs font-bold text-white shadow-md">
          {botAvatar ? (
            <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
          ) : (
            <span>{botName.slice(0, 2).toUpperCase()}</span>
          )}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#17212b] bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold text-white">{botName}</span>
            <span className="rounded bg-[#2b5278]/60 px-1 py-0.2 text-[9px] font-semibold text-[#82b5e7]">
              bot
            </span>
          </div>
          <p className="text-[10px] text-[#708499]">online agora</p>
        </div>
      </div>

      {/* Área da Conversa com Papel de Parede Escuro do Telegram */}
      <div className="relative flex-1 space-y-3 bg-[#0e1621] p-3.5 sm:p-4">
        {/* Balão de Mensagem */}
        <div className="relative ml-auto w-full max-w-[340px] rounded-2xl rounded-tr-sm border border-[#242f3d] bg-[#182533] p-3 shadow-md">
          {/* Mídia Opcional (Foto / Vídeo / GIF) */}
          {mediaUrl && mediaType !== 'none' && (
            <div className="relative mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {mediaType === 'video' ? (
                <div className="relative aspect-video w-full bg-black/60">
                  <video src={mediaUrl} className="h-full w-full object-cover" controls={false} />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </div>
                  </div>
                </div>
              ) : mediaType === 'animation' ? (
                <div className="relative aspect-video w-full">
                  <img src={mediaUrl} alt="GIF" className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                    GIF
                  </span>
                </div>
              ) : (
                <div className="aspect-video w-full">
                  <img src={mediaUrl} alt="Foto" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Texto Formatado da Mensagem */}
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#f0f2f5]">
            {text.split('\n').map((line, idx) => {
              // Destaque para bloco de código Copia e Cola
              if (line.startsWith('```') || line.endsWith('```')) {
                return null;
              }
              if (cleanCode && line.includes(cleanCode)) {
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      navigator.clipboard.writeText(cleanCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="my-2 cursor-pointer rounded-xl border border-[#3b4759] bg-[#101923] p-2.5 font-mono text-[11px] text-[#86c5da] transition hover:border-[#5288c1]"
                    title="Clique para copiar"
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#6f8298]">
                      <span>PIX Copia e Cola</span>
                      <span className="flex items-center gap-1 text-[#5288c1]">
                        {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedCode ? 'Copiado!' : 'Copiar'}
                      </span>
                    </div>
                    <div className="break-all">{cleanCode}</div>
                  </div>
                );
              }
              return (
                <span key={idx}>
                  {line}
                  {idx < text.split('\n').length - 1 && <br />}
                </span>
              );
            })}
          </div>

          {/* Rodapé com Hora e Status de Entrega */}
          <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[#6c7883]">
            <span>18:55</span>
            <CheckCheck className="h-3.5 w-3.5 text-[#539fd6]" />
          </div>

          {/* Botões Inline Interativos */}
          {buttonRows.length > 0 && (
            <div className="mt-3 space-y-1.5 pt-1">
              {buttonRows.map((row, rIdx) => (
                <div key={rIdx} className="flex gap-1.5">
                  {row.map((btn, bIdx) => {
                    const colorClass = BUTTON_COLORS[btn.color || 'default'];
                    return (
                      <button
                        key={bIdx}
                        type="button"
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-xs font-semibold shadow-sm transition active:scale-[0.98] ${colorClass}`}
                      >
                        {btn.text.includes('ADICIONAR') || btn.text.includes('🔥') ? (
                          <Flame className="h-3.5 w-3.5 fill-current" />
                        ) : btn.text.includes('RECUSAR') || btn.text.includes('❌') ? (
                          <X className="h-3.5 w-3.5" />
                        ) : btn.text.includes('Copiar') || btn.text.includes('📋') ? (
                          <Copy className="h-3.5 w-3.5" />
                        ) : null}
                        <span className="truncate">{btn.text}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prova Social Opcional (Igual da Imagem 4) */}
        {socialProof && (
          <div className="ml-auto w-full max-w-[340px] rounded-2xl rounded-tr-sm border border-[#2b3548] bg-[#182533]/85 p-2.5 text-[11px] text-[#d6deeb] shadow-sm">
            <div className="flex items-start gap-1.5">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="italic leading-relaxed">{socialProof}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

