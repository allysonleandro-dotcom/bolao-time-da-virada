import { Bolao, BolaoParticipant, LotteryType, Participant, TicketGame } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { loadCustomPrices } from './storage';

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrencyNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0,00';
  }
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyBRL(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value !== 'string') return 0;
  
  const clean = value.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return 0;

  if (clean.includes(',') && clean.includes('.')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  if (clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatNumbersList(numbers: number[]): string {
  if (!numbers || numbers.length === 0) return '-';
  return [...numbers]
    .sort((a, b) => a - b)
    .map((n) => n.toString().padStart(2, '0'))
    .join(' - ');
}

export function formatBolaoBetSummary(bolao: Bolao): string {
  // Check specific preset cases requested by the user
  if (
    bolao.id === 'bolao-1-independencia-60' ||
    (bolao.title?.toLowerCase().includes('bolão 1') && bolao.title?.toLowerCase().includes('18'))
  ) {
    return '1 aposta de 18 dezenas';
  }
  if (
    bolao.id === 'bolao-2-independencia-39' ||
    (bolao.title?.toLowerCase().includes('bolão 2') && bolao.title?.toLowerCase().includes('17'))
  ) {
    return '3 apostas de 17 dezenas';
  }

  if (!bolao.tickets || bolao.tickets.length === 0) {
    return '0 apostas registradas';
  }

  // Group tickets by numbers count
  const countByNumbers = new Map<number, number>();
  for (const t of bolao.tickets) {
    const count = t.numbersCount || (t.numbers ? t.numbers.length : 15);
    countByNumbers.set(count, (countByNumbers.get(count) || 0) + 1);
  }

  const parts: string[] = [];
  countByNumbers.forEach((qty, dezenas) => {
    if (qty === 1) {
      parts.push(`1 aposta de ${dezenas} dezenas`);
    } else {
      parts.push(`${qty} apostas de ${dezenas} dezenas`);
    }
  });

  return parts.length > 0 ? parts.join(', ') : `${bolao.tickets.length} apostas registradas`;
}

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n / 2) k = n - k;
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return Math.round(res);
}

export function getOfficialGameCost(lotteryType: LotteryType, numbersCount: number): number {
  const customPrices = loadCustomPrices();
  const customEntry = customPrices[lotteryType]?.customTable?.find((p) => p.numbersCount === numbersCount);
  if (customEntry) return customEntry.price;

  const config = LOTTERY_CONFIGS[lotteryType];
  if (!config) return 0;

  const basePrice = customPrices[lotteryType]?.basePrice ?? config.basePrice;
  const entry = config.priceTable.find((p) => p.numbersCount === numbersCount);
  if (entry) {
    if (customPrices[lotteryType]?.basePrice && customPrices[lotteryType]?.basePrice !== config.basePrice) {
      return entry.combinations * basePrice;
    }
    return entry.price;
  }
  
  // Custom fallback: combinations * basePrice
  const comb = combinations(numbersCount, config.standardBetCount);
  return comb * basePrice;
}

export interface BolaoFinancials {
  totalTicketsCost: number;
  totalTicketsCount: number;
  totalCombinations: number;
  adminFeeAmount: number;
  reserveFundAmount: number;
  extraCost: number;
  totalBaseExpenses: number;
  suggestedQuotaPrice: number;
  totalExpectedRevenue: number;
  totalQuotasSold: number;
  totalQuotasPaid: number;
  totalQuotasPending: number;
  totalCollected: number;
  totalPending: number;
  surplusOrBalance: number;
  isFullyFunded: boolean;
}

