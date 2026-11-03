import React, { useState } from 'react';
import {
  Bot,
  CalendarClock,
  CreditCard,
  FileVideo,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Send,
  Settings,
  Sparkles,
  Users,
  X,
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
  studio: FileVideo,
  automacao: Sparkles,
  campaigns: CalendarClock,
  vendas: CreditCard,
  settings: Settings,
};

const MAIN_MOBILE_TABS: NavTab[] = ['dashboard', 'bots', 'leads', 'vendas'];
const MORE_MOBILE_TABS: NavTab[] = ['messages', 'studio', 'automacao', 'campaigns', 'settings'];

export function Sidebar({ activeTab, onChange, newLeads }: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMoreActive = MORE_MOBILE_TABS.includes(activeTab);

  return (
    <>
      {/* Desktop Sidebar */}
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

      {/* Drawer / Popover de Mais Opções no Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t border-[#293246] bg-[#10141d] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#212838] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#909cb2]">Outros Módulos</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1 text-[#78859b] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {MORE_MOBILE_TABS.map((tabId) => {
                const item = NAV_ITEMS.find((n) => n.id === tabId)!;
                const Icon = icons[tabId];
                const active = activeTab === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => {
                      onChange(tabId);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      active
                        ? 'border-[#d4f933]/50 bg-[#d4f933]/15 text-[#d4f933]'
                        : 'border-[#232b3c] bg-[#141a25] text-[#b0bbcb] hover:border-[#38455e]'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation - 5 botões perfeitos e ergonômicos */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#202736] bg-[#0b0e14]/95 px-1 py-1.5 backdrop-blur md:hidden">
        {MAIN_MOBILE_TABS.map((tabId) => {
          const item = NAV_ITEMS.find((n) => n.id === tabId)!;
          const Icon = icons[tabId];
          const active = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => onChange(tabId)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-semibold transition ${
                active ? 'text-[#d4f933]' : 'text-[#6f7c91]'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  active ? 'bg-[#d4f933]/15 text-[#d4f933]' : ''
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="truncate">{item.label}</span>
              {tabId === 'leads' && newLeads > 0 && (
                <span className="absolute right-3 top-1 h-1.5 w-1.5 rounded-full bg-[#d4f933]" />
              )}
            </button>
          );
        })}

        {/* Botão Mais */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-semibold transition ${
            isMoreActive ? 'text-[#d4f933]' : 'text-[#6f7c91]'
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
              isMoreActive ? 'bg-[#d4f933]/15 text-[#d4f933]' : ''
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </div>
          <span className="truncate">Mais</span>
          {isMoreActive && (
            <span className="absolute bottom-0 h-0.5 w-3 rounded-full bg-[#d4f933]" />
          )}
        </button>
      </nav>
    </>
  );
}
