import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  DollarSign,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { AppState, Product, Purchase, PurchaseStatus } from '@shared/types';
import { api } from '../lib/api';
import { formatBRL, formatDate, formatFullDate, formatNumber } from '../lib/format';
import { Modal } from './Modal';
import { TelegramPreview } from './TelegramPreview';
import { useToast } from './Toast';
import { notifications } from '../lib/notifications';

interface SalesProps {
  state: AppState;
  selectedBotId: string;
  refresh: () => Promise<void>;
}

const STATUS_LABEL: Record<PurchaseStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
};

const STATUS_CLASS: Record<PurchaseStatus, string> = {
  pendente: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  pago: 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]',
  cancelado: 'border-slate-500/25 bg-slate-500/10 text-slate-400',
  reembolsado: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
};

function parsePriceToCents(input: string): number {
  let value = String(input || '').trim().replace(/[^\d.,]/g, '');
  if (value.includes(',') && value.includes('.')) value = value.replace(/\./g, '').replace(',', '.');
  else if (value.includes(',')) value = value.replace(',', '.');
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function priceInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2).replace('.', ',');
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function Sales({ state, selectedBotId, refresh }: SalesProps) {
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todas' | PurchaseStatus>('todas');

  const [syncForm, setSyncForm] = useState({
    clientId: state.integrations.syncpay.clientId || '',
    clientSecret: '',
    enabled: state.integrations.syncpay.enabled,
  });

  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '7,90',
    pixCode: '',
    checkoutUrl: '',
    deliveryText: '',
    active: true,
  });

  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    botId: selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '',
    leadId: '',
    productId: state.products[0]?.id || '',
    customerName: '',
    customerEmail: '',
    customerDocument: '',
    customerPhone: '',
  });
  const [chargeResult, setChargeResult] = useState<{
    pixCode: string;
    amount: string;
    warning?: string;
    purchase: Purchase;
  } | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    botId: selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '',
    leadId: '',
    productId: state.products[0]?.id || '',
    amount: '7,90',
    status: 'pago' as PurchaseStatus,
    notes: '',
  });

  const purchases = useMemo(() => {
    const scoped =
      selectedBotId === 'all'
        ? state.purchases
        : state.purchases.filter((purchase) => purchase.botId === selectedBotId);
    const list = filter === 'todas' ? scoped : scoped.filter((purchase) => purchase.status === filter);
    return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.purchases, selectedBotId, filter]);

  const sales = state.sales;
  const integration = state.integrations.syncpay;

  const saveSyncPay = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('sync');
    try {
      await api.saveSyncPay({
        clientId: syncForm.clientId.trim(),
        clientSecret: syncForm.clientSecret.trim() || undefined,
        enabled: syncForm.enabled,
      });
      setSyncForm({ ...syncForm, clientSecret: '' });
      notify('success', 'SyncPay salva', 'As credenciais ficam cifradas no banco.');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao salvar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const testSyncPay = async () => {
    setBusy('test');
    try {
      const result = await api.testSyncPay();
      notify('success', 'SyncPay respondeu', `Token gerado em ${result.latencyMs} ms.`);
    } catch (error) {
      notify('error', 'SyncPay recusou', error instanceof Error ? error.message : 'Confira as credenciais.');
    } finally {
      setBusy(null);
    }
  };

  const rotateWebhook = async () => {
    if (!window.confirm('Gerar uma nova URL de webhook? A URL antiga para de funcionar na SyncPay.')) return;
    setBusy('rotate');
    try {
      await api.rotateSyncPayWebhook();
      notify('success', 'Webhook rotacionado', 'Atualize a URL no painel da SyncPay.');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao rotacionar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', price: '7,90', pixCode: '', checkoutUrl: '', deliveryText: '', active: true });
    setProductOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: priceInput(product.priceCents),
      pixCode: product.pixCode || '',
      checkoutUrl: product.checkoutUrl || '',
      deliveryText: product.deliveryText,
      active: product.active,
    });
    setProductOpen(true);
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const priceCents = parsePriceToCents(productForm.price);
    if (priceCents < 100) {
      notify('error', 'Preço inválido', 'Informe pelo menos R$ 1,00.');
      return;
    }
    setBusy('product');
    try {
      const payload = {
        name: productForm.name.trim(),
        priceCents,
        pixCode: productForm.pixCode.trim() || null,
        checkoutUrl: productForm.checkoutUrl.trim() || null,
        deliveryText: productForm.deliveryText.trim(),
        active: productForm.active,
      };
      if (editingProduct) await api.updateProduct(editingProduct.id, payload);
      else await api.createProduct(payload);
      notify('success', editingProduct ? 'Produto atualizado' : 'Produto criado', payload.name);
      setProductOpen(false);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao salvar', error instanceof Error ? error.message : 'Revise os dados.');
    } finally {
      setBusy(null);
    }
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) return;
    setBusy(`delprod-${product.id}`);
    try {
      await api.deleteProduct(product.id);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao excluir', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const openCharge = () => {
    setChargeResult(null);
    setChargeForm({
      botId: selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '',
      leadId: '',
      productId: state.products[0]?.id || '',
      customerName: '',
      customerEmail: '',
      customerDocument: '',
      customerPhone: '',
    });
    setChargeOpen(true);
  };

  const submitCharge = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('charge');
    try {
      const result = await api.createCharge({
        botId: chargeForm.botId,
        leadId: chargeForm.leadId || null,
        productId: chargeForm.productId,
        customerName: chargeForm.customerName || undefined,
        customerEmail: chargeForm.customerEmail || undefined,
        customerDocument: chargeForm.customerDocument || undefined,
        customerPhone: chargeForm.customerPhone || undefined,
      });
      setChargeResult({
        pixCode: result.pixCode,
        amount: result.amount,
        warning: result.warning,
        purchase: result.purchase,
      });
      await refresh();
    } catch (error) {
      notify('error', 'Cobrança não criada', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const sendPixToLeadTelegram = async () => {
    if (!chargeResult || !chargeForm.leadId) return;
    const lead = state.leads.find((l) => l.id === chargeForm.leadId);
    if (!lead) return;
    const pixText = `✅ Como realizar o pagamento:\n\n1. Abra o aplicativo do seu banco.\n2. Selecione a opção "Pagar" ou "PIX".\n3. Escolha "PIX Copia e Cola".\n4. Cole a chave que está abaixo e finalize o pagamento com segurança.\n\nCopie o código abaixo:\n\n\`${chargeResult.pixCode}\`\n\nApós efetuar o pagamento, o seu acesso é liberado automaticamente. 🎁`;
    setBusy('send-pix');
    try {
      await api.sendMessage({
        botId: chargeForm.botId,
        chatId: lead.telegramUserId,
        text: pixText,
        leadId: lead.id,
      });
      notify('success', 'PIX Enviado no Telegram!', `Mensagem entregue para @${lead.username || lead.name}.`);
    } catch (err) {
      notify('error', 'Falha ao enviar no Telegram', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('manual');
    try {
      await api.createPurchase({
        botId: manualForm.botId,
        leadId: manualForm.leadId || null,
        productId: manualForm.productId || null,
        amountCents: parsePriceToCents(manualForm.amount),
        status: manualForm.status,
        notes: manualForm.notes || undefined,
      });
      if (manualForm.status === 'pago') {
        notifications.notifySale({
          valor: parsePriceToCents(manualForm.amount) / 100,
          leadName: manualForm.notes || 'Venda Manual',
          botName: state.bots.find((b) => b.id === manualForm.botId)?.firstName || 'Modelo Hot',
          tipo: 'Venda Manual Confirmada',
        });
      }
      notify('success', 'Venda registrada', 'Se estava como paga, o acesso foi entregue.');
      setManualOpen(false);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao registrar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const changePurchaseStatus = async (purchase: Purchase, status: PurchaseStatus) => {
    setBusy(`buy-${purchase.id}`);
    try {
      const result = await api.updatePurchase(purchase.id, { status });
      if (status === 'pago') {
        notifications.notifySale({
          valor: purchase.amountCents / 100,
          leadName: purchase.customerName || 'Cliente VIP',
          botName: state.bots.find((b) => b.id === purchase.botId)?.firstName || 'Modelo Hot',
          tipo: 'Pagamento Confirmado',
        });
        notify(
          result.delivered ? 'success' : 'info',
          result.delivered ? 'Pagamento confirmado' : 'Pago, entrega pendente',
          result.delivered
            ? 'Mensagem de acesso enviada no Telegram.'
            : result.deliveryError || 'Reenvie o acesso manualmente.'
        );
      } else {
        notify('success', 'Compra atualizada', STATUS_LABEL[status]);
      }
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao atualizar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const reconcile = async (purchase: Purchase) => {
    setBusy(`rec-${purchase.id}`);
    try {
      const result = await api.reconcilePurchase(purchase.id);
      notify('success', 'Status sincronizado', STATUS_LABEL[result.purchase.status]);
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao consultar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const deliver = async (purchase: Purchase) => {
    setBusy(`del-${purchase.id}`);
    try {
      await api.deliverPurchase(purchase.id);
      notify('success', 'Acesso reenviado', 'Mensagem entregue no Telegram.');
      await refresh();
    } catch (error) {
      notify('error', 'Falha ao entregar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const copy = async (value: string, label: string) => {
    const ok = await copyText(value);
    notify(ok ? 'success' : 'error', ok ? 'Copiado' : 'Não foi possível copiar', label);
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Faturado', value: formatBRL(sales.paidCents), hint: `${sales.paidCount} vendas pagas`, icon: Wallet },
          { label: 'Aguardando PIX', value: formatBRL(sales.pendingCents), hint: `${sales.pendingCount} pendentes`, icon: CreditCard },
          { label: 'Ticket médio', value: formatBRL(sales.ticketCents), hint: `Últimos 7d: ${formatBRL(sales.last7dCents)}`, icon: DollarSign },
          { label: 'Conversão', value: `${sales.conversionRate}%`, hint: `${sales.refundedCount} reembolsos`, icon: ShoppingCart },
        ].map((card) => (
          <div key={card.label} className="card p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#6f7c91]">
              <card.icon className="h-3.5 w-3.5 text-[#d4f933]" />
              {card.label}
            </div>
            <div className="mt-1.5 text-2xl font-bold text-white">{card.value}</div>
            <div className="text-[10px] text-[#657287]">{card.hint}</div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <KeyRound className="h-4 w-4 text-[#d4f933]" /> Integração SyncPay
            </h2>
            <p className="mt-1 text-[11px] text-[#7b879b]">
              Credenciais do painel da SyncPay (Developer API). O segredo fica cifrado no banco e nunca volta para o navegador.
            </p>
          </div>
          <span
            className={`badge ${
              integration.configured
                ? 'border-[#d4f933]/25 bg-[#d4f933]/10 text-[#d4f933]'
                : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
            }`}
          >
            {integration.configured ? 'Configurada' : 'Não configurada'}
          </span>
        </div>

        <form onSubmit={saveSyncPay} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="label" htmlFor="sync-id">Client ID</label>
            <input
              id="sync-id"
              className="input"
              value={syncForm.clientId}
              onChange={(event) => setSyncForm({ ...syncForm, clientId: event.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div>
            <label className="label" htmlFor="sync-secret">Client Secret</label>
            <input
              id="sync-secret"
              type="password"
              className="input"
              value={syncForm.clientSecret}
              onChange={(event) => setSyncForm({ ...syncForm, clientSecret: event.target.value })}
              placeholder={integration.configured ? '•••••• (deixe vazio para manter)' : 'cole o secret'}
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={busy === 'sync'} className="btn-primary text-xs">
              {busy === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Salvar
            </button>
            <button type="button" onClick={testSyncPay} disabled={busy === 'test'} className="btn-secondary text-xs">
              {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Testar
            </button>
          </div>
        </form>

        <div className="mt-3 rounded-xl border border-[#232b3a] bg-[#0c1017] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6f7c91]">
              <Link2 className="h-3.5 w-3.5 text-[#d4f933]" /> URL de callback (webhook)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copy(integration.webhookUrl || '', 'URL do webhook')}
                disabled={!integration.webhookUrl}
                className="btn-secondary text-[10px]"
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
              <button type="button" onClick={rotateWebhook} disabled={busy === 'rotate'} className="btn-secondary text-[10px]">
                <RefreshCw className="h-3 w-3" /> Rotacionar
              </button>
            </div>
          </div>
          <code className="mt-1.5 block break-all text-[11px] text-[#9aa6ba]">
            {integration.webhookUrl || 'Defina a URL pública do painel em Ajustes para gerar o webhook.'}
          </code>
          <p className="mt-1 text-[10px] text-[#657287]">
            Cole essa URL no cadastro de webhook da SyncPay (evento cash-in atualizado). A SyncPay envia o header
            Authorization com esse mesmo token.
          </p>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-white">Produtos</h2>
            <p className="mt-1 text-[11px] text-[#7b879b]">
              Preço, código PIX copia e cola e a mensagem de entrega enviada após o pagamento.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={openCharge} disabled={state.products.length === 0} className="btn-secondary text-xs">
              <CreditCard className="h-3.5 w-3.5" /> Gerar PIX
            </button>
            <button type="button" onClick={openNewProduct} className="btn-primary text-xs">
              <Plus className="h-3.5 w-3.5" /> Novo produto
            </button>
          </div>
        </div>

        {state.products.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[#252e3f] bg-[#0c1017] p-6 text-center text-xs text-[#7b879b]">
            Nenhum produto. Cadastre o primeiro para gerar cobranças PIX reais.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {state.products.map((product) => (
              <article key={product.id} className="rounded-xl border border-[#232b3a] bg-[#0c1017] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">{product.name}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[#9aa6ba]">
                      <strong className="text-[#d4f933]">{formatBRL(product.priceCents)}</strong>
                      <span>·</span>
                      <span>{product.pixCode ? 'PIX cadastrado' : 'sem PIX fixo'}</span>
                      {!product.active && <span className="text-amber-300">· inativo</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEditProduct(product)} className="rounded-lg px-2 text-[10px] font-semibold text-[#9aa6ba] hover:bg-[#171c26] hover:text-white">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeProduct(product)}
                      className="rounded-lg p-2 text-[#657287] hover:bg-rose-400/10 hover:text-rose-300"
                      aria-label="Excluir produto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {product.pixCode && (
                  <button
                    type="button"
                    onClick={() => void copy(product.pixCode || '', 'Código PIX')}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[#232b3a] bg-[#0a0e13] px-2 py-1.5 text-left text-[10px] text-[#7f8ca0] hover:text-white"
                  >
                    <Copy className="h-3 w-3 shrink-0" />
                    <span className="truncate">{product.pixCode}</span>
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#1c2434] pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Compras & Transações</h2>
              <span className="badge border-[#293448] bg-[#141924] text-[10px] text-[#93a2b7]">
                {purchases.length} {purchases.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#7b879b]">
              Tudo que o webhook da SyncPay e pagamentos PIX registrarem aparece aqui em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <select
                className="h-10 w-40 appearance-none rounded-xl border border-[#273244] bg-[#0c1017] pl-3 pr-8 text-xs font-semibold text-[#ccd7e6] transition focus:border-[#d4f933] focus:outline-none"
                value={filter}
                onChange={(event) => setFilter(event.target.value as 'todas' | PurchaseStatus)}
              >
                <option value="todas">Todas as compras</option>
                {(['pendente', 'pago', 'cancelado', 'reembolsado'] as PurchaseStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#708198]" />
            </div>

            <button
              type="button"
              onClick={() => setManualOpen(true)}
              disabled={state.bots.length === 0}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[#2c374b] bg-[#151c27] px-3.5 text-xs font-semibold text-white transition hover:border-[#d4f933] hover:text-[#d4f933] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5 text-[#d4f933]" />
              <span>Venda manual</span>
            </button>
          </div>
        </div>

        {purchases.length === 0 ? (
          <div className="my-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#242e40] bg-[#0d1118]/60 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2d384c] bg-[#141924] text-[#d4f933] shadow-inner">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-white">Nenhuma compra registrada</h3>
            <p className="mt-1 max-w-sm text-xs text-[#738399]">
              {filter === 'todas'
                ? 'Novas transações aprovadas e PIX gerados aparecerão aqui em tempo real via webhook.'
                : `Nenhuma compra encontrada com o status "${STATUS_LABEL[filter]}".`}
            </p>
            {filter === 'todas' && state.bots.length > 0 && (
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="mt-4 flex items-center gap-1.5 rounded-xl border border-[#d4f933]/30 bg-[#d4f933]/10 px-3.5 py-1.5 text-xs font-bold text-[#d4f933] transition hover:bg-[#d4f933]/20"
              >
                <Plus className="h-3.5 w-3.5" /> Registrar Venda Manual
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#232b3a] text-[10px] uppercase tracking-wide text-[#6f7c91]">
                  <th className="py-2 pr-3 font-semibold">Data</th>
                  <th className="py-2 pr-3 font-semibold">Cliente</th>
                  <th className="py-2 pr-3 font-semibold">Produto</th>
                  <th className="py-2 pr-3 font-semibold">Valor</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Origem</th>
                  <th className="py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const lead = purchase.leadId ? state.leads.find((item) => item.id === purchase.leadId) : null;
                  const product = purchase.productId
                    ? state.products.find((item) => item.id === purchase.productId)
                    : null;
                  return (
                    <tr key={purchase.id} className="border-b border-[#1a212e] last:border-0">
                      <td className="py-2 pr-3 text-[#7f8ca0]" title={formatFullDate(purchase.createdAt)}>
                        {formatDate(purchase.createdAt)}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-[#d7dde7]">{purchase.customerName || lead?.name || '—'}</div>
                        <div className="text-[10px] text-[#657287]">{lead?.username ? `@${lead.username}` : purchase.customerEmail || '—'}</div>
                      </td>
                      <td className="py-2 pr-3 text-[#9aa6ba]">{product?.name || '—'}</td>
                      <td className="py-2 pr-3 font-semibold text-white">{formatBRL(purchase.amountCents)}</td>
                      <td className="py-2 pr-3">
                        <span className={`badge ${STATUS_CLASS[purchase.status]}`}>{STATUS_LABEL[purchase.status]}</span>
                      </td>
                      <td className="py-2 pr-3 text-[10px] uppercase text-[#657287]">{purchase.provider}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          {purchase.status !== 'pago' && purchase.provider === 'syncpay' && (
                            <button
                              type="button"
                              onClick={() => void reconcile(purchase)}
                              disabled={busy === `rec-${purchase.id}`}
                              className="btn-secondary text-[10px]"
                              title="Consultar na SyncPay"
                            >
                              {busy === `rec-${purchase.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            </button>
                          )}
                          {purchase.status === 'pendente' && (
                            <button
                              type="button"
                              onClick={() => void changePurchaseStatus(purchase, 'pago')}
                              disabled={busy === `buy-${purchase.id}`}
                              className="btn-secondary text-[10px]"
                              title="Marcar como pago"
                            >
                              {busy === `buy-${purchase.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            </button>
                          )}
                          {purchase.status === 'pago' && !purchase.deliverySentAt && (
                            <button
                              type="button"
                              onClick={() => void deliver(purchase)}
                              disabled={busy === `del-${purchase.id}`}
                              className="btn-secondary text-[10px]"
                              title="Reenviar acesso"
                            >
                              <Send className="h-3 w-3" />
                            </button>
                          )}
                          {purchase.status === 'pago' && (
                            <button
                              type="button"
                              onClick={() => void changePurchaseStatus(purchase, 'reembolsado')}
                              className="rounded-lg px-2 text-[10px] text-[#657287] hover:text-rose-300"
                            >
                              Reembolsar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#1a212e] pt-3 text-xs text-[#75849a]">
          <div className="flex items-center gap-2">
            <span>
              Total filtrado: <strong className="text-white">{formatNumber(purchases.length)}</strong>
            </span>
            <span>•</span>
            <span>
              Faturamento:{' '}
              <strong className="text-[#d4f933]">
                {formatBRL(purchases.reduce((sum, item) => sum + item.amountCents, 0))}
              </strong>
            </span>
          </div>
          <span className="text-[10px] text-[#616f84]">Sincronização em tempo real com SyncPay & Telegram</span>
        </div>
      </section>

      <Modal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        title={editingProduct ? 'Editar produto' : 'Novo produto'}
        description="O código PIX abaixo é o que os modelos enviam em {pix}."
        footer={
          <>
            <button type="button" onClick={() => setProductOpen(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" form="product-form" disabled={busy === 'product'} className="btn-primary text-xs">
              {busy === 'product' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Salvar
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={saveProduct} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="label" htmlFor="prod-name">Nome</label>
              <input
                id="prod-name"
                className="input"
                value={productForm.name}
                onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                placeholder="Ex.: Acesso vitalício"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="prod-price">Preço (R$)</label>
              <input
                id="prod-price"
                className="input"
                value={productForm.price}
                onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                placeholder="7,90"
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="prod-pix">Código PIX copia e cola</label>
            <textarea
              id="prod-pix"
              className="input min-h-20 resize-y font-mono text-[11px]"
              value={productForm.pixCode}
              onChange={(event) => setProductForm({ ...productForm, pixCode: event.target.value })}
              placeholder="00020126..."
            />
          </div>
          <div>
            <label className="label" htmlFor="prod-link">Link de checkout (opcional)</label>
            <input
              id="prod-link"
              className="input"
              value={productForm.checkoutUrl}
              onChange={(event) => setProductForm({ ...productForm, checkoutUrl: event.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="label" htmlFor="prod-delivery">Mensagem de entrega</label>
            <textarea
              id="prod-delivery"
              className="input min-h-24 resize-y"
              value={productForm.deliveryText}
              onChange={(event) => setProductForm({ ...productForm, deliveryText: event.target.value })}
              placeholder="✅ Pagamento aprovado, {nome}! Seu acesso: {link}"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        title={chargeResult ? 'PIX gerado' : 'Gerar cobrança PIX'}
        description={
          chargeResult
            ? 'Envie o código para o lead ou copie e cole no seu banco.'
            : 'A cobrança é criada na SyncPay e registrada como pendente.'
        }
        footer={
          chargeResult ? (
            <button type="button" onClick={() => setChargeOpen(false)} className="btn-secondary text-xs">Fechar</button>
          ) : (
            <>
              <button type="button" onClick={() => setChargeOpen(false)} className="btn-secondary text-xs">Cancelar</button>
              <button type="submit" form="charge-form" disabled={busy === 'charge'} className="btn-primary text-xs">
                {busy === 'charge' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                Gerar PIX
              </button>
            </>
          )
        }
      >
        {chargeResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-[#d4f933]/30 bg-[#d4f933]/10 p-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4f933]">PIX Gerado com Sucesso</span>
                <div className="text-2xl font-black text-white">{chargeResult.amount}</div>
              </div>
              <button
                type="button"
                onClick={() => void copy(chargeResult.pixCode, 'Código PIX Copia e Cola')}
                className="btn-primary shrink-0 text-xs shadow-md shadow-[#d4f933]/15"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Código
              </button>
            </div>

            {/* Enviar no Telegram do Lead com 1 clique */}
            {chargeForm.leadId && (
              <button
                type="button"
                onClick={sendPixToLeadTelegram}
                disabled={busy === 'send-pix'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
              >
                {busy === 'send-pix' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Cobrança no Telegram do Lead Agora
              </button>
            )}

            {/* Mockup Real do Telegram da Cobrança */}
            <div>
              <div className="mb-2 text-xs font-bold text-white">Como o Cliente Recebe no Telegram:</div>
              <TelegramPreview
                botName={state.bots.find((b) => b.id === chargeForm.botId)?.username ? `@${state.bots.find((b) => b.id === chargeForm.botId)?.username}` : 'Modelo Hot 💋'}
                botAvatar={state.bots.find((b) => b.id === chargeForm.botId)?.avatarUrl}
                text={`✅ Como realizar o pagamento:\n\n1. Abra o aplicativo do seu banco.\n2. Selecione a opção "Pagar" ou "PIX".\n3. Escolha "PIX Copia e Cola".\n4. Cole a chave que está abaixo e finalize o pagamento com segurança.\n\nCopie o código abaixo:\n\n\`${chargeResult.pixCode}\`\n\nApós efetuar o pagamento, o seu acesso é liberado automaticamente. 🎁`}
                buttons={[
                  { text: '📋 Copiar Código PIX', url: 'https://t.me', color: 'purple', row: 0 },
                ]}
                socialProof='💬 Diego disse: "pqp que gostosa do caralho naquele vídeo com o amigo do ex marido 😈"'
              />
            </div>

            {chargeResult.warning && (
              <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                {chargeResult.warning}
              </p>
            )}
          </div>
        ) : (
          <form id="charge-form" onSubmit={submitCharge} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="chg-bot">Bot</label>
                <select
                  id="chg-bot"
                  className="input"
                  value={chargeForm.botId}
                  onChange={(event) => setChargeForm({ ...chargeForm, botId: event.target.value, leadId: '' })}
                  required
                >
                  {state.bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>@{bot.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="chg-product">Produto</label>
                <select
                  id="chg-product"
                  className="input"
                  value={chargeForm.productId}
                  onChange={(event) => setChargeForm({ ...chargeForm, productId: event.target.value })}
                  required
                >
                  {state.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {formatBRL(product.priceCents)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="chg-lead">Lead (opcional)</label>
              <select
                id="chg-lead"
                className="input"
                value={chargeForm.leadId}
                onChange={(event) => {
                  const lead = state.leads.find((item) => item.id === event.target.value);
                  setChargeForm({
                    ...chargeForm,
                    leadId: event.target.value,
                    customerName: lead?.name || chargeForm.customerName,
                  });
                }}
              >
                <option value="">Sem lead</option>
                {state.leads
                  .filter((lead) => lead.botId === chargeForm.botId)
                  .slice(0, 200)
                  .map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} {lead.username ? `(@${lead.username})` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-[10px] leading-relaxed text-[#657287]">
              A SyncPay exige nome, CPF, e-mail e telefone do pagador. Se você preencher um deles, preencha todos.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="chg-name">Nome completo</label>
                <input
                  id="chg-name"
                  className="input"
                  value={chargeForm.customerName}
                  onChange={(event) => setChargeForm({ ...chargeForm, customerName: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="chg-cpf">CPF</label>
                <input
                  id="chg-cpf"
                  className="input"
                  value={chargeForm.customerDocument}
                  onChange={(event) => setChargeForm({ ...chargeForm, customerDocument: event.target.value })}
                  placeholder="00000000000"
                />
              </div>
              <div>
                <label className="label" htmlFor="chg-email">E-mail</label>
                <input
                  id="chg-email"
                  type="email"
                  className="input"
                  value={chargeForm.customerEmail}
                  onChange={(event) => setChargeForm({ ...chargeForm, customerEmail: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="chg-phone">Telefone (DDD)</label>
                <input
                  id="chg-phone"
                  className="input"
                  value={chargeForm.customerPhone}
                  onChange={(event) => setChargeForm({ ...chargeForm, customerPhone: event.target.value })}
                  placeholder="11999999999"
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Registrar venda manual"
        description="Para vendas fechadas fora da SyncPay ou lançamentos retroativos."
        footer={
          <>
            <button type="button" onClick={() => setManualOpen(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" form="manual-form" disabled={busy === 'manual'} className="btn-primary text-xs">
              {busy === 'manual' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Registrar
            </button>
          </>
        }
      >
        <form id="manual-form" onSubmit={submitManual} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="man-bot">Bot</label>
              <select
                id="man-bot"
                className="input"
                value={manualForm.botId}
                onChange={(event) => setManualForm({ ...manualForm, botId: event.target.value, leadId: '' })}
              >
                {state.bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>@{bot.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="man-lead">Lead</label>
              <select
                id="man-lead"
                className="input"
                value={manualForm.leadId}
                onChange={(event) => setManualForm({ ...manualForm, leadId: event.target.value })}
              >
                <option value="">Sem lead</option>
                {state.leads
                  .filter((lead) => lead.botId === manualForm.botId)
                  .slice(0, 200)
                  .map((lead) => (
                    <option key={lead.id} value={lead.id}>{lead.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="man-product">Produto</label>
              <select
                id="man-product"
                className="input"
                value={manualForm.productId}
                onChange={(event) => {
                  const product = state.products.find((item) => item.id === event.target.value);
                  setManualForm({
                    ...manualForm,
                    productId: event.target.value,
                    amount: product ? priceInput(product.priceCents) : manualForm.amount,
                  });
                }}
              >
                <option value="">Sem produto</option>
                {state.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="man-amount">Valor (R$)</label>
              <input
                id="man-amount"
                className="input"
                value={manualForm.amount}
                onChange={(event) => setManualForm({ ...manualForm, amount: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="man-status">Status</label>
              <select
                id="man-status"
                className="input"
                value={manualForm.status}
                onChange={(event) => setManualForm({ ...manualForm, status: event.target.value as PurchaseStatus })}
              >
                {(['pago', 'pendente', 'cancelado', 'reembolsado'] as PurchaseStatus[]).map((status) => (
                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="man-notes">Observação</label>
            <input
              id="man-notes"
              className="input"
              value={manualForm.notes}
              onChange={(event) => setManualForm({ ...manualForm, notes: event.target.value })}
              placeholder="Ex.: pagou no PIX pessoal"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
