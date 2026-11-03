import type {
  AddChatInput,
  AppState,
  BroadcastInput,
  Campaign,
  CreateCampaignInput,
  CreateChargeInput,
  CreateProductInput,
  CreateSequenceInput,
  CreateTemplateInput,
  FollowUpSequence,
  GenerateTemplatesInput,
  Lead,
  MessageTemplate,
  Product,
  PublicIntegrations,
  Purchase,
  RegisterPurchaseInput,
  SendMessageInput,
  Settings,
  UpdateLeadInput,
  UpdateSettingsInput,
} from '@shared/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Falha na requisição (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body || {}) });
}

function patch<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
}

function remove<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'DELETE' });
}

export const api = {
  authStatus: () =>
    request<{ passwordProtected: boolean; authenticated: boolean }>('/api/auth/status'),
  login: (password: string) => post<{ ok: boolean }>('/api/auth/login', { password }),
  logout: () => post<{ ok: boolean }>('/api/auth/logout'),
  state: () => request<AppState>('/api/state'),
  connectBot: (token: string, options?: { language?: string; niche?: string }) =>
    post<{ ok: boolean; bot: AppState['bots'][number] }>('/api/bots', { token, ...options }),
  refreshBot: (id: string) => post<{ ok: boolean; latencyMs: number }>(`/api/bots/${id}/refresh`),
  deleteBot: (id: string) => request<{ ok: boolean }>(`/api/bots/${id}`, { method: 'DELETE' }),
  syncBot: (id: string) =>
    post<{ ok: boolean; processed: number; leads: number; state: AppState }>(`/api/bots/${id}/sync`),
  syncAll: () =>
    post<{ ok: boolean; results: Array<{ botId: string; username: string; processed: number; leads: number; error?: string }>; state: AppState }>(
      '/api/bots/sync-all'
    ),
  setWebhook: (id: string, publicBaseUrl?: string) =>
    post<{ ok: boolean; webhookUrl: string }>(`/api/bots/${id}/webhook`, { publicBaseUrl }),
  removeWebhook: (id: string) =>
    request<{ ok: boolean }>(`/api/bots/${id}/webhook`, { method: 'DELETE' }),
  installCommands: (id: string) =>
    post<{ ok: boolean; commands: Array<{ command: string; description: string }> }>(
      `/api/bots/${id}/commands`,
      {}
    ),
  addChat: (input: AddChatInput) =>
    post<{ ok: boolean; chat: AppState['chats'][number]; warning: string | null }>('/api/chats', input),
  deleteChat: (id: string) => request<{ ok: boolean }>(`/api/chats/${id}`, { method: 'DELETE' }),
  updateLead: (id: string, input: UpdateLeadInput) =>
    patch<{ ok: boolean; lead: Lead }>(`/api/leads/${id}`, input),
  deleteLead: (id: string) => request<{ ok: boolean }>(`/api/leads/${id}`, { method: 'DELETE' }),
  startLeadFollowUp: (id: string, sequenceId?: string) =>
    patch<{ ok: boolean; lead: Lead }>(`/api/leads/${id}/followup`, {
      action: 'start',
      sequenceId,
    }),
  stopLeadFollowUp: (id: string) =>
    patch<{ ok: boolean; lead: Lead }>(`/api/leads/${id}/followup`, { action: 'stop' }),
  uploadMedia: (input: { filename: string; dataUrl: string; mediaType?: 'photo' | 'video' | 'animation' }) =>
    post<{ ok: boolean; url: string; fullUrl: string; filename: string; size: number; mediaType: 'photo' | 'video' | 'animation' }>(
      '/api/upload',
      input
    ),
  sendMessage: (input: SendMessageInput) =>
    post<{ ok: boolean; messageId?: string; error?: string }>('/api/messages/send', input),
  broadcast: (input: BroadcastInput) =>
    post<{ ok: boolean; total: number; sent: number; failed: number; errors: string[] }>(
      '/api/messages/broadcast',
      input
    ),
  createCampaign: (input: CreateCampaignInput) =>
    post<{ ok: boolean; campaign: Campaign }>('/api/campaigns', input),
  updateCampaign: (
    id: string,
    input: { status?: 'agendada' | 'pausada'; scheduledFor?: string; endsAt?: string | null }
  ) => patch<{ ok: boolean; campaign: Campaign }>(`/api/campaigns/${id}`, input),
  deleteCampaign: (id: string) =>
    request<{ ok: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),
  runCampaign: (id: string) =>
    post<{ ok: boolean; sent: number; failed: number; state: AppState }>(
      `/api/campaigns/${id}/run`
    ),
  updateSettings: (input: UpdateSettingsInput) =>
    patch<{ ok: boolean; settings: Settings }>('/api/settings', input),

  // ---------- Templates ----------
  createTemplate: (input: CreateTemplateInput) =>
    post<{ ok: boolean; template: MessageTemplate }>('/api/templates', input),
  updateTemplate: (id: string, input: Partial<CreateTemplateInput>) =>
    patch<{ ok: boolean; template: MessageTemplate }>(`/api/templates/${id}`, input),
  deleteTemplate: (id: string) => remove<{ ok: boolean }>(`/api/templates/${id}`),
  previewTemplate: (input: {
    body: string;
    leadId?: string | null;
    productId?: string | null;
    botId?: string | null;
  }) => post<{ ok: boolean; text: string }>('/api/templates/preview', input),
  generateTemplates: (input: GenerateTemplatesInput) =>
    post<{
      ok: boolean;
      variants: Array<{ name: string; body: string; category: string }>;
      created: MessageTemplate[];
      saved: boolean;
    }>('/api/templates/generate', input),

  // ---------- Sequências ----------
  createSequence: (input: CreateSequenceInput) =>
    post<{ ok: boolean; sequence: FollowUpSequence }>('/api/sequences', input),
  updateSequence: (id: string, input: Partial<CreateSequenceInput>) =>
    patch<{ ok: boolean; sequence: FollowUpSequence }>(`/api/sequences/${id}`, input),
  deleteSequence: (id: string) => remove<{ ok: boolean }>(`/api/sequences/${id}`),
  previewSequence: (id: string) =>
    post<{ ok: boolean; previews: Array<{ delayMinutes: number; templateName: string; text: string }> }>(
      `/api/sequences/${id}/preview`,
      {}
    ),

  // ---------- Produtos ----------
  createProduct: (input: CreateProductInput) =>
    post<{ ok: boolean; product: Product }>('/api/products', input),
  updateProduct: (id: string, input: Partial<CreateProductInput>) =>
    patch<{ ok: boolean; product: Product }>(`/api/products/${id}`, input),
  deleteProduct: (id: string) => remove<{ ok: boolean }>(`/api/products/${id}`),

  // ---------- Vendas ----------
  createCharge: (input: CreateChargeInput) =>
    post<{
      ok: boolean;
      purchase: Purchase;
      pixCode: string;
      amount: string;
      warning?: string;
    }>('/api/charges', input),
  createPurchase: (input: RegisterPurchaseInput) =>
    post<{ ok: boolean; purchase: Purchase }>('/api/purchases', input),
  updatePurchase: (id: string, input: { status?: Purchase['status']; notes?: string }) =>
    patch<{ ok: boolean; purchase: Purchase; delivered?: boolean; deliveryError?: string }>(
      `/api/purchases/${id}`,
      input
    ),
  reconcilePurchase: (id: string) =>
    post<{ ok: boolean; purchase: Purchase }>(`/api/purchases/${id}/reconcile`, {}),
  deliverPurchase: (id: string) =>
    post<{ ok: boolean }>(`/api/purchases/${id}/deliver`, {}),

  // ---------- Integrações ----------
  saveSyncPay: (input: { clientId?: string; clientSecret?: string; enabled?: boolean }) =>
    post<{ ok: boolean; integrations: PublicIntegrations }>('/api/integrations/syncpay', input),
  testSyncPay: () => post<{ ok: boolean; latencyMs: number }>('/api/integrations/syncpay/test', {}),
  rotateSyncPayWebhook: () =>
    post<{ ok: boolean; webhookUrl: string; integrations: PublicIntegrations }>(
      '/api/integrations/syncpay/rotate-webhook',
      {}
    ),

  runAutomation: () =>
    post<{
      ok: boolean;
      campaigns: { executed: number; sent: number; failed: number; expired: number };
      followUps: { sent: number; failed: number; stopped: number; rescheduled: number; skipped: string | null };
      ms: number;
      automation: AppState['automation'];
    }>('/api/automation/run', {}),

  clearData: (confirm: string) => post<{ ok: boolean }>('/api/data/clear', { confirm }),
};
