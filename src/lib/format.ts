import type { CampaignAudience, LeadStatus } from '@shared/types';

export const LEAD_STATUSES: LeadStatus[] = [
  'novo',
  'interessado',
  'qualificado',
  'cliente',
  'arquivado',
];

const statusLabels: Record<LeadStatus, string> = {
  novo: 'Novo',
  interessado: 'Interessado',
  qualificado: 'Qualificado',
  cliente: 'Cliente',
  arquivado: 'Arquivado',
};

const statusClasses: Record<LeadStatus, string> = {
  novo: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  interessado: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  qualificado: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
  cliente: 'border-[#d4f933]/30 bg-[#d4f933]/10 text-[#d4f933]',
  arquivado: 'border-slate-500/25 bg-slate-500/10 text-slate-400',
};

export function statusLabel(status: LeadStatus): string {
  return statusLabels[status] || status;
}

export function statusClass(status: LeadStatus): string {
  return statusClasses[status] || statusClasses.novo;
}

export function audienceLabel(audience: CampaignAudience): string {
  if (audience === 'all') return 'Todos os leads';
  return statusLabels[audience] || audience;
}

export function initials(name: string): string {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
}

export function plural(value: number, singular: string, pluralForm: string): string {
  return `${formatNumber(value)} ${value === 1 ? singular : pluralForm}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const date = new Date(iso).getTime();
  if (!Number.isFinite(date)) return 'nunca';
  const diff = Date.now() - date;
  if (diff < 45_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h atrás`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} d atrás`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

export function truncate(value: string, length = 70): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

export function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function toIsoFromLocal(value: string): string {
  return new Date(value).toISOString();
}

export function formatBRL(cents: number): string {
  return (Math.round(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell ?? '');
          if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(',')
    )
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
