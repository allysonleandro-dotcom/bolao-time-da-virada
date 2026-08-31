import { Bolao, Participant, BolaoParticipant, LotteryType } from '../types';
import { INITIAL_BOLOES, INITIAL_PARTICIPANTS } from '../data/lotteries';
import { saveBoloes, saveParticipants } from '../utils/storage';
import { extractNameAndPhone } from '../utils/calculator';

export const DEFAULT_SHEET_ID = '1rcxVn3q3eG_7zf_fM6n0t2w9FWBdTcCFshZ3TiKQMIk';

export const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1rcxVn3q3eG_7zf_fM6n0t2w9FWBdTcCFshZ3TiKQMIk/edit?hl=pt-br&pli=1&gid=539482389#gid=539482389';

export const BOLOES_REGULARES_TAB_NAME = 'BOLÕES_REGULARES';
export const INDEPENDENCIA_GID = '539482389';
export const OVERVIEW_GID = '1591013330';

export interface SyncResult {
  success: boolean;
  message: string;
  boloes: Bolao[];
  participants: Participant[];
  timestamp: string;
  sourceUrl: string;
  details?: {
    tabsRead: string[];
    regularBoloesFound: number;
    independenciaBoloesFound: number;
    totalParticipants: number;
  };
}

/**
 * Extracts Spreadsheet ID from any Google Sheets URL
 */
export function extractSpreadsheetId(rawUrl: string): string {
  if (!rawUrl) return DEFAULT_SHEET_ID;
  const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return idMatch ? idMatch[1] : DEFAULT_SHEET_ID;
}

/**
 * Converts any Google Sheets URL (view, edit, share) to CSV export URL
 */
export function convertToGoogleSheetsCsvUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.includes('docs.google.com/spreadsheets')) {
    return rawUrl;
  }

  const spreadsheetId = extractSpreadsheetId(rawUrl);
  const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Robust CSV parser that handles quotes and multiple columns
 */
