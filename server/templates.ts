import type { MessageTemplate, TemplateCategory } from '../shared/types.js';

export interface RenderContext {
  nome?: string;
  username?: string;
  bot?: string;
  produto?: string;
  preco?: string;
  pix?: string;
  link?: string;
  oferta?: string;
}

/** Resolve `{a|b|c}` (spintax) e depois `{variavel}`. */
export function renderTemplate(body: string, context: RenderContext, random: () => number = Math.random): string {
  let output = body;
  const spintax = /\{([^{}|]*\|[^{}]*)\}/g;
  // Várias passadas permitem spintax aninhado simples: {oi|{bom dia|olá}}.
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    output = output.replace(spintax, (_match, group: string) => {
      changed = true;
      const options = group.split('|');
      return options[Math.floor(random() * options.length)] || options[0];
    });
    if (!changed) break;
  }
  return output.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, key: string) => {
    const value = context[key as keyof RenderContext];
    return typeof value === 'string' ? value : '';
  });
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function contextForLead(
  lead: { name: string; username: string | null },
  bot?: { firstName: string },
  product?: { name: string; priceCents: number; pixCode: string | null; checkoutUrl: string | null } | null
): RenderContext {
  return {
    nome: (lead.name || '').split(' ')[0] || lead.name,
    username: lead.username ? `@${lead.username}` : lead.name,
    bot: bot?.firstName || 'nosso bot',
    produto: product?.name || 'o material completo',
    preco: product ? formatBRL(product.priceCents) : '',
    pix: product?.pixCode || '',
    link: product?.checkoutUrl || '',
    oferta: product ? `${product.name} por ${formatBRL(product.priceCents)}` : '',
  };
}

/** Escolhe um template ativo por peso (rotação real entre modelos). */
export function pickWeighted(
  templates: MessageTemplate[],
  random: () => number = Math.random
): MessageTemplate | null {
  const pool = templates.filter((template) => template.active);
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, template) => sum + Math.max(1, template.weight || 1), 0);
  let ticket = random() * total;
  for (const template of pool) {
    ticket -= Math.max(1, template.weight || 1);
    if (ticket <= 0) return template;
  }
  return pool[pool.length - 1];
}

export function categoryLabel(category: TemplateCategory): string {
  const labels: Record<TemplateCategory, string> = {
    abertura: 'Abertura',
    reengajamento: 'Reengajamento',
    oferta: 'Oferta',
    prova_social: 'Prova social',
    fechamento: 'Fechamento',
    recuperacao: 'Recuperação',
  };
  return labels[category] || category;
}

interface Archetype {
  key: string;
  name: string;
  categories: TemplateCategory[];
  body: string;
  buttons?: Array<{ text: string; url?: string }>;
}

/**
 * Arquétipos de copy escritos para o nicho de conteúdo adulto/infoproduto.
 * Cada corpo usa spintax, então o mesmo arquétipo gera dezenas de variações.
 * O gerador combina arquétipo + spintax + emoji + ordem de blocos — tudo local,
 * sem depender de API externa, e 100% determinístico quando a semente é fixa.
 */
