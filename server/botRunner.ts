import { store } from './store.js';
import { syncBotUpdates } from './updates.js';

interface WorkerState {
  botId: string;
  username: string;
  active: boolean;
  consecutiveErrors: number;
  lastRunAt: number;
  lastSuccessAt: number;
  totalProcessed: number;
  stopRequested: boolean;
}

class BotSupervisor {
  private workers = new Map<string, WorkerState>();
  private watchdogTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startTime = Date.now();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();
    console.log('[BotRunner 24/7] 🚀 Iniciando motor autônomo, validado e vigilante de bots...');

    // Inicia workers para todos os bots cadastrados
    this.reconcileBots();

    // Watchdog executado a cada 10 segundos para manter tudo 100% vivo e monitorado
    this.watchdogTimer = setInterval(() => {
      this.reconcileBots();
      this.healthCheckWatchdog();
    }, 10_000);
    this.watchdogTimer.unref?.();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    for (const worker of this.workers.values()) {
      worker.stopRequested = true;
    }
    this.workers.clear();
    console.log('[BotRunner 24/7] 🛑 Motor de bots pausado.');
  }

  public getStatus() {
    const now = Date.now();
    return {
      running: this.isRunning,
      uptimeSeconds: Math.floor((now - this.startTime) / 1000),
      workersCount: this.workers.size,
      workers: Array.from(this.workers.values()).map((w) => ({
        botId: w.botId,
        username: w.username,
        active: w.active,
        consecutiveErrors: w.consecutiveErrors,
        uptimeSeconds: Math.floor((now - (w.lastSuccessAt || w.lastRunAt)) / 1000),
        totalProcessed: w.totalProcessed,
        lastSuccessAt: w.lastSuccessAt ? new Date(w.lastSuccessAt).toISOString() : null,
        healthy: w.consecutiveErrors === 0 && now - w.lastRunAt < 35_000,
      })),
    };
  }

  private reconcileBots(): void {
    if (!this.isRunning) return;
    const currentBots = store.rawBots;
    const currentBotIds = new Set(currentBots.map((b) => b.id));

    // Remove workers de bots que foram deletados
    for (const [botId, worker] of this.workers.entries()) {
      if (!currentBotIds.has(botId)) {
        worker.stopRequested = true;
        this.workers.delete(botId);
        console.log(`[BotRunner 24/7] Bot @${worker.username} foi removido. Worker finalizado.`);
      }
    }

    // Cria ou reativa workers para bots ativos
    for (const bot of currentBots) {
      // Se estiver usando webhook, as mensagens chegam via rota HTTP do webhook
      if (bot.webhookUrl) {
        if (this.workers.has(bot.id)) {
          this.workers.get(bot.id)!.stopRequested = true;
          this.workers.delete(bot.id);
        }
        continue;
      }

      let worker = this.workers.get(bot.id);
      if (!worker || worker.stopRequested || !worker.active) {
        worker = {
          botId: bot.id,
          username: bot.username,
          active: true,
          consecutiveErrors: 0,
          lastRunAt: Date.now(),
          lastSuccessAt: Date.now(),
          totalProcessed: 0,
          stopRequested: false,
        };
        this.workers.set(bot.id, worker);
        void this.startWorkerLoop(worker);
        console.log(`[BotRunner 24/7] ⚡ Worker dedicado ativado para @${bot.username} (Polling Contínuo & Inteligente)`);
      }
    }
  }

  private async startWorkerLoop(worker: WorkerState): Promise<void> {
    while (this.isRunning && !worker.stopRequested) {
      worker.lastRunAt = Date.now();
      try {
        // Long-polling de 5s no Telegram: responde de forma quase instantânea (<300ms) sem sobrecarga
        const result = await syncBotUpdates(worker.botId, 5);

        if (result.ok) {
          worker.consecutiveErrors = 0;
          worker.lastSuccessAt = Date.now();
          worker.totalProcessed += result.processed;

          // Se processou mensagens, não espera: busca a próxima leva imediatamente
          if (result.processed > 0) {
            await sleep(50);
            continue;
          }

          // Se a fila estava limpa, pausa de 1s antes de manter a escuta contínua
          await sleep(1000);
        } else {
          worker.consecutiveErrors += 1;
          const waitTime = result.retryAfter
            ? result.retryAfter * 1000
            : Math.min(15_000, 1000 * Math.pow(1.4, Math.min(worker.consecutiveErrors, 6)));

          console.warn(
            `[BotRunner 24/7] @${worker.username} aviso: ${result.error || 'falha temporária'}. Reconexão em ${Math.round(waitTime / 1000)}s...`
          );
          await sleep(waitTime);
        }
      } catch (err) {
        worker.consecutiveErrors += 1;
        const waitTime = Math.min(15_000, 2000 * worker.consecutiveErrors);
        console.error(`[BotRunner 24/7] @${worker.username} erro não capturado:`, err);
        await sleep(waitTime);
      }
    }
    worker.active = false;
  }

  private healthCheckWatchdog(): void {
    const now = Date.now();
    for (const [botId, worker] of this.workers.entries()) {
      // Se um worker não atualizou nos últimos 40 segundos, reativa automaticamente
      if (worker.active && now - worker.lastRunAt > 40_000) {
        console.warn(`[BotRunner 24/7 Watchdog] ⚠️ Bot @${worker.username} parece travado. Auto-healing acionado!`);
        worker.stopRequested = true;
        this.workers.delete(botId);
        this.reconcileBots();
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const botSupervisor = new BotSupervisor();
