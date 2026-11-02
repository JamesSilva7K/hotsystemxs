import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import type { AppState, FollowUpSequence, MessageTemplate, TemplateCategory } from '@shared/types';
import { api } from '../lib/api';
import { formatFullDate, formatNumber, localDateTimeValue, relativeTime, toIsoFromLocal } from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';

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
  });

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
    setTemplateForm({ name: '', category: 'reengajamento', body: '', weight: 1 });
    setTemplateOpen(true);
  };

  const openEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      body: template.body,
      weight: template.weight,
    });
    setTemplateOpen(true);
  };

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('template');
    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, templateForm);
        notify('success', 'Template atualizado', templateForm.name);
      } else {
        await api.createTemplate(templateForm);
        notify('success', 'Template criado', 'Já pode ser usado nos passos de follow-up.');
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
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {template.buttons.map((button, index) => (
                    <span key={`${template.id}-btn-${index}`} className="badge border-[#2b3447] bg-[#131923] text-[#aab4c4]">
                      {button.text}
                    </span>
                  ))}
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
        title={editingTemplate ? 'Editar modelo' : 'Novo modelo'}
        description="Use {nome}, {preco}, {pix}, {link} e spintax {oi|olá} para variar automaticamente."
        footer={
          <>
            <button type="button" onClick={() => setTemplateOpen(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" form="template-form" disabled={busy === 'template'} className="btn-primary text-xs">
              {busy === 'template' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Salvar modelo
            </button>
          </>
        }
      >
        <form id="template-form" onSubmit={saveTemplate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="tpl-name">Nome</label>
              <input
                id="tpl-name"
                className="input"
                value={templateForm.name}
                onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })}
                placeholder="Ex.: Sumiu no meio"
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="tpl-cat">Categoria</label>
              <select
                id="tpl-cat"
                className="input"
                value={templateForm.category}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, category: event.target.value as TemplateCategory })
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="tpl-body">Mensagem</label>
            <textarea
              id="tpl-body"
              className="input min-h-48 resize-y leading-relaxed"
              value={templateForm.body}
              onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })}
              maxLength={4096}
              required
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#657287]">
              <span>**negrito** e `código` funcionam no Telegram.</span>
              <span>{templateForm.body.length}/4096</span>
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
        onClose={() => setPreview(null)}
        title={preview?.title || 'Prévia'}
        description="É exatamente assim que a mensagem chega no Telegram."
        footer={<button type="button" onClick={() => setPreview(null)} className="btn-secondary text-xs">Fechar</button>}
      >
        <div className="rounded-2xl border border-[#232b3a] bg-[#0b0f14] p-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#e6ebf2]">{preview?.text}</p>
        </div>
      </Modal>
    </div>
  );
}
