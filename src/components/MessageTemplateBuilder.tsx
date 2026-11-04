import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  Bold,
  Check,
  Code,
  Hash,
  ImageIcon,
  Italic,
  LayoutGrid,
  Link2,
  Loader2,
  Plus,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CreateTemplateInput,
  MessageTemplate,
  TemplateButton,
  TemplateCategory,
} from '@shared/types';
import { api } from '../lib/api';
import { SmartImageInput } from './SmartImageInput';
import { TelegramPreview } from './TelegramPreview';

// ─── Types ─────────────────────────────────────────────────────────────────

interface MessageTemplateBuilderProps {
  open: boolean;
  onClose: () => void;
  onSaved: (template: MessageTemplate) => void;
  editTemplate?: MessageTemplate | null;
  defaultCategory?: TemplateCategory;
}

type MediaType = 'none' | 'photo' | 'video' | 'animation';
type MediaMode = 'single' | 'grid';

interface GridItem {
  id: string;
  url: string;
  type: 'photo' | 'video';
  position?: 'main-left' | 'top-right' | 'bottom-right' | 'auto';
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES: { value: TemplateCategory; label: string; color: string }[] = [
  { value: 'abertura',       label: 'Boas-Vindas',    color: 'blue'    },
  { value: 'reengajamento',  label: 'Reengajamento',  color: 'emerald' },
  { value: 'oferta',         label: 'Oferta/Planos',  color: 'amber'   },
  { value: 'prova_social',   label: 'Prova Social',   color: 'purple'  },
  { value: 'fechamento',     label: 'Fechamento',     color: 'rose'    },
  { value: 'recuperacao',    label: 'Recuperação DM', color: 'green'   },
];

const CATEGORY_PILL: Record<string, string> = {
  blue:    'bg-blue-500/20 text-blue-300 border-blue-500/40',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  amber:   'bg-amber-500/20 text-amber-300 border-amber-500/40',
  purple:  'bg-purple-500/20 text-purple-300 border-purple-500/40',
  rose:    'bg-rose-500/20 text-rose-300 border-rose-500/40',
  green:   'bg-green-500/20 text-green-300 border-green-500/40',
};

const BUTTON_COLORS: { value: TemplateButton['color']; label: string; cls: string }[] = [
  { value: 'default', label: 'Padrão', cls: 'bg-[#1e2d3d] text-[#b0c4d8]' },
  { value: 'green',   label: 'Verde',  cls: 'bg-green-700 text-white'      },
  { value: 'red',     label: 'Verm.',  cls: 'bg-red-700 text-white'        },
  { value: 'purple',  label: 'Roxo',   cls: 'bg-purple-700 text-white'     },
  { value: 'amber',   label: 'Ambar',  cls: 'bg-amber-500 text-black'      },
];

const GRID_POSITIONS: Array<{
  position: GridItem['position'];
  label: string;
}> = [
  { position: 'main-left',    label: 'Principal'   },
  { position: 'top-right',    label: 'Topo Dir.'   },
  { position: 'bottom-right', label: 'Baixo Dir.'  },
  { position: 'auto',         label: 'Extra'       },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseTelegramMarkdown(text: string): string {
  // Convert Telegram markdown to HTML for preview
  return text
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="bg-[#1b2838] px-1 rounded text-[#a8d8f0] font-mono text-[11px]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#539fd6] underline" target="_blank">$1</a>');
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#4a5568]">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-5 border-t border-[#1b202b]" />;
}

// ─── Main Component ────────────────────────────────────────────────────────

export function MessageTemplateBuilder({
  open,
  onClose,
  onSaved,
  editTemplate,
  defaultCategory = 'abertura',
}: MessageTemplateBuilderProps) {
  // ── Form state ──
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>(defaultCategory);
  const [active, setActive] = useState(true);
  const [weight, setWeight] = useState(5);
  const [body, setBody] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('none');
  const [mediaMode, setMediaMode] = useState<MediaMode>('single');
  const [mediaUrl, setMediaUrl] = useState('');
  const [gridItems, setGridItems] = useState<GridItem[]>([
    { id: uid(), url: '', type: 'photo', position: 'main-left'    },
    { id: uid(), url: '', type: 'photo', position: 'top-right'    },
    { id: uid(), url: '', type: 'photo', position: 'bottom-right' },
    { id: uid(), url: '', type: 'photo', position: 'auto'         },
  ]);
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Populate form when editing ──
  useEffect(() => {
    if (!open) return;
    if (editTemplate) {
      setName(editTemplate.name);
      setCategory(editTemplate.category);
      setActive(editTemplate.active);
      setWeight(editTemplate.weight);
      setBody(editTemplate.body);
      setMediaType((editTemplate.mediaType as MediaType) ?? 'none');
      setMediaMode((editTemplate.mediaMode as MediaMode) ?? 'single');
      setMediaUrl(editTemplate.mediaUrl ?? '');
      if (editTemplate.mediaGrid && editTemplate.mediaGrid.length > 0) {
        const filled = editTemplate.mediaGrid.map((g) => ({
          id: g.id,
          url: g.url,
          type: g.type,
          position: g.position,
        }));
        // Pad to 4
        const padded: GridItem[] = [...filled];
        while (padded.length < 4) {
          padded.push({ id: uid(), url: '', type: 'photo', position: GRID_POSITIONS[padded.length].position });
        }
        setGridItems(padded.slice(0, 4));
      } else {
        setGridItems([
          { id: uid(), url: '', type: 'photo', position: 'main-left'    },
          { id: uid(), url: '', type: 'photo', position: 'top-right'    },
          { id: uid(), url: '', type: 'photo', position: 'bottom-right' },
          { id: uid(), url: '', type: 'photo', position: 'auto'         },
        ]);
      }
      setButtons(editTemplate.buttons ?? []);
      setTags(editTemplate.tags ?? []);
    } else {
      setName('');
      setCategory(defaultCategory);
      setActive(true);
      setWeight(5);
      setBody('');
      setMediaType('none');
      setMediaMode('single');
      setMediaUrl('');
      setGridItems([
        { id: uid(), url: '', type: 'photo', position: 'main-left'    },
        { id: uid(), url: '', type: 'photo', position: 'top-right'    },
        { id: uid(), url: '', type: 'photo', position: 'bottom-right' },
        { id: uid(), url: '', type: 'photo', position: 'auto'         },
      ]);
      setButtons([]);
      setTags([]);
    }
    setTagInput('');
    setError(null);
  }, [open, editTemplate, defaultCategory]);

  // ── Escape to close ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Markdown helper insert ──
  const insertMarkdown = useCallback((before: string, after: string, sample: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const selected = body.slice(start, end) || sample;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + before.length + selected.length + after.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }, [body]);

  // ── Buttons ──
  const addButton = () => {
    if (buttons.length >= 6) return;
    setButtons((prev) => [...prev, { text: '', url: '', color: 'default', row: 0 }]);
  };

  const updateButton = (idx: number, patch: Partial<TemplateButton>) => {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeButton = (idx: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Tags ──
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  // ── Grid item helpers ──
  const updateGridItem = (idx: number, url: string) => {
    setGridItems((prev) => prev.map((g, i) => (i === idx ? { ...g, url } : g)));
  };

  // ── Save ──
  const handleSave = async () => {
    if (!name.trim()) { setError('O nome do template é obrigatório.'); return; }
    if (!body.trim()) { setError('O corpo da mensagem é obrigatório.'); return; }

    setSaving(true);
    setError(null);

    try {
      const resolvedGrid = mediaMode === 'grid'
        ? gridItems.filter((g) => g.url.trim()).map((g) => ({
            id: g.id,
            url: g.url,
            type: g.type,
            position: g.position,
          }))
        : [];

      const input: CreateTemplateInput = {
        name:      name.trim(),
        category,
        body:      body.trim(),
        buttons:   buttons.filter((b) => b.text.trim()),
        mediaUrl:  mediaType !== 'none' && mediaMode === 'single' ? (mediaUrl || null) : null,
        mediaType,
        mediaMode,
        mediaGrid: resolvedGrid,
        weight,
        active,
        tags,
      };

      const result = editTemplate
        ? await api.updateTemplate(editTemplate.id, input)
        : await api.createTemplate(input);

      onSaved(result.template);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar template.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // ── Preview data ──
  const previewButtons = buttons.filter((b) => b.text.trim());
  const previewMediaGrid = mediaMode === 'grid'
    ? gridItems.filter((g) => g.url.trim()).map((g) => ({ id: g.id, url: g.url, type: g.type, position: g.position }))
    : [];

  const catMeta = CATEGORIES.find((c) => c.value === category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#1b202b] bg-[#0d1017] shadow-2xl">

        {/* ── Header bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#1b202b] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <AlignLeft className="h-4 w-4 text-[#d4f933]" />
            <span className="text-sm font-bold text-white">
              {editTemplate ? 'Editar Template' : 'Novo Template'}
            </span>
            {catMeta && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${CATEGORY_PILL[catMeta.color]}`}>
                {catMeta.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#4a5568] transition hover:bg-[#1b202b] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ═══ SECTION 1 — Identity ═══ */}
          <SectionLabel>Identidade</SectionLabel>

          {/* Name */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-[#8fa0b6]">Nome do Template</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Oferta VIP Premium #1"
              className="w-full rounded-xl border border-[#1f2736] bg-[#090c13] px-3 py-2.5 text-sm text-white placeholder-[#3d4f65] outline-none focus:border-[#d4f933]/50 focus:ring-1 focus:ring-[#d4f933]/20"
            />
          </div>

          {/* Category pills */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-[#8fa0b6]">Categoria</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    category === cat.value
                      ? CATEGORY_PILL[cat.color] + ' ring-1 ring-offset-1 ring-offset-[#0d1017] ring-current'
                      : 'border-[#1f2736] bg-transparent text-[#4a5568] hover:border-[#2d3748] hover:text-[#8fa0b6]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active + Weight */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Active toggle */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActive((v) => !v)}
                className={`relative h-5 w-9 rounded-full border transition ${
                  active
                    ? 'border-[#d4f933]/50 bg-[#d4f933]/20'
                    : 'border-[#1f2736] bg-[#090c13]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                    active ? 'left-4 bg-[#d4f933]' : 'left-0.5 bg-[#3d4f65]'
                  }`}
                />
              </button>
              <span className={`text-xs font-semibold ${active ? 'text-[#d4f933]' : 'text-[#4a5568]'}`}>
                {active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Weight */}
            <div className="flex flex-1 items-center gap-3">
              <span className="shrink-0 text-xs font-semibold text-[#8fa0b6]">Peso</span>
              <input
                type="range"
                min={1}
                max={10}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="flex-1 accent-[#d4f933]"
              />
              <span className="w-5 text-center text-xs font-bold text-[#d4f933]">{weight}</span>
            </div>
          </div>

          <Divider />

          {/* ═══ SECTION 2 — Body ═══ */}
          <SectionLabel>Corpo da Mensagem</SectionLabel>

          {/* Markdown helper buttons */}
          <div className="mb-2 flex flex-wrap gap-1">
            {[
              { icon: <Bold className="h-3 w-3" />,   before: '*',  after: '*',  sample: 'negrito'  },
              { icon: <Italic className="h-3 w-3" />,  before: '_',  after: '_',  sample: 'itálico'  },
              { icon: <Code className="h-3 w-3" />,    before: '`',  after: '`',  sample: 'código'   },
              { icon: <Link2 className="h-3 w-3" />,   before: '[', after: '](url)', sample: 'link' },
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => insertMarkdown(item.before, item.after, item.sample)}
                className="flex items-center gap-1 rounded-lg border border-[#1f2736] bg-[#090c13] px-2 py-1 text-[10px] font-semibold text-[#8fa0b6] transition hover:border-[#d4f933]/30 hover:text-[#d4f933]"
              >
                {item.icon}
              </button>
            ))}
            <span className="ml-auto self-center text-[10px] text-[#3d4f65]">
              Use *negrito*, _itálico_, `código` para formatar
            </span>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ei {nome}! 👋&#10;&#10;Tenho uma oferta exclusiva para você..."
              rows={5}
              className="w-full resize-y rounded-xl border border-[#1f2736] bg-[#090c13] px-3 py-2.5 text-sm text-white placeholder-[#3d4f65] outline-none focus:border-[#d4f933]/50 focus:ring-1 focus:ring-[#d4f933]/20"
              style={{ minHeight: 120 }}
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-[#3d4f65]">
              {body.length} chars
            </span>
          </div>

          <Divider />

          {/* ═══ SECTION 3 — Media ═══ */}
          <SectionLabel>Mídia</SectionLabel>

          {/* Media type pills */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(['none', 'photo', 'video', 'animation'] as MediaType[]).map((mt) => (
              <button
                key={mt}
                type="button"
                onClick={() => setMediaType(mt)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  mediaType === mt
                    ? 'border-[#d4f933]/50 bg-[#d4f933]/10 text-[#d4f933]'
                    : 'border-[#1f2736] bg-transparent text-[#4a5568] hover:text-[#8fa0b6]'
                }`}
              >
                {mt === 'none' ? 'Sem Mídia' : mt === 'animation' ? 'GIF' : mt.charAt(0).toUpperCase() + mt.slice(1)}
              </button>
            ))}
          </div>

          {mediaType !== 'none' && (
            <>
              {/* Mode pills */}
              <div className="mb-3 flex gap-1.5">
                {(['single', 'grid'] as MediaMode[]).map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => setMediaMode(mm)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      mediaMode === mm
                        ? 'border-[#d4f933]/50 bg-[#d4f933]/10 text-[#d4f933]'
                        : 'border-[#1f2736] bg-transparent text-[#4a5568] hover:text-[#8fa0b6]'
                    }`}
                  >
                    {mm === 'single' ? <Square className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
                    {mm === 'single' ? 'Imagem Única' : 'Grid (até 4)'}
                  </button>
                ))}
              </div>

              {mediaMode === 'single' ? (
                <SmartImageInput
                  label="URL / Upload da Mídia"
                  value={mediaUrl}
                  onChange={setMediaUrl}
                  placeholder="https://..."
                />
              ) : (
                <div className="space-y-2">
                  {gridItems.map((item, idx) => (
                    <SmartImageInput
                      key={item.id}
                      label={GRID_POSITIONS[idx]?.label ?? `Mídia ${idx + 1}`}
                      value={item.url}
                      onChange={(url) => updateGridItem(idx, url)}
                      placeholder="https://..."
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <Divider />

          {/* ═══ SECTION 4 — Buttons ═══ */}
          <SectionLabel>Botões Telegram</SectionLabel>

          <div className="space-y-2">
            {buttons.map((btn, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#1f2736] bg-[#090c13] p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={btn.text}
                    onChange={(e) => updateButton(idx, { text: e.target.value })}
                    placeholder="Texto do botão"
                    className="flex-1 rounded-lg border border-[#1b2030] bg-[#0d1017] px-2.5 py-1.5 text-xs text-white placeholder-[#3d4f65] outline-none focus:border-[#d4f933]/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeButton(idx)}
                    className="shrink-0 rounded-lg p-1.5 text-[#4a5568] transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={btn.url ?? ''}
                  onChange={(e) => updateButton(idx, { url: e.target.value })}
                  placeholder="URL (opcional)"
                  className="w-full rounded-lg border border-[#1b2030] bg-[#0d1017] px-2.5 py-1.5 text-xs text-white placeholder-[#3d4f65] outline-none focus:border-[#d4f933]/40"
                />

                <div className="flex flex-wrap items-center gap-2">
                  {/* Color */}
                  <div className="flex gap-1">
                    {BUTTON_COLORS.map((bc) => (
                      <button
                        key={bc.value}
                        type="button"
                        onClick={() => updateButton(idx, { color: bc.value })}
                        className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold transition ${bc.cls} ${
                          btn.color === bc.value ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#090c13]' : 'opacity-50 hover:opacity-100'
                        }`}
                        title={bc.label}
                      >
                        {btn.color === bc.value && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>

                  {/* Row selector */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-[#4a5568]">Linha:</span>
                    {[0, 1].map((row) => (
                      <button
                        key={row}
                        type="button"
                        onClick={() => updateButton(idx, { row })}
                        className={`h-5 w-5 rounded text-[10px] font-bold transition ${
                          btn.row === row
                            ? 'bg-[#d4f933] text-black'
                            : 'bg-[#1b2030] text-[#4a5568] hover:text-white'
                        }`}
                      >
                        {row + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {buttons.length < 6 && (
            <button
              type="button"
              onClick={addButton}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#1f2736] py-2.5 text-xs font-semibold text-[#4a5568] transition hover:border-[#d4f933]/30 hover:text-[#d4f933]"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Botão {buttons.length > 0 ? `(${buttons.length}/6)` : ''}
            </button>
          )}

          {/* Button preview */}
          {buttons.filter((b) => b.text.trim()).length > 0 && (
            <div className="mt-3 rounded-xl border border-[#1f2736] bg-[#07090f] p-3 space-y-1">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#3d4f65]">
                Preview dos Botões
              </p>
              {(() => {
                const rows: TemplateButton[][] = [];
                buttons.filter((b) => b.text.trim()).forEach((btn) => {
                  const r = btn.row ?? 0;
                  if (!rows[r]) rows[r] = [];
                  rows[r].push(btn);
                });
                return rows.filter(Boolean).map((row, ri) => (
                  <div key={ri} className="flex gap-1">
                    {row.map((btn, bi) => {
                      const colorClass =
                        btn.color === 'green'  ? 'bg-[#3b7c3d] text-white' :
                        btn.color === 'red'    ? 'bg-[#a33232] text-white' :
                        btn.color === 'purple' ? 'bg-[#5b3c88] text-white' :
                        btn.color === 'amber'  ? 'bg-[#c58b1d] text-black' :
                                                 'bg-[#203246] text-[#e1ebf5]';
                      return (
                        <div
                          key={bi}
                          className={`flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-center text-[11px] font-semibold ${colorClass}`}
                        >
                          {btn.text}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}

          <Divider />

          {/* ═══ SECTION 5 — Live Preview ═══ */}
          <SectionLabel>Preview em Tempo Real</SectionLabel>

          <TelegramPreview
            text={body || '_Escreva seu texto acima para ver o preview..._'}
            mediaUrl={mediaMode === 'single' && mediaType !== 'none' ? mediaUrl || null : null}
            mediaType={mediaType !== 'none' ? mediaType : 'none'}
            mediaGrid={previewMediaGrid}
            buttons={previewButtons}
          />

          <Divider />

          {/* ═══ SECTION 6 — Tags ═══ */}
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Tags
            </span>
          </SectionLabel>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#3d4f65]" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="ex: vip, premium (Enter para adicionar)"
                className="w-full rounded-xl border border-[#1f2736] bg-[#090c13] py-2 pl-7 pr-3 text-xs text-white placeholder-[#3d4f65] outline-none focus:border-[#d4f933]/40"
              />
            </div>
            <button
              type="button"
              onClick={addTag}
              className="rounded-xl border border-[#1f2736] bg-[#090c13] px-3 py-2 text-xs text-[#8fa0b6] transition hover:border-[#d4f933]/30 hover:text-[#d4f933]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full border border-[#1f2736] bg-[#090c13] px-2 py-0.5 text-[10px] text-[#8fa0b6]"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-[#4a5568] transition hover:text-red-400"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-[#1b202b] px-6 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#1f2736] px-5 py-2.5 text-sm font-semibold text-[#8fa0b6] transition hover:border-[#2d3748] hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#d4f933] px-6 py-2.5 text-sm font-bold text-black shadow-md transition hover:bg-[#c5ea25] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Salvar Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
