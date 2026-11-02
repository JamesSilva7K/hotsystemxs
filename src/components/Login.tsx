import React, { useState } from 'react';
import { LockKeyhole, Loader2, Zap } from 'lucide-react';
import { api } from '../lib/api';

interface LoginProps {
  onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#33405a] bg-[#141a25] text-[#d4f933] shadow-[0_0_40px_rgba(212,249,51,0.1)]">
            <Zap className="h-7 w-7 fill-current" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Hot System</h1>
          <p className="mt-1 text-sm text-[#8c97aa]">Acesso restrito ao painel de leads</p>
        </div>

        <form onSubmit={submit} className="card p-6">
          <label className="label" htmlFor="password">
            Senha do painel
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69758b]" />
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input pl-9"
              placeholder="Digite a senha configurada"
            />
          </div>
          {error && (
            <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading || !password} className="btn-primary mt-4 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar no painel
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#5f6a7e]">
          A senha é definida no servidor pela variável <span className="mono text-[#8d99ad]">PANEL_PASSWORD</span>.
        </p>
      </div>
    </div>
  );
}
