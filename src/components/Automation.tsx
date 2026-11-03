import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Grid,
  Image,
  Layers,
  Loader2,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Video,
  Wand2,
  Zap,
} from 'lucide-react';
import type { AppState, FollowUpSequence, MessageTemplate, TemplateCategory } from '@shared/types';
import { api } from '../lib/api';
import { formatFullDate, formatNumber, localDateTimeValue, relativeTime, toIsoFromLocal } from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { TelegramPreview } from './TelegramPreview';

interface AutomationProps {
  state: AppState;
  selectedBotId: string;
  refresh: () => Promise<void>;
}

const CATEGORIES: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'reengajamento', label: 'Reengajamento' },
  { value: 'recuperacao', label: 'Recuperação' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'prova_social', label: 'Prova social' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'abertura', label: 'Abertura' },
];

function categoryLabel(value: TemplateCategory): string {
  return CATEGORIES.find((item) => item.value === value)?.label || value;
}

interface SequenceStepDraft {
  templateId: string;
  delayMinutes: number;
}

interface TemplateGridItem {
  id: string;
  url: string;
  type: 'photo' | 'video';
  position: 'main-left' | 'top-right' | 'bottom-right' | 'auto';
}

interface TemplateButtonItem {
  id: number;
  text: string;
  url: string;
  callbackData: string;
  color: 'default' | 'green' | 'red' | 'purple' | 'amber';
  row: number;
}

