import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileVideo,
  Flame,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import type { AppState, Lead, MediaGridItem } from '@shared/types';
import type { NavTab } from '../lib/nav';
import { api } from '../lib/api';
import { formatDate, formatNumber, plural, relativeTime, truncate } from '../lib/format';
import { Avatar } from './Avatar';
import { TelegramPreview, type InlinePreviewButton } from './TelegramPreview';
import { useToast } from './Toast';
import { FlagBrasil, FlagUSA, FlagEspanha, type LanguageCode } from './LanguageSelector';

interface MessagesProps {
  state: AppState;
  selectedBotId: string;
  initialLead: Lead | null;
  onConsumeLead: () => void;
  refresh: () => Promise<void>;
  onNavigate?: (tab: NavTab) => void;
  initialMedia?: { url: string; type: 'video' | 'photo' | 'animation' } | null;
  onConsumeMedia?: () => void;
}

type Mode = 'audience' | 'lead' | 'chat';
type Audience = 'all' | 'novo' | 'interessado' | 'qualificado' | 'cliente';

interface MessageButton {
  id: number;
  text: string;
  url: string;
  color?: 'default' | 'green' | 'red' | 'purple' | 'amber';
  row?: number;
}

export interface StrategyTemplate {
  name: string;
  category: string;
  text: string;
  buttons: MessageButton[];
  mediaMode?: 'single' | 'grid';
  mediaGrid?: MediaGridItem[];
}

