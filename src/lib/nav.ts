export type NavTab =
  | 'dashboard'
  | 'bots'
  | 'leads'
  | 'messages'
  | 'automacao'
  | 'campaigns'
  | 'vendas'
  | 'settings';

export const NAV_ITEMS: Array<{ id: NavTab; label: string; title: string; subtitle: string }> = [
  {
    id: 'dashboard',
    label: 'Visão geral',
    title: 'Visão geral',
    subtitle: 'Captação, conversas e saúde dos bots em um só lugar.',
  },
  {
    id: 'bots',
    label: 'Bots',
    title: 'Bots e canais',
    subtitle: 'Conexão oficial, webhook, comandos e comunidades.',
  },
  {
    id: 'leads',
    label: 'Leads',
    title: 'Leads e CRM',
    subtitle: 'Contatos reais captados pelas conversas do Telegram.',
  },
  {
    id: 'messages',
    label: 'Mensagens',
    title: 'Mensagens',
    subtitle: 'Envio individual e transmissão segmentada com resultado real.',
  },
  {
    id: 'automacao',
    label: 'Automação',
    title: 'Recuperação de leads',
    subtitle: 'Follow-up para quem parou de responder, modelos de mensagem e janelas de envio.',
  },
  {
    id: 'campaigns',
    label: 'Campanhas',
    title: 'Campanhas',
    subtitle: 'Agendamentos com data de início, término e recorrência.',
  },
  {
    id: 'vendas',
    label: 'Vendas',
    title: 'Vendas e PIX',
    subtitle: 'Produtos, cobranças SyncPay e compras registradas automaticamente.',
  },
  {
    id: 'settings',
    label: 'Ajustes',
    title: 'Ajustes',
    subtitle: 'Atendimento, segurança e manutenção dos dados.',
  },
];
