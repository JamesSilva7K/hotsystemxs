import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AppState,
  AutomationSummary,
  Bot,
  BotCommand,
  Campaign,
  Chat,
  DayCount,
  FollowUpSequence,
  Integrations,
  Lead,
  LeadFollowUp,
  LeadStatus,
  MessageLog,
  MessageTemplate,
  Metrics,
  Product,
  PublicIntegrations,
  Purchase,
  SalesMetrics,
  Settings,
} from '../shared/types.js';
import {
  AVATAR_DIR,
  DATA_DIR,
  DEPLOY_URL,
  IS_SERVERLESS,
  POLLING_ENABLED,
  PUBLIC_BASE_URL,
  STORE_FILE,
  VERSION,
} from './config.js';
import { createDocumentDriver, type DocumentDriver, type DocumentRecord } from './db.js';
import { decryptSecret, encryptSecret } from './security.js';

export interface StoredBot {
  id: string;
  tokenEnc: string;
  username: string;
  firstName: string;
  description: string;
  avatarFile: string | null;
  avatarDataUrl?: string | null;
  status: Bot['status'];
  canJoinGroups: boolean;
  canReadAllGroupMessages: boolean;
  supportsInlineQueries: boolean;
  webhookUrl: string | null;
  webhookSecretEnc: string | null;
  pendingUpdates: number;
  commands: BotCommand[];
  createdAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  offset: number;
  lastUpdateId: number;
  language?: string;
  niche?: string;
  vipChannelId?: string | null;
  vipChannelTitle?: string | null;
  vipInviteLink?: string | null;
  vipRequirements?: import('../shared/types.js').VipRequirements;
  operatingMode?: import('../shared/types.js').BotOperatingMode;
  funnelStages?: import('../shared/types.js').BotFunnelStageConfig[];
  previewGroupId?: string | null;
  previewGroupTitle?: string | null;
  previewGroupInviteLink?: string | null;
  previewScheduleMode?: 'interval' | 'hours' | 'off';
  previewScheduleIntervalHours?: number;
  previewScheduleHours?: string[];
  previewAutoMedia?: boolean;
  previewLastSentAt?: string | null;
}

interface Database {
  version: number;
  bots: StoredBot[];
  chats: Chat[];
  leads: Lead[];
  messages: MessageLog[];
  campaigns: Campaign[];
  templates: MessageTemplate[];
  sequences: FollowUpSequence[];
  products: Product[];
  purchases: Purchase[];
  settings: Settings;
  integrations: Integrations;
  seenUpdates: number[];
}

const MAX_MESSAGES = 10_000;
const MAX_PURCHASES = 5_000;
const MAX_SEEN_UPDATES = 2_000;
const SCHEMA_VERSION = 2;

function defaultSettings(): Settings {
  return {
    operatorName: 'Operador',
    autoReplyEnabled: true,
    welcomeMessage:
      'Olá, {nome}! Você está falando com {bot}. Recebemos sua mensagem e já vamos te atender por aqui.',
    followUpEnabled: true,
    timezone: 'America/Sao_Paulo',
    notifyNewLeads: false,
    adminChatId: '',
    publicBaseUrl: PUBLIC_BASE_URL,
  };
}

function defaultIntegrations(): Integrations {
  return {
    syncpay: {
      clientId: '',
      clientSecretEnc: '',
      webhookToken: crypto.randomBytes(24).toString('base64url'),
      enabled: false,
    },
  };
}