export function parseCsvRows(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Normalizes participant name for lookup and ID matching
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

/**
 * Creates a clean ID from a name
 */
export function nameToId(name: string): string {
  return (
    'part-' +
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/**
 * Parses financial float value from strings like "R$ 25,00" or "60.00"
 */
function parseMoneyValue(valStr: string, fallback: number = 0): number {
  if (!valStr) return fallback;
  const clean = valStr.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? fallback : num;
}

/**
 * 1. PARSER ESPECÍFICO DA ABA "BOLÕES_REGULARES"
 * Lê a estrutura da aba de Bolões Regulares da planilha, com:
 * - Título e concurso (ex: "TESTE APLICATIVO LOTOFÁCIL 8 MILHÕES (CONCURSO 3773) - SORTEIO 28/08/2026")
 * - Valor da cota (ex: R$ 25,00)
 * - Tabela de cotas (Cota 1..50, Participante, Valor, Status TRUE/pago)
 */
export function processBoloesRegularesTab(
  rows: string[][],
  existingBoloes: Bolao[],
  existingParticipants: Participant[]
): { bolao: Bolao; participants: Participant[] } {
  let title = 'Bolão Regular Lotofácil 8 Milhões (Concurso 3773)';
  let lotteryType: LotteryType = 'lotofacil';
  let contestNumber = '3773';
  let drawDate = '2026-08-28';
  let quotaPrice = 25.0;
  const totalQuotas = 50;

  // 1. Extração de metadados do cabeçalho
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    const fullRow = row.join(' ');
    
    // Procura linha de título do Bolão
    if (
      fullRow.toUpperCase().includes('LOTOFÁCIL') ||
      fullRow.toUpperCase().includes('CONCURSO') ||
      fullRow.toUpperCase().includes('SORTEIO')
    ) {
      for (const cell of row) {
        if (cell && cell.length > 15) {
          title = cell.trim();
          break;
        }
      }

      const contestMatch = fullRow.match(/CONCURSO\s*([0-9]+)/i);
      if (contestMatch) contestNumber = contestMatch[1];

      const dateMatch = fullRow.match(/([0-9]{2})\/([0-9]{2})\/([0-9]{4})/);
      if (dateMatch) {
        drawDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      }

      if (fullRow.toUpperCase().includes('MEGA')) {
        lotteryType = 'mega-sena';
      } else if (fullRow.toUpperCase().includes('QUINA')) {
        lotteryType = 'quina';
      } else if (fullRow.toUpperCase().includes('LOTOFÁCIL') || fullRow.toUpperCase().includes('LOTOFACIL')) {
        lotteryType = 'lotofacil';
      }
    }

    // Procura valor por cota
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell.includes('R$')) {
        const parsed = parseMoneyValue(cell, 0);
        if (parsed >= 5 && parsed <= 500) {
          quotaPrice = parsed;
        }
      }
    }
  }

  // 2. Localiza início da tabela de participantes
  let headerIndex = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (
      row.some(
        (cell) =>
          cell.toUpperCase().includes('PARTICIPANTE') ||
          cell.toUpperCase().includes('NÚMERO DA COTA') ||
          cell.toUpperCase().includes('HOTRA')
      )
    ) {
      headerIndex = r;
      break;
    }
  }

  const startRow = headerIndex !== -1 ? headerIndex + 1 : 6;

  // 3. Mapeamento de participantes descobertos
  const participantMap = new Map<
    string,
    {
      rawName: string;
      quotaNumbers: number[];
      isPaid: boolean;
      paidAt?: string;
      amountPaid: number;
      totalDue: number;
    }
  >();

  let quotaIndex = 1;
  const discoveredNewParticipants: Participant[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const paidAtRaw = (row[0] || '').trim();
    const name = (row[1] || '').trim();
    const valRaw = (row[2] || '').trim();
    const statusRaw = (row[3] || '').trim().toUpperCase();

    // Se houver nome preenchido na linha
    if (name && name !== '-' && name.length >= 2 && !name.toUpperCase().includes('TOTAL')) {
      const norm = normalizeName(name);
      const isPaid = statusRaw === 'TRUE' || statusRaw === 'PAGO' || statusRaw === 'SIM' || statusRaw === '';

      let paidAtFormatted: string | undefined;
      if (paidAtRaw && !paidAtRaw.includes('1899')) {
        paidAtFormatted = paidAtRaw;
      }

      if (!participantMap.has(norm)) {
        participantMap.set(norm, {
          rawName: name,
          quotaNumbers: [quotaIndex],
          isPaid,
          paidAt: paidAtFormatted,
          amountPaid: isPaid ? quotaPrice : 0,
          totalDue: quotaPrice,
        });
      } else {
        const item = participantMap.get(norm)!;
        item.quotaNumbers.push(quotaIndex);
        if (isPaid) item.isPaid = true;
        item.totalDue += quotaPrice;
        if (isPaid) item.amountPaid += quotaPrice;
      }
    }

    quotaIndex++;
    if (quotaIndex > totalQuotas + 5) break;
  }

  // 4. Montar lista de participantes do Bolão Regular
  const bolaoParticipants: BolaoParticipant[] = [];

  participantMap.forEach((data, norm) => {
    const existing = existingParticipants.find((p) => normalizeName(p.name) === norm);
    let pId: string;

    if (existing) {
      pId = existing.id;
    } else {
      pId = nameToId(data.rawName);
      discoveredNewParticipants.push({
        id: pId,
        name: data.rawName,
        phone: '',
        pixKey: '',
        pixKeyType: 'outro',
        notes: 'Importado automaticamente da aba BOLÕES_REGULARES',
        createdAt: new Date().toISOString(),
      });
    }

    bolaoParticipants.push({
      participantId: pId,
      quotas: data.quotaNumbers.length,
      quotaNumbers: data.quotaNumbers,
      status: data.isPaid ? 'pago' : 'pendente',
      amountPaid: data.amountPaid,
      totalDue: data.totalDue,
      paidAt: data.paidAt,
      paymentMethod: 'pix',
      notes: `Cotas: ${data.quotaNumbers.join(', ')}`,
    });
  });

  // Preservar participantes existentes no bolão regular local que ainda não foram persistidos na planilha
  const existingReg = existingBoloes.find(
    (b) => b.id === 'bolao-regular-lotofacil-25' || b.id === 'bolao-regular-25' || b.title.includes('REGULAR')
  );
  if (existingReg && existingReg.participants && existingReg.participants.length > 0) {
    const allKnown = [...existingParticipants, ...discoveredNewParticipants];
    for (const localP of existingReg.participants) {
      const localPartInfo = allKnown.find((p) => p.id === localP.participantId);
      const localNorm = normalizeName(localPartInfo?.name || localP.participantId);

      const alreadyInList = bolaoParticipants.some((bp) => {
        const bpInfo = allKnown.find((p) => p.id === bp.participantId);
        return bp.participantId === localP.participantId || normalizeName(bpInfo?.name || '') === localNorm;
      });

      if (!alreadyInList) {
        bolaoParticipants.push({ ...localP });
      }
    }
  }

  // Se a planilha estiver vazia, preserva participante Allyson
  if (bolaoParticipants.length === 0) {
    bolaoParticipants.push({
      participantId: 'part-allyson',
      quotas: 1,
      quotaNumbers: [1],
      status: 'pago',
      amountPaid: 25.0,
      totalDue: 25.0,
      paidAt: '2026-08-25T11:00:00Z',
      paymentMethod: 'pix',
    });
  }

  const regularBolao: Bolao = {
    id: 'bolao-regular-lotofacil-25',
    title: title || 'TESTE APLICATIVO LOTOFÁCIL 8 MILHÕES (CONCURSO 3773)',
    lotteryType: lotteryType,
    contestNumber: contestNumber || '3773',
    drawDate: drawDate || '2026-08-28',
    totalQuotas: totalQuotas,
    totalCotas: totalQuotas,
    dezenas: 8,
    quotaPrice: quotaPrice,
    adminFeePercent: 0,
    adminFeeFixed: 0,
    extraCost: 0,
    reserveFundAmount: 0,
    organizerName: 'Allyson Leandro',
    pixKeyRecipient: 'allyson.leandro@gmail.com',
    pixKeyType: 'email',
    notes: `Bolão Regular sincronizado da aba BOLÕES_REGULARES • ${totalQuotas} cotas de R$ ${quotaPrice.toFixed(2)} cada.`,
    status: 'arrecadando',
    tickets: [
      {
        id: 'reg-t-1',
        name: 'Aposta Estratégica (8 dezenas / Concurso 3773)',
        numbersCount: 8,
        numbers: [3, 7, 11, 14, 18, 21, 23, 25],
        cost: 168.0,
      },
      {
        id: 'reg-t-2',
        name: 'Fechamento Combinado Lotofácil',
        numbersCount: 15,
        numbers: [1, 2, 4, 6, 8, 9, 12, 13, 15, 16, 17, 19, 20, 22, 24],
        cost: 140.0,
      },
    ],
    participants: bolaoParticipants,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: new Date().toISOString(),
  };

  return {
    bolao: regularBolao,
    participants: discoveredNewParticipants,
  };
}

