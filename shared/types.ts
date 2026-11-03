export type BotStatus = 'online' | 'degraded' | 'offline';

export type LeadStatus = 'novo' | 'interessado' | 'qualificado' | 'cliente' | 'arquivado';

export type MessageDirection = 'in' | 'out';

export type DeliveryStatus = 'enviado' | 'entregue' | 'falhou';

export interface BotCommand {
  command: string;
  description: string;
}

export interface Bot {
  id: string;
  username: string;
  firstName: string;
  description: string;
  avatarUrl: string | null;
  status: BotStatus;
  canJoinGroups: boolean;
  canReadAllGroupMessages: boolean;
  supportsInlineQueries: boolean;
  webhookUrl: string | null;
  pendingUpdates: number;
  commands: BotCommand[];
  createdAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  leadsCount: number;
  chatsCount: number;
  language?: string;
  niche?: string;
}

export interface Chat {
  id: string;
  botId: string;
  telegramChatId: string;
  title: string;
  type: 'channel' | 'supergroup' | 'group' | 'private';
  username: string | null;
  membersCount: number;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  lastActivityAt: string;
}

/** Estado do lead dentro da sequência de recuperação. */
export interface LeadFollowUp {
  sequenceId: string | null;
  stepIndex: number;
  nextRunAt: string | null;
  attempts: number;
  lastSentAt: string | null;
  startedAt: string;
  stoppedReason: string | null;
}

export interface Lead {
  id: string;
  botId: string;
  telegramUserId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: LeadStatus;
  sourceChatId: string | null;
  sourceChatTitle: string;
  languageCode: string | null;
  firstContactAt: string;
  lastMessageAt: string;
  lastInboundAt: string;
  lastOutboundAt: string | null;
  lastMessageText: string;
  messagesCount: number;
  notes: string;
  tags: string[];
  followUp: LeadFollowUp | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  botId: string;
  leadId: string | null;
  chatId: string;
  direction: MessageDirection;
  text: string;
  status: DeliveryStatus;
  telegramMessageId: string | null;
  error: string | null;
  createdAt: string;
}

export type CampaignAudience = 'all' | LeadStatus;