export function calculateBolaoFinancials(bolao: Bolao): BolaoFinancials {
  const totalTicketsCost = bolao.tickets.reduce((acc, t) => acc + (t.cost || 0), 0);
  const totalTicketsCount = bolao.tickets.length;
  
  const config = LOTTERY_CONFIGS[bolao.lotteryType];
  const standardCount = config ? config.standardBetCount : 6;
  const totalCombinations = bolao.tickets.reduce(
    (acc, t) => acc + combinations(t.numbersCount, standardCount),
    0
  );

  const extraCost = bolao.extraCost || 0;
  const reserveFundAmount = bolao.reserveFundAmount || 0;
  
  // Base raw cost
  const baseExpenses = totalTicketsCost + extraCost + reserveFundAmount;
  
  // Admin fee (percent or fixed)
  const adminFeePercent = bolao.adminFeePercent || 0;
  const adminFeeFixed = bolao.adminFeeFixed || 0;
  const adminFeeAmount = (totalTicketsCost * adminFeePercent) / 100 + adminFeeFixed;
  
  const totalBaseExpenses = baseExpenses + adminFeeAmount;
  
  const totalQuotas = bolao.totalQuotas > 0 ? bolao.totalQuotas : 1;
  const suggestedQuotaPrice = Math.ceil((totalBaseExpenses / totalQuotas) * 10) / 10;
  
  const actualQuotaPrice = bolao.quotaPrice || suggestedQuotaPrice;
  const totalExpectedRevenue = totalQuotas * actualQuotaPrice;

  let totalQuotasSold = 0;
  let totalQuotasPaid = 0;
  let totalQuotasPending = 0;
  let totalCollected = 0;
  let totalPending = 0;

  bolao.participants.forEach((p) => {
    const q = p.quotas || 0;
    totalQuotasSold += q;
    const due = q * actualQuotaPrice;
    if (p.status === 'pago') {
      totalQuotasPaid += q;
      totalCollected += p.amountPaid || due;
    } else if (p.status === 'pendente') {
      totalQuotasPending += q;
      totalPending += due - (p.amountPaid || 0);
      totalCollected += p.amountPaid || 0;
    } else if (p.status === 'parcial') {
      totalCollected += p.amountPaid || 0;
      totalPending += Math.max(0, due - (p.amountPaid || 0));
    }
  });

  const surplusOrBalance = totalExpectedRevenue - (totalTicketsCost + extraCost);
  const isFullyFunded = totalCollected >= totalTicketsCost;

  return {
    totalTicketsCost,
    totalTicketsCount,
    totalCombinations,
    adminFeeAmount,
    reserveFundAmount,
    extraCost,
    totalBaseExpenses,
    suggestedQuotaPrice,
    totalExpectedRevenue,
    totalQuotasSold,
    totalQuotasPaid,
    totalQuotasPending,
    totalCollected,
    totalPending,
    surplusOrBalance,
    isFullyFunded,
  };
}

export function checkTicketMatches(
  ticketNumbers: number[],
  drawnNumbers: number[],
  lotteryType: LotteryType
): { hits: number[]; prizeTier?: string; hitCount: number } {
  if (!drawnNumbers || drawnNumbers.length === 0) {
    return { hits: [], hitCount: 0 };
  }
  const drawnSet = new Set(drawnNumbers);
  const hits = ticketNumbers.filter((n) => drawnSet.has(n));
  const hitCount = hits.length;

  const config = LOTTERY_CONFIGS[lotteryType];
  let prizeTier: string | undefined;

  if (config && config.prizeTiers) {
    const matchingTier = config.prizeTiers.find((tier) => tier.hits === hitCount);
    if (matchingTier) {
      prizeTier = matchingTier.name;
    }
  }

  return { hits, prizeTier, hitCount };
}

// Universal multiplier calculator for any Caixa lottery
export function calculateLotteryPrizeMultipliers(
  lotteryType: LotteryType,
  betSize: number,
  hits: number
): Record<number, number> {
  const config = LOTTERY_CONFIGS[lotteryType];
  const standardSize = config?.standardBetCount || (lotteryType === 'mega-sena' ? 6 : lotteryType === 'lotofacil' ? 15 : 6);
  const prizeTiers = config?.prizeTiers || [];

  const multipliers: Record<number, number> = {};

  prizeTiers.forEach((tier) => {
    const p = Number(tier.hits);
    if (isNaN(p)) return;
    if (hits >= p && betSize - hits >= standardSize - p) {
      const count = combinations(hits, p) * combinations(betSize - hits, standardSize - p);
      multipliers[p] = count;
    } else {
      multipliers[p] = 0;
    }
  });

  return multipliers;
}

