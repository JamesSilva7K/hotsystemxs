import type { BotCommand } from './telegram.js';

export type SupportedLanguage = 'pt' | 'en' | 'es';

export function normalizeLang(lang?: string | null): SupportedLanguage {
  if (!lang) return 'pt';
  const clean = lang.toLowerCase().trim();
  if (clean.startsWith('en')) return 'en';
  if (clean.startsWith('es')) return 'es';
  return 'pt';
}

export function getLocalizedCommands(lang: SupportedLanguage): BotCommand[] {
  if (lang === 'en') {
    return [
      { command: 'start', description: 'Access private VIP & meet the model' },
      { command: 'menu', description: 'Unlock secret videos & video calls' },
      { command: 'help', description: 'Payment support & verification' },
    ];
  }
  if (lang === 'es') {
    return [
      { command: 'start', description: 'Acceso privado VIP y conocer la modelo' },
      { command: 'menu', description: 'Ver videos secretos y videollamadas' },
      { command: 'ayuda', description: 'Soporte y comprobante de pago' },
    ];
  }
  return [
    { command: 'start', description: 'Iniciar atendimento e acesso VIP' },
    { command: 'menu', description: 'Ver planos, vídeos secretos e chamada' },
    { command: 'ajuda', description: 'Falar com o suporte e enviar PIX' },
  ];
}

export interface LocalizedMessageResult {
  text: string;
  buttons: Array<{ text: string; url?: string; callbackData?: string }>;
}

export function getLocalizedWelcome(
  lang: SupportedLanguage,
  name: string,
  botName: string,
  username?: string | null
): LocalizedMessageResult {
  const safeName = name ? name.split(' ')[0] : 'amor';

  if (lang === 'en') {
    return {
      text:
        `Hey there ${safeName}! 😈 So glad you reached out.\n\n` +
        `I'm ${botName}, and I've created this private, unfiltered VIP space just for us.\n\n` +
        `Inside my exclusive Best Friends group you'll get:\n` +
        `🔞 300+ full HD explicit videos with zero blur\n` +
        `🎥 Weekly 1-on-1 private video calls with me\n` +
        `💬 My direct personal WhatsApp for private talks\n` +
        `✨ Sneak peeks, sexy voice notes and private stories\n\n` +
        `👇 Tap below to unlock instant access before spots close:`,
      buttons: [
        { text: '💎 UNLOCK VIP PASS', url: 'https://syncpayments.com.br' },
        { text: '💋 CHAT WITH ' + botName, url: username ? `https://t.me/${username}` : undefined },
      ],
    };
  }

  if (lang === 'es') {
    return {
      text:
        `¡Hola ${safeName}! 😈 Qué rico verte por aquí en Telegram.\n\n` +
        `Soy ${botName}, y preparé este rincón íntimo, caliente y sin censura sólo para los dos.\n\n` +
        `En mi canal de Mejores Amigos vas a encontrar:\n` +
        `🔞 Más de 300 videos completos en HD sin censura\n` +
        `🎥 Videollamadas privadas 1 a 1 cada semana\n` +
        `💬 Mi WhatsApp personal directo para hablar\n` +
        `✨ Audios gemidos, adelantos y fotos prohibidas\n\n` +
        `👇 Toca el botón abajo para entrar ahora antes de que se agoten los cupos:`,
      buttons: [
        { text: '💎 ENTRAR AL VIP AHORA', url: 'https://syncpayments.com.br' },
        { text: '💋 HABLAR CON ' + botName, url: username ? `https://t.me/${username}` : undefined },
      ],
    };
  }

  return {
    text:
      `Oie amorzinho, ${safeName}! 😈 Que delícia te ver por aqui no Telegram.\n\n` +
      `Eu sou a ${botName}, e preparei esse cantinho bem íntimo, quente e sem censura só pra nós dois.\n\n` +
      `Lá no meu Melhores Amigos você encontra:\n` +
      `🔞 Mais de 300 vídeos completos sem censura nem tarjas\n` +
      `🎥 Chamadas de vídeo individuais toda semana\n` +
      `💬 Meu WhatsApp pessoal direto comigo\n` +
      `✨ Spoilers, áudios safados e conteúdos que não posto em nenhum outro lugar\n\n` +
      `👇 Clica no botão abaixo para escolher seu acesso antes que as vagas encerrem:`,
    buttons: [
      { text: '💎 ENTRAR NO VIP AGORA', url: 'https://syncpayments.com.br' },
      { text: '💋 FALAR COM A ' + botName, url: username ? `https://t.me/${username}` : undefined },
    ],
  };
}

