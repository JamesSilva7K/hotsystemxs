/**
 * Gerenciador de Áudio e Notificações Push do Hot System
 * Sintetiza sons reais de caixa registradora / PIX via Web Audio API (sem dependência de arquivos externos).
 */

class NotificationManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private pushEnabled: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.soundEnabled = window.localStorage.getItem('hot-system:sound') !== 'false';
      this.pushEnabled = window.localStorage.getItem('hot-system:push') === 'true';
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
   * Toca som satisfatório de PIX / Venda Aprovada (sintetizado digitalmente).
   */
  playSaleChime(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Nota 1 (Dó 5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Nota 2 (Mi 6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, now + 0.09); // E6
      gain2.gain.setValueAtTime(0.35, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.45);

      // Nota 3 (Sol 6 - Moeda metálica brilhante)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1567.98, now + 0.18); // G6
      gain3.gain.setValueAtTime(0.4, now + 0.18);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.18);
      osc3.stop(now + 0.65);
    } catch {
      // Ignora erro em navegadores com restrição estrita de autoplay
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

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      this.pushEnabled = true;
      window.localStorage.setItem('hot-system:push', 'true');
      return true;
    }
    try {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      this.pushEnabled = granted;
      window.localStorage.setItem('hot-system:push', granted ? 'true' : 'false');
      return granted;
    } catch {
      return false;
    }
  }

  notify(title: string, body: string, icon = '/favicon.svg'): void {
    this.playSaleChime();
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' && this.pushEnabled) {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            void (reg as unknown as { showNotification: (t: string, o?: Record<string, unknown>) => Promise<void> }).showNotification(title, {
              body,
              icon,
              badge: icon,
              vibrate: [200, 100, 200],
            });
          });
        } else {
          new Notification(title, {
            body,
            icon,
            badge: icon,
          });
        }
      } catch {
        // Fallback em alguns navegadores mobile
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
    const dataHora = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const title = `💰 ${details.tipo || 'PIX Aprovado'}: ${formattedPrice}`;
    const body = `🔥 Lead: ${details.leadName || 'Assinante VIP'} (${details.botName || 'Modelo Hot'})\n⏰ ${dataHora}`;
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
    if (enabled) this.playSaleChime();
  }

  get isPushEnabled(): boolean {
    return this.pushEnabled;
  }
}

export const notifications = new NotificationManager();