function emptyDatabase(): Database {
  return {
    version: SCHEMA_VERSION,
    bots: [],
    chats: [],
    leads: [],
    messages: [],
    campaigns: [],
    templates: [],
    sequences: [],
    products: [],
    purchases: [],
    settings: defaultSettings(),
    integrations: defaultIntegrations(),
    seenUpdates: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Migra documentos antigos (v1) sem perder nada. */
function normalize(raw: Partial<Database> | null | undefined): Database {
  const base = emptyDatabase();
  if (!raw || typeof raw !== 'object') return base;
  const now = new Date().toISOString();
  const leads = asArray<Partial<Lead>>(raw.leads).map((lead) => ({
    ...(lead as Lead),
    lastInboundAt: lead.lastInboundAt || lead.lastMessageAt || lead.firstContactAt || now,
    lastOutboundAt: lead.lastOutboundAt || null,
    followUp: (lead.followUp as LeadFollowUp | null) ?? null,
  }));
  const campaigns = asArray<Partial<Campaign>>(raw.campaigns).map((campaign) => ({
    ...(campaign as Campaign),
    startsAt: campaign.startsAt || campaign.scheduledFor || null,
    endsAt: campaign.endsAt || null,
  }));
  const integrations = {
    ...defaultIntegrations(),
    ...(raw.integrations || {}),
    syncpay: {
      ...defaultIntegrations().syncpay,
      ...((raw.integrations || {}).syncpay || {}),
    },
  };
  return {
    ...base,
    ...raw,
    version: SCHEMA_VERSION,
    settings: { ...defaultSettings(), ...(raw.settings || {}) },
    bots: asArray(raw.bots),
    chats: asArray(raw.chats),
    leads,
    messages: asArray(raw.messages),
    campaigns,
    templates: asArray(raw.templates),
    sequences: asArray(raw.sequences),
    products: asArray(raw.products),
    purchases: asArray(raw.purchases),
    integrations,
    seenUpdates: asArray<number>(raw.seenUpdates),
  };
}

export class Store {
  private db: Database = emptyDatabase();
  private loaded = false;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private driver: DocumentDriver | null = null;
  private readyPromise: Promise<void> | null = null;
  private lastLoadAt = 0;

  /** Carrega o documento uma única vez por processo (idempotente). */
  ready(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.bootstrap();
    return this.readyPromise;
  }

  private async bootstrap(): Promise<void> {
    this.driver = createDocumentDriver();
    if (this.driver.kind === 'file') {
      this.initFile();
      return;
    }
    const raw = await this.driver.load();
    this.db = normalize(raw as Partial<Database> | null);
    this.loaded = true;
    this.lastLoadAt = Date.now();
    if (!raw) await this.flushAsync();
  }

  /** Somente arquivo local: mantém o comportamento síncrono original. */
  init(): void {
    if (!this.loaded && (!this.driver || this.driver.kind === 'file')) this.initFile();
  }

  private initFile(): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) {
      this.db = emptyDatabase();
      this.loaded = true;
      this.persist();
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as Partial<Database>;
      this.db = normalize(parsed);
      this.loaded = true;
    } catch (error) {
      const broken = `${STORE_FILE}.broken-${Date.now()}`;
      fs.copyFileSync(STORE_FILE, broken);
      this.db = emptyDatabase();
      this.loaded = true;
      this.persist();
      throw new Error(`Banco de dados inválido. Cópia preservada em ${broken}. ${String(error)}`);
    }
  }

  get storageKind(): 'file' | 'supabase' | 'vercel-kv' {
    return this.driver?.kind || 'file';
  }

  get storageLabel(): string {
    return this.driver?.describe() || 'Arquivo local (data/state.json)';
  }

  private assertLoaded(): void {
    if (this.loaded) return;
    if (!this.driver || this.driver.kind === 'file') {
      this.initFile();
      return;
    }
    throw new Error('Armazenamento remoto ainda não carregado. Chame store.ready() antes.');
  }

  /**
   * Em serverless cada invocação precisa ver o estado mais recente do banco.
   * Um cache curto evita uma leitura por requisição dentro do mesmo processo.
   */
  async ensureFresh(maxAgeMs = 1_500): Promise<void> {
    await this.ready();
    if (!this.driver || this.driver.kind === 'file') return;
    if (this.dirty) return;
    if (Date.now() - this.lastLoadAt < maxAgeMs) return;
    const raw = await this.driver.load();
    if (raw) {
      this.db = normalize(raw as Partial<Database>);
      this.lastLoadAt = Date.now();
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.renameSync(tmp, STORE_FILE);
    } catch {
      // Windows pode bloquear o rename por antivírus/índice. Preserva os dados.
      fs.copyFileSync(tmp, STORE_FILE);
      fs.rmSync(tmp, { force: true });
    }
    this.dirty = false;
  }

  private schedulePersist(): void {
    this.dirty = true;
    if (this.driver && this.driver.kind !== 'file') return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        this.persist();
      } catch (error) {
        console.error('[store] falha ao salvar estado:', error);
      }
    }, 120);
    this.saveTimer.unref?.();
  }

  /** Grava imediatamente no destino remoto. Chamado antes de responder a requisição. */
  async flushAsync(): Promise<void> {
    if (!this.dirty || !this.driver) return;
    const snapshot = this.db as unknown as DocumentRecord;
    this.dirty = false;
    if (this.driver.kind === 'file') {
      this.persist();
      return;
    }
    try {
      await this.driver.save(snapshot);
      this.lastLoadAt = Date.now();
    } catch (error) {
      this.dirty = true;
      throw error;
    }
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty) return;
    if (this.driver && this.driver.kind !== 'file') {
      // Em serverless não há evento de saída confiável; o flush é por requisição.
      return;
    }
    try {
      this.persist();
    } catch (error) {
      console.error('[store] falha ao salvar estado no encerramento:', error);
    }
  }

  transaction<T>(mutator: (db: Database) => T): T {
    this.assertLoaded();
    const result = mutator(this.db);
    this.schedulePersist();
    return result;
  }

  get settings(): Settings {
    this.assertLoaded();
    return clone(this.db.settings);
  }

  updateSettings(patch: Partial<Settings>): Settings {
    return this.transaction((db) => {
      db.settings = { ...db.settings, ...patch };
      return clone(db.settings);
    });
  }

  get integrations(): Integrations {
    this.assertLoaded();
    return clone(this.db.integrations);
  }

  updateIntegrations(patch: Partial<Integrations['syncpay']>): Integrations {
    return this.transaction((db) => {
      db.integrations.syncpay = { ...db.integrations.syncpay, ...patch };
      return clone(db.integrations);
    });
  }

  get syncpaySecret(): string {
    this.assertLoaded();
    const enc = this.db.integrations.syncpay.clientSecretEnc;
    if (!enc) return '';
    try {
      return decryptSecret(enc);
    } catch {
      return '';
    }
  }

  get internalBots(): StoredBot[] {
    this.assertLoaded();
    return this.db.bots;
  }

  findBot(id: string): StoredBot | undefined {
    this.assertLoaded();
    return this.db.bots.find((bot) => bot.id === id);
  }

  findBotByUsername(username: string): StoredBot | undefined {
    const clean = username.replace(/^@/, '').toLowerCase();
    return this.db.bots.find((bot) => bot.username.toLowerCase() === clean);
  }

  getBotToken(id: string): string | null {
    const bot = this.findBot(id);
    if (!bot) return null;
    try {
      return decryptSecret(bot.tokenEnc);
    } catch {
      return null;
    }
  }

  getWebhookSecret(bot: StoredBot): string | null {
    if (!bot.webhookSecretEnc) return null;
    try {
      return decryptSecret(bot.webhookSecretEnc);
    } catch {
      return null;
    }
  }

  upsertBot(input: {
    id: string;
    token: string;
    username: string;
    firstName: string;
    description: string;
    avatarFile: string | null;
    avatarDataUrl?: string | null;
    canJoinGroups: boolean;
    canReadAllGroupMessages: boolean;
    supportsInlineQueries: boolean;
    commands: BotCommand[];
    webhookUrl: string | null;
    pendingUpdates: number;
    language?: string;
    niche?: string;
    lastSyncAt?: string | null;
  }): StoredBot {
    return this.transaction((db) => {
      const now = new Date().toISOString();
      const existing = db.bots.find((bot) => bot.id === input.id);
      const record: StoredBot = {
        id: input.id,
        tokenEnc: encryptSecret(input.token),
        username: input.username,
        firstName: input.firstName,
        description: input.description,
        avatarFile: input.avatarFile,
        avatarDataUrl: input.avatarDataUrl ?? existing?.avatarDataUrl ?? null,
        status: 'online',
        canJoinGroups: input.canJoinGroups,
        canReadAllGroupMessages: input.canReadAllGroupMessages,
        supportsInlineQueries: input.supportsInlineQueries,
        webhookUrl: input.webhookUrl,
        webhookSecretEnc: existing?.webhookSecretEnc || null,
        pendingUpdates: input.pendingUpdates,
        commands: input.commands,
        createdAt: existing?.createdAt || now,
        lastSyncAt: input.lastSyncAt || existing?.lastSyncAt || now,
        lastError: null,
        offset: existing?.offset || 0,
        lastUpdateId: existing?.lastUpdateId || 0,
        language: input.language || existing?.language || 'pt',
        niche: input.niche || existing?.niche || 'Modelo Hot',
      };
      if (existing) {
        Object.assign(existing, record);
      } else {
        db.bots.push(record);
      }
      return record;
    });
  }

  updateBot(id: string, patch: Partial<StoredBot>): StoredBot | null {
    return this.transaction((db) => {
      const bot = db.bots.find((item) => item.id === id);
      if (!bot) return null;
      Object.assign(bot, patch);
      return bot;
    });
  }

  removeBot(id: string): boolean {
    return this.transaction((db) => {
      const before = db.bots.length;
      db.bots = db.bots.filter((bot) => bot.id !== id);
      db.chats = db.chats.filter((chat) => chat.botId !== id);
      db.leads = db.leads.filter((lead) => lead.botId !== id);
      db.messages = db.messages.filter((message) => message.botId !== id);
      db.campaigns = db.campaigns.filter((campaign) => campaign.botId !== id);
      db.sequences = db.sequences.filter((sequence) => sequence.botId !== id);
      const file = path.join(AVATAR_DIR, `${id}.jpg`);
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
      return db.bots.length !== before;
    });
  }

  hasSeenUpdate(updateId: number): boolean {
    return this.db.seenUpdates.includes(updateId);
  }

  markUpdateSeen(updateId: number): void {
    this.transaction((db) => {
      if (!db.seenUpdates.includes(updateId)) db.seenUpdates.push(updateId);
      if (db.seenUpdates.length > MAX_SEEN_UPDATES) {
        db.seenUpdates = db.seenUpdates.slice(-MAX_SEEN_UPDATES);
      }
    });
  }

  upsertChat(input: {
    botId: string;
    telegramChatId: string;
    title: string;
    type: Chat['type'];
    username?: string | null;
    membersCount?: number;
    isAdmin?: boolean;
    isActive?: boolean;
  }): Chat {
    return this.transaction((db) => {
      const now = new Date().toISOString();
      const existing = db.chats.find(
        (chat) => chat.botId === input.botId && chat.telegramChatId === input.telegramChatId
      );
      if (existing) {
        existing.title = input.title || existing.title;
        existing.type = input.type || existing.type;
        existing.username = input.username ?? existing.username;
        if (typeof input.membersCount === 'number') existing.membersCount = input.membersCount;
        if (typeof input.isAdmin === 'boolean') existing.isAdmin = input.isAdmin;
        if (typeof input.isActive === 'boolean') existing.isActive = input.isActive;
        existing.lastActivityAt = now;
        return clone(existing);
      }
      const chat: Chat = {
        id: `chat_${input.botId}_${input.telegramChatId}`,
        botId: input.botId,
        telegramChatId: input.telegramChatId,
        title: input.title,
        type: input.type,
        username: input.username || null,
        membersCount: input.membersCount || 0,
        isAdmin: Boolean(input.isAdmin),
        isActive: input.isActive !== false,
        createdAt: now,
        lastActivityAt: now,
      };
      db.chats.push(chat);
      return clone(chat);
    });
  }

  removeChat(id: string): boolean {
    return this.transaction((db) => {
      const before = db.chats.length;
      db.chats = db.chats.filter((chat) => chat.id !== id);
      return db.chats.length !== before;
    });
  }

  findLeadByTelegramId(botId: string, telegramUserId: string): Lead | undefined {
    return this.db.leads.find(
      (lead) => lead.botId === botId && lead.telegramUserId === telegramUserId
    );
  }

  findLeadById(id: string): Lead | undefined {
    return this.db.leads.find((lead) => lead.id === id);
  }

  upsertLead(input: {
    botId: string;
    telegramUserId: string;
    name: string;
    username: string | null;
    avatarUrl?: string | null;
    sourceChatId: string | null;
    sourceChatTitle: string;
    languageCode?: string | null;
    lastMessageText: string;
    trackingSource?: string | null;
  }): { lead: Lead; created: boolean } {
    return this.transaction((db) => {
      const now = new Date().toISOString();
      const existing = db.leads.find(
        (lead) => lead.botId === input.botId && lead.telegramUserId === input.telegramUserId
      );
      if (existing) {
        existing.name = input.name || existing.name;
        existing.username = input.username ?? existing.username;
        if (input.avatarUrl) existing.avatarUrl = input.avatarUrl;
        existing.lastMessageAt = now;
        existing.lastInboundAt = now;
        existing.lastMessageText = input.lastMessageText.slice(0, 500);
        existing.messagesCount += 1;
        existing.updatedAt = now;
        if (input.trackingSource) {
          existing.trackingSource = input.trackingSource;
          existing.dmUnlocked = true;
          if (!existing.dmUnlockedAt) existing.dmUnlockedAt = now;
          if (!existing.tags.includes(`orig-${input.trackingSource}`)) {
            existing.tags.push(`orig-${input.trackingSource}`);
          }
        }
        if (existing.sourceChatTitle.startsWith('Conversa')) {
          existing.sourceChatTitle = input.sourceChatTitle || existing.sourceChatTitle;
        }
        return { lead: clone(existing), created: false };
      }
      const initialTags: string[] = [];
      if (input.trackingSource) {
        initialTags.push(`orig-${input.trackingSource}`);
      }
      const lead: Lead = {
        id: `lead_${input.botId}_${input.telegramUserId}`,
        botId: input.botId,
        telegramUserId: input.telegramUserId,
        name: input.name || `Usuário ${input.telegramUserId}`,
        username: input.username,
        avatarUrl: input.avatarUrl || null,
        status: 'novo',
        sourceChatId: input.sourceChatId,
        sourceChatTitle: input.sourceChatTitle,
        languageCode: input.languageCode || null,
        firstContactAt: now,
        lastMessageAt: now,
        lastInboundAt: now,
        lastOutboundAt: null,
        lastMessageText: input.lastMessageText.slice(0, 500),
        messagesCount: 1,
        notes: '',
        tags: initialTags,
        followUp: null,
        createdAt: now,
        updatedAt: now,
        trackingSource: input.trackingSource || null,
        dmUnlocked: Boolean(input.trackingSource),
        dmUnlockedAt: input.trackingSource ? now : null,
      };
      db.leads.unshift(lead);
      return { lead: clone(lead), created: true };
    });
  }

  updateLead(
    id: string,
    patch: Partial<
      Pick<
        Lead,
        | 'status'
        | 'notes'
        | 'tags'
        | 'avatarUrl'
        | 'lastOutboundAt'
        | 'followUp'
        | 'vipUnlocked'
        | 'vipUnlockedAt'
        | 'vipTermsAccepted'
        | 'trackingSource'
        | 'dmUnlocked'
        | 'dmUnlockedAt'
      >
    >
  ): Lead | null {
    return this.transaction((db) => {
      const lead = db.leads.find((item) => item.id === id);
      if (!lead) return null;
      if (patch.status) lead.status = patch.status;
      if (typeof patch.notes === 'string') lead.notes = patch.notes.slice(0, 2_000);
      if (Array.isArray(patch.tags)) {
        lead.tags = Array.from(
          new Set(patch.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 20))
        );
      }
      if (patch.avatarUrl) lead.avatarUrl = patch.avatarUrl;
      if (typeof patch.lastOutboundAt === 'string') lead.lastOutboundAt = patch.lastOutboundAt;
      if (patch.followUp !== undefined) lead.followUp = patch.followUp;
      if (patch.vipUnlocked !== undefined) lead.vipUnlocked = patch.vipUnlocked;
      if (patch.vipUnlockedAt !== undefined) lead.vipUnlockedAt = patch.vipUnlockedAt;
      if (patch.vipTermsAccepted !== undefined) lead.vipTermsAccepted = patch.vipTermsAccepted;
      if (patch.trackingSource !== undefined) lead.trackingSource = patch.trackingSource;
      if (patch.dmUnlocked !== undefined) lead.dmUnlocked = patch.dmUnlocked;
      if (patch.dmUnlockedAt !== undefined) lead.dmUnlockedAt = patch.dmUnlockedAt;
      lead.updatedAt = new Date().toISOString();
      return clone(lead);
    });
  }

  setLeadFollowUp(id: string, followUp: LeadFollowUp | null): Lead | null {
    return this.transaction((db) => {
      const lead = db.leads.find((item) => item.id === id);
      if (!lead) return null;
      lead.followUp = followUp;
      lead.updatedAt = new Date().toISOString();
      return clone(lead);
    });
  }

  addMessage(message: MessageLog): void {
    this.transaction((db) => {
      db.messages.unshift(message);
      if (db.messages.length > MAX_MESSAGES) db.messages.length = MAX_MESSAGES;
    });
  }

  addCampaign(campaign: Campaign): Campaign {
    return this.transaction((db) => {
      db.campaigns.unshift(campaign);
      return clone(campaign);
    });
  }

  updateCampaign(id: string, patch: Partial<Campaign>): Campaign | null {
    return this.transaction((db) => {
      const campaign = db.campaigns.find((item) => item.id === id);
      if (!campaign) return null;
      Object.assign(campaign, patch, { updatedAt: new Date().toISOString() });
      return clone(campaign);
    });
  }

  removeCampaign(id: string): boolean {
    return this.transaction((db) => {
      const before = db.campaigns.length;
      db.campaigns = db.campaigns.filter((campaign) => campaign.id !== id);
      return db.campaigns.length !== before;
    });
  }

  // ---------- Templates ----------

  findTemplate(id: string): MessageTemplate | undefined {
    this.assertLoaded();
    return this.db.templates.find((template) => template.id === id);
  }

  addTemplate(template: MessageTemplate): MessageTemplate {
    return this.transaction((db) => {
      db.templates.unshift(template);
      return clone(template);
    });
  }

  updateTemplate(id: string, patch: Partial<MessageTemplate>): MessageTemplate | null {
    return this.transaction((db) => {
      const template = db.templates.find((item) => item.id === id);
      if (!template) return null;
      Object.assign(template, patch, { updatedAt: new Date().toISOString() });
      return clone(template);
    });
  }

  removeTemplate(id: string): boolean {
    return this.transaction((db) => {
      const before = db.templates.length;
      db.templates = db.templates.filter((template) => template.id !== id);
      db.sequences = db.sequences.map((sequence) => ({
        ...sequence,
        steps: sequence.steps.filter((step) => step.templateId !== id),
      }));
      return db.templates.length !== before;
    });
  }

  bumpTemplateUsage(id: string): void {
    this.transaction((db) => {
      const template = db.templates.find((item) => item.id === id);
      if (template) template.usageCount += 1;
    });
  }

  // ---------- Sequências ----------

  findSequence(id: string): FollowUpSequence | undefined {
    this.assertLoaded();
    return this.db.sequences.find((sequence) => sequence.id === id);
  }

  addSequence(sequence: FollowUpSequence): FollowUpSequence {
    return this.transaction((db) => {
      db.sequences.unshift(sequence);
      return clone(sequence);
    });
  }

  updateSequence(id: string, patch: Partial<FollowUpSequence>): FollowUpSequence | null {
    return this.transaction((db) => {
      const sequence = db.sequences.find((item) => item.id === id);
      if (!sequence) return null;
      Object.assign(sequence, patch, { updatedAt: new Date().toISOString() });
      return clone(sequence);
    });
  }

  removeSequence(id: string): boolean {
    return this.transaction((db) => {
      const before = db.sequences.length;
      db.sequences = db.sequences.filter((sequence) => sequence.id !== id);
      for (const lead of db.leads) {
        if (lead.followUp?.sequenceId === id) lead.followUp = null;
      }
      return db.sequences.length !== before;
    });
  }

  // ---------- Produtos ----------

  findProduct(id: string): Product | undefined {
    this.assertLoaded();
    return this.db.products.find((product) => product.id === id);
  }

  addProduct(product: Product): Product {
    return this.transaction((db) => {
      db.products.unshift(product);
      return clone(product);
    });
  }

  updateProduct(id: string, patch: Partial<Product>): Product | null {
    return this.transaction((db) => {
      const product = db.products.find((item) => item.id === id);
      if (!product) return null;
      Object.assign(product, patch, { updatedAt: new Date().toISOString() });
      return clone(product);
    });
  }

  removeProduct(id: string): boolean {
    return this.transaction((db) => {
      const before = db.products.length;
      db.products = db.products.filter((product) => product.id !== id);
      for (const sequence of db.sequences) {
        if (sequence.productId === id) sequence.productId = null;
      }
      return db.products.length !== before;
    });
  }

  // ---------- Compras ----------

  findPurchaseByExternalId(provider: string, externalId: string): Purchase | undefined {
    this.assertLoaded();
    return this.db.purchases.find(
      (purchase) => purchase.provider === provider && purchase.externalId === externalId
    );
  }

  addPurchase(purchase: Purchase): Purchase {
    return this.transaction((db) => {
      db.purchases.unshift(purchase);
      if (db.purchases.length > MAX_PURCHASES) db.purchases.length = MAX_PURCHASES;
      return clone(purchase);
    });
  }

  updatePurchase(id: string, patch: Partial<Purchase>): Purchase | null {
    return this.transaction((db) => {
      const purchase = db.purchases.find((item) => item.id === id);
      if (!purchase) return null;
      Object.assign(purchase, patch);
      return clone(purchase);
    });
  }

  clearOperationalData(): void {
    this.transaction((db) => {
      db.leads = [];
      db.chats = [];
      db.messages = [];
      db.campaigns = [];
      db.purchases = [];
    });
  }

  getDefaultFunnelStages(): import('../shared/types.js').BotFunnelStageConfig[] {
    return [
      {
        id: 'welcome',
        name: 'Boas-vindas Personalizada (/start)',
        description: 'Apresentação sedutora da modelo no idioma nativo do bot.',
        enabled: true,
        order: 1,
      },
      {
        id: 'age_gate',
        name: 'Verificação de Idade & Termos (+18)',
        description: 'Bloqueio obrigatório de maioridade com botões interativos.',
        enabled: true,
        order: 2,
      },
      {
        id: 'teaser_sample',
        name: 'Amostra Sensorial & Provocação (Foto/Áudio Teaser)',
        description: 'Disponibiliza prévia provocativa para despertar o desejo do lead.',
        enabled: true,
        order: 3,
      },
      {
        id: 'plans_checkout',
        name: 'Apresentação de Planos VIP & Checkout',
        description: 'Mostra valores em R$ ou USD/EUR com botões de compra direta.',
        enabled: true,
        order: 4,
      },
      {
        id: 'payment_validation',
        name: 'Validação de Pagamento Automática (SyncPay)',
        description: 'Verificação de PIX ou cartão aprovado antes de liberar acessos.',
        enabled: true,
        order: 5,
      },
      {
        id: 'vip_delivery',
        name: 'Liberação do Canal VIP Anti-Vazamento',
        description: 'Entrega link de uso único que expira após 1 entrada.',
        enabled: true,
        order: 6,
      },
      {
        id: 'followup_recovery',
        name: 'Recuperação Agressiva de Lead (25% a 40% OFF)',
        description: 'Dispara ofertas de desconto progressivas caso o lead hesite.',
        enabled: true,
        order: 7,
      },
    ];
  }

  private toPublicBot(bot: StoredBot): Bot {
    const avatarFile = bot.avatarFile ? path.join(AVATAR_DIR, bot.avatarFile) : '';
    const botChats = this.db.chats.filter((chat) => chat.botId === bot.id);
    const groupsCount = botChats.filter((c) => c.type === 'group' || c.type === 'supergroup').length;
    const channelsCount = botChats.filter((c) => c.type === 'channel').length;

    return {
      id: bot.id,
      username: bot.username,
      firstName: bot.firstName,
      description: bot.description,
      avatarUrl:
        bot.avatarDataUrl ||
        (avatarFile && fs.existsSync(avatarFile)
          ? `/api/bots/${encodeURIComponent(bot.id)}/avatar`
          : null),
      status: bot.status,
      canJoinGroups: bot.canJoinGroups,
      canReadAllGroupMessages: bot.canReadAllGroupMessages,
      supportsInlineQueries: bot.supportsInlineQueries,
      webhookUrl: bot.webhookUrl ? bot.webhookUrl.split('?')[0] : null,
      pendingUpdates: bot.pendingUpdates,
      commands: bot.commands,
      createdAt: bot.createdAt,
      lastSyncAt: bot.lastSyncAt,
      lastError: bot.lastError,
      leadsCount: this.db.leads.filter((lead) => lead.botId === bot.id).length,
      chatsCount: botChats.length,
      groupsCount,
      channelsCount,
      language: bot.language || 'pt',
      niche: bot.niche || 'Modelo Hot',
      vipChannelId: bot.vipChannelId || null,
      vipChannelTitle: bot.vipChannelTitle || null,
      vipInviteLink: bot.vipInviteLink || null,
      vipRequirements: bot.vipRequirements || {
        requireTerms: true,
        requirePayment: true,
        singleUseLink: true,
      },
      operatingMode: bot.operatingMode || 'conversational_sales',
      funnelStages: bot.funnelStages && bot.funnelStages.length > 0 ? bot.funnelStages : this.getDefaultFunnelStages(),
      previewGroupId: bot.previewGroupId || null,
      previewGroupTitle: bot.previewGroupTitle || null,
      previewGroupInviteLink: bot.previewGroupInviteLink || null,
      previewScheduleMode: bot.previewScheduleMode || 'off',
      previewScheduleIntervalHours: bot.previewScheduleIntervalHours || 4,
      previewScheduleHours: bot.previewScheduleHours || ['12:00', '18:00', '22:30'],
      previewAutoMedia: bot.previewAutoMedia ?? true,
      previewLastSentAt: bot.previewLastSentAt || null,
    };
  }

  private buildMetrics(): Metrics {
    const now = Date.now();
    const days: DayCount[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(now - i * 86_400_000);
      days.push({ date: date.toISOString().slice(0, 10), leads: 0, messages: 0 });
    }
    const dayIndex = new Map(days.map((day) => [day.date, day]));
    for (const lead of this.db.leads) {
      const key = lead.firstContactAt.slice(0, 10);
      const day = dayIndex.get(key);
      if (day) day.leads += 1;
    }
    for (const message of this.db.messages) {
      const key = message.createdAt.slice(0, 10);
      const day = dayIndex.get(key);
      if (day) day.messages += 1;
    }
    const statusOrder: LeadStatus[] = ['novo', 'interessado', 'qualificado', 'cliente', 'arquivado'];
    const statusCounts = statusOrder.map((status) => ({
      status,
      count: this.db.leads.filter((lead) => lead.status === status).length,
    }));
    const sourceMap = new Map<string, number>();
    for (const lead of this.db.leads) {
      sourceMap.set(lead.sourceChatTitle, (sourceMap.get(lead.sourceChatTitle) || 0) + 1);
    }
    const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
    const sent7d = this.db.messages.filter(
      (message) => message.direction === 'out' && message.createdAt >= sevenDaysAgo
    ).length;
    const received7d = this.db.messages.filter(
      (message) => message.direction === 'in' && message.createdAt >= sevenDaysAgo
    ).length;
    const activeLeads = this.db.leads.filter((lead) => lead.lastMessageAt >= sevenDaysAgo).length;
    return {
      totalLeads: this.db.leads.length,
      newLeads7d: this.db.leads.filter((lead) => lead.firstContactAt >= sevenDaysAgo).length,
      activeLeads,
      qualifiedLeads: this.db.leads.filter(
        (lead) => lead.status === 'qualificado' || lead.status === 'cliente'
      ).length,
      totalMessages: this.db.messages.length,
      sent7d,
      received7d,
      responseRate:
        received7d > 0 ? Math.min(100, Math.round((sent7d / received7d) * 100)) : 0,
      statusCounts,
      daily: days,
      topSources: Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  private buildSalesMetrics(): SalesMetrics {
    const purchases = this.db.purchases;
    const paid = purchases.filter((purchase) => purchase.status === 'pago');
    const pending = purchases.filter((purchase) => purchase.status === 'pendente');
    const refunded = purchases.filter((purchase) => purchase.status === 'reembolsado');
    const sum = (items: Purchase[]) => items.reduce((total, item) => total + item.amountCents, 0);
    const paidCents = sum(paid);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return {
      paidCents,
      pendingCents: sum(pending),
      refundedCents: sum(refunded),
      paidCount: paid.length,
      pendingCount: pending.length,
      refundedCount: refunded.length,
      last7dCents: sum(paid.filter((purchase) => (purchase.paidAt || purchase.createdAt) >= sevenDaysAgo)),
      ticketCents: paid.length > 0 ? Math.round(paidCents / paid.length) : 0,
      conversionRate:
        this.db.leads.length > 0
          ? Math.round((paid.length / this.db.leads.length) * 1000) / 10
          : 0,
    };
  }

  private buildAutomationSummary(): AutomationSummary {
    const today = new Date().toISOString().slice(0, 10);
    const in24h = new Date(Date.now() + 86_400_000).toISOString();
    const active = this.db.leads.filter(
      (lead) => lead.followUp && lead.followUp.nextRunAt && !lead.followUp.stoppedReason
    );
    const due = active.filter((lead) => (lead.followUp?.nextRunAt || '') <= in24h);
    const nextRunAt =
      active
        .map((lead) => lead.followUp?.nextRunAt || '')
        .filter(Boolean)
        .sort()[0] || null;
    return {
      sequencesActive: this.db.sequences.filter((sequence) => sequence.active).length,
      sequencesTotal: this.db.sequences.length,
      leadsInFollowUp: active.length,
      dueIn24h: due.length,
      sentToday: this.db.leads.filter(
        (lead) => lead.followUp?.lastSentAt && lead.followUp.lastSentAt.slice(0, 10) === today
      ).length,
      stoppedToday: this.db.leads.filter(
        (lead) =>
          lead.followUp?.stoppedReason &&
          lead.followUp.lastSentAt &&
          lead.followUp.lastSentAt.slice(0, 10) === today
      ).length,
      templatesActive: this.db.templates.filter((template) => template.active).length,
      templatesTotal: this.db.templates.length,
      nextRunAt,
    };
  }

  private publicIntegrations(): PublicIntegrations {
    const base = (this.db.settings.publicBaseUrl || DEPLOY_URL || '').replace(/\/$/, '');
    const token = this.db.integrations.syncpay.webhookToken;
    const syncpay = this.db.integrations.syncpay;
    return {
      syncpay: {
        configured: Boolean(syncpay.clientId && syncpay.clientSecretEnc),
        enabled: syncpay.enabled,
        clientId: syncpay.clientId,
        webhookUrl: base ? `${base}/api/payments/webhook/syncpay${token ? `/${token}` : ''}` : '',
      },
      cron: {
        protected: Boolean(process.env.CRON_SECRET),
        url: base ? `${base}/api/cron/tick` : '',
      },
    };
  }

  getPublicState(): AppState {
    this.assertLoaded();
    const base = (this.db.settings.publicBaseUrl || DEPLOY_URL || '').replace(/\/$/, '');
    return {
      bots: this.db.bots.map((bot) => this.toPublicBot(bot)),
      chats: clone(this.db.chats),
      leads: clone(this.db.leads),
      messages: clone(this.db.messages.slice(0, 500)),
      campaigns: clone(this.db.campaigns),
      templates: clone(this.db.templates),
      sequences: clone(this.db.sequences),
      products: clone(this.db.products),
      purchases: clone(this.db.purchases.slice(0, 300)),
      settings: clone(this.db.settings),
      integrations: this.publicIntegrations(),
      metrics: this.buildMetrics(),
      sales: this.buildSalesMetrics(),
      automation: this.buildAutomationSummary(),
      server: {
        now: new Date().toISOString(),
        version: VERSION,
        storage: this.storageLabel,
        storageKind: this.storageKind,
        serverless: IS_SERVERLESS,
        pollingEnabled: POLLING_ENABLED && !IS_SERVERLESS,
        publicBaseUrl: base || PUBLIC_BASE_URL,
        passwordProtected: Boolean(process.env.PANEL_PASSWORD),
        cronProtected: Boolean(process.env.CRON_SECRET),
      },
    };
  }

  get rawBots(): StoredBot[] {
    this.assertLoaded();
    return this.db.bots;
  }

  get rawLeads(): Lead[] {
    this.assertLoaded();
    return this.db.leads;
  }

  get rawChats(): Chat[] {
    this.assertLoaded();
    return this.db.chats;
  }

  get rawCampaigns(): Campaign[] {
    this.assertLoaded();
    return this.db.campaigns;
  }

  get rawTemplates(): MessageTemplate[] {
    this.assertLoaded();
    return this.db.templates;
  }

  get rawSequences(): FollowUpSequence[] {
    this.assertLoaded();
    return this.db.sequences;
  }

  get rawProducts(): Product[] {
    this.assertLoaded();
    return this.db.products;
  }

  get rawPurchases(): Purchase[] {
    this.assertLoaded();
    return this.db.purchases;
  }

  get stats() {
    return {
      bots: this.db.bots.length,
      leads: this.db.leads.length,
      messages: this.db.messages.length,
      campaigns: this.db.campaigns.length,
      chats: this.db.chats.length,
      templates: this.db.templates.length,
      purchases: this.db.purchases.length,
    };
  }
}

export const store = new Store();

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
