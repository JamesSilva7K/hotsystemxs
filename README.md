# Hot System

Painel de captação e operação de leads no Telegram. O sistema usa exclusivamente a API oficial do Telegram, persiste os dados no servidor e trabalha somente com o histórico real da operação.

## O que está pronto

- **Conexão real de bots** com validação por `getMe`, leitura de comandos, descrição, foto oficial e webhook.
- **Captação automática de leads** por long polling ou webhook HTTPS, incluindo mensagens e cliques em botões.
- **CRM** com origem, histórico, tags, anotações e estágios de funil controlados manualmente.
- **Mensagens individuais e transmissões** com retorno real de sucesso ou erro por destinatário.
- **Campanhas agendadas** com recorrência diária/semanal executadas pelo servidor.
- **Painel protegido por senha opcional**, cookies HttpOnly e tokens de bot criptografados com AES-256-GCM.
- **Sincronização contínua** em segundo plano, mesmo com o navegador fechado.

## Requisitos

- Node.js 20 ou superior (testado com Node 24).
- Um bot criado no [@BotFather](https://t.me/BotFather).
- Para webhook: um domínio público com HTTPS. Sem domínio, o long polling funciona normalmente.

## Instalação

```bash
npm install
cp .env.example .env
npm run dev
```

Acesse `http://127.0.0.1:3000`.

Para produção:

```bash
npm run build
npm start
```

O `npm start` exige que `dist/` e `dist-server/` tenham sido gerados pelo build.

## Primeiros passos

1. Abra **Bots** e cole o token gerado pelo @BotFather.
2. O servidor valida o token diretamente no Telegram e importa os dados oficiais.
3. Envie `/start` para o seu bot no Telegram.
4. O lead aparece em **Leads** e o histórico em **Mensagens**.

## Polling ou webhook

- **Long polling (padrão):** não exige domínio. O servidor consulta o Telegram a cada 25 segundos (`POLL_INTERVAL_MS`).
- **Webhook:** exige uma URL pública HTTPS. Preencha `PUBLIC_BASE_URL` em **Ajustes** e clique em **Ativar webhook** no bot. O servidor gera e valida o `secret_token` automaticamente.
- Não use os dois modos ao mesmo tempo. Ao remover o webhook, o polling volta a funcionar.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP. |
| `HOST` | `127.0.0.1` | Interface de escuta. Use `0.0.0.0` apenas atrás de proxy e senha. |
| `PANEL_PASSWORD` | vazio | Senha do painel. Recomendada para qualquer acesso remoto. |
| `SESSION_SECRET` | gerado | Segredo do cookie de sessão. |
| `APP_SECRET` | gerado | Segredo de criptografia dos tokens. Se trocar, reconecte os bots. |
| `PUBLIC_BASE_URL` | vazio | URL pública HTTPS para webhook. |
| `TRUST_PROXY` | `0` | Use `1` apenas atrás de proxy reverso confiável. |
| `TELEGRAM_POLLING` | `true` | Ativa a sincronização automática por polling. |
| `POLL_INTERVAL_MS` | `25000` | Intervalo mínimo de polling (10 s). |
| `DATA_DIR` | `./data` | Diretório do banco JSON e avatares. |

## Dados e segurança

- O estado fica em `data/state.json`. Os tokens dos bots são criptografados; o restante do arquivo contém leads, chats, mensagens e campanhas.
- `data/.store-key` e `data/.session-key` são gerados automaticamente quando os segredos não são informados. Faça backup deles junto com `state.json`.
- Os tokens nunca são enviados ao navegador. As rotas usam o ID do bot.
- O painel escuta em `127.0.0.1` por padrão. Para expor na internet, use HTTPS, defina `PANEL_PASSWORD` e um proxy reverso.
- O webhook é autenticado pelo header `X-Telegram-Bot-Api-Secret-Token`.

## Estrutura

```text
server/          API Express, Telegram, persistência, agendador e webhook
shared/          Tipos compartilhados entre servidor e frontend
src/             Interface React
data/            Estado local e avatares (não versionado)
dist/            Build do frontend
dist-server/     Build do servidor
```

## Limites conscientes

- Uma instância por diretório de dados. O armazenamento é JSON local, adequado para operação single-tenant; para múltiplas instâncias, migre para um banco compartilhado.
- Transmissões síncronas têm limite de 100 destinatários por requisição; campanhas têm limite de 300 por execução para respeitar o Telegram.
- O sistema não processa pagamentos. Não há checkout, PIX ou gateway financeiro; a operação é focada em captação, CRM e mensagens.
- O Telegram exige que o usuário tenha iniciado conversa com o bot para receber mensagens diretas.

## Verificação

```bash
npm run check
npm run build
```

Para um teste rápido após iniciar:

```bash
curl http://127.0.0.1:3000/api/health
```