/**
 * 2. PARSER DA ABA DE INDEPENDÊNCIA (Bolão 1 e Bolão 2)
 */
export function processIndependenciaTab(
  rows: string[][],
  existingBoloes: Bolao[],
  existingParticipants: Participant[]
): { bolao1: Bolao; bolao2: Bolao; participants: Participant[] } {
  const participantMetadataMap = new Map<string, Participant>();
  for (const p of [...INITIAL_PARTICIPANTS, ...existingParticipants]) {
    const norm = normalizeName(p.name);
    if (!participantMetadataMap.has(norm)) {
      participantMetadataMap.set(norm, p);
    }
  }

  const b1ParticipantsList: { quotaNum: number; name: string; isPaid: boolean; rawVal: string }[] = [];
  const b2ParticipantsList: { quotaNum: number; name: string; isPaid: boolean; rawVal: string }[] = [];

  let isReadingQuotas = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const col0 = (row[0] || '').trim().toUpperCase();
    const col1 = (row[1] || '').trim().toUpperCase();
    const col5 = (row[5] || '').trim().toUpperCase();

    if (col0.includes('COTA') && col1.includes('PARTICIPANTE')) {
      isReadingQuotas = true;
      continue;
    }

    if (isReadingQuotas) {
      if (col0.includes('TOTAL') || col0.includes('CUSTO') || col5.includes('TOTAL') || col5.includes('CUSTO')) {
        isReadingQuotas = false;
        continue;
      }

      // Bolão 1
      const cota1Str = (row[0] || '').replace(/[^\d]/g, '');
      const name1 = (row[1] || '').trim();
      const val1 = (row[2] || '').trim();
      const status1Str = (row[3] || '').trim().toUpperCase();

      if (cota1Str && name1 && name1 !== '-' && name1.length >= 2) {
        const qNum = parseInt(cota1Str, 10);
        const isPaid = status1Str === 'TRUE' || status1Str === 'PAGO' || status1Str === 'SIM';
        b1ParticipantsList.push({ quotaNum: qNum, name: name1, isPaid, rawVal: val1 });
      }

      // Bolão 2
      const cota2Str = (row[5] || '').replace(/[^\d]/g, '');
      const name2 = (row[6] || '').trim();
      const val2 = (row[7] || '').trim();
      const status2Str = (row[8] || '').trim().toUpperCase();

      if (cota2Str && name2 && name2 !== '-' && name2.length >= 2) {
        const qNum = parseInt(cota2Str, 10);
        const isPaid = status2Str === 'TRUE' || status2Str === 'PAGO' || status2Str === 'SIM';
        b2ParticipantsList.push({ quotaNum: qNum, name: name2, isPaid, rawVal: val2 });
      }
    }
  }

  const allDiscoveredNames = new Set<string>();
  b1ParticipantsList.forEach((i) => allDiscoveredNames.add(i.name));
  b2ParticipantsList.forEach((i) => allDiscoveredNames.add(i.name));

  const updatedParticipants: Participant[] = [];
  const participantIdByNameMap = new Map<string, string>();

  allDiscoveredNames.forEach((rawName) => {
    const norm = normalizeName(rawName);
    const existing = participantMetadataMap.get(norm);

    if (existing) {
      updatedParticipants.push(existing);
      participantIdByNameMap.set(norm, existing.id);
    } else {
      const newId = nameToId(rawName);
      const newPart: Participant = {
        id: newId,
        name: rawName,
        phone: '',
        pixKey: '',
        pixKeyType: 'outro',
        notes: 'Importado automaticamente da planilha Google Sheets',
        createdAt: new Date().toISOString(),
      };
      updatedParticipants.push(newPart);
      participantIdByNameMap.set(norm, newId);
    }
  });

  existingParticipants.forEach((p) => {
    const norm = normalizeName(p.name);
    if (!participantIdByNameMap.has(norm)) {
      updatedParticipants.push(p);
      participantIdByNameMap.set(norm, p.id);
    }
  });

  // Participantes do Bolão 1
  const b1Map = new Map<string, { quotaNumbers: number[]; isPaid: boolean; name: string }>();
  b1ParticipantsList.forEach((item) => {
    const norm = normalizeName(item.name);
    const pId = participantIdByNameMap.get(norm) || nameToId(item.name);
    if (!b1Map.has(pId)) {
      b1Map.set(pId, { quotaNumbers: [item.quotaNum], isPaid: item.isPaid, name: item.name });
    } else {
      const curr = b1Map.get(pId)!;
      curr.quotaNumbers.push(item.quotaNum);
      if (item.isPaid) curr.isPaid = true;
    }
  });

  const bolao1Participants: BolaoParticipant[] = Array.from(b1Map.entries()).map(([pId, data]) => {
    const quotas = data.quotaNumbers.length;
    const totalDue = quotas * 60.0;
    return {
      participantId: pId,
      quotas,
      quotaNumbers: data.quotaNumbers.sort((a, b) => a - b),
      status: data.isPaid ? 'pago' : 'pendente',
      amountPaid: data.isPaid ? totalDue : 0,
      totalDue,
      paymentMethod: 'pix',
    };
  });

  // Preservar participantes existentes no Bolão 1 local que ainda não constam na planilha
  const existingB1 = existingBoloes.find(
    (b) => b.id === 'bolao-1-independencia-60' || b.title.includes('Bolão 1')
  );
  if (existingB1 && existingB1.participants && existingB1.participants.length > 0) {
    for (const localP of existingB1.participants) {
      const localPartInfo = updatedParticipants.find((p) => p.id === localP.participantId);
      const localNorm = normalizeName(localPartInfo?.name || localP.participantId);

      const alreadyInList = bolao1Participants.some((bp) => {
        const bpInfo = updatedParticipants.find((p) => p.id === bp.participantId);
        return bp.participantId === localP.participantId || normalizeName(bpInfo?.name || '') === localNorm;
      });

      if (!alreadyInList) {
        bolao1Participants.push({ ...localP });
      }
    }
  }

  // Participantes do Bolão 2
  const b2Map = new Map<string, { quotaNumbers: number[]; isPaid: boolean; name: string }>();
  b2ParticipantsList.forEach((item) => {
    const norm = normalizeName(item.name);
    const pId = participantIdByNameMap.get(norm) || nameToId(item.name);
    if (!b2Map.has(pId)) {
      b2Map.set(pId, { quotaNumbers: [item.quotaNum], isPaid: item.isPaid, name: item.name });
    } else {
      const curr = b2Map.get(pId)!;
      curr.quotaNumbers.push(item.quotaNum);
      if (item.isPaid) curr.isPaid = true;
    }
  });

  const bolao2Participants: BolaoParticipant[] = Array.from(b2Map.entries()).map(([pId, data]) => {
    const quotas = data.quotaNumbers.length;
    const totalDue = quotas * 39.0;
    return {
      participantId: pId,
      quotas,
      quotaNumbers: data.quotaNumbers.sort((a, b) => a - b),
      status: data.isPaid ? 'pago' : 'pendente',
      amountPaid: data.isPaid ? totalDue : 0,
      totalDue,
      paymentMethod: 'pix',
    };
  });

  // Preservar participantes existentes no Bolão 2 local que ainda não constam na planilha
  const existingB2 = existingBoloes.find(
    (b) => b.id === 'bolao-2-independencia-39' || b.title.includes('Bolão 2')
  );
  if (existingB2 && existingB2.participants && existingB2.participants.length > 0) {
    for (const localP of existingB2.participants) {
      const localPartInfo = updatedParticipants.find((p) => p.id === localP.participantId);
      const localNorm = normalizeName(localPartInfo?.name || localP.participantId);

      const alreadyInList = bolao2Participants.some((bp) => {
        const bpInfo = updatedParticipants.find((p) => p.id === bp.participantId);
        return bp.participantId === localP.participantId || normalizeName(bpInfo?.name || '') === localNorm;
      });

      if (!alreadyInList) {
        bolao2Participants.push({ ...localP });
      }
    }
  }

  const bolao1: Bolao = {
    id: 'bolao-1-independencia-60',
    title: 'Bolão 1 da Lotofácil da Independência (1 aposta de 18 dezenas)',
    lotteryType: 'lotofacil',
    contestNumber: '3790',
    drawDate: '2026-09-15',
    totalQuotas: 50,
    totalCotas: 50,
    dezenas: 18,
    quotaPrice: 60.0,
    adminFeePercent: 0,
    adminFeeFixed: 0,
    extraCost: 0,
    reserveFundAmount: 0,
    organizerName: 'Allyson Leandro',
    pixKeyRecipient: 'allyson.leandro@gmail.com',
    pixKeyType: 'email',
    notes: 'Bolão 1 Especial da Lotofácil da Independência (1 aposta de 18 dezenas) • 50 cotas de R$ 60,00 cada.',
    status: 'arrecadando',
    tickets: [
      {
        id: 'ind1-t-1',
        name: 'Aposta Principal (18 Dezenas)',
        numbersCount: 18,
        numbers: [1, 2, 3, 5, 7, 8, 9, 10, 11, 13, 15, 17, 18, 20, 21, 22, 24, 25],
        cost: 2856.0,
      },
    ],
    participants: bolao1Participants.length > 0 ? bolao1Participants : INITIAL_BOLOES[1]?.participants || [],
    createdAt: '2026-08-21T08:00:00Z',
    updatedAt: new Date().toISOString(),
  };

  const bolao2: Bolao = {
    id: 'bolao-2-independencia-39',
    title: 'Bolão 2 da Lotofácil da Independência (3 apostas de 17 dezenas)',
    lotteryType: 'lotofacil',
    contestNumber: '3790',
    drawDate: '2026-09-15',
    totalQuotas: 40,
    totalCotas: 40,
    dezenas: 17,
    quotaPrice: 39.0,
    adminFeePercent: 0,
    adminFeeFixed: 0,
    extraCost: 0,
    reserveFundAmount: 0,
    organizerName: 'Allyson Leandro',
    pixKeyRecipient: 'allyson.leandro@gmail.com',
    pixKeyType: 'email',
    notes: 'Bolão 2 Especial da Lotofácil da Independência (3 apostas de 17 dezenas) • 40 cotas de R$ 39,00 cada.',
    status: 'arrecadando',
    tickets: [
      {
        id: 'ind2-t-1',
        name: 'Aposta 1 (17 Dezenas)',
        numbersCount: 17,
        numbers: [1, 2, 3, 5, 7, 8, 10, 11, 13, 15, 17, 18, 20, 21, 22, 24, 25],
        cost: 476.0,
      },
      {
        id: 'ind2-t-2',
        name: 'Aposta 2 (17 Dezenas)',
        numbersCount: 17,
        numbers: [2, 4, 5, 6, 8, 9, 11, 12, 14, 16, 17, 19, 21, 22, 23, 24, 25],
        cost: 476.0,
      },
      {
        id: 'ind2-t-3',
        name: 'Aposta 3 (17 Dezenas)',
        numbersCount: 17,
        numbers: [1, 3, 4, 5, 7, 9, 10, 12, 13, 15, 16, 18, 20, 22, 23, 24, 25],
        cost: 476.0,
      },
    ],
    participants: bolao2Participants.length > 0 ? bolao2Participants : INITIAL_BOLOES[2]?.participants || [],
    createdAt: '2026-08-22T09:00:00Z',
    updatedAt: new Date().toISOString(),
  };

  return {
    bolao1,
    bolao2,
    participants: updatedParticipants,
  };
}

