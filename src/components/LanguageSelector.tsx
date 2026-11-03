import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type LanguageCode = 'pt' | 'en' | 'es';

interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flagSvg: React.ReactNode;
}

export const FlagBrasil = ({ className = 'w-5 h-3.5' }: { className?: string }) => (
  <svg className={`shrink-0 rounded-[2px] shadow-sm ${className}`} viewBox="0 0 720 504" fill="none">
    <rect width="720" height="504" fill="#009b3a" />
    <polygon points="360,42 660,252 360,462 60,252" fill="#fedf00" />
    <circle cx="360" cy="252" r="126" fill="#002776" />
    <path
      d="M234,252 A126,126 0 0,0 486,252 A126,108 0 0,1 234,252"
      fill="#ffffff"
    />
  </svg>
);

export const FlagUSA = ({ className = 'w-5 h-3.5' }: { className?: string }) => (
  <svg className={`shrink-0 rounded-[2px] shadow-sm ${className}`} viewBox="0 0 720 504" fill="none">
    <rect width="720" height="504" fill="#b22234" />
    <path d="M0,38.77 h720 M0,116.31 h720 M0,193.85 h720 M0,271.38 h720 M0,348.92 h720 M0,426.46 h720" stroke="#ffffff" strokeWidth="38.77" />
    <rect width="288" height="271.38" fill="#3c3b6e" />
    <g fill="#ffffff">
      <circle cx="48" cy="45" r="8" />
      <circle cx="96" cy="45" r="8" />
      <circle cx="144" cy="45" r="8" />
      <circle cx="192" cy="45" r="8" />
      <circle cx="240" cy="45" r="8" />
      <circle cx="72" cy="90" r="8" />
      <circle cx="120" cy="90" r="8" />
      <circle cx="168" cy="90" r="8" />
      <circle cx="216" cy="90" r="8" />
      <circle cx="48" cy="135" r="8" />
      <circle cx="96" cy="135" r="8" />
      <circle cx="144" cy="135" r="8" />
      <circle cx="192" cy="135" r="8" />
      <circle cx="240" cy="135" r="8" />
      <circle cx="72" cy="180" r="8" />
      <circle cx="120" cy="180" r="8" />
      <circle cx="168" cy="180" r="8" />
      <circle cx="216" cy="180" r="8" />
      <circle cx="48" cy="225" r="8" />
      <circle cx="96" cy="225" r="8" />
      <circle cx="144" cy="225" r="8" />
      <circle cx="192" cy="225" r="8" />
      <circle cx="240" cy="225" r="8" />
    </g>
  </svg>
);

export const FlagEspanha = ({ className = 'w-5 h-3.5' }: { className?: string }) => (
  <svg className={`shrink-0 rounded-[2px] shadow-sm ${className}`} viewBox="0 0 720 504" fill="none">
    <rect width="720" height="126" fill="#aa151b" />
    <rect y="126" width="720" height="252" fill="#f1bf00" />
    <rect y="378" width="720" height="126" fill="#aa151b" />
    {/* Escudo estilizado */}
    <circle cx="180" cy="252" r="32" fill="#aa151b" opacity="0.85" />
    <rect x="168" y="235" width="24" height="34" rx="4" fill="#ffffff" opacity="0.9" />
  </svg>
);

export const LANGUAGES: LanguageOption[] = [
  {
    code: 'pt',
    name: 'Português',
    nativeName: 'Brasil',
    flagSvg: <FlagBrasil className="h-4 w-6" />,
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'Global / USA',
    flagSvg: <FlagUSA className="h-4 w-6" />,
  },
  {
    code: 'es',
    name: 'Español',
    nativeName: 'Hispanoamérica',
    flagSvg: <FlagEspanha className="h-4 w-6" />,
  },
];

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
  className?: string;
}

export function LanguageSelector({ value, onChange, className = '' }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = LANGUAGES.find((l) => l.code === value) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 180);
    }
    setOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className={`relative ${open ? 'z-50' : 'z-20'} ${className}`}>
      {/* Botão Gatilho com a Bandeira em Vetor */}
      <button
        type="button"
        onClick={toggleDropdown}
        className="flex h-10 w-full items-center justify-between gap-2.5 rounded-xl border border-[#273244] bg-[#121722] px-3 py-2 text-left text-xs font-semibold text-white transition hover:border-[#d4f933]/50 focus:border-[#d4f933] focus:outline-none"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selected.flagSvg}
          <div className="flex items-baseline gap-1 truncate">
            <span className="font-bold text-white">{selected.name}</span>
            <span className="text-[10px] text-[#718299]">({selected.nativeName})</span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#718299] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu Dropdown com Bandeiras Vetoriais */}
      {open && (
        <div
          className={`absolute left-0 z-[100] w-full min-w-[220px] rounded-xl border border-[#2e3b50] bg-[#0c1017] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.9)] ring-1 ring-white/10 backdrop-blur-xl ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <div className="space-y-1">
            {LANGUAGES.map((item) => {
              const active = item.code === value;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs transition ${
                    active
                      ? 'border border-[#d4f933]/30 bg-[#d4f933]/15 text-[#d4f933]'
                      : 'text-[#ccd6e4] hover:bg-[#18202d] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.flagSvg}
                    <div className="flex flex-col text-left">
                      <span className="font-bold">{item.name}</span>
                      <span className="text-[10px] text-[#7e8fa6]">{item.nativeName}</span>
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-[#d4f933]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