export function Automation({ state, selectedBotId, refresh }: AutomationProps) {
  const { notify } = useToast();
  const [tab, setTab] = useState<'templates' | 'sequences'>('templates');
  const [busy, setBusy] = useState<string | null>(null);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'reengajamento' as TemplateCategory,
    body: '',
    weight: 1,
    mediaMode: 'none' as 'single' | 'grid' | 'none',
    mediaUrl: '',
    mediaType: 'none' as 'photo' | 'video' | 'animation' | 'none',
    mediaGrid: [] as TemplateGridItem[],
    buttons: [] as TemplateButtonItem[],
  });

  const currentBot = useMemo(() => {
    if (selectedBotId !== 'all') {
      return state.bots.find((b) => b.id === selectedBotId) || state.bots[0] || null;
    }
    return state.bots[0] || null;
  }, [state.bots, selectedBotId]);

  const addGridItem = (type: 'photo' | 'video' = 'photo') => {
    if (templateForm.mediaGrid.length >= 10) return;
    const defaultPos =
      templateForm.mediaGrid.length === 0
        ? 'main-left'
        : templateForm.mediaGrid.length === 1
        ? 'top-right'
        : 'bottom-right';

    const newItem: TemplateGridItem = {
      id: `grid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url:
        type === 'photo'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
          : 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
      type,
      position: defaultPos,
    };
    setTemplateForm((prev) => ({
      ...prev,
      mediaMode: 'grid',
      mediaGrid: [...prev.mediaGrid, newItem],
    }));
  };

  const updateGridItem = (id: string, patch: Partial<TemplateGridItem>) => {
    setTemplateForm((prev) => ({
      ...prev,
      mediaGrid: prev.mediaGrid.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeGridItem = (id: string) => {
    setTemplateForm((prev) => ({
      ...prev,
      mediaGrid: prev.mediaGrid.filter((item) => item.id !== id),
    }));
  };

  const moveGridItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= templateForm.mediaGrid.length) return;
    const copy = [...templateForm.mediaGrid];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setTemplateForm((prev) => ({ ...prev, mediaGrid: copy }));
  };

  const fillExampleHotGrid = () => {
    setTemplateForm((prev) => ({
      ...prev,
      mediaMode: 'grid',
      mediaGrid: [
        {
          id: 'g-1',
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          type: 'photo',
          position: 'main-left',
        },
        {
          id: 'g-2',
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
          type: 'photo',
          position: 'top-right',
        },
        {
          id: 'g-3',
          url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
          type: 'photo',
          position: 'bottom-right',
        },
      ],
    }));
  };

  const addButton = () => {
    if (templateForm.buttons.length >= 8) return;
    const newIdNum = (templateForm.buttons.reduce((max, b) => Math.max(max, b.id), 0) || 0) + 1;
    setTemplateForm((prev) => ({
      ...prev,
      buttons: [
        ...prev.buttons,
        {
          id: newIdNum,
          text: '🔥 NOVO BOTÃO',
          url: '',
          callbackData: 'menu',
          color: 'green',
          row: prev.buttons.length,
        },
      ],
    }));
  };

  const updateButton = (id: number, patch: Partial<TemplateButtonItem>) => {
    setTemplateForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  const removeButton = (id: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((b) => b.id !== id),
    }));
  };

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    brief: '',
    category: 'reengajamento' as TemplateCategory,
    count: 5,
    productId: '',
  });

  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [sequenceForm, setSequenceForm] = useState({
    botId: selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '',
    name: '',
    productId: '',
    steps: [{ templateId: '', delayMinutes: 30 }] as SequenceStepDraft[],
    startsAt: '',
    endsAt: '',
    quietHoursStart: 8,
    quietHoursEnd: 22,
    maxMessagesPerLead: 3,
  });

  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);
  const [previewTemplateObj, setPreviewTemplateObj] = useState<MessageTemplate | null>(null);

  const templates = useMemo(
    () =>
      (selectedBotId === 'all' ? state.templates : state.templates).slice().sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [state.templates, selectedBotId]
  );
  const sequences = useMemo(
    () =>
      (selectedBotId === 'all'
        ? state.sequences
        : state.sequences.filter((sequence) => sequence.botId === selectedBotId)
      ).slice(),
    [state.sequences, selectedBotId]
  );
  const activeTemplates = templates.filter((template) => template.active);
  const automation = state.automation;

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      category: 'reengajamento',
      body: 'Oi vida... vi que você parou de me responder. Aconteceu alguma coisa? 🥺\n\nEu tava aqui separando um conteúdo novo e lembrei de você. Se você quiser ver, me avisa que eu libero uma provinha agora:',
      weight: 1,
      mediaMode: 'none',
      mediaUrl: '',
      mediaType: 'none',
      mediaGrid: [],
      buttons: [
        { id: 1, text: '🔞 VER PRÉVIA NA DM', url: '', callbackData: 'teaser_amostra', color: 'green', row: 0 },
        { id: 2, text: '💎 VER PLANOS VIP', url: '', callbackData: 'menu', color: 'purple', row: 1 },
      ],
    });
    setTemplateOpen(true);
  };

  const openEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      body: template.body,
      weight: template.weight,
      mediaMode:
        template.mediaMode ||
        (template.mediaGrid && template.mediaGrid.length > 0
          ? 'grid'
          : template.mediaUrl
          ? 'single'
          : 'none'),
      mediaUrl: template.mediaUrl || '',
      mediaType: template.mediaType || (template.mediaUrl ? 'photo' : 'none'),
      mediaGrid:
        template.mediaGrid?.map((item) => ({
          id: item.id || `g-${Math.random()}`,
          url: item.url,
          type: item.type,
          position: item.position || 'auto',
        })) || [],
      buttons:
        template.buttons && template.buttons.length > 0
          ? template.buttons.map((b, i) => ({
              id: i + 1,
              text: b.text,
              url: b.url || '',
              callbackData: b.callbackData || '',
              color: b.color || 'default',
              row: b.row ?? i,
            }))
          : [
              { id: 1, text: '🔞 VER PRÉVIA NA DM', url: '', callbackData: 'teaser_amostra', color: 'green', row: 0 },
              { id: 2, text: '💎 VER PLANOS VIP', url: '', callbackData: 'menu', color: 'purple', row: 1 },
            ],
    });
    setTemplateOpen(true);
  };

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('template');
    try {
      const payload = {
        name: templateForm.name.trim(),
        category: templateForm.category,
        body: templateForm.body.trim(),
        weight: templateForm.weight,
        mediaMode: templateForm.mediaMode,
        mediaUrl: templateForm.mediaMode === 'single' && templateForm.mediaUrl.trim() ? templateForm.mediaUrl.trim() : null,
        mediaType: templateForm.mediaMode === 'single' ? templateForm.mediaType : 'none',
        mediaGrid: templateForm.mediaMode === 'grid' ? templateForm.mediaGrid : [],
        buttons: templateForm.buttons.map((b) => ({
          text: b.text.trim(),
          url: b.url.trim() ? b.url.trim() : undefined,
          callbackData: b.callbackData.trim() ? b.callbackData.trim() : undefined,
          color: b.color,
          row: b.row,
        })),
      };

      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, payload);
        notify('success', 'Template atualizado com sucesso!', templateForm.name);
      } else {
        await api.createTemplate(payload);
        notify('success', 'Template criado com sucesso!', 'Já pode ser usado nos passos de follow-up e campanhas.');
      }
      setTemplateOpen(false);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao salvar', error instanceof Error ? error.message : 'Revise os dados.');
    } finally {
      setBusy(null);
    }
  };

  const toggleTemplate = async (template: MessageTemplate) => {
    setBusy(`toggle-${template.id}`);
    try {
      await api.updateTemplate(template.id, { active: !template.active });
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao atualizar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const removeTemplate = async (template: MessageTemplate) => {
    if (!window.confirm(`Excluir o modelo "${template.name}"? Ele sai também das sequências.`)) return;
    setBusy(`del-${template.id}`);
    try {
      await api.deleteTemplate(template.id);
      notify('success', 'Modelo excluído', template.name);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao excluir', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const runGeneration = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('generate');
    try {
      const result = await api.generateTemplates({
        brief: generateForm.brief,
        category: generateForm.category,
        count: Number(generateForm.count) || 5,
        productId: generateForm.productId || null,
        save: true,
      });
      notify(
        'success',
        `${result.created.length} modelos criados`,
        'Todos ficam ativos e entram na rotação dos follow-ups.'
      );
      setGenerateOpen(false);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao gerar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const previewTemplate = async (template: MessageTemplate) => {
    setBusy(`preview-${template.id}`);
    try {
      const result = await api.previewTemplate({
        body: template.body,
        productId: state.products[0]?.id || null,
        botId: selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || null,
      });
      setPreview({ title: template.name, text: result.text });
      setPreviewTemplateObj(template);
    } catch (error) {
      notify('error', 'Falha no preview', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const openNewSequence = () => {
    setSequenceForm({
      botId: selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '',
      name: '',
      productId: state.products[0]?.id || '',
      steps: [{ templateId: activeTemplates[0]?.id || '', delayMinutes: 30 }],
      startsAt: '',
      endsAt: '',
      quietHoursStart: 8,
      quietHoursEnd: 22,
      maxMessagesPerLead: 3,
    });
    setSequenceOpen(true);
  };

  const saveSequence = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sequenceForm.botId) {
      notify('error', 'Sem bot', 'Conecte um bot antes de criar a sequência.');
      return;
    }
    if (sequenceForm.steps.some((step) => !step.templateId)) {
      notify('error', 'Passo sem modelo', 'Escolha um template em cada passo.');
      return;
    }
    setBusy('sequence');
    try {
      await api.createSequence({
        botId: sequenceForm.botId,
        name: sequenceForm.name,
        productId: sequenceForm.productId || null,
        active: true,
        steps: sequenceForm.steps,
        startsAt: sequenceForm.startsAt ? toIsoFromLocal(sequenceForm.startsAt) : null,
        endsAt: sequenceForm.endsAt ? toIsoFromLocal(sequenceForm.endsAt) : null,
        quietHoursStart: Number(sequenceForm.quietHoursStart),
        quietHoursEnd: Number(sequenceForm.quietHoursEnd),
        maxMessagesPerLead: Number(sequenceForm.maxMessagesPerLead),
        stopOnStatus: ['cliente', 'arquivado'],
      });
      notify('success', 'Sequência criada', 'Leads que pararem de responder entram automaticamente.');
      setSequenceOpen(false);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao criar', error instanceof Error ? error.message : 'Revise os dados.');
    } finally {
      setBusy(null);
    }
  };

  const toggleSequence = async (sequence: FollowUpSequence) => {
    setBusy(`seq-${sequence.id}`);
    try {
      await api.updateSequence(sequence.id, { active: !sequence.active });
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao atualizar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const removeSequence = async (sequence: FollowUpSequence) => {
    if (!window.confirm(`Excluir a sequência "${sequence.name}"?`)) return;
    setBusy(`delseq-${sequence.id}`);
    try {
      await api.deleteSequence(sequence.id);
      notify('success', 'Sequência excluída', sequence.name);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao excluir', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    setBusy('run');
    try {
      const result = await api.runAutomation();
      notify(
        'success',
        'Automação executada',
        `${result.followUps.sent} follow-ups enviados · ${result.followUps.failed} falhas · ${result.campaigns.executed} campanhas.`
      );
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao executar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Recuperação automática</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#8290a5]">
              Quando o lead para de responder, a sequência assume: envia o próximo modelo respeitando o
              intervalo, o horário de silêncio e a janela de datas. Qualquer resposta dele reinicia a contagem.
            </p>
          </div>
          <button type="button" onClick={runNow} disabled={busy === 'run'} className="btn-secondary text-xs">
            {busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rodar agora
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Leads em follow-up', value: formatNumber(automation.leadsInFollowUp), icon: Users },
            { label: 'Vencem em 24h', value: formatNumber(automation.dueIn24h), icon: Clock },
            { label: 'Modelos ativos', value: `${automation.templatesActive}/${automation.templatesTotal}`, icon: Sparkles },
            { label: 'Sequências ativas', value: `${automation.sequencesActive}/${automation.sequencesTotal}`, icon: Zap },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[#202836] bg-[#0c1017] px-3 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#6f7c91]">
                <item.icon className="h-3.5 w-3.5 text-[#d4f933]" />
                {item.label}
              </div>
              <div className="mt-1 text-xl font-bold text-white">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6f7c91]">
          <span>Próximo envio: <strong className="text-[#b9c2d0]">{automation.nextRunAt ? relativeTime(automation.nextRunAt) : '—'}</strong></span>
          <span>·</span>
          <span>Enviados hoje: <strong className="text-[#b9c2d0]">{automation.sentToday}</strong></span>
          {!state.settings.followUpEnabled && (
            <span className="text-amber-300">· Follow-up desativado nos Ajustes</span>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('templates')}
          className={tab === 'templates' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
        >
          <Sparkles className="h-3.5 w-3.5" /> Modelos ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('sequences')}
          className={tab === 'sequences' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
        >
          <Clock className="h-3.5 w-3.5" /> Sequências ({sequences.length})
        </button>
        <div className="ml-auto flex gap-2">
          {tab === 'templates' ? (
            <>
              <button type="button" onClick={() => setGenerateOpen(true)} className="btn-secondary text-xs">
                <Wand2 className="h-3.5 w-3.5" /> Gerar modelos
              </button>
              <button type="button" onClick={openNewTemplate} className="btn-primary text-xs">
                <Plus className="h-3.5 w-3.5" /> Novo modelo
              </button>
            </>
          ) : (
            <button type="button" onClick={openNewSequence} disabled={state.bots.length === 0} className="btn-primary text-xs">
              <Plus className="h-3.5 w-3.5" /> Nova sequência
            </button>
          )}
        </div>
      </div>

      {tab === 'templates' && (
        <section className="grid gap-3 lg:grid-cols-2">
          {templates.length === 0 && (
            <div className="card p-10 text-center lg:col-span-2">
              <Sparkles className="mx-auto h-8 w-8 text-[#5d6a7f]" />
              <h3 className="mt-3 text-sm font-bold text-white">Nenhum modelo ainda</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-[#7b879b]">
                Use &quot;Gerar modelos&quot; para criar várias variações prontas no estilo do seu atendimento,
                ou escreva o seu com <code className="text-[#d4f933]">{'{nome}'}</code>,{' '}
                <code className="text-[#d4f933]">{'{preco}'}</code> e <code className="text-[#d4f933]">{'{pix}'}</code>.
              </p>
            </div>
          )}
          {templates.map((template) => (
            <article key={template.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white">{template.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="badge border-[#2b3447] bg-[#171c26] text-[#9aa6ba]">
                      {categoryLabel(template.category)}
                    </span>
                    <span
                      className={`badge ${
                        template.active
                          ? 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]'
                          : 'border-[#2b3447] bg-[#171c26] text-[#7d899d]'
                      }`}
                    >
                      {template.active ? 'Ativo' : 'Pausado'}
                    </span>
                    {template.mediaMode === 'grid' && template.mediaGrid && template.mediaGrid.length > 0 && (
                      <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold">
                        📸 Grid ({template.mediaGrid.length})
                      </span>
                    )}
                    {template.mediaMode === 'single' && template.mediaUrl && (
                      <span className="badge border-sky-500/30 bg-sky-500/10 text-sky-300">
                        {template.mediaType === 'video' ? '🎬 Vídeo' : template.mediaType === 'animation' ? '✨ GIF' : '🖼️ Foto'}
                      </span>
                    )}
                    {template.buttons.length > 0 && (
                      <span className="badge border-purple-500/30 bg-purple-500/10 text-purple-300">
                        🎨 {template.buttons.length} botões
                      </span>
                    )}
                    <span className="text-[10px] text-[#657287]">{template.usageCount} envios</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void previewTemplate(template)}
                    className="rounded-lg p-2 text-[#7d899d] hover:bg-[#171c26] hover:text-white"
                    title="Ver como o lead recebe"
                  >
                    {busy === `preview-${template.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleTemplate(template)}
                    className="rounded-lg p-2 text-[#7d899d] hover:bg-[#171c26] hover:text-white"
                    title={template.active ? 'Pausar' : 'Ativar'}
                  >
                    {template.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditTemplate(template)}
                    className="rounded-lg px-2 text-[10px] font-semibold text-[#9aa6ba] hover:bg-[#171c26] hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeTemplate(template)}
                    className="rounded-lg p-2 text-[#657287] hover:bg-rose-400/10 hover:text-rose-300"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-[#9aa5b8]">
                {template.body}
              </p>
              {template.buttons.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {template.buttons.map((button, index) => {
                    const colorClass =
                      button.color === 'green'
                        ? 'bg-[#3b7c3d] text-white'
                        : button.color === 'purple'
                        ? 'bg-[#5b3c88] text-white'
                        : button.color === 'amber'
                        ? 'bg-[#c58b1d] text-black font-bold'
                        : button.color === 'red'
                        ? 'bg-[#a33232] text-white'
                        : 'bg-[#131923] text-[#aab4c4] border border-[#2b3447]';
                    return (
                      <span
                        key={`${template.id}-btn-${index}`}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-medium shadow-sm ${colorClass}`}
                      >
                        {button.text}
                      </span>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === 'sequences' && (
        <section className="space-y-3">
          {sequences.length === 0 && (
            <div className="card p-10 text-center">
              <Clock className="mx-auto h-8 w-8 text-[#5d6a7f]" />
              <h3 className="mt-3 text-sm font-bold text-white">Nenhuma sequência criada</h3>
              <p className="mx-auto mt-1 max-w-lg text-xs text-[#7b879b]">
                Monte uma escada de mensagens: 30 min, 4 h e 1 dia depois da última mensagem do lead, por exemplo.
                Cada passo usa um modelo diferente.
              </p>
              <button type="button" onClick={openNewSequence} disabled={state.bots.length === 0} className="btn-secondary mt-4 text-xs">
                <Plus className="h-3.5 w-3.5" /> Criar sequência
              </button>
            </div>
          )}
          {sequences.map((sequence) => {
            const bot = state.bots.find((item) => item.id === sequence.botId);
            const product = state.products.find((item) => item.id === sequence.productId);
            return (
              <article key={sequence.id} className="card p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{sequence.name}</h3>
                      <span className="badge border-[#2b3447] bg-[#171c26] text-[#9aa6ba]">@{bot?.username || 'bot'}</span>
                      <span
                        className={`badge ${
                          sequence.active
                            ? 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]'
                            : 'border-[#2b3447] bg-[#171c26] text-[#7d899d]'
                        }`}
                      >
                        {sequence.active ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#748196]">
                      <span>{sequence.steps.length} passos</span>
                      <span>·</span>
                      <span>Limite {sequence.maxMessagesPerLead} msgs/lead</span>
                      <span>·</span>
                      <span>Silêncio {sequence.quietHoursStart}h–{sequence.quietHoursEnd}h</span>
                      {product && (
                        <>
                          <span>·</span>
                          <span>Produto: <strong className="text-[#d4f933]">{product.name}</strong></span>
                        </>
                      )}
                    </div>
                    {(sequence.startsAt || sequence.endsAt) && (
                      <div className="mt-1 text-[10px] text-[#657287]">
                        Janela: {sequence.startsAt ? formatFullDate(sequence.startsAt) : 'sem início'} até{' '}
                        {sequence.endsAt ? formatFullDate(sequence.endsAt) : 'sem término'}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {sequence.steps.map((step, index) => {
                        const template = state.templates.find((item) => item.id === step.templateId);
                        return (
                          <span
                            key={`${sequence.id}-step-${index}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232b3a] bg-[#0d1118] px-2 py-1 text-[10px] text-[#9aa6ba]"
                          >
                            <span className="font-bold text-[#d4f933]">+{step.delayMinutes}min</span>
                            {template?.name || 'modelo removido'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void toggleSequence(sequence)} className="btn-secondary text-xs">
                      {sequence.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {sequence.active ? 'Pausar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSequence(sequence)}
                      className="rounded-xl p-2.5 text-[#657287] hover:bg-rose-400/10 hover:text-rose-300"
                      aria-label="Excluir sequência"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={editingTemplate ? 'Editar Modelo de Mensagem Avançado' : 'Novo Modelo de Mensagem Avançado'}
        description="Monte textos persuasivos, anexe mídias em grid interativo e crie botões de ação com cores personalizadas e preview 100% real do Telegram."
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setTemplateOpen(false)} className="btn-secondary text-xs">
              Cancelar
            </button>
            <button type="submit" form="template-form" disabled={busy === 'template'} className="btn-primary text-xs">
              {busy === 'template' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Salvar Modelo
            </button>
          </>
        }
      >
        <form id="template-form" onSubmit={saveTemplate} className="space-y-4">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Coluna Esquerda: Edição e Configurações */}
            <div className="space-y-4 xl:col-span-7">
              {/* Nome e Categoria */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="tpl-name">
                    Nome do Modelo
                  </label>
                  <input
                    id="tpl-name"
                    className="input text-xs"
                    value={templateForm.name}
                    onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })}
                    placeholder="Ex.: Teaser de Recuperação 35% OFF"
                    maxLength={80}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="tpl-cat">
                    Categoria do Funil
                  </label>
                  <select
                    id="tpl-cat"
                    className="input text-xs"
                    value={templateForm.category}
                    onChange={(event) =>
                      setTemplateForm({ ...templateForm, category: event.target.value as TemplateCategory })
                    }
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Texto da Mensagem */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0" htmlFor="tpl-body">
                    Texto da Mensagem
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-[#657287]">Atalhos rápidos:</span>
                    {['{nome}', '{preco}', '{pix}', '{link}'].map((shortcut) => (
                      <button
                        key={shortcut}
                        type="button"
                        onClick={() =>
                          setTemplateForm((prev) => ({ ...prev, body: prev.body + ' ' + shortcut }))
                        }
                        className="rounded border border-[#2b3547] bg-[#121824] px-1.5 py-0.5 text-[#d4f933] hover:border-[#d4f933]/50"
                      >
                        {shortcut}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  id="tpl-body"
                  className="input min-h-36 resize-y leading-relaxed text-xs font-sans"
                  value={templateForm.body}
                  onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })}
                  maxLength={4096}
                  placeholder="Escreva a mensagem envolvente aqui..."
                  required
                />
                <div className="mt-1 flex justify-between text-[10px] text-[#657287]">
                  <span>**negrito**, *itálico* e `código` funcionam nativamente no Telegram.</span>
                  <span>{templateForm.body.length}/4096</span>
                </div>
              </div>

              {/* Mídias & Grid Interativo 🖼️ */}
              <div className="rounded-2xl border border-[#242e3f] bg-[#0c1017] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2433] pb-2">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-[#d4f933]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Mídia & Grid de Imagens/Vídeos/GIFs
                    </span>
                  </div>
                  {/* Seletor de Modo de Mídia */}
                  <div className="flex rounded-lg border border-[#263246] bg-[#121722] p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTemplateForm((prev) => ({ ...prev, mediaMode: 'none' }))}
                      className={`rounded px-2.5 py-1 font-semibold transition ${
                        templateForm.mediaMode === 'none' ? 'bg-[#d4f933] text-black' : 'text-[#8292a8]'
                      }`}
                    >
                      Sem Mídia
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          mediaMode: 'single',
                          mediaType: prev.mediaType === 'none' ? 'photo' : prev.mediaType,
                        }))
                      }
                      className={`rounded px-2.5 py-1 font-semibold transition ${
                        templateForm.mediaMode === 'single' ? 'bg-[#d4f933] text-black' : 'text-[#8292a8]'
                      }`}
                    >
                      Mídia Única
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (templateForm.mediaGrid.length === 0) fillExampleHotGrid();
                        else setTemplateForm((prev) => ({ ...prev, mediaMode: 'grid' }));
                      }}
                      className={`rounded px-2.5 py-1 font-semibold transition ${
                        templateForm.mediaMode === 'grid' ? 'bg-[#d4f933] text-black' : 'text-[#8292a8]'
                      }`}
                    >
                      Grid Interativo 📸
                    </button>
                  </div>
                </div>

                {/* Opções de Mídia Única */}
                {templateForm.mediaMode === 'single' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase font-bold text-[#7e8ea4]">URL da Mídia (HTTPS)</label>
                        <input
                          value={templateForm.mediaUrl}
                          onChange={(e) => setTemplateForm({ ...templateForm, mediaUrl: e.target.value })}
                          placeholder="https://exemplo.com/foto.jpg ou .mp4 ou .gif"
                          className="input text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#7e8ea4]">Tipo da Mídia</label>
                        <select
                          value={templateForm.mediaType}
                          onChange={(e) =>
                            setTemplateForm({
                              ...templateForm,
                              mediaType: e.target.value as 'photo' | 'video' | 'animation',
                            })
                          }
                          className="input text-xs mt-1"
                        >
                          <option value="photo">Foto (JPEG/PNG)</option>
                          <option value="video">Vídeo (MP4)</option>
                          <option value="animation">GIF / Animação</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Opções de Grid Interativo */}
                {templateForm.mediaMode === 'grid' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[#93a2b7]">
                        Monte o layout do álbum do Telegram ({templateForm.mediaGrid.length} mídias):
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => addGridItem('photo')}
                          className="rounded-lg border border-[#2b3648] bg-[#141b27] px-2.5 py-1 text-[11px] font-bold text-[#d4f933] hover:bg-[#1a2333]"
                        >
                          + Foto
                        </button>
                        <button
                          type="button"
                          onClick={() => addGridItem('video')}
                          className="rounded-lg border border-[#2b3648] bg-[#141b27] px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:bg-[#1a2333]"
                        >
                          + Vídeo
                        </button>
                        <button
                          type="button"
                          onClick={fillExampleHotGrid}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"
                        >
                          Modelo Hot 🔥
                        </button>
                      </div>
                    </div>

                    {/* Lista dos Itens do Grid */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {templateForm.mediaGrid.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-[#202938] bg-[#111620] p-2"
                        >
                          <div className="flex items-center gap-1">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1a2230] font-mono text-[10px] font-bold text-[#8fa0b5]">
                              {idx + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => moveGridItem(idx, 'up')}
                                disabled={idx === 0}
                                className="text-[#64748b] hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveGridItem(idx, 'down')}
                                disabled={idx === templateForm.mediaGrid.length - 1}
                                className="text-[#64748b] hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Miniatura */}
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[#0a0d13] border border-[#2a3447]">
                            <img src={item.url} alt="Grid" className="h-full w-full object-cover" />
                          </div>

                          {/* Input URL */}
                          <input
                            value={item.url}
                            onChange={(e) => updateGridItem(item.id, { url: e.target.value })}
                            placeholder="URL da mídia"
                            className="input flex-1 min-w-[120px] text-[11px] py-1"
                          />

                          {/* Seletor de Posição Específica no Grid */}
                          <select
                            value={item.position || 'auto'}
                            onChange={(e) =>
                              updateGridItem(item.id, {
                                position: e.target.value as TemplateGridItem['position'],
                              })
                            }
                            className="rounded-lg border border-[#2a364a] bg-[#161c28] px-2 py-1 text-[11px] font-semibold text-[#d4f933]"
                          >
                            <option value="main-left">Principal (Esquerda)</option>
                            <option value="top-right">Superior Direita</option>
                            <option value="bottom-right">Inferior Direita</option>
                            <option value="auto">Automático</option>
                          </select>

                          {/* Remover */}
                          <button
                            type="button"
                            onClick={() => removeGridItem(item.id)}
                            className="rounded-lg p-1.5 text-[#657388] hover:bg-rose-400/10 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação Coloridos & Interativos 🎨 */}
              <div className="rounded-2xl border border-[#242e3f] bg-[#0c1017] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2433] pb-2">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-[#d4f933]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Botões de Ação Coloridos ({templateForm.buttons.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addButton}
                    disabled={templateForm.buttons.length >= 8}
                    className="btn-secondary text-xs py-1 px-2.5 font-bold text-[#d4f933] border-[#d4f933]/30"
                  >
                    + Adicionar Botão
                  </button>
                </div>

                {/* Lista de Botões */}
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {templateForm.buttons.map((btn) => (
                    <div
                      key={btn.id}
                      className="rounded-xl border border-[#202938] bg-[#111620] p-2.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Texto do Botão */}
                        <input
                          value={btn.text}
                          onChange={(e) => updateButton(btn.id, { text: e.target.value })}
                          placeholder="Texto do botão (ex.: 💎 PLANO VIP)"
                          className="input flex-1 min-w-[140px] text-xs py-1 font-semibold"
                        />

                        {/* Seletor de Cores Idêntico a outras funções */}
                        <div className="flex items-center gap-1">
                          {(['green', 'purple', 'amber', 'red', 'default'] as const).map((colorKey) => (
                            <button
                              key={colorKey}
                              type="button"
                              onClick={() => updateButton(btn.id, { color: colorKey })}
                              className={`h-5 w-5 rounded-full border-2 transition ${
                                btn.color === colorKey
                                  ? 'border-white scale-110 shadow'
                                  : 'border-transparent opacity-60 hover:opacity-100'
                              } ${
                                colorKey === 'green'
                                  ? 'bg-[#3b7c3d]'
                                  : colorKey === 'purple'
                                  ? 'bg-[#5b3c88]'
                                  : colorKey === 'amber'
                                  ? 'bg-[#c58b1d]'
                                  : colorKey === 'red'
                                  ? 'bg-[#a33232]'
                                  : 'bg-[#203246]'
                              }`}
                              title={`Cor: ${colorKey}`}
                            />
                          ))}
                        </div>

                        {/* Seletor de Linha */}
                        <select
                          value={btn.row}
                          onChange={(e) => updateButton(btn.id, { row: Number(e.target.value) || 0 })}
                          className="rounded-lg border border-[#2a364a] bg-[#161c28] px-2 py-1 text-[11px] font-semibold text-[#8ca0b5]"
                          title="Linha do botão"
                        >
                          <option value={0}>Linha 1</option>
                          <option value={1}>Linha 2</option>
                          <option value={2}>Linha 3</option>
                          <option value={3}>Linha 4</option>
                        </select>

                        {/* Remover Botão */}
                        <button
                          type="button"
                          onClick={() => removeButton(btn.id)}
                          className="rounded-lg p-1.5 text-[#657388] hover:bg-rose-400/10 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* URL ou Callback Data */}
                      <div className="flex gap-2">
                        <input
                          value={btn.url}
                          onChange={(e) => updateButton(btn.id, { url: e.target.value })}
                          placeholder="Link de compra ou checkout (https://...)"
                          className="input flex-1 text-[11px] py-1 border-[#1e2736]"
                        />
                        <input
                          value={btn.callbackData}
                          onChange={(e) => updateButton(btn.id, { callbackData: e.target.value })}
                          placeholder="Ou comando (ex: menu, vip)"
                          className="input w-36 text-[11px] py-1 border-[#1e2736]"
                        />
                      </div>
                    </div>
                  ))}

                  {templateForm.buttons.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#242e40] p-3 text-center text-xs text-[#73839b]">
                      Nenhum botão configurado. Clique em <b>+ Adicionar Botão</b> para criar botões interativos coloridos.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna Direita: Preview 100% Realista do Telegram */}
            <div className="xl:col-span-5">
              <div className="sticky top-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#d4f933] flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Preview 100% Realista no Telegram
                  </span>
                  <span className="text-[10px] text-[#718298]">Visão do Lead no Celular</span>
                </div>

                <div className="rounded-2xl border border-[#252f40] bg-[#090c12] p-3 shadow-xl">
                  <TelegramPreview
                    botName={currentBot ? `@${currentBot.username}` : 'Modelo Hot VIP 💋'}
                    botAvatar={currentBot?.avatarUrl}
                    text={templateForm.body}
                    mediaUrl={templateForm.mediaMode === 'single' ? templateForm.mediaUrl : undefined}
                    mediaType={templateForm.mediaMode === 'single' ? templateForm.mediaType : undefined}
                    mediaGrid={
                      templateForm.mediaMode === 'grid' && templateForm.mediaGrid.length >= 2
                        ? templateForm.mediaGrid
                        : undefined
                    }
                    buttons={templateForm.buttons.map((b) => ({
                      text: b.text,
                      url: b.url || undefined,
                      callbackData: b.callbackData || undefined,
                      color: b.color,
                      row: b.row,
                    }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Gerar modelos"
        description="O gerador combina arquétipos de copy + spintax para criar variações prontas."
        footer={
          <>
            <button type="button" onClick={() => setGenerateOpen(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" form="generate-form" disabled={busy === 'generate'} className="btn-primary text-xs">
              {busy === 'generate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Gerar
            </button>
          </>
        }
      >
        <form id="generate-form" onSubmit={runGeneration} className="space-y-3">
          <div>
            <label className="label" htmlFor="gen-brief">Briefing da oferta</label>
            <input
              id="gen-brief"
              className="input"
              value={generateForm.brief}
              onChange={(event) => setGenerateForm({ ...generateForm, brief: event.target.value })}
              placeholder="Ex.: acesso vitalício por R$ 7,90 com grupo e vídeos extras"
              maxLength={400}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="gen-cat">Categoria</label>
              <select
                id="gen-cat"
                className="input"
                value={generateForm.category}
                onChange={(event) =>
                  setGenerateForm({ ...generateForm, category: event.target.value as TemplateCategory })
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="gen-count">Quantidade</label>
              <input
                id="gen-count"
                type="number"
                min={1}
                max={20}
                className="input"
                value={generateForm.count}
                onChange={(event) => setGenerateForm({ ...generateForm, count: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="gen-product">Produto</label>
              <select
                id="gen-product"
                className="input"
                value={generateForm.productId}
                onChange={(event) => setGenerateForm({ ...generateForm, productId: event.target.value })}
              >
                <option value="">Sem produto</option>
                {state.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-[#252e3f] bg-[#0d1017] p-3 text-[11px] leading-relaxed text-[#768398]">
            Cada modelo gerado entra ativo e passa a concorrer na rotação por peso. Você pode editar ou pausar
            qualquer um depois.
          </div>
        </form>
      </Modal>

      <Modal
        open={sequenceOpen}
        onClose={() => setSequenceOpen(false)}
        title="Nova sequência de recuperação"
        description="Escolha o intervalo e o modelo de cada passo."
        footer={
          <>
            <button type="button" onClick={() => setSequenceOpen(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" form="sequence-form" disabled={busy === 'sequence'} className="btn-primary text-xs">
              {busy === 'sequence' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Criar sequência
            </button>
          </>
        }
      >
        <form id="sequence-form" onSubmit={saveSequence} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="seq-bot">Bot</label>
              <select
                id="seq-bot"
                className="input"
                value={sequenceForm.botId}
                onChange={(event) => setSequenceForm({ ...sequenceForm, botId: event.target.value })}
              >
                {state.bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>@{bot.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="seq-name">Nome</label>
              <input
                id="seq-name"
                className="input"
                value={sequenceForm.name}
                onChange={(event) => setSequenceForm({ ...sequenceForm, name: event.target.value })}
                placeholder="Ex.: Recuperação 3 toques"
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="seq-product">Produto (preenche {'{preco}'} e {'{pix}'})</label>
            <select
              id="seq-product"
              className="input"
              value={sequenceForm.productId}
              onChange={(event) => setSequenceForm({ ...sequenceForm, productId: event.target.value })}
            >
              <option value="">Sem produto</option>
              {state.products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label mb-0">Passos</span>
              <button
                type="button"
                onClick={() =>
                  setSequenceForm({
                    ...sequenceForm,
                    steps: [
                      ...sequenceForm.steps,
                      {
                        templateId: activeTemplates[0]?.id || '',
                        delayMinutes: sequenceForm.steps.length === 0 ? 30 : 240,
                      },
                    ],
                  })
                }
                className="btn-secondary text-[10px]"
              >
                <Plus className="h-3 w-3" /> Adicionar passo
              </button>
            </div>
            {sequenceForm.steps.map((step, index) => (
              <div key={`step-${index}`} className="grid gap-2 rounded-xl border border-[#232b3a] bg-[#0c1017] p-2 sm:grid-cols-[1fr_120px_40px]">
                <select
                  className="input"
                  value={step.templateId}
                  onChange={(event) => {
                    const steps = [...sequenceForm.steps];
                    steps[index] = { ...steps[index], templateId: event.target.value };
                    setSequenceForm({ ...sequenceForm, steps });
                  }}
                >
                  <option value="">Escolha o modelo</option>
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {categoryLabel(template.category)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={43200}
                    className="input"
                    value={step.delayMinutes}
                    onChange={(event) => {
                      const steps = [...sequenceForm.steps];
                      steps[index] = { ...steps[index], delayMinutes: Number(event.target.value) };
                      setSequenceForm({ ...sequenceForm, steps });
                    }}
                  />
                  <span className="text-[10px] text-[#657287]">min</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSequenceForm({
                      ...sequenceForm,
                      steps: sequenceForm.steps.filter((_, position) => position !== index),
                    })
                  }
                  disabled={sequenceForm.steps.length === 1}
                  className="rounded-lg p-2 text-[#657287] hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"
                  aria-label="Remover passo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="seq-start">Início (opcional)</label>
              <input
                id="seq-start"
                type="datetime-local"
                className="input"
                value={sequenceForm.startsAt}
                onChange={(event) => setSequenceForm({ ...sequenceForm, startsAt: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="seq-end">Término (opcional)</label>
              <input
                id="seq-end"
                type="datetime-local"
                className="input"
                value={sequenceForm.endsAt}
                onChange={(event) => setSequenceForm({ ...sequenceForm, endsAt: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="seq-qstart">Silêncio de</label>
              <input
                id="seq-qstart"
                type="number"
                min={0}
                max={23}
                className="input"
                value={sequenceForm.quietHoursStart}
                onChange={(event) => setSequenceForm({ ...sequenceForm, quietHoursStart: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="seq-qend">Silêncio até</label>
              <input
                id="seq-qend"
                type="number"
                min={0}
                max={23}
                className="input"
                value={sequenceForm.quietHoursEnd}
                onChange={(event) => setSequenceForm({ ...sequenceForm, quietHoursEnd: Number(event.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="seq-max">Máx. por lead</label>
              <input
                id="seq-max"
                type="number"
                min={1}
                max={20}
                className="input"
                value={sequenceForm.maxMessagesPerLead}
                onChange={(event) => setSequenceForm({ ...sequenceForm, maxMessagesPerLead: Number(event.target.value) })}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#657287]">
            Horário de silêncio usa o fuso {state.settings.timezone || 'America/Sao_Paulo'} dos Ajustes. Fora dele o
            envio é reprogramado para o próximo horário permitido.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(preview)}
        onClose={() => {
          setPreview(null);
          setPreviewTemplateObj(null);
        }}
        title={preview?.title || 'Prévia Realista no Telegram'}
        description="É exatamente assim com balão escuro, botões coloridos e mídias que o lead recebe no celular."
        footer={
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setPreviewTemplateObj(null);
            }}
            className="btn-secondary text-xs"
          >
            Fechar
          </button>
        }
      >
        <div className="rounded-2xl border border-[#232b3a] bg-[#0b0f14] p-4 flex justify-center">
          <TelegramPreview
            botName={currentBot ? `@${currentBot.username}` : 'Modelo Hot VIP 💋'}
            botAvatar={currentBot?.avatarUrl}
            text={preview?.text || ''}
            mediaUrl={previewTemplateObj?.mediaMode === 'single' ? previewTemplateObj.mediaUrl : undefined}
            mediaType={previewTemplateObj?.mediaMode === 'single' ? previewTemplateObj.mediaType : undefined}
            mediaGrid={
              previewTemplateObj?.mediaMode === 'grid' &&
              previewTemplateObj.mediaGrid &&
              previewTemplateObj.mediaGrid.length >= 2
                ? previewTemplateObj.mediaGrid
                : undefined
            }
            buttons={previewTemplateObj?.buttons?.map((b) => ({
              text: b.text,
              url: b.url || undefined,
              callbackData: b.callbackData || undefined,
              color: b.color,
              row: b.row,
            }))}
          />
        </div>
      </Modal>
    </div>
  );
}
