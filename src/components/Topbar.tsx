import React from 'react';
import { ChevronDown, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Bot } from '@shared/types';
import type { NavTab } from '../lib/nav';
import { NAV_ITEMS } from '../lib/nav';
import { Dot } from './StatusBadge';
import { relativeTime } from '../lib/format';

interface TopbarProps {
  tab: NavTab;
  bots: Bot[];
  selectedBotId: string;
  onSelectBot: (id: string) => void;
  onSync: () => void;
  syncing: boolean;
  lastSync: string | null;
  connected: boolean;
}

export function Topbar({
  tab,
  bots,
  selectedBotId,
  onSelectBot,
  onSync,
  syncing,
  lastSync,
  connected,
}: TopbarProps) {
  const meta = NAV_ITEMS.find((item) => item.id === tab) || NAV_ITEMS[0];
  const selected = bots.find((bot) => bot.id === selectedBotId);

  return (
    <header className="sticky top-0 z-30 border-b border-[#1b202b] bg-[#0b0d11]/88 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
              {meta.title}
            </h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-[#293246] bg-[#11151d] px-2 py-0.5 text-[10px] font-semibold text-[#9aa5b9] sm:inline-flex">
              <Dot tone={connected ? 'lime' : 'slate'} />
              {connected ? 'Servidor online' : 'Sem conexão'}
            </span>
          </div>
          <p className="hidden truncate text-xs text-[#7e899d] sm:block">{meta.subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {bots.length > 0 && (
            <div className="relative block">
              <select
                value={selectedBotId}
                onChange={(event) => onSelectBot(event.target.value)}
                className="h-9 max-w-[128px] appearance-none rounded-xl border border-[#293246] bg-[#121722] pl-3 pr-8 text-[11px] font-semibold text-[#dce2ee] focus:border-[#d4f933] focus:outline-none sm:h-10 sm:max-w-[200px] sm:pr-9 sm:text-xs"
                aria-label="Filtrar por bot"
              >
                <option value="all">Todos os bots</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    @{bot.username}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#77839a]" />
            </div>
          )}

          {selected && (
            <span className="hidden items-center gap-1.5 rounded-xl border border-[#293246] bg-[#121722] px-2.5 py-2 text-[11px] font-medium text-[#a7b1c4] lg:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-[#d4f933]" />
              @{selected.username}
            </span>
          )}

          <button
            type="button"
            onClick={onSync}
            disabled={syncing || bots.length === 0}
            className="btn-secondary h-10 px-3 text-xs"
            title={lastSync ? `Última sincronização: ${relativeTime(lastSync)}` : 'Sincronizar agora'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
