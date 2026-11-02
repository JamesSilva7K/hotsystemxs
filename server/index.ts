import { HOST, PANEL_PASSWORD, POLL_INTERVAL_MS, POLLING_ENABLED, PORT, VERSION } from './config.js';
import { app, prepare } from './app.js';
import { startScheduler } from './messaging.js';
import { store } from './store.js';
import { syncBotUpdates } from './updates.js';

await prepare();

const server = app.listen(PORT, HOST, () => {
  console.log(`Hot System v${VERSION} em http://${HOST}:${PORT}`);
  console.log(
    `Bots: ${store.stats.bots} | Leads: ${store.stats.leads} | Templates: ${store.stats.templates} | Compras: ${store.stats.purchases}`
  );
  console.log(`Armazenamento: ${store.storageLabel}`);
  if (!PANEL_PASSWORD) {
    console.warn('Aviso: PANEL_PASSWORD não definido. Use apenas em rede local confiável.');
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`[server] falha ao escutar em ${HOST}:${PORT}: ${error.message}`);
  process.exit(1);
});

startScheduler();

if (POLLING_ENABLED) {
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      for (const bot of store.rawBots) {
        if (!bot.webhookUrl) {
          const result = await syncBotUpdates(bot.id);
          if (!result.ok && result.error) {
            console.warn(`[polling] @${bot.username}: ${result.error}`);
          }
        }
      }
    } finally {
      polling = false;
    }
  };
  setTimeout(() => void poll(), 3_000).unref?.();
  setInterval(() => void poll(), POLL_INTERVAL_MS).unref?.();
}

process.on('exit', () => store.flush());

function shutdown(signal: string) {
  console.log(`\n${signal} recebido. Encerrando...`);
  store.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref?.();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