const TEMPLATES_BY_LANG: Record<LanguageCode, StrategyTemplate[]> = {
  pt: [
    // --- MODELOS DE RECUPERAÇÃO HOT (30% OFF / 25% OFF / ÁUDIO / BARULHO MOLHADO) ---
    {
      name: 'Recuperação: Cerveja no Bar (30% OFF 🍺💦)',
      category: 'Recuperação Hot 🔥',
      text: `Tá com medo de pagar caro? 30% OFF = você gasta menos que uma cerveja no bar e ainda leva minha buc3t4 virando o olho na tela do celular. 🍺➡️💦`,
      buttons: [
        { id: 1, text: 'MENSAL + 🎁 por R$ 13.93 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DIA NO PARAISO 😈 por R$ 6.93 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperação: Barulho Molhado (25% OFF 👅💦)',
      category: 'Recuperação Hot 🔥',
      text: `Quer ouvir o barulho molhado? Eu gravei o som da minha buc3t4 sendo lambida com a língua dele (meu dedo). 25% OFF e você recebe o audio e o video no WhatsApp agora...`,
      buttons: [
        { id: 1, text: 'MENSAL + 🎁 por R$ 14.93 (25% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DIA NO PARAISO 😈 por R$ 7.43 (25% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperação: Banho Quente & Ensaboada (40% OFF 🚿)',
      category: 'Recuperação Hot 🔥',
      text: `Tô entrando no banho agora pensando em você... Vai mesmo ficar só na vontade por causa de poucos reais? Descontinho de 40% só pra você entrar agora e me ver ensaboada no ao vivo: 🚿🧼💦`,
      buttons: [
        { id: 1, text: 'MENSAL + 🎁 por R$ 11.90 (40% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DIA NO PARAISO 😈 por R$ 5.90 (40% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperação: Áudio Proibido na Cama (35% OFF 🍑)',
      category: 'Recuperação Hot 🔥',
      text: `Amor, vi que você gerou o seu PIX e não pagou... Eu tô deitada aqui sem calcinha gravando um gemidinho bem manhoso falando o seu nome. Paga nos próximos 5 minutos que você recebe no privado sem censura! 😈🍑`,
      buttons: [
        { id: 1, text: 'MENSAL + 🎁 por R$ 12.90 (35% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DIA NO PARAISO 😈 por R$ 6.40 (35% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperação: Último Aviso antes de Fechar ⏳',
      category: 'Recuperação Hot 🔥',
      text: `Último aviso amor! O lote promocional vai expirar e as vagas do Melhores Amigos da {nome_bot} vão fechar hoje. Quem entrou já tá gozando todo dia, quem ficou fora só passa vontade. Clica antes que feche:`,
      buttons: [
        { id: 1, text: 'MENSAL + 🎁 por R$ 13.93 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: 'VITALICIO + CHAMADA ☎️ por R$ 29.90', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    // --- QUEBRA DE OBJEÇÃO & OUTRAS ESTRATÉGIAS ---
    {
      name: 'Santinha / Melhores Amigos (Grid Hot 🔥)',
      category: 'Quebra de Objeção',
      text: `Na igreja eu sou certinha... mas aqui você vê o lado meu que quase ninguém conhece. 😇🔥\n\nComo falei no Instagram, me converti recentemente e estou mudando muita coisa na minha vida e esse grupo eu vou fechar. ❗️\n\nQuem entrar agora garante acesso ao conteúdo que já tem lá dentro e continua recebendo as próximas fotos e videos exclusivos.\n\nLá no meu Melhores Amigos você encontra:\n\n😈 Meus vídeos mais secretos\n🔥 Meu lado mais provocante, sem pose de santinha\n🎁 Conteúdo exclusivo todos os dias\n📱 Meu WhatsApp pessoal pra conversar e fazer chamada de vídeo\n\n👇 Vem me ver enquanto da tempo!`,
      buttons: [
        { id: 1, text: 'MENSAL + 🎁 por R$ 19.94', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DIA NO PARAISO 😈 por R$ 9.94', url: 'https://syncpayments.com.br', color: 'default', row: 1 },
        { id: 3, text: 'VITALICIO + CHAMADA ☎️ por R$ 39.94', url: 'https://syncpayments.com.br', color: 'default', row: 2 },
      ],
      mediaMode: 'grid',
      mediaGrid: [
        {
          id: 'g-1',
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          type: 'photo',
          position: 'main-left',
          order: 0,
        },
        {
          id: 'g-2',
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
          type: 'photo',
          position: 'top-right',
          order: 1,
        },
        {
          id: 'g-3',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-1232-large.mp4',
          type: 'video',
          position: 'bottom-right',
          order: 2,
        },
      ],
    },
    {
      name: 'Abordagem & Conquista (Primeiro Contato 😈)',
      category: 'Abordagem',
      text: `Oie amorzinho... que bom que você me chamou aqui no Telegram! 🙈\n\nEu sou a {nome_bot}, e preparei esse cantinho bem íntimo e sem censura só pra nós dois.\n\nVocê prefere ver umas fotinhas provocantes agora ou prefere que eu te mande um áudio me apresentando melhor? 😈`,
      buttons: [
        { id: 1, text: '🔥 QUERO VER FOTO AGORA', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '🎙️ ME MANDA UM ÁUDIO', url: 'https://t.me', color: 'purple', row: 0 },
      ],
    },
    {
      name: 'Apresentação de Planos VIP ({nome_bot} 💎)',
      category: 'Planos & VIP',
      text: `😈 Se você achou as prévias quentes, você não imagina o que te espera no meu VIP!\n\nLá dentro com a {nome_bot} você tem:\n✨ Mais de 300 vídeos sem censura nem tarjas\n🎥 Chamadas de vídeo individuais toda semana\n💬 Meu WhatsApp pessoal direto comigo\n🔞 Conteúdo novo todos os dias atualizado!\n\nEscolha seu plano e vem comigo agora antes que as vagas encerrem:`,
      buttons: [
        { id: 1, text: '💎 VIP MENSAL - R$ 19,90', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '👑 VIP VITALÍCIO + WPP - R$ 39,90', url: 'https://syncpayments.com.br', color: 'purple', row: 1 },
        { id: 3, text: '🔥 1 DIA DE TESTE - R$ 9,90', url: 'https://syncpayments.com.br', color: 'default', row: 2 },
      ],
    },
    {
      name: 'Promoção Relâmpago (60% OFF ⚡)',
      category: 'Promoção',
      text: `🚨 ATENÇÃO AMOR: Liberamos apenas 5 Vagas com 60% OFF!\n\nA {nome_bot} acabou de abrir um lote promocional que vai durar só pelos próximos 15 minutos.\n\nDe ~~R$ 49,90~~ por APENAS R$ 19,90 com acesso IMEDIATO a todo o meu acervo VIP!\n\nCorre antes que o link expire: 👇`,
      buttons: [
        { id: 1, text: '⚡ GARANTIR MINHA VAGA COM 60% OFF', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
      ],
    },
    {
      name: 'Upsell Premiado Nº #75 (Hot 🔥)',
      category: 'Upsell',
      text: `😱🔥 Eitaaaa! Sua compra foi PREMIADA Nº #75 🎉🎉🎉\n\n✨ + 265 vídeos extras meu mais N0VINHAA+18 perdendo a virgindade...\n😈 Spoilers, áudios e vídeos que não posto no grupo\n\n🎁 BÔNUS ESPECIAL:\n✅ Meu WPP pessoal\n✅ Grupo lives, no grupo de live já tem + de 15 lives gravadas 😈\n\n➡️ Só por R$7,90 e acesso vitalício IMEDIATO!`,
      buttons: [
        { id: 1, text: '🔥 ADICIONAR AO PEDIDO', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '❌ RECUSAR OFERTA', url: 'https://t.me', color: 'red', row: 0 },
      ],
    },
    {
      name: 'Cobrança PIX Copia e Cola ⚡',
      category: 'Cobrança',
      text: `✅ Como realizar o pagamento:\n\n1. Abra o aplicativo do seu banco.\n2. Selecione a opção "Pagar" ou "PIX".\n3. Escolha "PIX Copia e Cola".\n4. Cole a chave que está abaixo e finalize o pagamento com segurança.\n\nCopie o código abaixo:\n\n\`00020126870014br.gov.bcb.pix2565pix.basspago.com.br/qr/v3/at/8698aa5a-9b67-4dda-b9a4-d3161d3b7d655204000053039865802BR5920SYNC_TECNOLOGIA_LTDA6008BRASILIA62070503***6304373F\`\n\nApós efetuar o pagamento, o seu acesso é liberado automaticamente. 🎁`,
      buttons: [
        { id: 1, text: '📋 Copiar Código PIX', url: 'https://t.me', color: 'purple', row: 0 },
      ],
    },
  ],
  en: [
    // --- ENGLISH RECOVERY & HIGH CONVERSION STRATEGIES ---
    {
      name: 'Recovery: Cheaper than a Beer (30% OFF 🍺💦)',
      category: 'Recuperação Hot 🔥',
      text: `Afraid of paying too much? 30% OFF = you spend less than a beer at the bar and get my p*ssy rolling its eyes right on your phone screen. 🍺➡️💦`,
      buttons: [
        { id: 1, text: 'MONTHLY + 🎁 for $4.90 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DAY IN PARADISE 😈 for $2.50 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recovery: Wet Slurp Sound (25% OFF 👅💦)',
      category: 'Recuperação Hot 🔥',
      text: `Wanna hear the wet sound? I recorded the sound of my p*ssy being licked deep with his tongue (my finger). 25% OFF and you receive the raw audio and video on your WhatsApp right now...`,
      buttons: [
        { id: 1, text: 'MONTHLY + 🎁 for $5.50 (25% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DAY IN PARADISE 😈 for $2.90 (25% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recovery: Steamy Hot Shower (40% OFF 🚿)',
      category: 'Recuperação Hot 🔥',
      text: `I'm stepping into the shower right now thinking about you... Are you really gonna stay longing over a few bucks? 40% OFF discount unlocked just for you to join now and see me soaped up live: 🚿🧼💦`,
      buttons: [
        { id: 1, text: 'MONTHLY + 🎁 for $3.90 (40% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DAY IN PARADISE 😈 for $1.90 (40% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recovery: Forbidden Bed Audio (35% OFF 🍑)',
      category: 'Recuperação Hot 🔥',
      text: `Babe, I noticed you started your checkout but haven't completed... I'm lying naked in bed recording a sultry moan whispering your name. Finish in the next 5 minutes and get it uncut in private! 😈🍑`,
      buttons: [
        { id: 1, text: 'MONTHLY + 🎁 for $4.50 (35% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DAY IN PARADISE 😈 for $2.20 (35% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recovery: Final Notice before Closing ⏳',
      category: 'Recuperação Hot 🔥',
      text: `Final notice babe! The promotional batch is expiring and {nome_bot}'s Best Friends VIP spots close today. Everyone inside is enjoying private treats daily, tap before access locks:`,
      buttons: [
        { id: 1, text: 'MONTHLY + 🎁 for $4.90 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: 'LIFETIME + CALL ☎️ for $9.90', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Good Girl vs Wild (Grid Hot 🔥)',
      category: 'Quebra de Objeção',
      text: `In church I look so innocent... but in here you see the side of me nobody else gets to know. 😇🔥\n\nLike I said on Instagram, I've had huge changes recently and this private VIP vault is closing soon. ❗️\n\nJoin right now to lock lifetime access to everything already posted and all upcoming exclusive videos.\n\nInside my Best Friends you get:\n\n😈 My most secret, unfiltered videos\n🔥 My wild side with zero innocent posing\n🎁 Fresh exclusive clips every day\n📱 My personal private line for video calls\n\n👇 Come unlock before time runs out!`,
      buttons: [
        { id: 1, text: 'MONTHLY + 🎁 for $6.90', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DAY IN PARADISE 😈 for $2.90', url: 'https://syncpayments.com.br', color: 'default', row: 1 },
        { id: 3, text: 'LIFETIME + CALL ☎️ for $12.90', url: 'https://syncpayments.com.br', color: 'default', row: 2 },
      ],
      mediaMode: 'grid',
      mediaGrid: [
        {
          id: 'g-en-1',
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          type: 'photo',
          position: 'main-left',
          order: 0,
        },
        {
          id: 'g-en-2',
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
          type: 'photo',
          position: 'top-right',
          order: 1,
        },
        {
          id: 'g-en-3',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-1232-large.mp4',
          type: 'video',
          position: 'bottom-right',
          order: 2,
        },
      ],
    },
    {
      name: 'Approach & Seduction (First Contact 😈)',
      category: 'Abordagem',
      text: `Hey handsome... so glad you reached out to me on Telegram! 🙈\n\nI'm {nome_bot}, and I made this intimate, uncensored corner just for the two of us.\n\nWould you rather see a teasing picture right now or hear a voice note of me introducing myself? 😈`,
      buttons: [
        { id: 1, text: '🔥 SHOW ME A TEASE NOW', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '🎙️ SEND ME A VOICE NOTE', url: 'https://t.me', color: 'purple', row: 0 },
      ],
    },
    {
      name: 'VIP Membership Plans ({nome_bot} 💎)',
      category: 'Planos & VIP',
      text: `😈 If you thought the free teasers were hot, you have no idea what's waiting inside my VIP!\n\nInside with {nome_bot} you unlock:\n✨ 300+ full explicit videos with zero blur\n🎥 1-on-1 private video calls every week\n💬 Direct chat on my personal line\n🔞 New fresh updates posted daily!\n\nPick your plan and join me right now before slots close:`,
      buttons: [
        { id: 1, text: '💎 VIP MONTHLY - $6.90', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '👑 LIFETIME VIP + CALL - $12.90', url: 'https://syncpayments.com.br', color: 'purple', row: 1 },
        { id: 3, text: '🔥 1 DAY TRIAL - $2.90', url: 'https://syncpayments.com.br', color: 'default', row: 2 },
      ],
    },
    {
      name: 'Flash Sale (60% OFF ⚡)',
      category: 'Promoção',
      text: `🚨 ATTENTION BABE: Only 5 VIP Spots released at 60% OFF!\n\n{nome_bot} just opened a flash discount batch valid for the next 15 minutes only.\n\nFrom ~~$19.90~~ to JUST $6.90 with INSTANT access to my entire VIP archive!\n\nHurry before the link expires: 👇`,
      buttons: [
        { id: 1, text: '⚡ CLAIM MY SPOT WITH 60% OFF', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
      ],
    },
    {
      name: 'Winning Order Upsell #75 (Hot 🔥)',
      category: 'Upsell',
      text: `😱🔥 Wowww! Your order just won LUCKY UPSELL #75 🎉🎉🎉\n\n✨ + 265 extra videos of my wildest solo sessions...\n😈 Spoilers, audios and tapes never shared in the public group\n\n🎁 SPECIAL BONUS:\n✅ Direct private WhatsApp\n✅ Private live recordings archive with 15+ uncut lives 😈\n\n➡️ Only $2.90 for INSTANT lifetime access!`,
      buttons: [
        { id: 1, text: '🔥 ADD TO MY ORDER', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '❌ DECLINE OFFER', url: 'https://t.me', color: 'red', row: 0 },
      ],
    },
    {
      name: 'Direct Checkout & Card / Crypto ⚡',
      category: 'Cobrança',
      text: `✅ How to complete your private access:\n\n1. Click the secure checkout link below.\n2. Choose Card, Apple Pay or Crypto.\n3. Complete the payment in seconds.\n\nYour secret link and VIP group invite are unlocked automatically right after approval! 🎁`,
      buttons: [
        { id: 1, text: '💳 Pay Securely Now (Instant Access)', url: 'https://syncpayments.com.br', color: 'purple', row: 0 },
      ],
    },
  ],
  es: [
    // --- ESPAÑOL RECUPERACIÓN & MODELOS DE CONVERSIÓN ---
    {
      name: 'Recuperación: Más Barato que Cerveza (30% OFF 🍺💦)',
      category: 'Recuperação Hot 🔥',
      text: `¿Tienes miedo de pagar caro? 30% OFF = gastas menos que una cerveza en el bar y te llevas mi c0ñit0 bien mojado en la pantalla de tu celular. 🍺➡️💦`,
      buttons: [
        { id: 1, text: 'MENSUAL + 🎁 por $4.90 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DÍA EN EL PARAÍSO 😈 por $2.50 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperación: Sonido Mojado (25% OFF 👅💦)',
      category: 'Recuperação Hot 🔥',
      text: `¿Quieres escuchar el sonido mojado? Grabé el sonido de mi c0ñit0 siendo lamido bien profundo con su lengua (mi dedo). 25% OFF y recibes el audio y el video en tu WhatsApp ahora mismo...`,
      buttons: [
        { id: 1, text: 'MENSUAL + 🎁 por $5.50 (25% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DÍA EN EL PARAÍSO 😈 por $2.90 (25% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperación: Ducha Caliente & Enjabonada (40% OFF 🚿)',
      category: 'Recuperação Hot 🔥',
      text: `Estoy entrando a la ducha ahora pensando en ti... ¿De verdad te vas a quedar con las ganas por unos pocos pesos? Descuento del 40% exclusivo para que entres ahora y me veas bien enjabonada en vivo: 🚿🧼💦`,
      buttons: [
        { id: 1, text: 'MENSUAL + 🎁 por $3.90 (40% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DÍA EN EL PARAÍSO 😈 por $1.90 (40% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperación: Audio Prohibido en la Cama (35% OFF 🍑)',
      category: 'Recuperação Hot 🔥',
      text: `Amor, vi que generaste tu orden pero no terminaste el pago... Estoy acostada aquí sin ropita interior grabando un gemido bien suave diciendo tu nombre. ¡Paga en los próximos 5 minutos y lo recibes sin censura en tu privado! 😈🍑`,
      buttons: [
        { id: 1, text: 'MENSUAL + 🎁 por $4.50 (35% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DÍA EN EL PARAÍSO 😈 por $2.20 (35% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Recuperación: Último Aviso antes de Cerrar ⏳',
      category: 'Recuperação Hot 🔥',
      text: `¡Último aviso amor! El lote promocional está por vencer y las vacantes de Mejores Amigos de {nome_bot} se cierran hoy. Quien entró ya goza todos los días, quien quedó fuera se queda con las ganas. Toca antes de que cierre:`,
      buttons: [
        { id: 1, text: 'MENSUAL + 🎁 por $4.90 (30% OFF)', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: 'VITALICIO + LLAMADA ☎️ por $9.90', url: 'https://syncpayments.com.br', color: 'green', row: 1 },
      ],
    },
    {
      name: 'Niña Buena vs Traviesa (Grid Hot 🔥)',
      category: 'Quebra de Objeção',
      text: `En la iglesia soy juiciosa... pero aquí ves el lado mío que casi nadie conoce. 😇🔥\n\nComo conté en Instagram, he tenido muchos cambios últimamente y este grupo lo voy a cerrar pronto. ❗️\n\nQuien entra ahora asegura acceso a todo el contenido que ya está adentro y sigue recibiendo las próximas fotos y videos exclusivos.\n\nEn mi canal de Mejores Amigos encuentras:\n\n😈 Mis videos más secretos sin censura\n🔥 Mi lado más caliente y atrevido\n🎁 Contenido nuevo todos los días\n📱 Mi WhatsApp personal para videollamadas privadas\n\n👇 ¡Ven a verme antes de que se acabe el tiempo!`,
      buttons: [
        { id: 1, text: 'MENSUAL + 🎁 por $6.90', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '1 DÍA EN EL PARAÍSO 😈 por $2.90', url: 'https://syncpayments.com.br', color: 'default', row: 1 },
        { id: 3, text: 'VITALICIO + LLAMADA ☎️ por $12.90', url: 'https://syncpayments.com.br', color: 'default', row: 2 },
      ],
      mediaMode: 'grid',
      mediaGrid: [
        {
          id: 'g-es-1',
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          type: 'photo',
          position: 'main-left',
          order: 0,
        },
        {
          id: 'g-es-2',
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
          type: 'photo',
          position: 'top-right',
          order: 1,
        },
        {
          id: 'g-es-3',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-1232-large.mp4',
          type: 'video',
          position: 'bottom-right',
          order: 2,
        },
      ],
    },
    {
      name: 'Abordaje y Seducción (Primer Contacto 😈)',
      category: 'Abordagem',
      text: `Hola corazón... ¡qué rico que me hablaste por Telegram! 🙈\n\nSoy {nome_bot}, y armé este rincón bien íntimo y sin censura sólo para los dos.\n\n¿Prefieres que te mande unas fotos provocativas ahora o prefieres que te mande un audio presentándome mejor? 😈`,
      buttons: [
        { id: 1, text: '🔥 QUIERO VER FOTO AHORA', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '🎙️ MÁNDAME UN AUDIO', url: 'https://t.me', color: 'purple', row: 0 },
      ],
    },
    {
      name: 'Presentación de Planes VIP ({nome_bot} 💎)',
      category: 'Planos & VIP',
      text: `😈 Si te gustaron las previas calientes, ¡no te imaginas lo que te espera en mi VIP!\n\nAdentro con {nome_bot} tienes:\n✨ Más de 300 videos sin censura ni filtros\n🎥 Videollamadas individuales cada semana\n💬 Mi WhatsApp personal directo conmigo\n🔞 ¡Contenido nuevo actualizado todos los días!\n\nElige tu plan y entra conmigo ahora antes de que se agoten las plazas:`,
      buttons: [
        { id: 1, text: '💎 VIP MENSUAL - $6.90', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '👑 VIP VITALICIO + WPP - $12.90', url: 'https://syncpayments.com.br', color: 'purple', row: 1 },
        { id: 3, text: '🔥 1 DÍA DE PRUEBA - $2.90', url: 'https://syncpayments.com.br', color: 'default', row: 2 },
      ],
    },
    {
      name: 'Promoción Relámpago (60% OFF ⚡)',
      category: 'Promoção',
      text: `🚨 ATENCIÓN AMOR: ¡Liberamos solo 5 cupos con 60% OFF!\n\n{nome_bot} acaba de abrir un lote promocional que dura solo por los próximos 15 minutos.\n\nDe ~~$19.90~~ por SOLO $6.90 con acceso INMEDIATO a todo mi catálogo VIP.\n\nCorre antes de que el enlace expire: 👇`,
      buttons: [
        { id: 1, text: '⚡ ASEGURAR MI CUPO CON 60% OFF', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
      ],
    },
    {
      name: 'Upsell Premiado Nº #75 (Hot 🔥)',
      category: 'Upsell',
      text: `😱🔥 ¡Uff amor! Tu compra fue PREMIADA Nº #75 🎉🎉🎉\n\n✨ + 265 videos extras de mis sesiones más calientes...\n😈 Spoilers, audios y videos que no publico en el grupo público\n\n🎁 BONO ESPECIAL:\n✅ Mi WhatsApp personal\n✅ Grupo de transmisiones con más de 15 directos grabados 😈\n\n➡️ ¡Solo por $2.90 y acceso vitalicio INMEDIATO!`,
      buttons: [
        { id: 1, text: '🔥 AGREGAR A MI PEDIDO', url: 'https://syncpayments.com.br', color: 'green', row: 0 },
        { id: 2, text: '❌ RECHAZAR OFERTA', url: 'https://t.me', color: 'red', row: 0 },
      ],
    },
    {
      name: 'Pago Inmediato con Tarjeta / Transferencia ⚡',
      category: 'Cobrança',
      text: `✅ Cómo realizar tu pago seguro:\n\n1. Entra al enlace de pago seguro aquí abajo.\n2. Elige tu método favorito (Tarjeta, Transferencia o Cripto).\n3. Finaliza el pago de forma discreta y 100% segura.\n\n¡Apenas se confirme el pago, tu acceso al VIP se libera automáticamente! 🎁`,
      buttons: [
        { id: 1, text: '💳 Pagar de Forma Segura Ahora', url: 'https://syncpayments.com.br', color: 'purple', row: 0 },
      ],
    },
  ],
};

export function Messages({
  state,
  selectedBotId,
  initialLead,
  onConsumeLead,
  refresh,
  onNavigate,
  initialMedia,
  onConsumeMedia,
}: MessagesProps) {
  const { notify } = useToast();
  const defaultBotId =
    selectedBotId !== 'all' ? selectedBotId : state.bots[0]?.id || '';
  const [botId, setBotId] = useState(defaultBotId);
  const [mode, setMode] = useState<Mode>('audience');
  const [audience, setAudience] = useState<Audience>('all');
  const [leadId, setLeadId] = useState('');
  const [chatId, setChatId] = useState('');
  const [templateLang, setTemplateLang] = useState<LanguageCode>(() => {
    const initBot = state.bots.find((b) => b.id === defaultBotId) || state.bots[0];
    const l = initBot?.language;
    return l === 'en' || l === 'es' || l === 'pt' ? l : 'pt';
  });
  const [text, setText] = useState(TEMPLATES_BY_LANG.pt[0].text);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'animation' | 'none'>('none');
  const [mediaMode, setMediaMode] = useState<'single' | 'grid'>('single');
  const [mediaGrid, setMediaGrid] = useState<MediaGridItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [buttons, setButtons] = useState<MessageButton[]>(TEMPLATES_BY_LANG.pt[0].buttons);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);

  const bot = state.bots.find((item) => item.id === botId) || state.bots[0] || null;

  // Sincronização inteligente com o idioma de cadastro do Bot
  useEffect(() => {
    if (bot?.language && (bot.language === 'pt' || bot.language === 'en' || bot.language === 'es')) {
      setTemplateLang(bot.language as LanguageCode);
    }
  }, [bot?.id, bot?.language]);

  const scopedLeads = useMemo(
    () => (bot ? state.leads.filter((lead) => lead.botId === bot.id) : []),
    [state.leads, bot]
  );
  const scopedChats = useMemo(
    () => (bot ? state.chats.filter((chat) => chat.botId === bot.id) : []),
    [state.chats, bot]
  );
  const scopedMessages = useMemo(
    () => (bot ? state.messages.filter((message) => message.botId === bot.id).slice(0, 40) : []),
    [state.messages, bot]
  );

  useEffect(() => {
    if (selectedBotId !== 'all') setBotId(selectedBotId);
  }, [selectedBotId]);

  useEffect(() => {
    if (!botId && state.bots[0]) setBotId(state.bots[0].id);
  }, [botId, state.bots]);

  useEffect(() => {
    if (initialLead) {
      setBotId(initialLead.botId);
      setMode('lead');
      setLeadId(initialLead.id);
      onConsumeLead();
    }
  }, [initialLead, onConsumeLead]);

  useEffect(() => {
    if (initialMedia) {
      setMediaUrl(initialMedia.url);
      setMediaType(initialMedia.type);
      onConsumeMedia?.();
    }
  }, [initialMedia, onConsumeMedia]);

  const detectMediaType = (urlOrName: string): 'photo' | 'video' | 'animation' => {
    const clean = urlOrName.toLowerCase();
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(clean)) return 'video';
    if (/\.gif(\?.*)?$/i.test(clean)) return 'animation';
    return 'photo';
  };

  const handleMediaUrlChange = (value: string) => {
    setMediaUrl(value);
    if (!value.trim()) {
      setMediaType('none');
    } else if (mediaType === 'none') {
      setMediaType(detectMediaType(value));
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadingMedia(true);
    try {
      let detected: 'photo' | 'video' | 'animation' = 'photo';
      if (file.type.startsWith('video/')) detected = 'video';
      else if (file.type === 'image/gif') detected = 'animation';

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        try {
          const res = await api.uploadMedia({
            filename: file.name,
            dataUrl,
            mediaType: detected,
          });
          if (res.ok) {
            setMediaUrl(res.url);
            setMediaType(res.mediaType);
            notify('success', 'Mídia Carregada!', `${file.name} foi anexado com sucesso.`);
          }
        } catch {
          // Fallback para preview imediato se rede oscilar
          setMediaUrl(dataUrl);
          setMediaType(detected);
          notify('info', 'Mídia Anexada', 'Pronta para visualização e envio.');
        } finally {
          setUploadingMedia(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingMedia(false);
      notify('error', 'Falha no Upload', err instanceof Error ? err.message : 'Tente novamente.');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFileUpload(file);
          break;
        }
      }
    }
  };

  const recipientCount = useMemo(() => {
    if (mode === 'audience') {
      if (audience === 'all') return scopedLeads.length;
      return scopedLeads.filter((lead) => lead.status === audience).length;
    }
    if (mode === 'lead') return leadId ? 1 : 0;
    return chatId ? 1 : 0;
  }, [mode, audience, scopedLeads, leadId, chatId]);

  const getBotDisplayName = () => bot?.firstName || (bot?.username ? `@${bot.username}` : 'Modelo Hot');

  const applyTemplate = (tpl: StrategyTemplate) => {
    const botName = getBotDisplayName();
    const replacedText = tpl.text.replaceAll('{nome_bot}', botName);
    setText(replacedText);
    setButtons(
      tpl.buttons.map((b) => ({
        ...b,
        text: b.text.replaceAll('{nome_bot}', botName),
      }))
    );
    if ('mediaMode' in tpl && tpl.mediaMode === 'grid' && tpl.mediaGrid) {
      setMediaMode('grid');
      setMediaGrid([...tpl.mediaGrid]);
    } else {
      setMediaMode('single');
      setMediaGrid([]);
    }
    notify('info', 'Estratégia aplicada', `${tpl.name}`);
  };

  const insertTag = (tag: string) => {
    const val = tag === '{nome_bot}' ? getBotDisplayName() : tag;
    setText((prev) => prev + (prev.endsWith(' ') || prev.endsWith('\n') || !prev ? '' : ' ') + val);
  };

  const addGridItem = (type: 'photo' | 'video' = 'photo') => {
    if (mediaGrid.length >= 10) {
      notify('error', 'Limite atingido', 'O Telegram permite no máximo 10 mídias por álbum.');
      return;
    }
    const newItem: MediaGridItem = {
      id: `grid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: '',
      type,
      position: mediaGrid.length === 0 ? 'main-left' : mediaGrid.length === 1 ? 'top-right' : 'bottom-right',
      order: mediaGrid.length,
    };
    setMediaGrid((curr) => [...curr, newItem]);
  };

  const updateGridItem = (id: string, updates: Partial<MediaGridItem>) => {
    setMediaGrid((curr) => curr.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeGridItem = (id: string) => {
    setMediaGrid((curr) => curr.filter((item) => item.id !== id));
  };

  const moveGridItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === mediaGrid.length - 1)) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...mediaGrid];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setMediaGrid(updated);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bot) {
      notify('error', 'Nenhum bot conectado', 'Conecte um bot antes de enviar.');
      return;
    }
    if (!text.trim()) {
      notify('error', 'Mensagem vazia', 'Escreva o texto antes de enviar.');
      return;
    }
    const cleanButtons = buttons
      .map((button) => ({ text: button.text.trim(), url: button.url.trim() }))
      .filter((button) => button.text && button.url);

    setSending(true);
    setLastResult(null);
    try {
      if (mode === 'audience') {
        const result = await api.broadcast({
          botId: bot.id,
          audience,
          text: text.trim(),
          imageUrl: mediaMode === 'single' ? mediaUrl.trim() || undefined : undefined,
          mediaType: mediaMode === 'single' && mediaType !== 'none' ? mediaType : undefined,
          mediaGrid: mediaMode === 'grid' && mediaGrid.length >= 2 ? mediaGrid : undefined,
          buttons: cleanButtons.length ? cleanButtons : undefined,
        });
        const summary = `${result.sent} enviadas · ${result.failed} falhas · ${result.total} destinos`;
        setLastResult(summary);
        if (result.sent > 0) {
          notify('success', 'Transmissão concluída', summary);
        } else {
          notify('error', 'Nenhuma mensagem entregue', result.errors[0] || 'Verifique as permissões do bot.');
        }
      } else {
        let target = chatId.trim();
        if (mode === 'lead') {
          const l = scopedLeads.find((item) => item.id === leadId);
          if (!l) {
            notify('error', 'Selecione um lead', 'Escolha o destinatário na lista.');
            return;
          }
          target = l.telegramUserId;
        }
        const result = await api.sendMessage({
          botId: bot.id,
          chatId: target,
          text: text.trim(),
          imageUrl: mediaMode === 'single' ? mediaUrl.trim() || undefined : undefined,
          mediaType: mediaMode === 'single' && mediaType !== 'none' ? mediaType : undefined,
          mediaGrid: mediaMode === 'grid' && mediaGrid.length >= 2 ? mediaGrid : undefined,
          buttons: cleanButtons.length ? cleanButtons : undefined,
          leadId: mode === 'lead' ? leadId : undefined,
        });
        if (result.ok) {
          notify('success', 'Mensagem entregue', `Enviada com sucesso no Telegram.`);
          setText('');
        } else {
          notify('error', 'Falha no envio', result.error || 'Erro no envio.');
        }
      }
      await refresh();
    } catch (error) {
      notify('error', 'Falha no envio', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const selectedLead = scopedLeads.find((lead) => lead.id === leadId) || null;
  const hasMedia = (mediaMode === 'single' && Boolean(mediaUrl.trim())) || (mediaMode === 'grid' && mediaGrid.length > 0);
  const charLimit = hasMedia ? 1_024 : 4_096;

  const CATEGORIES = [
    'Todos',
    'Recuperação Hot 🔥',
    'Quebra de Objeção',
    'Abordagem',
    'Planos & VIP',
    'Promoção',
    'Upsell',
    'Cobrança',
  ];

  const activeTemplates = TEMPLATES_BY_LANG[templateLang] || TEMPLATES_BY_LANG.pt;
  const filteredTemplates =
    selectedCategory === 'Todos'
      ? activeTemplates
      : activeTemplates.filter((tpl) => tpl.category === selectedCategory);

  const isLangSyncedWithBot = bot?.language === templateLang;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Barra Superior com Seleção de Modelos Rápidos & Sincronização Inteligente de Idioma */}
      <div className="space-y-3 rounded-2xl border border-[#2b3548] bg-[#10141d] p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2838] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4f933]/15 text-[#d4f933]">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Estratégias & Modelos de Conversão</span>
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Sincronizado {bot ? `@${bot.username}` : ''}
                </span>
              </div>
              <p className="text-[11px] text-[#7d8ca4]">
                Modelos de alta conversão adaptados em tempo real com o nome da modelo ({getBotDisplayName()})
              </p>
            </div>
          </div>

          {/* Seletor Rápido de Idioma das Cópias com Bandeiras Vetoriais */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#242f42] bg-[#0c1017] p-1">
            <span className="flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-[#697a92]">
              <Globe className="h-3 w-3" /> Idioma:
            </span>
            {([
              { code: 'pt' as const, label: 'PT', name: 'Português', flag: <FlagBrasil className="h-3 w-4" /> },
              { code: 'en' as const, label: 'EN', name: 'English', flag: <FlagUSA className="h-3 w-4" /> },
              { code: 'es' as const, label: 'ES', name: 'Español', flag: <FlagEspanha className="h-3 w-4" /> },
            ]).map((lang) => {
              const active = templateLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setTemplateLang(lang.code);
                    notify('info', `Modelos em ${lang.name}`, `Carregando estratégias no idioma ${lang.label}.`);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? 'bg-[#d4f933] text-black shadow'
                      : 'text-[#8596ab] hover:bg-[#151c27] hover:text-white'
                  }`}
                  title={`Ver modelos em ${lang.name}`}
                >
                  {lang.flag}
                  <span>{lang.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Abas de Categorias de Conversão */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2332] pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-[#d4f933] text-black shadow-md font-bold'
                    : 'border border-[#232b3b] bg-[#141924] text-[#8ea0b7] hover:border-[#38465d] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-[#69798f]">
            {filteredTemplates.length} modelo(s) disponível(is)
          </div>
        </div>

        {/* Lista de Modelos Filtrados com Visualização Rápida */}
        <div className="flex flex-wrap gap-2 pt-1">
          {filteredTemplates.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="group flex items-center gap-2 rounded-xl border border-[#273244] bg-[#161c28] px-3 py-2 text-xs font-semibold text-[#ccd6e4] transition hover:border-[#d4f933]/50 hover:bg-[#d4f933]/10 hover:text-white"
            >
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                  tpl.category.includes('Recuperação')
                    ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                    : 'bg-[#202838] text-[#8fa0b7]'
                }`}
              >
                {tpl.category}
              </span>
              <span>{tpl.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Coluna do Formulário de Envio */}
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d2533] pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Criar Envio / Transmissão</h2>
              <p className="mt-0.5 text-xs text-[#8290a5]">Envie textos, fotos, vídeos e botões reais diretamente no Telegram.</p>
            </div>
            <span className="badge border-[#2b3447] bg-[#171c26] text-[#a4afc1]">
              <Users className="h-3 w-3" /> {formatNumber(recipientCount)} destino(s)
            </span>
          </div>

          <form onSubmit={send} className="mt-5 space-y-4">
            {state.bots.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="message-bot">Modelo / Bot Remetente</label>
                  <select
                    id="message-bot"
                    value={botId}
                    onChange={(event) => setBotId(event.target.value)}
                    className="input font-semibold"
                  >
                    {state.bots.map((item) => (
                      <option key={item.id} value={item.id}>
                        @{item.username} ({item.firstName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Tipo de Destino</span>
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#252e3f] bg-[#0d1017] p-1">
                    {([
                      ['audience', 'Audiência'],
                      ['lead', 'Lead Único'],
                      ['chat', 'Canal / Grupo'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${
                          mode === value ? 'bg-[#d4f933] text-black shadow' : 'text-[#7f8ca1] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Nenhum bot conectado no momento. Conecte sua primeira Modelo na aba <b>Bots</b> para disparar mensagens reais.
              </div>
            )}

            {mode === 'audience' && (
              <div>
                <label className="label" htmlFor="message-audience">Segmento de Leads</label>
                <select
                  id="message-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  className="input"
                >
                  <option value="all">Todos os leads ativos ({scopedLeads.length})</option>
                  <option value="novo">Leads novos ({scopedLeads.filter((l) => l.status === 'novo').length})</option>
                  <option value="interessado">Leads interessados ({scopedLeads.filter((l) => l.status === 'interessado').length})</option>
                  <option value="qualificado">Leads qualificados ({scopedLeads.filter((l) => l.status === 'qualificado').length})</option>
                  <option value="cliente">Clientes pagantes ({scopedLeads.filter((l) => l.status === 'cliente').length})</option>
                </select>
              </div>
            )}

            {mode === 'lead' && (
              <div>
                <label className="label" htmlFor="message-lead">Selecionar Lead</label>
                <select
                  id="message-lead"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione um lead...</option>
                  {scopedLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.username ? `(@${l.username})` : ''} · {l.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode === 'chat' && (
              <div>
                <label className="label" htmlFor="message-chat">Selecionar Grupo / Canal</label>
                <select
                  id="message-chat"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione o canal ou grupo...</option>
                  {scopedChats.map((c) => (
                    <option key={c.id} value={c.telegramChatId}>
                      {c.title} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Texto da Mensagem */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="label mb-0" htmlFor="message-text">Texto da Mensagem</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#718096]">Inserir:</span>
                    <button
                      type="button"
                      onClick={() => insertTag('{nome_bot}')}
                      className="rounded border border-[#2b3548] bg-[#161c28] px-1.5 py-0.5 text-[10px] font-semibold text-[#d4f933] hover:bg-[#d4f933]/15"
                      title="Insere o nome da Modelo / Bot atual"
                    >
                      {templateLang === 'en' ? '+ Model Name' : templateLang === 'es' ? '+ Nombre Modelo' : '+ Nome da Modelo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('https://syncpayments.com.br')}
                      className="rounded border border-[#2b3548] bg-[#161c28] px-1.5 py-0.5 text-[10px] font-semibold text-[#6ee7b7] hover:bg-[#6ee7b7]/15"
                      title="Insere link de checkout"
                    >
                      {templateLang === 'en' ? '+ Checkout Link' : templateLang === 'es' ? '+ Enlace de Pago' : '+ Link Checkout'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag(templateLang === 'pt' ? '{chave_pix}' : '{payment_link}')}
                      className="rounded border border-[#2b3548] bg-[#161c28] px-1.5 py-0.5 text-[10px] font-semibold text-[#c084fc] hover:bg-[#c084fc]/15"
                      title="Insere código de pagamento"
                    >
                      {templateLang === 'en' ? '+ Payment Code' : templateLang === 'es' ? '+ Código de Pago' : '+ Código PIX'}
                    </button>
                  </div>
                </div>
                <span className={`text-[10px] ${text.length > charLimit ? 'text-rose-400 font-bold' : 'text-[#77859c]'}`}>
                  {text.length}/{charLimit} caracteres
                </span>
              </div>
              <textarea
                id="message-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="input min-h-[140px] resize-y font-sans leading-relaxed"
              />
            </div>

            {/* Seletor de Modo de Mídia: Individual vs Grid / Álbum Telegram */}
            <div className="space-y-4 rounded-2xl border border-[#263143] bg-[#121722] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2432] pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#d4f933]/15 text-[#d4f933]">
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-white">Mídia & Álbum no Telegram</span>
                    <span className="ml-2 text-[10px] text-[#78889e]">Alta resolução • Visual avançado</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-[#232b3a] bg-[#0c1017] p-1">
                  <button
                    type="button"
                    onClick={() => setMediaMode('single')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      mediaMode === 'single'
                        ? 'bg-[#d4f933] text-black shadow'
                        : 'text-[#8796ab] hover:text-white'
                    }`}
                  >
                    Foto / Vídeo Único
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaMode('grid');
                      if (mediaGrid.length === 0) {
                        // Inicia com o Grid de 3 itens estilo a foto do usuário
                        setMediaGrid([
                          {
                            id: `g-${Date.now()}-1`,
                            url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
                            type: 'photo',
                            position: 'main-left',
                            order: 0,
                          },
                          {
                            id: `g-${Date.now()}-2`,
                            url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
                            type: 'photo',
                            position: 'top-right',
                            order: 1,
                          },
                          {
                            id: `g-${Date.now()}-3`,
                            url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-1232-large.mp4',
                            type: 'video',
                            position: 'bottom-right',
                            order: 2,
                          },
                        ]);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      mediaMode === 'grid'
                        ? 'bg-[#d4f933] text-black shadow'
                        : 'text-[#8796ab] hover:text-white'
                    }`}
                  >
                    <span>Grid / Álbum de Mídias</span>
                    <span className="rounded bg-rose-500/20 px-1 text-[9px] text-rose-300">Hot 🔥</span>
                  </button>
                </div>
              </div>

              {/* MODO 1: Mídia Individual */}
              {mediaMode === 'single' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#8b9bb2]">Anexe foto, vídeo ou GIF individual:</span>
                    <div className="flex items-center gap-2">
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('studio')}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#2b3548] bg-[#171d29] px-2.5 py-1 text-[11px] font-semibold text-[#d4f933] transition hover:border-[#d4f933]/50 hover:bg-[#d4f933]/10"
                        >
                          <Sparkles className="h-3 w-3" />
                          Estúdio de Vídeo
                        </button>
                      )}
                      {mediaUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setMediaUrl('');
                            setMediaType('none');
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3 w-3" /> Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="relative">
                      <input
                        id="media-url"
                        value={mediaUrl}
                        onChange={(e) => handleMediaUrlChange(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="Cole link https:// ou use Ctrl+V para colar foto/vídeo..."
                        className="input mono text-xs pr-20"
                      />
                      {uploadingMedia && (
                        <span className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] font-bold text-[#d4f933]">
                          <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => mediaFileInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2b3548] bg-[#18202d] px-3.5 py-2 text-xs font-bold text-white transition hover:border-[#d4f933] hover:text-[#d4f933]"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Anexar do Aparelho</span>
                      <input
                        ref={mediaFileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                        }}
                      />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1d2533] pt-2.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold text-[#8b9bb2]">Formato do envio:</label>
                      <select
                        value={mediaType}
                        onChange={(e) => setMediaType(e.target.value as typeof mediaType)}
                        className="rounded-lg border border-[#283244] bg-[#141923] px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-[#d4f933]"
                      >
                        <option value="none">Sem mídia (Apenas texto)</option>
                        <option value="photo">Foto (JPEG / PNG)</option>
                        <option value="video">Vídeo (MP4 / WebM)</option>
                        <option value="animation">GIF / Animação</option>
                      </select>
                    </div>

                    <p className="text-[10px] text-[#718096]">
                      Dica: Você pode copiar uma foto ou print e dar <b>Ctrl+V</b> direto aqui!
                    </p>
                  </div>
                </div>
              ) : (
                /* MODO 2: Grid / Álbum de Fotos & Vídeos Estilo Telegram */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white">Montador de Grid / Álbum ({mediaGrid.length} mídias)</h4>
                      <p className="text-[10px] text-[#8292a8]">
                        Escolha a posição de cada foto e vídeo no grid do Telegram (até 10 mídias).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addGridItem('photo')}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#2b3548] bg-[#171d29] px-2.5 py-1 text-[11px] font-semibold text-[#d4f933] transition hover:bg-[#d4f933]/15"
                      >
                        <Plus className="h-3 w-3" /> Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => addGridItem('video')}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#2b3548] bg-[#171d29] px-2.5 py-1 text-[11px] font-semibold text-[#7fc0f4] transition hover:bg-[#7fc0f4]/15"
                      >
                        <Plus className="h-3 w-3" /> Vídeo
                      </button>
                    </div>
                  </div>

                  {/* Lista de Itens do Grid */}
                  <div className="space-y-2">
                    {mediaGrid.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#242e3f] bg-[#0d121a] p-2.5"
                      >
                        {/* Indicador de Ordem e Posição */}
                        <div className="flex items-center gap-1">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#192230] text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveGridItem(idx, 'up')}
                              disabled={idx === 0}
                              className="text-[#627086] hover:text-white disabled:opacity-30"
                              title="Subir posição"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGridItem(idx, 'down')}
                              disabled={idx === mediaGrid.length - 1}
                              className="text-[#627086] hover:text-white disabled:opacity-30"
                              title="Descer posição"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Seletor do Tipo */}
                        <select
                          value={item.type}
                          onChange={(e) => updateGridItem(item.id, { type: e.target.value as 'photo' | 'video' })}
                          className="rounded-lg border border-[#293549] bg-[#161c28] px-2 py-1 text-xs font-bold text-white"
                        >
                          <option value="photo">Foto 📸</option>
                          <option value="video">Vídeo 🎬</option>
                        </select>

                        {/* Seletor da Posição Específica no Grid */}
                        <select
                          value={item.position || 'auto'}
                          onChange={(e) =>
                            updateGridItem(item.id, {
                              position: e.target.value as MediaGridItem['position'],
                            })
                          }
                          className="rounded-lg border border-[#293549] bg-[#161c28] px-2 py-1 text-xs font-semibold text-[#d4f933]"
                          title="Posição específica no grid"
                        >
                          <option value="main-left">🌟 Destaque Esquerda (Foto Alta)</option>
                          <option value="top-right">↗️ Superior Direita</option>
                          <option value="bottom-right">↘️ Inferior Direita (Vídeo / Play)</option>
                          <option value="auto">🔄 Posição Automática</option>
                        </select>

                        {/* URL / Link da Mídia */}
                        <input
                          type="text"
                          value={item.url}
                          onChange={(e) => updateGridItem(item.id, { url: e.target.value })}
                          placeholder="https://exemplo.com/foto.jpg ou .mp4"
                          className="input mono min-w-[160px] flex-1 text-xs"
                        />

                        {/* Botão de Excluir */}
                        <button
                          type="button"
                          onClick={() => removeGridItem(item.id)}
                          className="rounded-lg p-1.5 text-[#6c7b91] transition hover:bg-rose-500/20 hover:text-rose-400"
                          title="Remover do grid"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {mediaGrid.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#242e40] p-4 text-center text-xs text-[#73839b]">
                      Nenhuma mídia no grid. Clique em <b>+ Foto</b> ou <b>+ Vídeo</b> para montar seu álbum!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botões Inline com Configuração de Cores e Posição */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">Botões Interativos no Telegram</span>
                  <p className="text-[10px] text-[#717e94]">Posicione lado a lado (mesma linha) ou empilhados.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setButtons((curr) => [
                      ...curr,
                      { id: Date.now(), text: '🔥 ADICIONAR', url: 'https://', color: 'green', row: 0 },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2b3548] bg-[#141a24] px-2.5 py-1 text-[11px] font-semibold text-[#d4f933] transition hover:bg-[#d4f933]/15"
                >
                  <Plus className="h-3 w-3" /> Adicionar Botão
                </button>
              </div>

              {buttons.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#293246] p-3 text-center text-[11px] text-[#657287]">
                  Nenhum botão configurado. Clique em "Adicionar Botão" para incluir links ou ações.
                </p>
              ) : (
                <div className="space-y-2">
                  {buttons.map((btn) => (
                    <div key={btn.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#232b3c] bg-[#0c1017] p-2.5">
                      <input
                        value={btn.text}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) => (b.id === btn.id ? { ...b, text: e.target.value } : b))
                          )
                        }
                        placeholder="Texto (ex: 🔥 ADICIONAR)"
                        className="input min-w-[130px] flex-1 text-xs"
                      />
                      <input
                        value={btn.url}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) => (b.id === btn.id ? { ...b, url: e.target.value } : b))
                          )
                        }
                        placeholder="https://..."
                        className="input min-w-[140px] flex-1 font-mono text-xs"
                      />
                      <select
                        value={btn.color || 'default'}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) =>
                              b.id === btn.id ? { ...b, color: e.target.value as MessageButton['color'] } : b
                            )
                          )
                        }
                        className="input w-28 text-xs font-semibold"
                      >
                        <option value="green">Verde 🔥</option>
                        <option value="red">Vermelho ❌</option>
                        <option value="purple">Roxo 📋</option>
                        <option value="amber">Dourado ⭐</option>
                        <option value="default">Padrão</option>
                      </select>
                      <select
                        value={btn.row ?? 0}
                        onChange={(e) =>
                          setButtons((curr) =>
                            curr.map((b) => (b.id === btn.id ? { ...b, row: Number(e.target.value) } : b))
                          )
                        }
                        className="input w-24 text-xs"
                        title="Linha do botão (0 = Linha 1, 1 = Linha 2)"
                      >
                        <option value={0}>Linha 1</option>
                        <option value={1}>Linha 2</option>
                        <option value={2}>Linha 3</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setButtons((curr) => curr.filter((b) => b.id !== btn.id))}
                        className="rounded-lg p-1.5 text-[#6f7c91] hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lastResult && (
              <div className="flex items-start gap-2 rounded-xl border border-[#d4f933]/30 bg-[#d4f933]/10 p-3 text-xs text-[#d4f933]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {lastResult}
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !text.trim() || !bot}
              className="btn-primary w-full py-3 text-sm font-bold shadow-lg shadow-[#d4f933]/20"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Disparando no Telegram...' : mode === 'audience' ? 'Enviar para a Audiência' : 'Enviar Mensagem Agora'}
            </button>
          </form>
        </section>

        {/* Coluna da Prévia Real do Telegram (Mockup Telegram) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-white">Visualização em Tempo Real</span>
            <span className="rounded-full bg-[#2b5278]/40 px-2 py-0.5 text-[10px] font-bold text-[#7fc0f4]">
              Telegram Live Mockup
            </span>
          </div>

          <TelegramPreview
            botName={bot ? `@${bot.username}` : 'Modelo Hot VIP 💋'}
            botAvatar={bot?.avatarUrl}
            text={text}
            mediaUrl={mediaMode === 'single' ? mediaUrl : undefined}
            mediaType={mediaMode === 'single' ? mediaType : undefined}
            mediaGrid={mediaMode === 'grid' && mediaGrid.length >= 2 ? mediaGrid : undefined}
            buttons={buttons.map((b) => ({
              text: b.text,
              url: b.url,
              color: b.color,
              row: b.row,
            }))}
            socialProof={
              text.includes('PIX') || text.includes('000201') || text.includes('Checkout') || text.includes('Pago')
                ? templateLang === 'en'
                  ? '💬 Mark said: "damn she is unbelievable in that bedroom tape 😈"'
                  : templateLang === 'es'
                  ? '💬 Carlos dijo: "qué rica que estás en ese video privado 😈"'
                  : '💬 Diego disse: "pqp que gostosa do caralho naquele vídeo com o amigo do ex marido 😈"'
                : undefined
            }
          />

          {/* Histórico Recente de Envios */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1d2533] px-5 py-3.5">
              <h3 className="text-xs font-bold text-white">Últimos Envios</h3>
              <span className="text-[10px] text-[#667387]">{plural(scopedMessages.length, 'evento', 'eventos')}</span>
            </div>
            {scopedMessages.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-[#748196]">
                Nenhuma mensagem registrada ainda.
              </p>
            ) : (
              <div className="max-h-[220px] divide-y divide-[#1a202c] overflow-y-auto">
                {scopedMessages.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex items-start gap-2.5 px-4 py-2.5 text-xs hover:bg-[#161b25]">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1a2130]">
                      {m.status === 'falhou' ? (
                        <AlertCircle className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Send className="h-3 w-3 text-[#d4f933]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#cad4e2]">{truncate(m.text, 65)}</p>
                      <p className="text-[10px] text-[#67758c]">
                        {m.direction === 'in' ? 'Recebida' : m.status} · {relativeTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