/**
 * Processa linhas da aba CONTATO e mescla com os participantes existentes
 */
export function processContatosRows(
  rows: string[][],
  existingParticipants: Participant[]
): Participant[] {
  const map = new Map<string, Participant>();
  // 1. Inicia com todos os participantes locais existentes (preservando todos os seus dados)
  for (const p of existingParticipants) {
    map.set(normalizeName(p.name), { ...p });
  }

  // 2. Itera sobre as linhas de CONTATO
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const rawName = (row[0] || '').trim();
    const phone = (row[1] || '').trim();
    if (!rawName || rawName.toUpperCase().includes('NOME') || rawName.toUpperCase().includes('WHATSAPP') || rawName.length < 2) continue;

    const norm = normalizeName(rawName);
    if (map.has(norm)) {
      const existing = map.get(norm)!;
      if (phone && !existing.phone) {
        existing.phone = phone;
      }
    } else {
      const contact = extractNameAndPhone(rawName, phone);
      const newPart: Participant = {
        id: nameToId(rawName),
        name: (contact.cleanName || rawName).toUpperCase(),
        phone: contact.formattedPhone || phone || '',
        pixKey: '',
        pixKeyType: 'outro',
        notes: 'Importado da aba CONTATO da planilha',
        createdAt: new Date().toISOString(),
      };
      map.set(norm, newPart);
    }
  }

  return Array.from(map.values());
}