export function getDefaultPrizeEstimates(lotteryType: LotteryType): Record<number, number> {
  switch (lotteryType) {
    case 'mega-sena':
      return {
        6: 45000000.0,
        5: 42000.0,
        4: 950.0,
      };
    case 'lotofacil':
      return {
        15: 2000000.0,
        14: 1650.0,
        13: 30.0,
        12: 12.0,
        11: 6.0,
      };
    case 'quina':
      return {
        5: 8500000.0,
        4: 7200.0,
        3: 85.0,
        2: 4.5,
      };
    case 'dupla-sena':
      return {
        6: 3500000.0,
        5: 4200.0,
        4: 85.0,
        3: 3.5,
      };
    case 'dia-de-sorte':
      return {
        7: 850000.0,
        6: 2200.0,
        5: 25.0,
        4: 5.0,
      };
    case 'lotomania':
      return {
        20: 3000000.0,
        19: 45000.0,
        18: 2500.0,
        17: 250.0,
        16: 40.0,
        15: 8.0,
        0: 150000.0,
      };
    case 'timemania':
      return {
        7: 5000000.0,
        6: 35000.0,
        5: 1200.0,
        4: 9.0,
        3: 3.0,
      };
    case 'milionaria':
      return {
        6: 10000000.0,
        5: 50000.0,
        4: 1000.0,
        3: 50.0,
        2: 12.0,
      };
    default:
      return {
        6: 1000000.0,
        5: 10000.0,
        4: 500.0,
      };
  }
}

export interface PrizeSplitSummary {
  grossPrize: number;
  adminFeeDeducted: number;
  reserveFundDeducted: number;
  netPrize: number;
  netPerQuota: number;
  payouts: {
    participantId: string;
    participantName: string;
    phone: string;
    pixKey?: string;
    quotas: number;
    amount: number;
    percentage: number;
  }[];
}

export function calculatePrizeSplit(
  bolao: Bolao,
  allParticipants: Participant[],
  customGrossPrize?: number
): PrizeSplitSummary {
  const gross = customGrossPrize ?? (bolao.totalPrizeWon || 0);
  const reserve = bolao.reserveFundAmount || 0;
  
  // No rateio de premiação, 100% do prêmio é distribuído integralmente entre as cotas dos participantes
  const netPrize = Math.max(0, gross - reserve);
  const totalQuotas = bolao.totalQuotas > 0 ? bolao.totalQuotas : 1;
  const netPerQuota = netPrize / totalQuotas;

  const participantMap = new Map<string, Participant>(
    allParticipants.map((p) => [p.id, p])
  );

  const payouts = bolao.participants.map((bp) => {
    const part = participantMap.get(bp.participantId);
    const quotas = bp.quotas || 0;
    const amount = quotas * netPerQuota;
    const percentage = totalQuotas > 0 ? (quotas / totalQuotas) * 100 : 0;

    return {
      participantId: bp.participantId,
      participantName: part ? part.name : 'Participante',
      phone: part?.phone || '',
      pixKey: part?.pixKey || '',
      quotas,
      amount,
      percentage,
    };
  });

  return {
    grossPrize: gross,
    adminFeeDeducted: 0,
    reserveFundDeducted: reserve,
    netPrize,
    netPerQuota,
    payouts,
  };
}

export function getParticipantQuotaLabel(
  bolao: Bolao,
  participantId?: string,
  bolaoParticipant?: BolaoParticipant
): string {
  if (!participantId && !bolaoParticipant) return 'Cota 01';

  // 1. Check if bolaoParticipant or matching item has explicit quotaNumbers
  const bp =
    bolaoParticipant ||
    (participantId ? bolao.participants.find((p) => p.participantId === participantId) : undefined);

  if (bp?.quotaNumbers && bp.quotaNumbers.length > 0) {
    if (bp.quotaNumbers.length === 1) {
      return `Cota ${String(bp.quotaNumbers[0]).padStart(2, '0')}`;
    }
    return `Cotas ${bp.quotaNumbers.map((n) => String(n).padStart(2, '0')).join(', ')}`;
  }

  // 2. Sequential calculation if not explicitly set
  let runningCount = 0;
  for (let i = 0; i < bolao.participants.length; i++) {
    const currentBp = bolao.participants[i];
    const qCount = Math.max(1, Math.round(currentBp.quotas || 1));
    const startNum = runningCount + 1;
    const endNum = runningCount + qCount;
    runningCount += qCount;

    if (
      (participantId && currentBp.participantId === participantId) ||
      (bolaoParticipant && currentBp === bolaoParticipant)
    ) {
      if (startNum === endNum) {
        return `Cota ${String(startNum).padStart(2, '0')}`;
      } else {
        return `Cotas ${String(startNum).padStart(2, '0')} a ${String(endNum).padStart(2, '0')}`;
      }
    }
  }

  return 'Cota 01';
}