export interface Campaign {
  id: string;
  botId: string;
  title: string;
  content: string;
  audience: CampaignAudience;
  chatIds: string[];
  /** Primeira execução (ou início da janela). */
  scheduledFor: string;
  /** Início da janela de validade (igual a scheduledFor quando não informado). */
  startsAt: string | null;
  /** Fim da janela: depois disso a campanha não roda mais. */
  endsAt: string | null;
  recurrence: 'once' | 'daily' | 'weekly';
  status: 'agendada' | 'pausada' | 'concluida';
  lastRunAt: string | null;
  lastResult: string | null;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory =
  | 'abertura'
  | 'reengajamento'
  | 'oferta'
  | 'prova_social'
  | 'fechamento'
  | 'recuperacao';

export interface TemplateButton {
  text: string;
  url?: string;
  callbackData?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  buttons: TemplateButton[];
  mediaUrl: string | null;
  active: boolean;
  weight: number;
  /** Template de origem quando este foi criado pelo gerador de modelos. */
  variantOf: string | null;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpStep {
  delayMinutes: number;
  templateId: string;
}

export interface FollowUpSequence {
  id: string;
  botId: string;
  name: string;
  steps: FollowUpStep[];
  active: boolean;
  /** Produto usado para preencher {preco}, {pix} e {link} nos templates. */
  productId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Hora local (0-23) a partir da qual pode enviar. */
  quietHoursStart: number;
  quietHoursEnd: number;
  maxMessagesPerLead: number;
  stopOnStatus: LeadStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: 'BRL';
  pixCode: string | null;
  checkoutUrl: string | null;
  deliveryText: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseStatus = 'pendente' | 'pago' | 'cancelado' | 'reembolsado';

export type PurchaseMethod = 'pix' | 'cartao' | 'outro';

export interface Purchase {
  id: string;
  botId: string;
  leadId: string | null;
  productId: string | null;
  provider: 'syncpay' | 'manual';
  externalId: string | null;
  amountCents: number;
  currency: 'BRL';
  status: PurchaseStatus;
  method: PurchaseMethod;
  customerName: string;
  customerEmail: string;
  customerDocument: string;
  pixCode: string | null;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  deliverySentAt: string | null;
  notes: string;
}

export interface SyncPaySettings {
  clientId: string;
  /** Segredo cifrado em repouso (nunca sai para o frontend). */
  clientSecretEnc: string;
  webhookToken: string;
  enabled: boolean;
}

export interface Integrations {
  syncpay: SyncPaySettings;
}

export interface PublicSyncPay {
  configured: boolean;
  enabled: boolean;
  clientId: string;
  webhookUrl: string;
}

export interface PublicIntegrations {
  syncpay: PublicSyncPay;
  cron: { protected: boolean; url: string };
}

export interface Settings {
  operatorName: string;
  autoReplyEnabled: boolean;
  welcomeMessage: string;
  followUpEnabled: boolean;
  /** Fuso usado nos horários de silêncio e na exibição (ex.: America/Sao_Paulo). */
  timezone: string;
  notifyNewLeads: boolean;
  adminChatId: string;
  publicBaseUrl: string;
}

export interface SalesMetrics {
  paidCents: number;
  pendingCents: number;
  refundedCents: number;
  paidCount: number;
  pendingCount: number;
  refundedCount: number;
  last7dCents: number;
  ticketCents: number;
  conversionRate: number;
}

export interface AutomationSummary {
  sequencesActive: number;
  sequencesTotal: number;
  leadsInFollowUp: number;
  dueIn24h: number;
  sentToday: number;
  stoppedToday: number;
  templatesActive: number;
  templatesTotal: number;
  nextRunAt: string | null;
}

export interface StatusCount {
  status: LeadStatus;
  count: number;
}

export interface DayCount {
  date: string;
  leads: number;
  messages: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface Metrics {
  totalLeads: number;
  newLeads7d: number;
  activeLeads: number;
  qualifiedLeads: number;
  totalMessages: number;
  sent7d: number;
  received7d: number;
  responseRate: number;
  statusCounts: StatusCount[];
  daily: DayCount[];
  topSources: SourceCount[];
}

export interface ServerInfo {
  now: string;
  version: string;
  storage: string;
  storageKind: 'file' | 'supabase' | 'vercel-kv';
  serverless: boolean;
  pollingEnabled: boolean;
  publicBaseUrl: string;
  passwordProtected: boolean;
  cronProtected: boolean;
}

export interface AppState {
  bots: Bot[];
  chats: Chat[];
  leads: Lead[];
  messages: MessageLog[];
  campaigns: Campaign[];
  templates: MessageTemplate[];
  sequences: FollowUpSequence[];
  products: Product[];
  purchases: Purchase[];
  settings: Settings;
  integrations: PublicIntegrations;
  metrics: Metrics;
  sales: SalesMetrics;
  automation: AutomationSummary;
  server: ServerInfo;
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface ConnectBotInput {
  token: string;
}

export interface SendMessageInput {
  botId: string;
  chatId: string;
  text: string;
  imageUrl?: string;
  mediaType?: 'photo' | 'video' | 'animation';
  leadId?: string;
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
}

export interface BroadcastInput {
  botId: string;
  text: string;
  imageUrl?: string;
  mediaType?: 'photo' | 'video' | 'animation';
  audience: CampaignAudience;
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>;
}

export interface CreateCampaignInput {
  botId: string;
  title: string;
  content: string;
  audience: CampaignAudience;
  chatIds?: string[];
  scheduledFor: string;
  startsAt?: string;
  endsAt?: string;
  recurrence: 'once' | 'daily' | 'weekly';
}

export interface AddChatInput {
  botId: string;
  chatId: string;
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  notes?: string;
  tags?: string[];
}

export interface UpdateSettingsInput {
  operatorName?: string;
  autoReplyEnabled?: boolean;
  welcomeMessage?: string;
  followUpEnabled?: boolean;
  notifyNewLeads?: boolean;
  adminChatId?: string;
  publicBaseUrl?: string;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  body: string;
  buttons?: TemplateButton[];
  mediaUrl?: string | null;
  weight?: number;
  active?: boolean;
  tags?: string[];
}

export interface GenerateTemplatesInput {
  brief: string;
  category: TemplateCategory;
  count: number;
  productId?: string | null;
  save?: boolean;
}

export interface CreateSequenceInput {
  botId: string;
  name: string;
  productId?: string | null;
  active?: boolean;
  steps: FollowUpStep[];
  startsAt?: string | null;
  endsAt?: string | null;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  maxMessagesPerLead?: number;
  stopOnStatus?: LeadStatus[];
}

export interface CreateProductInput {
  name: string;
  description?: string;
  priceCents: number;
  pixCode?: string | null;
  checkoutUrl?: string | null;
  deliveryText?: string;
  active?: boolean;
}

export interface CreateChargeInput {
  botId: string;
  leadId?: string | null;
  productId: string;
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  customerPhone?: string;
}

export interface RegisterPurchaseInput {
  botId: string;
  leadId?: string | null;
  productId?: string | null;
  amountCents: number;
  status?: PurchaseStatus;
  method?: PurchaseMethod;
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  notes?: string;
  externalId?: string | null;
}
