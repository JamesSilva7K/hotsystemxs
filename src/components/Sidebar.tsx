import React from 'react';
import {
  Bot,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Send,
  Settings,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import type { NavTab } from '../lib/nav';
import { NAV_ITEMS } from '../lib/nav';

interface SidebarProps {
  activeTab: NavTab;
  onChange: (tab: NavTab) => void;
  newLeads: number;
}

const icons = {
  dashboard: LayoutDashboard,
  bots: Bot,
  leads: Users,
  messages: Send,
  automacao: Sparkles,
  campaigns: CalendarClock,
  vendas: CreditCard,
  settings: Settings,
};

export function Sidebar({ activeTab, onChange, newLeads }: SidebarProps) {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col items-center border-r border-[#1b202b] bg-[#0a0c10]/95 px-3 py-5 backdrop-blur md:flex">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2a3345] bg-[#121722] text-[#d4f933] shadow-[0_0_30px_rgba(212,249,51,0.08)]">
          <Zap className="h-6 w-6 fill-current" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = icons[item.id];
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  active
                    ? 'bg-[#d4f933] text-[#080a0e] shadow-lg shadow-[#d4f933]/15'
                    : 'text-[#738096] hover:bg-[#171c27] hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.id === 'leads' && newLeads > 0 && !active && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#d4f933]" />
                )}
                <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-[#2b3447] bg-[#161b25] px-2.5 py-1 text-xs font-medium text-white shadow-xl group-hover:block">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="mt-4 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[#3e485d]">
          v2
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#202736] bg-[#0b0e14]/95 px-2 py-2 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = icons[item.id];
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold ${
                active ? 'text-[#d4f933]' : 'text-[#6f7c91]'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
              {item.id === 'leads' && newLeads > 0 && (
                <span className="absolute right-3 top-0.5 h-1.5 w-1.5 rounded-full bg-[#d4f933]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
