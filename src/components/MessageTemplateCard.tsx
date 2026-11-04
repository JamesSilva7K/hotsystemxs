import React from 'react';
import {
  Copy,
  Eye,
  Film,
  Flame,
  ImageIcon,
  LayoutGrid,
  Pencil,
  Sparkles,
  Tag,
  Trash2,
  Video,
  Zap,
} from 'lucide-react';
import type { MessageTemplate, TemplateCategory } from '@shared/types';

// ─── Props ─────────────────────────────────────────────────────────────────

interface MessageTemplateCardProps {
  template: MessageTemplate;
  accentColor?: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose';
  onEdit: (template: MessageTemplate) => void;
  onDelete: (template: MessageTemplate) => void;
  onDuplicate: (template: MessageTemplate) => void;
  onFire?: (template: MessageTemplate) => void;
  onCopyBody: (template: MessageTemplate) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  TemplateCategory,
  { label: string; color: string; pill: string; icon: React.ReactNode }
> = {
  abertura: {
    label: 'Boas-Vindas',
    color: 'blue',
    pill: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: <Sparkles className="h-3 w-3" />,
  },
  reengajamento: {
    label: 'Reengajamento',
    color: 'emerald',
    pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: <Zap className="h-3 w-3" />,
  },
  oferta: {
    label: 'Oferta/Planos',
    color: 'amber',
    pill: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: <Flame className="h-3 w-3" />,
  },
  prova_social: {
    label: 'Prova Social',
    color: 'purple',
    pill: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: <Tag className="h-3 w-3" />,
  },
  fechamento: {
    label: 'Fechamento',
    color: 'rose',
    pill: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: <LayoutGrid className="h-3 w-3" />,
  },
  recuperacao: {
    label: 'Recuperação DM',
    color: 'green',
    pill: 'bg-green-500/20 text-green-300 border-green-500/30',
    icon: <Zap className="h-3 w-3" />,
  },
};

const ACCENT_BORDER: Record<string, string> = {
  amber:   'border-amber-500/30',
  emerald: 'border-emerald-500/30',
  blue:    'border-blue-500/30',
  purple:  'border-purple-500/30',
  rose:    'border-rose-500/30',
  green:   'border-green-500/30',
};

const BTN_PILL: Record<string, string> = {
  default: 'bg-[#1e2d3d] text-[#b0c4d8]',
  green:   'bg-green-700/70 text-green-200',
  red:     'bg-red-700/70 text-red-200',
  purple:  'bg-purple-700/70 text-purple-200',
  amber:   'bg-amber-500/70 text-amber-900',
};

// ─── Component ─────────────────────────────────────────────────────────────

export function MessageTemplateCard({
  template,
  accentColor,
  onEdit,
  onDelete,
  onDuplicate,
  onFire,
  onCopyBody,
}: MessageTemplateCardProps) {
  const catMeta = CATEGORY_META[template.category] ?? CATEGORY_META['abertura'];

  // Derive accent from category when not passed explicitly
  const resolvedAccent = accentColor ?? (catMeta.color as MessageTemplateCardProps['accentColor']);
  const borderClass    = ACCENT_BORDER[resolvedAccent ?? catMeta.color] ?? 'border-[#1b202b]';

  // Truncate body for preview
  const bodyPreview = template.body.replace(/[*_`]/g, '').slice(0, 120) + (template.body.length > 120 ? '…' : '');

  // Count active buttons
  const activeButtons = template.buttons?.filter((b) => b.text?.trim()) ?? [];

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-[#10141c] p-4 transition hover:shadow-lg ${borderClass}`}
    >
      {/* ── Active status dot ── */}
      <div className="absolute right-3 top-3">
        <span
          className={`block h-2 w-2 rounded-full shadow ${
            template.active ? 'bg-emerald-400 shadow-emerald-400/40' : 'bg-[#3d4f65]'
          }`}
          title={template.active ? 'Ativo' : 'Inativo'}
        />
      </div>

      {/* ── Top row: name + category badge ── */}
      <div className="mb-2 flex flex-wrap items-start gap-2 pr-5">
        <span className="text-xs font-bold leading-tight text-white">{template.name}</span>
        <span
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catMeta.pill}`}
        >
          {catMeta.icon}
          {catMeta.label}
        </span>
      </div>

      {/* ── Body preview ── */}
      <p className="mb-3 line-clamp-2 text-[11px] leading-relaxed text-[#5a7080]">
        {bodyPreview || <em className="text-[#3d4f65]">Sem texto...</em>}
      </p>

      {/* ── Buttons preview ── */}
      {activeButtons.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {activeButtons.slice(0, 4).map((btn, i) => {
            const cls = BTN_PILL[btn.color ?? 'default'] ?? BTN_PILL['default'];
            return (
              <span
                key={i}
                className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold ${cls}`}
              >
                {btn.text}
              </span>
            );
          })}
          {activeButtons.length > 4 && (
            <span className="rounded-lg bg-[#1b202b] px-2 py-0.5 text-[9px] text-[#4a5568]">
              +{activeButtons.length - 4}
            </span>
          )}
        </div>
      )}

      {/* ── Media indicator ── */}
      {template.mediaUrl || (template.mediaGrid && template.mediaGrid.length > 0) ? (
        <div className="mb-3 flex items-center gap-1 text-[10px] text-[#4a5568]">
          {template.mediaMode === 'grid' ? (
            <>
              <LayoutGrid className="h-3 w-3 text-[#3d4f65]" />
              <span>Grid · {template.mediaGrid?.length ?? 0} items</span>
            </>
          ) : template.mediaType === 'video' ? (
            <>
              <Video className="h-3 w-3 text-blue-400" />
              <span className="text-blue-400">Vídeo</span>
            </>
          ) : template.mediaType === 'animation' ? (
            <>
              <Film className="h-3 w-3 text-purple-400" />
              <span className="text-purple-400">GIF</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Foto</span>
            </>
          )}
        </div>
      ) : null}

      {/* ── Tags ── */}
      {template.tags && template.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#1f2736] px-1.5 py-0.5 text-[9px] text-[#4a5568]"
            >
              #{tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-[9px] text-[#3d4f65]">+{template.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="mb-3 flex items-center gap-3 text-[10px] text-[#3d4f65]">
        <span>Peso <span className="font-bold text-[#5a7080]">{template.weight}</span></span>
        {template.usageCount > 0 && (
          <span>{template.usageCount} envios</span>
        )}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Action row ── */}
      <div className="flex items-center justify-between border-t border-[#1b202b] pt-3">
        <div className="flex items-center gap-0.5">
          {/* Fire now */}
          {onFire && (
            <ActionBtn
              onClick={() => onFire(template)}
              title="Enviar Agora"
              className="text-amber-400 hover:bg-amber-400/10"
            >
              <Flame className="h-3.5 w-3.5" />
            </ActionBtn>
          )}

          {/* Eye = preview */}
          <ActionBtn
            onClick={() => onFire ? onFire(template) : undefined}
            title="Pré-visualizar"
            className="text-[#4a5568] hover:text-sky-400 hover:bg-sky-400/10"
          >
            <Eye className="h-3.5 w-3.5" />
          </ActionBtn>

          {/* Copy body */}
          <ActionBtn
            onClick={() => onCopyBody(template)}
            title="Copiar Texto"
            className="text-[#4a5568] hover:text-[#d4f933] hover:bg-[#d4f933]/10"
          >
            <Copy className="h-3.5 w-3.5" />
          </ActionBtn>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Edit */}
          <ActionBtn
            onClick={() => onEdit(template)}
            title="Editar"
            className="text-[#4a5568] hover:text-blue-400 hover:bg-blue-400/10"
          >
            <Pencil className="h-3.5 w-3.5" />
          </ActionBtn>

          {/* Duplicate */}
          <ActionBtn
            onClick={() => onDuplicate(template)}
            title="Duplicar"
            className="text-[#4a5568] hover:text-emerald-400 hover:bg-emerald-400/10"
          >
            <Copy className="h-3.5 w-3.5" />
          </ActionBtn>

          {/* Delete */}
          <ActionBtn
            onClick={() => onDelete(template)}
            title="Excluir"
            className="text-[#4a5568] hover:text-red-400 hover:bg-red-400/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny helper ───────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  title,
  className,
  children,
}: {
  onClick?: () => void;
  title: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-lg p-1.5 transition ${className}`}
    >
      {children}
    </button>
  );
}
