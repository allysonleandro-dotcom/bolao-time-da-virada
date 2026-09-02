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

export function formatBolaoBetSummary(bolao: Bolao, includeEquivalence = true): string {
  const isCombo = bolao.lotteryType === 'combo' || (bolao.tickets && bolao.tickets.some(t => t.lotteryType && t.lotteryType !== bolao.lotteryType));
  
  // Check specific preset cases requested by the user
  if (
    bolao.id === 'bolao-1-independencia-60' ||
    (bolao.title?.toLowerCase().includes('bolão 1') && bolao.title?.toLowerCase().includes('18'))
  ) {
    return includeEquivalence
      ? '1 aposta de 18 dezenas (equivalente a 816 apostas simples de 15 dezenas)'
      : '1 aposta de 18 dezenas';
  }
  if (
    bolao.id === 'bolao-2-independencia-39' ||
    (bolao.title?.toLowerCase().includes('bolão 2') && bolao.title?.toLowerCase().includes('17'))
  ) {
    return includeEquivalence
      ? '3 apostas de 17 dezenas (equivalente a 408 apostas simples — 136 jogos simples por aposta)'
      : '3 apostas de 17 dezenas';
  }

  const config = LOTTERY_CONFIGS[bolao.lotteryType] || LOTTERY_CONFIGS['mega-sena'];
  const standard = config?.standardBetCount || 6;

  if (!bolao.tickets || bolao.tickets.length === 0) {
    if (bolao.dezenas && bolao.dezenas > standard) {
      const equiv = combinations(bolao.dezenas, standard);
      return includeEquivalence
        ? `1 aposta de ${bolao.dezenas} dezenas (equivale a ${equiv} apostas simples de ${standard} dezenas)`
        : `1 aposta de ${bolao.dezenas} dezenas`;
    }
    return '0 apostas registradas';
  }

  if (isCombo) {
    // Group tickets by lotteryType
    const byLottery = new Map<LotteryType, TicketGame[]>();
    for (const t of bolao.tickets) {
      const lType = t.lotteryType || (bolao.lotteryType !== 'combo' ? bolao.lotteryType : 'mega-sena');
      if (!byLottery.has(lType)) byLottery.set(lType, []);
      byLottery.get(lType)!.push(t);
    }

    const lotterySummaries: string[] = [];
    byLottery.forEach((tickets, lType) => {
      const lCfg = LOTTERY_CONFIGS[lType] || LOTTERY_CONFIGS['mega-sena'];
      const lStd = lCfg.standardBetCount;
      
      const countByNum = new Map<number, number>();
      for (const t of tickets) {
        const count = t.numbersCount || (t.numbers ? t.numbers.length : lStd);
        countByNum.set(count, (countByNum.get(count) || 0) + 1);
      }

      const numParts: string[] = [];
      countByNum.forEach((qty, dez) => {
        const eqPerBet = combinations(dez, lStd);
        const eqTot = qty * eqPerBet;
        if (dez > lStd) {
          numParts.push(
            includeEquivalence
              ? `${qty}x ${dez}D (${eqTot} simples)`
              : `${qty}x ${dez}D`
          );
        } else {
          numParts.push(`${qty}x simples (${dez}D)`);
        }
      });

      lotterySummaries.push(`${lCfg.name}: ${numParts.join(', ')}`);
    });

    return lotterySummaries.join(' • ');
  }

  // Single lottery: Group tickets by numbers count
  const countByNumbers = new Map<number, number>();
  for (const t of bolao.tickets) {
    const count = t.numbersCount || (t.numbers ? t.numbers.length : standard);
    countByNumbers.set(count, (countByNumbers.get(count) || 0) + 1);
  }

  const parts: string[] = [];
  countByNumbers.forEach((qty, dezenas) => {
    const equivPerBet = combinations(dezenas, standard);
    const equivTotal = qty * equivPerBet;

    if (dezenas > standard) {
      if (qty === 1) {
        parts.push(
          includeEquivalence
            ? `1 aposta de ${dezenas} dezenas (equivale a ${equivPerBet} apostas simples de ${standard} dezenas)`
            : `1 aposta de ${dezenas} dezenas`
        );
      } else {
        parts.push(
          includeEquivalence
            ? `${qty} apostas de ${dezenas} dezenas (equivale a ${equivTotal} apostas simples — ${equivPerBet} cada)`
            : `${qty} apostas de ${dezenas} dezenas`
        );
      }
    } else {
      if (qty === 1) {
        parts.push(`1 aposta simples de ${dezenas} dezenas`);
      } else {
        parts.push(`${qty} apostas simples de ${dezenas} dezenas`);
      }
    }
  });

  return parts.length > 0 ? parts.join(', ') : `${bolao.tickets.length} apostas registradas`;
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
  
  const totalCombinations = bolao.tickets.reduce((acc, t) => {
    const lotType = t.lotteryType || (bolao.lotteryType !== 'combo' ? bolao.lotteryType : 'mega-sena');
    const cfg = LOTTERY_CONFIGS[lotType] || LOTTERY_CONFIGS['mega-sena'];
    const standardCount = cfg.standardBetCount || 6;
    return acc + combinations(t.numbersCount, standardCount);
  }, 0);

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

/**
 * Normaliza e resolve com precisão o tipo de loteria com base no identificador
 * ou no título/nome do bolão (ex: detectando "Dia de Sorte" de 1 a 31).
 */
export function resolveLotteryType(lotteryType?: string, title?: string): LotteryType {
  const normTitle = (title || '').toUpperCase();
  const normType = (lotteryType || '').toLowerCase().replace(/[_\s]/g, '-').trim();

  // 1. Verificação explícita por palavras-chave no título (caso tenha sido criado com tipo genérico)
  if (
    normTitle.includes('DIA DE SORTE') ||
    normTitle.includes('DIADESORTE') ||
    normTitle.includes('DIA-DE-SORTE') ||
    normTitle.includes('DE SORTE')
  ) {
    return 'dia-de-sorte';
  }
  if (normTitle.includes('TIMEMANIA')) return 'timemania';
  if (normTitle.includes('LOTOMANIA')) return 'lotomania';
  if (normTitle.includes('DUPLA SENA') || normTitle.includes('DUPLASENA') || normTitle.includes('DUPLA-SENA')) {
    return 'dupla-sena';
  }
  if (normTitle.includes('SUPER SETE') || normTitle.includes('SUPERSETE') || normTitle.includes('SUPER-SETE')) {
    return 'super-sete';
  }
  if (normTitle.includes('MILIONARIA') || normTitle.includes('MILIONÁRIA')) {
    return 'milionaria';
  }
  if (normTitle.includes('QUINA')) return 'quina';
  if (normTitle.includes('MEGA-SENA') || normTitle.includes('MEGA SENA') || normTitle.includes('MEGASENA') || normTitle.includes('MEGA')) {
    return 'mega-sena';
  }
  if (
    normTitle.includes('LOTOFÁCIL') ||
    normTitle.includes('LOTOFACIL') ||
    normTitle.includes('INDEPENDÊNCIA') ||
    normTitle.includes('INDEPENDENCIA')
  ) {
    return 'lotofacil';
  }

  // 2. Normalização por chave de tipo
  if (
    normType === 'dia-de-sorte' ||
    normType === 'diadesorte' ||
    normType === 'dia_de_sorte' ||
    normType === 'sorte'
  ) {
    return 'dia-de-sorte';
  }
  if (normType === 'timemania') return 'timemania';
  if (normType === 'lotomania') return 'lotomania';
  if (normType === 'dupla-sena' || normType === 'duplasena' || normType === 'dupla_sena') return 'dupla-sena';
  if (normType === 'super-sete' || normType === 'supersete' || normType === 'super_sete') return 'super-sete';
  if (normType === 'milionaria' || normType === 'mais-milionaria' || normType === 'maismilionaria') return 'milionaria';
  if (normType === 'quina') return 'quina';
  if (normType === 'lotofacil' || normType === 'lotofácil') return 'lotofacil';
  if (normType === 'combo') return 'combo';
  if (normType === 'personalizado') return 'personalizado';
  if (normType === 'mega-sena' || normType === 'megasena' || normType === 'mega') return 'mega-sena';

  return 'mega-sena';
}

export function getLotteryConfig(lotteryType?: string, title?: string) {
  const resolved = resolveLotteryType(lotteryType, title);
  return LOTTERY_CONFIGS[resolved] || LOTTERY_CONFIGS['mega-sena'];
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

    const rawName = part ? part.name : bp.participantId.replace(/^part-/, '');
    const contact = extractNameAndPhone(rawName, part?.phone);

    return {
      participantId: bp.participantId,
      participantName: (contact.cleanName || 'PARTICIPANTE').toUpperCase(),
      phone: contact.formattedPhone || part?.phone || '',
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

export function extractNameAndPhone(
  rawName: string,
  fallbackPhone?: string
): {
  cleanName: string;
  phone: string;
  formattedPhone: string;
  cleanDigitsPhone: string;
} {
  let cleanName = (rawName || '').trim();
  let extractedPhone = (fallbackPhone || '').trim();

  // Pattern to find Brazilian phone numbers inside the name (e.g. "Claugia G. 61 8143-8363", "Rogério (61) 98147-8550", "allyson 61993816602")
  const phonePattern = /(?:\+?55\s*)?(?:\(?\b([1-9]{2})\)?\s*)?(?:(9\s*\d{4}|\d{4})[-.\s]?(\d{4})|\b(\d{10,11})\b)/;
  const match = cleanName.match(phonePattern);

  if (match && match[0] && match[0].replace(/\D/g, '').length >= 8) {
    const rawMatchedPhone = match[0].trim();
    if (!extractedPhone) {
      extractedPhone = rawMatchedPhone;
    }
    // Remove only the matched phone part from the name
    cleanName = cleanName.replace(rawMatchedPhone, '').trim();
    // Clean trailing/leading dashes or empty parentheses left around the removed phone
    cleanName = cleanName
      .replace(/\(\s*\)/g, '')
      .replace(/[\-–—\s]+$/, '')
      .replace(/^[\-–—\s]+/, '')
      .trim();
  }

  // If cleanName is still empty, fallback to rawName or 'Participante'
  if (!cleanName) {
    cleanName = (rawName || '').trim() || 'Participante';
  }

  // Sanitize digits
  const cleanDigits = extractedPhone.replace(/\D/g, '');
  let formattedPhone = extractedPhone;

  if (cleanDigits.length === 11) {
    // 11 digits: DDD + 9 digits (mobile)
    const ddd = cleanDigits.substring(0, 2);
    const part1 = cleanDigits.substring(2, 7);
    const part2 = cleanDigits.substring(7, 11);
    formattedPhone = `(${ddd}) ${part1}-${part2}`;
  } else if (cleanDigits.length === 10) {
    // 10 digits: DDD + 8 digits (landline)
    const ddd = cleanDigits.substring(0, 2);
    const part1 = cleanDigits.substring(2, 6);
    const part2 = cleanDigits.substring(6, 10);
    formattedPhone = `(${ddd}) ${part1}-${part2}`;
  } else if (cleanDigits.length === 12 || cleanDigits.length === 13) {
    // With 55 country code
    const without55 = cleanDigits.startsWith('55') ? cleanDigits.substring(2) : cleanDigits;
    if (without55.length === 11) {
      const ddd = without55.substring(0, 2);
      const part1 = without55.substring(2, 7);
      const part2 = without55.substring(7, 11);
      formattedPhone = `(${ddd}) ${part1}-${part2}`;
    }
  }

  // Format international digits for WhatsApp (55 + DDD + number)
  let waDigits = cleanDigits;
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    waDigits = `55${cleanDigits}`;
  } else if (cleanDigits.length === 8 || cleanDigits.length === 9) {
    // Assume DDD 61 if missing
    waDigits = `5561${cleanDigits}`;
  }

  // Ensure cleanName is always uppercase
  cleanName = cleanName.toUpperCase();

  return {
    cleanName,
    phone: formattedPhone || extractedPhone,
    formattedPhone: formattedPhone || extractedPhone,
    cleanDigitsPhone: waDigits,
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
  const config = LOTTERY_CONFIGS[bolao.lotteryType];
  const standard = config?.standardBetCount || 6;
  const lotteryName = config?.name || 'Loteria';
  const drawDate = formatDateBR(bolao.drawDate);
  const quotaPriceStr = formatCurrency(bolao.quotaPrice);
  const pixKey = bolao.pixKeyRecipient || 'Solicitar ao organizador';

  const financials = calculateBolaoFinancials(bolao);
  const betSummary = formatBolaoBetSummary(bolao, true);

  const isIndependencia =
    bolao.id.toLowerCase().includes('independencia') ||
    bolao.title?.toLowerCase().includes('independência') ||
    bolao.title?.toLowerCase().includes('independencia');

  // Detect participant object if only bolaoParticipant was supplied
  let resolvedPart = participant;
  if (!resolvedPart && bolaoParticipant && allParticipantsMap) {
    resolvedPart = allParticipantsMap.get(bolaoParticipant.participantId);
    if (!resolvedPart) {
      for (const [, p] of allParticipantsMap.entries()) {
        if (
          p.id === bolaoParticipant.participantId ||
          p.name.toLowerCase() === bolaoParticipant.participantId.toLowerCase()
        ) {
          resolvedPart = p;
          break;
        }
      }
    }
  }

  let rawPartName = resolvedPart?.name || '';
  let rawPartPhone = resolvedPart?.phone || '';
  if (!rawPartName && bolaoParticipant?.participantId) {
    let cleanSlug = bolaoParticipant.participantId.replace(/^part-/, '');
    if (cleanSlug && !cleanSlug.includes(' ') && !/[A-Z]/.test(cleanSlug)) {
      cleanSlug = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
    }
    rawPartName = cleanSlug;
  }

  // Extract clean name and contact
  const contactInfo = extractNameAndPhone(rawPartName, rawPartPhone);
  const pName = contactInfo.cleanName || 'Participante';
  const pPhone = contactInfo.formattedPhone;

  // Resolve quota info for this participant
  const bp =
    bolaoParticipant ||
    (resolvedPart ? bolao.participants.find((p) => p.participantId === resolvedPart?.id) : undefined);
  const quotasCount = bp?.quotas || 1;
  const totalQuotaVal = quotasCount * bolao.quotaPrice;
  const quotaNumStr = getParticipantQuotaLabel(
    bolao,
    resolvedPart?.id || bp?.participantId,
    bp
  );
  const isPaid = bp?.status === 'pago';

  switch (type) {
    case 'convite': {
      const greeting = resolvedPart ? `Olá, *${pName}*! Tudo bem? 👋\n\n` : '';
      return `${greeting}${isIndependencia ? '🍀 *LOTOFÁCIL DA INDEPENDÊNCIA - 300 MILHÕES* 🍀' : `🍀 *BOLÃO OFICIAL - ${lotteryName.toUpperCase()}* 🍀`}
📌 *Concurso:* ${bolao.contestNumber || 'Especial'}
📅 *Data do Sorteio:* ${drawDate}
🏷️ *Título:* ${bolao.title}

💰 *Valor por Cota:* ${quotaPriceStr}
🎯 *Total de Cotas:* ${bolao.totalQuotas} cotas
🎲 *Apostas Oficiais:* ${betSummary}
${
  financials.totalCombinations > 1
    ? `⚡ *Equivalência Total:* ${financials.totalCombinations} jogos simples de ${standard} dezenas (${financials.totalCombinations}x mais chances de acerto!)\n`
    : ''
}${
  bolao.digitalReceipts && bolao.digitalReceipts.length > 0
    ? `📸 *Comprovantes Digitais:* ${bolao.digitalReceipts.length} foto(s) da lotérica anexadas\n`
    : ''
}${bolao.notes ? `📝 *Detalhes:* ${bolao.notes}\n` : ''}🔑 *Chave PIX para pagamento:*
\`${pixKey}\`
👤 *Organizador:* ${bolao.organizerName || 'Allyson Leandro'}

⚠️ *Garanta sua cota respondendo esta mensagem com o comprovante!* Boa sorte a todos! 🤞✨`;
    }

    case 'comprovante': {
      return `🎟️ *COMPROVANTE OFICIAL DE COTA*
${isIndependencia ? '🍀 *LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)*' : `🍀 *BOLÃO OFICIAL - ${lotteryName.toUpperCase()}*`}

👤 *Destinatário / Participante:* *${pName}*${pPhone ? `\n📱 *Contato:* ${pPhone}` : ''}
🏷️ *Bolão:* ${bolao.title} (Concurso ${bolao.contestNumber || 'Especial'})
📅 *Data do Sorteio:* ${drawDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🎫 *Número da Cota:* *${quotaNumStr}*
🔢 *Quantidade Adquirida:* *${quotasCount} cota(s)*
💰 *Valor Unitário da Cota:* ${quotaPriceStr}
💵 *Valor Total Adquirido:* *${formatCurrency(totalQuotaVal)}*
📊 *Status do Pagamento:* ${isPaid ? '✅ PAGO E CONFIRMADO' : '⏳ AGUARDANDO PAGAMENTO'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

🎲 *Estrutura de Apostas:* ${betSummary}
⚡ *Equivalência:* ${financials.totalCombinations} jogos simples de ${standard} dezenas
👤 *Organizador Responsável:* ${bolao.organizerName || 'Allyson Leandro'}

✨ *Sua participação está 100% garantida no bolão! Boa sorte para nós!* 🍀🤞`;
    }

    case 'cobranca': {
      const partDebt = quotasCount * bolao.quotaPrice - (bp?.amountPaid || 0);
      return `👋 Olá, *${pName}*! Tudo bem?

Passando para confirmar sua participação no bolão *"${bolao.title}"* (Concurso ${bolao.contestNumber || 'Especial'}).

━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Participante:* *${pName}*
🎫 *Cota(s) Reservada(s):* *${quotaNumStr}* (${quotasCount} cota${quotasCount > 1 ? 's' : ''})
💰 *Valor por Cota:* ${quotaPriceStr}
💵 *Total a Pagar:* *${formatCurrency(partDebt > 0 ? partDebt : totalQuotaVal)}*
📊 *Status:* ⏳ AGUARDANDO PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━

🎲 *Apostas do Bolão:* ${betSummary}
📅 *Data do Sorteio:* ${drawDate}

🔑 *Chave PIX para pagamento:*
\`${pixKey}\`
👤 *Favorecido:* ${bolao.organizerName || 'Allyson Leandro'}

⚠️ *Por favor, assim que realizar a transferência me envie o comprovante para garantir seus bilhetes! Muito obrigado!* 🙏🍀`;
    }

    case 'rateio': {
      const partQuota = quotasCount;
      const partPrize = (bolao.netPrizePerQuota || 0) * partQuota;

      return `🎉 *PAGAMENTO DE PREMIAÇÃO - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA' : `BOLÃO ${lotteryName.toUpperCase()}`}*

👤 *Participante / Destinatário:* *${pName}*
🏷️ *Bolão:* ${bolao.title} (Concurso ${bolao.contestNumber})
📅 *Data do Sorteio:* ${drawDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *Prêmio Total do Bolão:* ${formatCurrency(bolao.totalPrizeWon)}
🎫 *Número da Cota:* *${quotaNumStr}*
🎯 *Suas Cotas:* ${partQuota} cota(s)
💰 *Seu Valor Líquido a Receber:* *${formatCurrency(partPrize)}*
━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 *Chave Pix informada:* \`${resolvedPart?.pixKey || 'Não informada'}\`

🚀 O pagamento será transferido via PIX em breve! Parabéns e obrigado pela parceria e confiança! 🥂✨`;
    }

    case 'jogos': {
      const gamesList = bolao.tickets
        .map((t, idx) => {
          const sorted = [...t.numbers].sort((a, b) => a - b);
          const numsStr = sorted.map((n) => String(n).padStart(2, '0')).join(' - ');
          const equiv = combinations(t.numbersCount, standard);
          const equivText =
            t.numbersCount > standard
              ? ` (${t.numbersCount} dezenas - Equivale a ${equiv} jogos simples de ${standard}D)`
              : ` (${t.numbersCount} dezenas - Jogo simples)`;
          return `🔹 *Jogo ${idx + 1}${equivText}:*\n[ ${numsStr} ]`;
        })
        .join('\n\n');

      return `📋 *JOGOS OFICIAIS REGISTRADOS - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : `BOLÃO ${lotteryName.toUpperCase()}`}*
🏷️ *Bolão:* ${bolao.title} | Concurso: ${bolao.contestNumber}
📅 *Sorteio:* ${drawDate}
🎯 *Resumo das Apostas:* ${betSummary}
⚡ *Total de Apostas Equivalentes:* ${financials.totalCombinations} jogos simples de ${standard} dezenas
${bolao.digitalReceipts && bolao.digitalReceipts.length > 0 ? `📸 *Bilhetes Digitalizados:* ${bolao.digitalReceipts.length} foto(s) anexadas pelo organizador\n` : ''}
${gamesList}

🍀 *Acompanhe o sorteio! Todas as apostas foram devidamente registradas e validadas.* 🤞`;
    }

    case 'resultado': {
      const drawnStr = (bolao.drawnNumbers || [])
        .sort((a, b) => a - b)
        .map((n) => String(n).padStart(2, '0'))
        .join(' - ');

      return `📢 *RESULTADO DO SORTEIO - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : lotteryName.toUpperCase()}*
🏷️ *Bolão:* ${bolao.title} (Conc. ${bolao.contestNumber})
📅 *Data:* ${drawDate}
🎲 *Apostas do Bolão:* ${betSummary}

🎯 *Dezenas Sorteadas:*
✨ *[ ${drawnStr || 'Aguardando divulgação'} ]* ✨

${bolao.totalPrizeWon && bolao.totalPrizeWon > 0
  ? `🎉 *PARABÉNS AO GRUPO! FOMOS PREMIADOS!* 🎉\n🏆 *Prêmio Total:* ${formatCurrency(bolao.totalPrizeWon)}\n💵 *Valor Líquido por Cota:* ${formatCurrency(bolao.netPrizePerQuota)}`
  : '🙏 Infelizmente não foi dessa vez, mas seguimos firmes para o próximo bolão! 🍀'
}`;
    }

    case 'participantes': {
      const list = bolao.participants
        .map((bpItem) => {
          const qLabel = getParticipantQuotaLabel(bolao, bpItem.participantId, bpItem);
          const p = allParticipantsMap?.get(bpItem.participantId) || (bpItem.participantId === resolvedPart?.id ? resolvedPart : undefined);
          const parsed = extractNameAndPhone(p?.name || 'Participante', p?.phone);
          const statusIcon = bpItem.status === 'pago' ? '✅ Pago' : '⏳ Pendente';
          return `🔹 *${qLabel}:* ${parsed.cleanName} (${statusIcon})`;
        })
        .join('\n');

      return `📋 *LISTA DE COTAS E PARTICIPANTES - ${isIndependencia ? 'LOTOFÁCIL DA INDEPENDÊNCIA (300 MILHÕES)' : `BOLÃO ${lotteryName.toUpperCase()}`}*
🏷️ *Bolão:* ${bolao.title} | Concurso: ${bolao.contestNumber}
📅 *Sorteio:* ${drawDate}
🎯 *Total de Cotas:* ${bolao.totalQuotas} cotas (${quotaPriceStr} cada)
🎲 *Estrutura de Apostas:* ${betSummary}
⚡ *Equivalência:* ${financials.totalCombinations} jogos simples de ${standard} dezenas

${list || 'Nenhum participante adicionado ainda.'}

Boa sorte a todos os participantes! 🍀✨`;
    }

    default:
      return customText || '';
  }
}