/**
 * Processa aba de bolão customizado criada na planilha
 */
export function processCustomBolaoTab(
  tabTitle: string,
  rows: string[][],
  existingBoloes: Bolao[],
  existingParticipants: Participant[]
): { bolao: Bolao; participants: Participant[] } {
  const normTitle = tabTitle.trim();
  const id = `bolao-custom-${normTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const existingBolao = existingBoloes.find((b) => b.id === id || b.title.toLowerCase() === normTitle.toLowerCase());

  let lotteryType: LotteryType = 'lotofacil';
  const upper = normTitle.toUpperCase();
  if (upper.includes('MEGA')) lotteryType = 'mega-sena';
  else if (upper.includes('QUINA')) lotteryType = 'quina';
  else if (upper.includes('DIADE SORTE') || upper.includes('DIA DE SORTE') || upper.includes('SORTE')) lotteryType = 'dia-de-sorte';
  else if (upper.includes('LOTOMANIA')) lotteryType = 'lotomania';
  else if (upper.includes('TIMEMANIA')) lotteryType = 'timemania';
  else if (upper.includes('DUPLA')) lotteryType = 'dupla-sena';

  const participantsList: BolaoParticipant[] = [];
  const newParticipants: Participant[] = [];

  let quotaPrice = existingBolao?.quotaPrice || 25;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const cotaStr = (row[0] || '').toString().trim();
    const cotaNum = parseInt(cotaStr, 10);
    const pName = (row[1] || '').trim();
    if (!pName || pName.toUpperCase().includes('PARTICIPANTE') || pName.toUpperCase().includes('COTA')) continue;

    const valorStr = (row[2] || '').toString().replace(/[^\d.,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr) || quotaPrice;
    if (valor > 0 && quotaPrice === 25) {
      quotaPrice = valor;
    }

    const statusRaw = (row[3] || '').toString().trim().toUpperCase();
    const isPaid = statusRaw === 'TRUE' || statusRaw === 'PAGO' || statusRaw === 'VERDADEIRO' || statusRaw === 'SIM';

    const pNorm = normalizeName(pName);
    let pId = nameToId(pName);
    const foundExisting = existingParticipants.find((p) => normalizeName(p.name) === pNorm);
    if (foundExisting) {
      pId = foundExisting.id;
    } else {
      const contact = extractNameAndPhone(pName);
      newParticipants.push({
        id: pId,
        name: (contact.cleanName || pName).toUpperCase(),
        phone: contact.formattedPhone || '',
        pixKey: '',
        pixKeyType: 'outro',
        notes: `Participante da aba "${tabTitle}"`,
        createdAt: new Date().toISOString(),
      });
    }

    const quotaIndex = isNaN(cotaNum) ? i : cotaNum;
    participantsList.push({
      participantId: pId,
      quotas: 1,
      quotaNumbers: [quotaIndex],
      status: isPaid ? 'pago' : 'pendente',
      amountPaid: isPaid ? valor : 0,
      totalDue: valor,
      paidAt: isPaid ? new Date().toISOString() : undefined,
      paymentMethod: 'pix',
      notes: row[5] || undefined,
    });
  }

  const bolao: Bolao = {
    id: existingBolao?.id || id,
    title: existingBolao?.title || tabTitle,
    lotteryType: existingBolao?.lotteryType || lotteryType,
    contestNumber: existingBolao?.contestNumber || '',
    drawDate: existingBolao?.drawDate || new Date().toISOString().split('T')[0],
    totalQuotas: existingBolao?.totalQuotas || Math.max(participantsList.length, 10),
    totalCotas: existingBolao?.totalCotas || Math.max(participantsList.length, 10),
    dezenas: existingBolao?.dezenas || 15,
    quotaPrice: quotaPrice,
    adminFeePercent: existingBolao?.adminFeePercent || 0,
    adminFeeFixed: existingBolao?.adminFeeFixed || 0,
    extraCost: existingBolao?.extraCost || 0,
    reserveFundAmount: existingBolao?.reserveFundAmount || 0,
    organizerName: existingBolao?.organizerName || 'Allyson Leandro',
    pixKeyRecipient: existingBolao?.pixKeyRecipient || 'allyson.leandro@gmail.com',
    pixKeyType: existingBolao?.pixKeyType || 'email',
    notes: existingBolao?.notes || `Bolão sincronizado da aba "${tabTitle}" da planilha Google Sheets.`,
    status: existingBolao?.status || 'arrecadando',
    tickets: existingBolao?.tickets || [],
    participants: participantsList.length > 0 ? participantsList : (existingBolao?.participants || []),
    createdAt: existingBolao?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { bolao, participants: newParticipants };
}

/**
 * Sincroniza todas as abas ativas da Planilha Google Sheets:
 * 1. Aba BOLÕES_REGULARES
 * 2. Aba Lotofácil da Independência (ADM.INDEPENDÊNCIA / PARTICIPANTES INDEPENDÊNCIA)
 * 3. Aba CONTATO
 * 4. Abas personalizadas de novos bolões
 */
export async function syncFromGoogleSheets(
  sheetUrl: string = DEFAULT_SHEET_URL,
  existingBoloes: Bolao[] = [],
  existingParticipants: Participant[] = []
): Promise<SyncResult> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  const tabsRead: string[] = [];

  let regularBolao: Bolao | null = null;
  let independenciaBolao1: Bolao | null = null;
  let independenciaBolao2: Bolao | null = null;
  const customBoloesFound: Bolao[] = [];
  let mergedParticipants: Participant[] = [...existingParticipants];

  const participantLookup = new Map<string, Participant>();
  for (const p of [...INITIAL_PARTICIPANTS, ...existingParticipants]) {
    participantLookup.set(normalizeName(p.name), { ...p });
  }

  let backendApiSuccess = false;

  // --- TENTATIVA 1: LEITURA EM TEMPO REAL VIA BACKEND API (SEM CACHE DE CDN) ---
  try {
    const apiRes = await fetch(`/api/sheets/get-all-data?spreadsheetId=${spreadsheetId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.success) {
        backendApiSuccess = true;

        // Processar Contatos primeiro
        if (data.contatos && data.contatos.length > 0) {
          mergedParticipants = processContatosRows(data.contatos, mergedParticipants);
          for (const p of mergedParticipants) {
            participantLookup.set(normalizeName(p.name), p);
          }
          tabsRead.push('CONTATO');
        }

        // Processar Bolões Regulares
        if (data.boloesRegulares && data.boloesRegulares.length > 0) {
          const parsed = processBoloesRegularesTab(data.boloesRegulares, existingBoloes, mergedParticipants);
          regularBolao = parsed.bolao;
          parsed.participants.forEach((p) => {
            const norm = normalizeName(p.name);
            if (!participantLookup.has(norm)) {
              participantLookup.set(norm, p);
              mergedParticipants.push(p);
            }
          });
          tabsRead.push('BOLÕES_REGULARES');
        }

        // Processar Independência (ADM.INDEPENDÊNCIA)
        if (data.admIndependencia && data.admIndependencia.length > 0) {
          const parsedInd = processIndependenciaTab(data.admIndependencia, existingBoloes, mergedParticipants);
          independenciaBolao1 = parsedInd.bolao1;
          independenciaBolao2 = parsedInd.bolao2;
          parsedInd.participants.forEach((p) => {
            const norm = normalizeName(p.name);
            if (!participantLookup.has(norm)) {
              participantLookup.set(norm, p);
              mergedParticipants.push(p);
            }
          });
          tabsRead.push('ADM.INDEPENDÊNCIA');
        }

        // Processar abas customizadas de novos bolões
        if (data.customBoloes && Array.isArray(data.customBoloes)) {
          for (const cb of data.customBoloes) {
            if (cb.rows && cb.rows.length > 0) {
              const customParsed = processCustomBolaoTab(cb.title, cb.rows, existingBoloes, mergedParticipants);
              customBoloesFound.push(customParsed.bolao);
              customParsed.participants.forEach((p) => {
                const norm = normalizeName(p.name);
                if (!participantLookup.has(norm)) {
                  participantLookup.set(norm, p);
                  mergedParticipants.push(p);
                }
              });
              tabsRead.push(cb.title);
            }
          }
        }
      }
    }
  } catch (backendErr) {
    console.warn('Leitura via backend API não disponível, tentando fallback CSV:', backendErr);
  }

  // --- TENTATIVA 2: FALLBACK PARA CSV PÚBLICO (SE O BACKEND NÃO RESPONDEU) ---
  if (!backendApiSuccess) {
    // 1. Ler aba BOLÕES_REGULARES via CSV
    try {
      const regularUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        BOLOES_REGULARES_TAB_NAME
      )}`;

      const resRegular = await fetch(regularUrl, {
        method: 'GET',
        headers: { Accept: 'text/csv, text/plain, */*' },
        cache: 'no-cache',
      });

      if (resRegular.ok) {
        const csvText = await resRegular.text();
        if (csvText && csvText.length > 50) {
          const rows = parseCsvRows(csvText);
          const parsed = processBoloesRegularesTab(rows, existingBoloes, mergedParticipants);
          regularBolao = parsed.bolao;
          parsed.participants.forEach((p) => {
            const norm = normalizeName(p.name);
            if (!participantLookup.has(norm)) {
              participantLookup.set(norm, p);
              mergedParticipants.push(p);
            }
          });
          tabsRead.push('BOLÕES_REGULARES');
        }
      }
    } catch (err) {
      console.warn('Aviso ao carregar aba BOLÕES_REGULARES:', err);
    }

    // 2. Ler aba INDEPENDÊNCIA (GID 539482389) via CSV
    try {
      const indUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${INDEPENDENCIA_GID}`;
      const resInd = await fetch(indUrl, {
        method: 'GET',
        headers: { Accept: 'text/csv, text/plain, */*' },
        cache: 'no-cache',
      });

      if (resInd.ok) {
        const csvText = await resInd.text();
        if (csvText && csvText.length > 50) {
          const rows = parseCsvRows(csvText);
          const parsedInd = processIndependenciaTab(rows, existingBoloes, mergedParticipants);
          independenciaBolao1 = parsedInd.bolao1;
          independenciaBolao2 = parsedInd.bolao2;

          parsedInd.participants.forEach((p) => {
            const norm = normalizeName(p.name);
            if (!participantLookup.has(norm)) {
              participantLookup.set(norm, p);
              mergedParticipants.push(p);
            }
          });
          tabsRead.push(`INDEPENDÊNCIA (gid:${INDEPENDENCIA_GID})`);
        }
      }
    } catch (err) {
      console.warn('Aviso ao carregar aba de Independência:', err);
    }
  }

  // Montagem final da lista de Bolões preservando participantes locais
  const finalBoloes: Bolao[] = [];

  if (regularBolao) {
    finalBoloes.push(regularBolao);
  } else {
    const existingReg = existingBoloes.find((b) => b.id === 'bolao-regular-lotofacil-25' || b.id === 'bolao-regular-25');
    if (existingReg) finalBoloes.push(existingReg);
    else if (INITIAL_BOLOES[0]) finalBoloes.push(INITIAL_BOLOES[0]);
  }

  if (independenciaBolao1) {
    finalBoloes.push(independenciaBolao1);
  } else {
    const existingB1 = existingBoloes.find((b) => b.id === 'bolao-1-independencia-60');
    if (existingB1) finalBoloes.push(existingB1);
    else if (INITIAL_BOLOES[1]) finalBoloes.push(INITIAL_BOLOES[1]);
  }

  if (independenciaBolao2) {
    finalBoloes.push(independenciaBolao2);
  } else {
    const existingB2 = existingBoloes.find((b) => b.id === 'bolao-2-independencia-39');
    if (existingB2) finalBoloes.push(existingB2);
    else if (INITIAL_BOLOES[2]) finalBoloes.push(INITIAL_BOLOES[2]);
  }

  // Adicionar bolões customizados encontrados nas abas da planilha
  customBoloesFound.forEach((cb) => {
    if (!finalBoloes.some((fb) => fb.id === cb.id || fb.title.toLowerCase() === cb.title.toLowerCase())) {
      finalBoloes.push(cb);
    }
  });

  // Preservar bolões adicionais criados pelo usuário
  existingBoloes.forEach((b) => {
    if (!finalBoloes.some((fb) => fb.id === b.id)) {
      finalBoloes.push(b);
    }
  });

  // Garantir que todos os participantes locais originais estão presentes
  existingParticipants.forEach((p) => {
    const norm = normalizeName(p.name);
    if (!participantLookup.has(norm)) {
      participantLookup.set(norm, p);
    }
  });

  const finalParticipants = Array.from(participantLookup.values());
  const timestamp = new Date().toISOString();

  // Salvar no localStorage para persistência imediata
  saveBoloes(finalBoloes);
  saveParticipants(finalParticipants);

  return {
    success: true,
    message: `Planilha sincronizada com sucesso em tempo real! (${finalBoloes.length} bolões e ${finalParticipants.length} participantes ativos).`,
    boloes: finalBoloes,
    participants: finalParticipants,
    timestamp,
    sourceUrl: sheetUrl,
    details: {
      tabsRead,
      regularBoloesFound: regularBolao ? 1 : 0,
      independenciaBoloesFound: (independenciaBolao1 ? 1 : 0) + (independenciaBolao2 ? 1 : 0),
      totalParticipants: finalParticipants.length,
    },
  };
}

