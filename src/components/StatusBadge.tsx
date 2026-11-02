import React from 'react';
import type { LeadStatus } from '@shared/types';
import { statusClass, statusLabel } from '../lib/format';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

export function Dot({ tone = 'lime' }: { tone?: 'lime' | 'red' | 'amber' | 'slate' }) {
  const colors = {
    lime: 'bg-[#d4f933] shadow-[0_0_0_3px_rgba(212,249,51,0.12)]',
    red: 'bg-rose-400 shadow-[0_0_0_3px_rgba(251,113,133,0.12)]',
    amber: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]',
    slate: 'bg-slate-500',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[tone]}`} aria-hidden="true" />;
}