export function generateWhatsAppMessage(
  type: 'convite' | 'comprovante' | 'jogos' | 'resultado' | 'rateio' | 'cobranca' | 'participantes',
  bolao: Bolao,
  participant?: Participant,
  bolaoParticipant?: BolaoParticipant,
  customText?: string,
  allParticipantsMap?: Map<string, Participant>
): string {
  const lotteryName = LOTTERY_CONFIGS[bolao.lotteryType]?.name || 'Loteria';
  const drawDate = formatDateBR(bolao.drawDate);
  const quotaPriceStr = formatCurrency(bolao.quotaPrice);
  const pixKey = bolao.pixKeyRecipient || 'Solicitar ao organizador';

  const isIndependencia =
    bolao.id.toLowerCase().includes('independencia') ||
    bolao.title?.toLowerCase().includes('independência') ||
    bolao.title?.toLowerCase().includes('independencia');

  switch (type) {
    case 'convite':
      return `${isIndependencia ? '🍀 *LOTOFÁCIL DA INDEPENDÊNCIA - 300 MILHÕES* 🍀' : `🍀 *BOLÃO OFICIAL - ${lotteryName.toUpperCase()}* 🍀`}
📌 *Concurso:* ${bolao.contestNumber || 'Especial'}
📅 *Data do Sorteio:* ${drawDate}
🏷️ *Título:* ${bolao.title}

💰 *Valor por Cota:* ${quotaPriceStr}
🎯 *Total de Cotas:* ${bolao.totalQuotas} cotas
🎲 *Quantidade de Apostas:* ${formatBolaoBetSummary(bolao)}
${bolao.digitalReceipts && bolao.digitalReceipts.length > 0 ? `📸 *Comprovantes Digitais:* ${bolao.digitalReceipts.length} foto(s) da lotérica registradas\n` : ''}
${bolao.notes ? `📝 *Detalhes:* ${bolao.notes}\n` : ''}
🔑 *Chave PIX para pagamento:*
\`${pixKey}\`
👤 *Organizador:* ${bolao.organizerName || 'Allyson Leandro'}

⚠️ *Garanta sua cota respondendo esta mensagem com o comprovante!* Boa sorte a todos! 🤞✨`;

    case 'comprovante': {
      const pName = participant?.name || 'Participante';
      const quotasCount = bolaoParticipant?.quotas || 1;
      const totalVal = formatCurrency(quotasCount * bolao.quotaPrice);
      const quotaNumStr = getParticipantQuotaLabel(
        bolao,
        participant?.id || bolaoParticipant?.participantId,
        bolaoParticipant
      );

      return `🎟️ *COMPROVANTE DE COTA - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : `BOLÃO ${lotteryName.toUpperCase()}`}*
👤 *Participante:* ${pName}
🏷️ *Bolão:* ${bolao.title} (Conc. ${bolao.contestNumber})
📅 *Data Sorteio:* ${drawDate}

🎫 *Número da Cota:* ${quotaNumStr}
🔢 *Cotas Adquiridas:* ${quotasCount} cota(s)
💵 *Valor Total:* ${totalVal}
✅ *Status:* PAGO E CONFIRMADO

Sua participação está 100% garantida no bolão. Boa sorte para nós! 🍀🌟`;
    }

    case 'jogos': {
      const gamesList = bolao.tickets
        .map((t, idx) => {
          const sorted = [...t.numbers].sort((a, b) => a - b);
          const numsStr = sorted.map((n) => String(n).padStart(2, '0')).join(' - ');
          return `🔹 *Jogo ${idx + 1} (${t.numbersCount} dezenas):*\n[ ${numsStr} ]`;
        })
        .join('\n\n');

      return `📋 *JOGOS OFICIAIS REGISTRADOS - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : `BOLÃO ${lotteryName.toUpperCase()}`}*
🏷️ *Bolão:* ${bolao.title} | Concurso: ${bolao.contestNumber}
📅 *Sorteio:* ${drawDate}
🎯 *Total de Jogos:* ${formatBolaoBetSummary(bolao)}
${bolao.digitalReceipts && bolao.digitalReceipts.length > 0 ? `📸 *Bilhetes Digitalizados:* ${bolao.digitalReceipts.length} foto(s) anexadas pelo organizador\n` : ''}
${gamesList}

🍀 *Acompanhe o sorteio! Todos os bilhetes foram devidamente validados.* 🤞`;
    }

    case 'resultado': {
      const drawnStr = (bolao.drawnNumbers || [])
        .sort((a, b) => a - b)
        .map((n) => String(n).padStart(2, '0'))
        .join(' - ');

      return `📢 *RESULTADO DO SORTEIO - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : lotteryName.toUpperCase()}*
🏷️ *Bolão:* ${bolao.title} (Conc. ${bolao.contestNumber})
📅 *Data:* ${drawDate}

🎯 *Dezenas Sorteadas:*
✨ *[ ${drawnStr || 'Aguardando divulgação'} ]* ✨

${bolao.totalPrizeWon && bolao.totalPrizeWon > 0
  ? `🎉 *PARABÉNS AO GRUPO! FOMOS PREMIADOS!* 🎉\n🏆 *Prêmio Total:* ${formatCurrency(bolao.totalPrizeWon)}\n💵 *Valor Líquido por Cota:* ${formatCurrency(bolao.netPrizePerQuota)}`
  : '🙏 Infelizmente não foi dessa vez, mas seguimos firmes para o próximo bolão! 🍀'
}`;
    }

    case 'rateio': {
      const partQuota = bolaoParticipant?.quotas || 1;
      const partPrize = (bolao.netPrizePerQuota || 0) * partQuota;
      const quotaNumStr = getParticipantQuotaLabel(
        bolao,
        participant?.id || bolaoParticipant?.participantId,
        bolaoParticipant
      );

      return `🎉 *PAGAMENTO DE PREMIAÇÃO - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : `BOLÃO ${lotteryName.toUpperCase()}`}*
👤 *Participante:* ${participant?.name || 'Amigo'}
🏷️ *Bolão:* ${bolao.title} (Conc. ${bolao.contestNumber})

🏆 *Prêmio Total do Bolão:* ${formatCurrency(bolao.totalPrizeWon)}
🎫 *Número da Cota:* ${quotaNumStr}
🎯 *Suas Cotas:* ${partQuota} cota(s)
💰 *Seu Valor a Receber:* *${formatCurrency(partPrize)}*

🔑 *Chave Pix informada:* \`${participant?.pixKey || 'Não cadastrada'}\`

O pagamento será realizado via PIX em breve! Obrigado pela parceria e confiança! 🚀✨`;
    }

    case 'cobranca': {
      const quotaNumStr = getParticipantQuotaLabel(
        bolao,
        participant?.id || bolaoParticipant?.participantId,
        bolaoParticipant
      );
      const partDebt = (bolaoParticipant?.quotas || 1) * bolao.quotaPrice - (bolaoParticipant?.amountPaid || 0);
      return `👋 *Lembrete Amigável - ${isIndependencia ? 'Lotofácil da Independência (300 Milhões)' : `Bolão ${lotteryName}`}*
Olá ${participant?.name || 'Amigo'}! Tudo bem?

Passando para lembrar que você reservou *${bolaoParticipant?.quotas || 1} cota(s)* (*${quotaNumStr}*) no bolão *"${bolao.title}"* (Conc. ${bolao.contestNumber}).

💰 *Valor pendente:* *${formatCurrency(partDebt)}*
📅 *Data do Sorteio:* ${drawDate}

🔑 *Chave PIX:* \`${pixKey}\`

Por favor, assim que fizer a transferência me envie o comprovante para garantir seus bilhetes! Muito obrigado! 🙏🍀`;
    }

    case 'participantes': {
      const list = bolao.participants
        .map((bp) => {
          const qLabel = getParticipantQuotaLabel(bolao, bp.participantId, bp);
          const p = allParticipantsMap?.get(bp.participantId) || (bp.participantId === participant?.id ? participant : undefined);
          const name = p?.name || 'Participante';
          const statusIcon = bp.status === 'pago' ? '✅ Pago' : '⏳ Pendente';
          return `🔹 *${qLabel}:* ${name} (${statusIcon})`;
        })
        .join('\n');

      return `📋 *LISTA DE COTAS E PARTICIPANTES - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : `BOLÃO ${lotteryName.toUpperCase()}`}*
🏷️ *Bolão:* ${bolao.title} | Concurso: ${bolao.contestNumber}
📅 *Sorteio:* ${drawDate}
🎯 *Total de Cotas:* ${bolao.totalQuotas} cotas (${quotaPriceStr} cada)
🎲 *Quantidade de Apostas:* ${formatBolaoBetSummary(bolao)}

${list || 'Nenhum participante adicionado ainda.'}

Boa sorte a todos os participantes! 🍀✨`;
    }

    default:
      return customText || '';
  }
}
