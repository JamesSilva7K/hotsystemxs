import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import type { AppState, Lead } from '@shared/types';
import { ApiError, api } from './lib/api';
import type { NavTab } from './lib/nav';
import { NAV_ITEMS } from './lib/nav';
import { Dashboard } from './components/Dashboard';
import { Bots } from './components/Bots';
import { Leads } from './components/Leads';
import { Messages } from './components/Messages';
import { Campaigns } from './components/Campaigns';
import { Automation } from './components/Automation';
import { Sales } from './components/Sales';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Login } from './components/Login';
import { useToast } from './components/Toast';

export default function App() {
  const { notify } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTabState] = useState<NavTab>(() => {
    const hash = window.location.hash.replace('#', '');
    return NAV_ITEMS.some((item) => item.id === hash) ? (hash as NavTab) : 'dashboard';
  });
  const [selectedBotId, setSelectedBotId] = useState(
    () => window.localStorage.getItem('hot-system:selected-bot') || 'all'
  );
  const [syncing, setSyncing] = useState(false);
  const [composerLead, setComposerLead] = useState<Lead | null>(null);
  const loadSeq = useRef(0);

  const setTab = useCallback((next: NavTab) => {
    setTabState(next);
    window.history.replaceState(null, '', `#${next}`);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (NAV_ITEMS.some((item) => item.id === hash)) setTabState(hash as NavTab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadState = useCallback(async (silent = false) => {
    const sequence = ++loadSeq.current;
    try {
      const data = await api.state();
      if (sequence !== loadSeq.current) return;
      setState(data);
      setLoadError('');
      setAuthenticated(true);
      setSelectedBotId((current) => {
        if (current === 'all') return current;
        return data.bots.some((bot) => bot.id === current) ? current : 'all';
      });
    } catch (error) {
      if (sequence !== loadSeq.current) return;
      if (error instanceof ApiError && error.status === 401) {
        setAuthenticated(false);
        setState(null);
      } else if (!silent) {
        setLoadError(error instanceof Error ? error.message : 'Falha ao carregar o painel.');
      } else {
        setLoadError(error instanceof Error ? error.message : 'Servidor indisponível.');
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.authStatus();
        if (cancelled) return;
        if (!status.passwordProtected || status.authenticated) {
          setAuthenticated(true);
          await loadState();
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Servidor indisponível.');
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadState]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadState(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [authenticated, loadState]);

  useEffect(() => {
    window.localStorage.setItem('hot-system:selected-bot', selectedBotId);
  }, [selectedBotId]);

  const syncAll = async () => {
    if (!state || state.bots.length === 0) return;
    setSyncing(true);
    try {
      const result = await api.syncAll();
      loadSeq.current += 1;
      setState(result.state);
      const processed = result.results.reduce((sum, item) => sum + item.processed, 0);
      const leads = result.results.reduce((sum, item) => sum + item.leads, 0);
      const failures = result.results.filter((item) => item.error);
      if (failures.length > 0) {
        notify(
          'info',
          'Sincronização parcial',
          `${processed} atualizações e ${leads} novos leads. ${failures[0]?.error || ''}`
        );
      } else {
        notify('success', 'Sincronização concluída', `${processed} atualizações processadas, ${leads} novos leads.`);
      }
    } catch (error) {
      notify('error', 'Falha ao sincronizar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSyncing(false);
    }
  };

  const newLeads = useMemo(() => {
    if (!state) return 0;
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    return state.leads.filter((lead) => lead.firstContactAt >= since).length;
  }, [state]);

  const lastSync = useMemo(() => {
    if (!state) return null;
    return (
      state.bots
        .map((bot) => bot.lastSyncAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null
    );
  }, [state]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#7e8b9f]">
          <Loader2 className="h-7 w-7 animate-spin text-[#d4f933]" />
          <span className="text-xs font-medium">Carregando painel…</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onSuccess={() => void loadState()} />;
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-300" />
          <h1 className="mt-3 text-base font-bold text-white">Não foi possível carregar o painel</h1>
          <p className="mt-1 text-xs leading-relaxed text-[#7e8b9f]">
            {loadError || 'Verifique se o servidor está em execução e tente novamente.'}
          </p>
          <button type="button" onClick={() => void loadState()} className="btn-primary mt-4 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const content = (() => {
    switch (tab) {
      case 'bots':
        return <Bots state={state} refresh={() => loadState()} onNavigate={setTab} />;
      case 'leads':
        return (
          <Leads
            state={state}
            selectedBotId={selectedBotId}
            refresh={() => loadState()}
            onCompose={(lead) => {
              setComposerLead(lead);
              setTab('messages');
            }}
          />
        );
      case 'messages':
        return (
          <Messages
            state={state}
            selectedBotId={selectedBotId}
            initialLead={composerLead}
            onConsumeLead={() => setComposerLead(null)}
            refresh={() => loadState()}
          />
        );
      case 'automacao':
        return <Automation state={state} selectedBotId={selectedBotId} refresh={() => loadState()} />;
      case 'campaigns':
        return <Campaigns state={state} selectedBotId={selectedBotId} refresh={() => loadState()} />;
      case 'vendas':
        return <Sales state={state} selectedBotId={selectedBotId} refresh={() => loadState()} />;
      case 'settings':
        return (
          <SettingsView
            state={state}
            refresh={() => loadState()}
            onLogout={() => {
              setAuthenticated(false);
              setState(null);
            }}
          />
        );
      default:
        return (
          <Dashboard
            state={state}
            selectedBotId={selectedBotId}
            onNavigate={setTab}
            onSync={syncAll}
            syncing={syncing}
          />
        );
    }
  })();

  return (
    <div className="flex min-h-screen">
      <Sidebar activeTab={tab} onChange={setTab} newLeads={newLeads} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          tab={tab}
          bots={state.bots}
          selectedBotId={selectedBotId}
          onSelectBot={setSelectedBotId}
          onSync={syncAll}
          syncing={syncing}
          lastSync={lastSync}
          connected={!loadError}
        />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
          {loadError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {loadError}
            </div>
          )}
          {content}
        </main>
      </div>
    </div>
  );
}