export function getLocalizedMenu(
  lang: SupportedLanguage,
  name: string,
  botName: string
): LocalizedMessageResult {
  if (lang === 'en') {
    return {
      text:
        `🔥 Exclusive VIP Membership Plans — ${botName}\n\n` +
        `Choose your pass and unlock all private videos immediately:\n\n` +
        `1️⃣ MONTHLY VIP + GIFT: $ 19.90\n` +
        `2️⃣ 1-DAY PARADISE PASS: $ 9.90\n` +
        `3️⃣ LIFETIME PASS + 1-ON-1 CALL: $ 39.90\n\n` +
        `👇 Tap below to confirm your spot:`,
      buttons: [
        { text: 'MONTHLY VIP + 🎁 ($ 19.90)', url: 'https://syncpayments.com.br' },
        { text: '1-DAY PARADISE 😈 ($ 9.90)', url: 'https://syncpayments.com.br' },
        { text: 'LIFETIME + VIDEO CALL ☎️ ($ 39.90)', url: 'https://syncpayments.com.br' },
      ],
    };
  }

  if (lang === 'es') {
    return {
      text:
        `🔥 Planes VIP Exclusivos — ${botName}\n\n` +
        `Elige tu pase y desbloquea todo el contenido secreto ahora mismo:\n\n` +
        `1️⃣ MENSUAL VIP + REGALO: R$ 19,90\n` +
        `2️⃣ 1 DÍA EN EL PARAÍSO: R$ 9,90\n` +
        `3️⃣ VITALICIO + VIDEOLLAMADA: R$ 39,90\n\n` +
        `👇 Selecciona tu plan abajo:`,
      buttons: [
        { text: 'MENSUAL + 🎁 por R$ 19.90', url: 'https://syncpayments.com.br' },
        { text: '1 DÍA EN EL PARAÍSO 😈 por R$ 9.90', url: 'https://syncpayments.com.br' },
        { text: 'VITALICIO + LLAMADA ☎️ por R$ 39.90', url: 'https://syncpayments.com.br' },
      ],
    };
  }

  return {
    text:
      `🔥 Planos VIP Exclusivos — ${botName}\n\n` +
      `Escolha o seu plano e receba acesso IMEDIATO a todo o acervo sem censura:\n\n` +
      `1️⃣ MENSAL VIP + BÔNUS: R$ 19,90\n` +
      `2️⃣ 1 DIA NO PARAÍSO: R$ 9,90\n` +
      `3️⃣ VITALÍCIO + CHAMADA DE VÍDEO: R$ 39,90\n\n` +
      `👇 Clique no plano desejado abaixo:`,
    buttons: [
      { text: 'MENSAL + 🎁 por R$ 19.90', url: 'https://syncpayments.com.br' },
      { text: '1 DIA NO PARAISO 😈 por R$ 9.90', url: 'https://syncpayments.com.br' },
      { text: 'VITALICIO + CHAMADA ☎️ por R$ 39.90', url: 'https://syncpayments.com.br' },
    ],
  };
}

export function getLocalizedHelp(
  lang: SupportedLanguage,
  name: string,
  botName: string
): LocalizedMessageResult {
  if (lang === 'en') {
    return {
      text:
        `Need help with your access or payment confirmation? 💬\n\n` +
        `Send your payment receipt right here in this chat and our team will approve your access immediately. You can also type /menu to see all available plans.`,
      buttons: [{ text: '💎 VIEW VIP PLANS', callbackData: '/menu' }],
    };
  }

  if (lang === 'es') {
    return {
      text:
        `¿Necesitas ayuda con tu pago o activación del acceso VIP? 💬\n\n` +
        `Envía tu comprobante de pago directamente por este chat y nuestro equipo te liberará el acceso al instante. También puedes escribir /menu para ver los planes disponibles.`,
      buttons: [{ text: '💎 VER PLANES VIP', callbackData: '/menu' }],
    };
  }

  return {
    text:
      `Precisa de ajuda com o seu pagamento ou liberação do VIP? 💬\n\n` +
      `Envie o comprovante do seu PIX diretamente aqui neste chat que o suporte confere e libera o seu acesso na hora! Você também pode digitar /menu para ver todos os planos disponíveis.`,
    buttons: [{ text: '💎 VER PLANES VIP', callbackData: '/menu' }],
  };
}

export function getLocalizedConversationReply(
  lang: SupportedLanguage,
  name: string,
  botName: string
): LocalizedMessageResult {
  const safeName = name ? name.split(' ')[0] : 'amor';

  if (lang === 'en') {
    return {
      text:
        `Mmm ${safeName}, I loved hearing from you... 😈\n\n` +
        `I'm in my bed right now thinking about you. Type /menu to see my private videos, or unlock full VIP access with 1-on-1 calls below:`,
      buttons: [{ text: '💎 UNLOCK VIP PASS NOW', url: 'https://syncpayments.com.br' }],
    };
  }

  if (lang === 'es') {
    return {
      text:
        `Mmm ${safeName}, me encantó tu mensaje amor... 😈\n\n` +
        `Estoy aquí acostadita en la cama con ganas de ti. Escribe /menu para ver mis videos más secretos o activa tu acceso VIP completo abajo:`,
      buttons: [{ text: '💎 ENTRAR AL VIP AHORA', url: 'https://syncpayments.com.br' }],
    };
  }

  return {
    text:
      `Eita ${safeName}... 😈 Adorei sua mensagem amor!\n\n` +
      `Tô aqui na cama sem calcinha pensando em você. Digita /menu para ver meus vídeos proibidos ou garante sua vaga no meu VIP com chamada de vídeo agora:`,
    buttons: [{ text: '💎 ENTRAR NO VIP AGORA', url: 'https://syncpayments.com.br' }],
  };
}

