/**
 * Gerenciador de Áudio e Notificações Push do Hot System
 * Sintetiza sons reais de caixa registradora / PIX via Web Audio API (sem dependência de arquivos externos).
 * Suporta Service Worker showNotification, vibração física no aparelho e controle de som pelo painel.
 */

type SoundChangeListener = (enabled: boolean) => void;
type PushChangeListener = (granted: boolean) => void;

class NotificationManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private pushEnabled: boolean = false;
  private soundListeners: Set<SoundChangeListener> = new Set();
  private pushListeners: Set<PushChangeListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.soundEnabled = window.localStorage.getItem('hot-system:sound') !== 'false';
      this.pushEnabled =
        'Notification' in window &&
        Notification.permission === 'granted' &&
        window.localStorage.getItem('hot-system:push') !== 'false';
    }
  }

  onSoundChange(listener: SoundChangeListener): () => void {
    this.soundListeners.add(listener);
    return () => this.soundListeners.delete(listener);
  }

  onPushChange(listener: PushChangeListener): () => void {
    this.pushListeners.add(listener);
    return () => this.pushListeners.delete(listener);
  }

  private notifySoundListeners(): void {
    for (const listener of this.soundListeners) {
      try {
        listener(this.soundEnabled);
      } catch {
        // ignore
      }
    }
  }

  private notifyPushListeners(): void {
    for (const listener of this.pushListeners) {
      try {
        listener(this.pushEnabled);
      } catch {
        // ignore
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Toca som brilhante e satisfatório de PIX / Venda Aprovada (Caixa Registradora + Sineta de Ouro)
   */
  playSaleChime(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. "Cha-ching" / Mecanismo de moeda inicial (metal agudo)
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(3500, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // 2. Acorde Ascendente Polifônico (Dó6, Mi6, Sol6, Dó7)
      const notes = [
        { freq: 1046.5, time: 0.04, dur: 0.35, gain: 0.28 }, // C6
        { freq: 1318.5, time: 0.10, dur: 0.40, gain: 0.32 }, // E6
        { freq: 1567.98, time: 0.16, dur: 0.50, gain: 0.35 }, // G6
        { freq: 2093.0, time: 0.22, dur: 0.70, gain: 0.40 }, // C7 (Brilho da vitória)
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        g.gain.setValueAtTime(n.gain, now + n.time);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);

        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      }
    } catch {
      // Ignora restrições de autoplay do navegador
    }
  }

  /**
   * Toca som suave de novo lead capturado.
   */
  playLeadChime(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // ignore
    }
  }

  /**
   * Pede permissão explícita para o navegador enviar notificações na tela do aparelho.
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    if (Notification.permission === 'granted') {
      this.pushEnabled = true;
      window.localStorage.setItem('hot-system:push', 'true');
      this.notifyPushListeners();
      return true;
    }

    try {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      this.pushEnabled = granted;
      window.localStorage.setItem('hot-system:push', granted ? 'true' : 'false');
      this.notifyPushListeners();

      if (granted) {
        this.notify(
          '🔔 Notificações Ativadas no Aparelho!',
          'Você receberá alertas em tempo real na tela do celular a cada venda e PIX aprovado.'
        );
      }
      return granted;
    } catch {
      return false;
    }
  }

  /**
   * Dispara notificação push oficial na tela do celular e toca o som.
   */
  notify(title: string, body: string, icon = '/icon-192.png'): void {
    // 1. Toca o som de venda
    this.playSaleChime();

    // 2. Vibração tátil no aparelho celular
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 200]);
      } catch {
        // ignore
      }
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // 3. Tenta via Service Worker primeiro (obrigatório para celulares Android e iOS PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          void (
            reg as unknown as {
              showNotification: (t: string, o?: Record<string, unknown>) => Promise<void>;
            }
          ).showNotification(title, {
            body,
            icon,
            badge: '/icon-192.png',
            vibrate: [200, 100, 200, 100, 200],
            tag: `sale-${Date.now()}`,
            renotify: true,
            requireInteraction: true,
            data: '/',
          });
        })
        .catch(() => {
          // Fallback para new Notification caso o service worker não responda
          try {
            new Notification(title, {
              body,
              icon,
              badge: '/icon-192.png',
            });
          } catch {
            // ignore
          }
        });
    } else {
      try {
        new Notification(title, {
          body,
          icon,
          badge: '/icon-192.png',
        });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Notificação personalizada profissional de Venda / PIX para mobile e desktop
   */
  notifySale(details: {
    valor: number;
    leadName?: string;
    botName?: string;
    tipo?: string;
  }): void {
    const formattedPrice = details.valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const now = new Date();
    const dataHora =
      now.toLocaleDateString('pt-BR') +
      ' às ' +
      now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const title = `💰 ${details.tipo || 'Venda Confirmada'}: ${formattedPrice}`;
    const body = `🔥 Cliente: ${details.leadName || 'Lead VIP'}\n🤖 Modelo: ${details.botName || 'Modelo Hot'}\n⏰ ${dataHora}`;
    this.notify(title, body);
  }

  get isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('hot-system:sound', enabled ? 'true' : 'false');
    }
    this.notifySoundListeners();
    if (enabled) this.playSaleChime();
  }

  get isPushEnabled(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      this.pushEnabled
    );
  }

  get permissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }
}

export const notifications = new NotificationManager();