const ARCHETYPES: Archetype[] = [
  {
    key: 'sumiu',
    name: 'Sumiu no meio',
    categories: ['reengajamento', 'recuperacao'],
    body:
      'Oi {nome}! 👀\n\n{Sumiu|Desapareceu|Saiu} bem na melhor parte… {eu vi que você parou de responder|notei que você não voltou}.\n\n' +
      '{O material continua aqui te esperando|Ainda está tudo no mesmo lugar, esperando você}. {Quer que eu te mande o link de novo?|Te envio o acesso agora?}\n\n' +
      '🔥 {oferta}\n\n{É só responder *quero* que eu te mando o PIX na hora.|Me responde com *sim* e eu libero o acesso.}',
    buttons: [{ text: '🔥 Quero agora' }, { text: '❓ Tirar dúvida' }],
  },
  {
    key: 'escassez',
    name: 'Última chance',
    categories: ['oferta', 'reengajamento'],
    body:
      '{⏰ Última chamada|Corre que tá acabando|Só até hoje}!\n\n{nome}, {o preço sobe hoje à meia-noite|essa condição sai do ar em poucas horas|as vagas com esse valor estão fechando}.\n\n' +
      '{Você viu a prévia e sabe do que eu tô falando 👀|Você já viu o que tem lá dentro, né?}\n\n' +
      '💎 {produto}\n💸 {preco} — {acesso vitalício|pagamento único|sem mensalidade}\n\n{Me responde *eu quero* que eu te passo o PIX.|Se quiser garantir, é só pedir o PIX aqui.}',
    buttons: [{ text: '💎 Garantir acesso' }],
  },
  {
    key: 'prova',
    name: 'Prova social',
    categories: ['prova_social', 'oferta'],
    body:
      '{Mais uma pessoa entrou agora|Acabou de entrar mais gente|O grupo tá crescendo} 🔥\n\n' +
      '{nome}, {só hoje já foram várias pessoas|ontem entraram dezenas} e o {feedback|retorno} tá sendo {absurdo|inacreditável}.\n\n' +
      '🎁 {produto}\n💸 {preco}\n⚡ {Acesso liberado na hora|Liberação automática após o PIX}\n\n' +
      '{Te mando o PIX?|Quer entrar também?}',
    buttons: [{ text: '🎁 Entrar agora' }],
  },
  {
    key: 'curiosidade',
    name: 'Curiosidade',
    categories: ['reengajamento', 'oferta'],
    body:
      '{nome}, {você viu só a ponta do que tem lá|tem coisa que eu não posso nem mostrar aqui} 👀\n\n' +
      '{São vários vídeos que não sobem no grupo|É material que não fica público em lugar nenhum}.\n\n' +
      '{Se você quiser, eu te mando o acesso completo.|Quer que eu libere o pacote inteiro pra você?}\n\n' +
      '💸 {preco} {uma vez só|pagamento único}',
    buttons: [{ text: '👀 Quero ver' }],
  },
  {
    key: 'duvida',
    name: 'Quebra de objeção',
    categories: ['fechamento', 'recuperacao'],
    body:
      '{nome}, {ficou alguma dúvida?|posso te ajudar em algo?} 🤔\n\n' +
      '{Muita gente pergunta|Sempre perguntam} {se é seguro|como funciona o acesso|se precisa de algo a mais}.\n\n' +
      '✅ {Pagamento pelo PIX oficial|PIX copia e cola}\n✅ {Acesso liberado automaticamente|Liberação na hora}\n✅ {Sem assinatura, sem cobrança escondida|Pagamento único}\n\n' +
      '{Se quiser, eu te explico em 1 minuto.|Me chama que eu te mostro.}',
    buttons: [{ text: '💬 Falar comigo' }],
  },
  {
    key: 'bonus',
    name: 'Bônus e pacote',
    categories: ['oferta', 'fechamento'],
    body:
      '{nome}, além do que você viu, {vou liberar uns bônus|tem mais coisa inclusa} 🎁\n\n' +
      '✅ {produto}\n✅ {Mensagens diretas comigo|Meu contato pessoal}\n✅ {Grupo com lives gravadas|Conteúdo extra no grupo}\n\n' +
      '{Tudo isso por {preco}|Sai por {preco}, uma vez só}.\n\n' +
      '{Te passo o PIX agora?|Quer garantir?}',
    buttons: [{ text: '🎁 Quero os bônus' }],
  },
  {
    key: 'pix',
    name: 'Fechamento no PIX',
    categories: ['fechamento', 'oferta'],
    body:
      'Perfeito, {nome}! {Vamos liberar seu acesso|Bora garantir o seu} 🔓\n\n' +
      '*Como realizar o pagamento:*\n\n' +
      '1. Abra o aplicativo do seu banco.\n' +
      '2. Selecione a opção *Pagar* ou *PIX*.\n' +
      '3. Escolha *PIX Copia e Cola*.\n' +
      '4. Cole o código abaixo e finalize o pagamento com segurança.\n\n' +
      '`{pix}`\n\n' +
      '{Após efetuar o pagamento, o seu acesso é liberado automaticamente.|Assim que o PIX cair, o acesso é liberado na hora.} 🔓',
    buttons: [{ text: '📋 Copiar código' }],
  },
  {
    key: 'ultima',
    name: 'Despedida',
    categories: ['recuperacao', 'reengajamento'],
    body:
      '{nome}, {vou encerrar seu atendimento|vou parar de te chamar} 🙈\n\n' +
      '{Fica tranquilo, não vou mais te incomodar|Não quero te encher}.\n\n' +
      'Mas {antes de fechar|só antes de encerrar}: {a condição de {preco} ainda tá de pé hoje|o valor de {preco} ainda vale hoje}.\n\n' +
      '{Se quiser, me responde *quero* que eu te mando o PIX.|Se mudar de ideia, é só responder aqui.}',
  },
  {
    key: 'boasvindas',
    name: 'Boas-vindas',
    categories: ['abertura'],
    body:
      '{Oi|Olá|E aí}, {nome}! 👋\n\n' +
      '{Que bom te ver por aqui|Bem-vindo(a)}! Eu sou {bot}.\n\n' +
      '{Você quer ver o que eu tenho disponível hoje?|Quer que eu te mostre o que tá rolando hoje?}\n\n' +
      '💎 {produto}\n💸 {preco}\n⚡ {Acesso imediato|Liberação automática}',
    buttons: [{ text: '👀 Ver o que tem' }, { text: '💬 Falar comigo' }],
  },
];