// =========================================================================
// REAL-TIME GOOGLE SHEETS API V4 CALLS (VIA BACKEND PROXY / WEBHOOK)
// =========================================================================

export interface SheetsApiResult {
  success: boolean;
  message?: string;
  action?: 'created' | 'updated';
  rowNumber?: number;
  error?: string;
  alreadyExisted?: boolean;
  totalProcessed?: number;
  results?: any[];
}

/**
 * Dispara criação de nova aba com cabeçalhos para novo Bolão criado no app
 */
export async function triggerCreateBolaoTabInSheets(
  nomeDoBolao: string,
  spreadsheetId?: string
): Promise<SheetsApiResult> {
  try {
    const res = await fetch('/api/sheets/create-tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeDoBolao,
        spreadsheetId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Erro ao chamar /api/sheets/create-tab:', err);
    return {
      success: false,
      error: err?.message || 'Falha de conexão com a Google Sheets API.',
    };
  }
}

/**
 * Dispara inserção ou atualização de participante em tempo real na aba do Bolão
 */
export async function triggerSyncParticipantInSheets(
  nomeDoBolao: string,
  dadosParticipante: {
    usuarioId?: string;
    nome: string;
    statusPagamento: 'Pago' | 'Pendente' | string;
    dataEnvio?: string;
    palpite?: string;
    cotaNumbers?: number[];
    quotas?: number;
    valor?: number;
    bolaoId?: string;
  },
  spreadsheetId?: string
): Promise<SheetsApiResult> {
  try {
    const res = await fetch('/api/sheets/sync-participant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeDoBolao,
        dadosParticipante,
        spreadsheetId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Erro ao chamar /api/sheets/sync-participant:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao sincronizar participante com a planilha.',
    };
  }
}

/**
 * Dispara atualização do status de pagamento do participante no Google Sheets
 */
export async function triggerUpdatePaymentStatusInSheets(
  nomeDoBolao: string,
  usuarioId: string,
  nomeParticipante: string,
  statusPagamento: 'Pago' | 'Pendente' | string,
  bolaoId?: string,
  cotaNumbers?: number[],
  quotas?: number,
  valor?: number,
  spreadsheetId?: string
): Promise<SheetsApiResult> {
  try {
    const res = await fetch('/api/sheets/update-payment-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeDoBolao,
        usuarioId,
        nomeParticipante,
        statusPagamento,
        bolaoId,
        cotaNumbers,
        quotas,
        valor,
        spreadsheetId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Erro ao chamar /api/sheets/update-payment-status:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao atualizar status de pagamento na planilha.',
    };
  }
}

/**
 * Dispara remoção de participante de um bolão no Google Sheets
 */
export async function triggerRemoveParticipantInSheets(
  nomeDoBolao: string,
  nomeParticipante: string,
  usuarioId?: string,
  bolaoId?: string,
  spreadsheetId?: string
): Promise<SheetsApiResult> {
  try {
    const res = await fetch('/api/sheets/remove-participant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeDoBolao,
        nomeParticipante,
        usuarioId,
        bolaoId,
        spreadsheetId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Erro ao chamar /api/sheets/remove-participant:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao remover participante na planilha.',
    };
  }
}

/**
 * Dispara sincronização de contato na aba CONTATO da planilha
 */
export async function triggerSyncContactInSheets(
  nome: string,
  telefone: string,
  spreadsheetId?: string
): Promise<SheetsApiResult> {
  try {
    const res = await fetch('/api/sheets/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        telefone,
        spreadsheetId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Erro ao chamar /api/sheets/sync-contact:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao sincronizar contato na planilha.',
    };
  }
}

/**
 * Sincroniza em lote todos os participantes de um Bolão para a aba respectiva
 */
export async function triggerFullSyncBolaoInSheets(
  bolao: Bolao,
  allParticipantsList: Participant[] = [],
  spreadsheetId?: string
): Promise<SheetsApiResult> {
  try {
    const participantNameMap = new Map<string, string>();
    for (const p of allParticipantsList) {
      participantNameMap.set(p.id, p.name);
    }

    const participantes = bolao.participants.map((p) => {
      const resolvedName = participantNameMap.get(p.participantId) || p.participantId;
      const isPaid = p.status === 'pago';
      return {
        usuarioId: p.participantId,
        nome: resolvedName,
        statusPagamento: isPaid ? 'Pago' : 'Pendente',
        quotas: p.quotas,
        cotaNumbers: p.quotaNumbers,
        valor: p.amountPaid || p.quotas * bolao.quotaPrice,
        dataEnvio: p.paidAt
          ? new Date(p.paidAt).toLocaleString('pt-BR')
          : new Date().toLocaleString('pt-BR'),
        palpite: p.notes || (p.quotas ? `${p.quotas} cota(s)` : ''),
      };
    });

    const res = await fetch('/api/sheets/full-sync-bolao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeDoBolao: bolao.title,
        bolaoId: bolao.id,
        quotaPrice: bolao.quotaPrice,
        totalQuotas: bolao.totalQuotas,
        participantes,
        spreadsheetId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Erro ao chamar /api/sheets/full-sync-bolao:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao sincronizar bolão com a planilha.',
    };
  }
}
