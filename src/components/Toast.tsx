import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (tone: ToastTone, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((tone: ToastTone, title: string, description?: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-3), { id, tone, title, description }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
          const color =
            item.tone === 'success'
              ? 'border-[#d4f933]/30 text-[#d4f933]'
              : item.tone === 'error'
              ? 'border-rose-400/30 text-rose-300'
              : 'border-sky-400/30 text-sky-300';
          return (
            <div
              key={item.id}
              className={`animate-fade-up pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[#11151e]/95 p-3.5 shadow-2xl backdrop-blur ${color}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{item.title}</div>
                {item.description && <div className="mt-0.5 text-xs text-[#9aa4b8]">{item.description}</div>}
              </div>
              <button
                type="button"
                className="text-[#6f7b90] hover:text-white"
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                aria-label="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider.');
  return context;
}