const EMOJI_SPICE = ['🔥', '👀', '💎', '⚡', '🎁', '😈', '🥵', '🔓'];

export interface GeneratedVariant {
  name: string;
  body: string;
  category: TemplateCategory;
  buttons: Array<{ text: string; url?: string }>;
}

/**
 * Gera `count` modelos distintos a partir do briefing + arquétipos + spintax.
 * O brief entra como bloco de abertura, então o admin mantém o controle da oferta.
 */
export function generateVariants(input: {
  brief: string;
  category: TemplateCategory;
  count: number;
  product?: { name: string; priceCents: number; pixCode: string | null; checkoutUrl: string | null } | null;
  random?: () => number;
}): GeneratedVariant[] {
  const random = input.random || Math.random;
  const brief = input.brief.trim();
  const pool = ARCHETYPES.filter((archetype) => archetype.categories.includes(input.category));
  const usable = pool.length > 0 ? pool : ARCHETYPES;
  const product = input.product;
  const context: RenderContext = {
    nome: '{nome}',
    bot: '{bot}',
    produto: product?.name || '{produto}',
    preco: product ? formatBRL(product.priceCents) : '{preco}',
    pix: product?.pixCode || '{pix}',
    link: product?.checkoutUrl || '{link}',
    oferta: product ? `${product.name} por ${formatBRL(product.priceCents)}` : '{oferta}',
  };
  const seen = new Set<string>();
  const variants: GeneratedVariant[] = [];
  const target = Math.max(1, Math.min(30, input.count));
  let guard = 0;
  while (variants.length < target && guard < target * 40) {
    guard += 1;
    const archetype = usable[Math.floor(random() * usable.length)];
    const spice = EMOJI_SPICE[Math.floor(random() * EMOJI_SPICE.length)];
    const headline =
      input.category === 'abertura'
        ? ''
        : `${spice} ${brief
            .replace(/\s+/g, ' ')
            .slice(0, 120)}${brief.length > 120 ? '…' : ''}\n\n`;
    // Resolve spintax mantendo as variáveis ({nome}, {pix}...) para o envio.
    const resolved = renderTemplate(archetype.body, { ...context, nome: '{nome}', bot: '{bot}' }, random);
    const body = `${headline}${resolved}`.replace(/\n{3,}/g, '\n\n').trim();
    if (seen.has(body)) continue;
    seen.add(body);
    variants.push({
      name: `${archetype.name}${variants.length > 0 ? ` ${variants.length + 1}` : ''}`,
      body,
      category: input.category,
      buttons: archetype.buttons || [],
    });
  }
  return variants;
}

export const TEMPLATE_ARCHETYPE_COUNT = ARCHETYPES.length;
