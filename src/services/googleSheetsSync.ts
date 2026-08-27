import { Bolao, Participant, BolaoParticipant, LotteryType } from '../types';
import { INITIAL_BOLOES, INITIAL_PARTICIPANTS } from '../data/lotteries';
import { saveBoloes, saveParticipants } from '../utils/storage';

export const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1rcxVn3q3eG_7zf_fM6n0t2w9FWBdTcCFshZ3TiKQMIk/edit?hl=pt-br&pli=1&gid=539482389#gid=539482389';

export interface SyncResult {
  success: boolean;
  message: string;
  boloes: Bolao[];
  participants: Participant[];
  timestamp: string;
  sourceUrl: string;
}

/**
 * Converts any Google Sheets URL (view, edit, share) to CSV export URL
 */
export function convertToGoogleSheetsCsvUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.includes('docs.google.com/spreadsheets')) {
    return rawUrl;
  }

  // Extract Spreadsheet ID
  const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : '';

  // Extract GID (Sheet ID tab)
  const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  if (!spreadsheetId) return rawUrl;

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Robust CSV parser that handles quotes and multiple columns
 */
function parseCsvRows(csvText: string): string[][] {
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
function normalizeName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

/**
 * Creates a clean ID from a name
 */
function nameToId(name: string): string {
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
 * Fetches and synchronizes data directly from Google Sheets
 */
export async function syncFromGoogleSheets(
  sheetUrl: string = DEFAULT_SHEET_URL,
  existingBoloes: Bolao[] = [],
  existingParticipants: Participant[] = []
): Promise<SyncResult> {
  const csvUrl = convertToGoogleSheetsCsvUrl(sheetUrl);

  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/csv, text/plain, */*',
      },
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ao acessar planilha: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    if (!csvText || csvText.length < 20) {
      throw new Error('A planilha retornou conteúdo vazio ou inacessível.');
    }

    const rows = parseCsvRows(csvText);
    const parsedData = processGoogleSheetsData(rows, existingBoloes, existingParticipants);

    const timestamp = new Date().toISOString();

    // Save to local storage for persistence & offline readiness
    saveBoloes(parsedData.boloes);
    saveParticipants(parsedData.participants);

    return {
      success: true,
      message: `Sincronização com Google Sheets concluída com sucesso! ${parsedData.participants.length} participantes e ${parsedData.boloes.length} bolões sincronizados.`,
      boloes: parsedData.boloes,
      participants: parsedData.participants,
      timestamp,
      sourceUrl: sheetUrl,
    };
  } catch (err: any) {
    console.error('Erro na sincronização da planilha:', err);
    return {
      success: false,
      message: err.message || 'Falha ao buscar dados do Google Sheets.',
      boloes: existingBoloes.length > 0 ? existingBoloes : INITIAL_BOLOES,
      participants: existingParticipants.length > 0 ? existingParticipants : INITIAL_PARTICIPANTS,
      timestamp: new Date().toISOString(),
      sourceUrl: sheetUrl,
    };
  }
}

/**
 * Core parsing logic for Lotofácil da Independência spreadsheet structure
 */
export function processGoogleSheetsData(
  rows: string[][],
  currentBoloes: Bolao[],
  currentParticipants: Participant[]
): { boloes: Bolao[]; participants: Participant[] } {
  // Known participant phone and pix registry map (to preserve rich metadata)
  const participantMetadataMap = new Map<string, Participant>();
  for (const p of [...INITIAL_PARTICIPANTS, ...currentParticipants]) {
    const norm = normalizeName(p.name);
    if (!participantMetadataMap.has(norm)) {
      participantMetadataMap.set(norm, p);
    }
  }

  // Find header rows for Bolão 1 and Bolão 2
  // Typically: COTA, PARTICIPANTE, VALOR, STATUS (col A-D) and (col F-I)
  let b1ParticipantsList: { quotaNum: number; name: string; isPaid: boolean; rawVal: string }[] = [];
  let b2ParticipantsList: { quotaNum: number; name: string; isPaid: boolean; rawVal: string }[] = [];

  let isReadingQuotas = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Detect header row
    const col0 = (row[0] || '').trim().toUpperCase();
    const col1 = (row[1] || '').trim().toUpperCase();
    const col5 = (row[5] || '').trim().toUpperCase();
    const col6 = (row[6] || '').trim().toUpperCase();

    if (col0.includes('COTA') && col1.includes('PARTICIPANTE')) {
      isReadingQuotas = true;
      continue;
    }

    if (isReadingQuotas) {
      // Check if finished reading quota table (e.g. footer reached)
      if (col0.includes('TOTAL') || col0.includes('CUSTO') || col5.includes('TOTAL') || col5.includes('CUSTO')) {
        isReadingQuotas = false;
        continue;
      }

      // Parse Bolão 1 (Cols 0..3)
      const cota1Str = (row[0] || '').replace(/[^\d]/g, '');
      const name1 = (row[1] || '').trim();
      const val1 = (row[2] || '').trim();
      const status1Str = (row[3] || '').trim().toUpperCase();

      if (cota1Str && name1 && name1 !== '-' && name1.length >= 2) {
        const qNum = parseInt(cota1Str, 10);
        const isPaid = status1Str === 'TRUE' || status1Str === 'PAGO' || status1Str === 'SIM';
        b1ParticipantsList.push({
          quotaNum: qNum,
          name: name1,
          isPaid,
          rawVal: val1,
        });
      }

      // Parse Bolão 2 (Cols 5..8)
      const cota2Str = (row[5] || '').replace(/[^\d]/g, '');
      const name2 = (row[6] || '').trim();
      const val2 = (row[7] || '').trim();
      const status2Str = (row[8] || '').trim().toUpperCase();

      if (cota2Str && name2 && name2 !== '-' && name2.length >= 2) {
        const qNum = parseInt(cota2Str, 10);
        const isPaid = status2Str === 'TRUE' || status2Str === 'PAGO' || status2Str === 'SIM';
        b2ParticipantsList.push({
          quotaNum: qNum,
          name: name2,
          isPaid,
          rawVal: val2,
        });
      }
    }
  }

  // If no quotas read from table, fallback to existing
  if (b1ParticipantsList.length === 0 && b2ParticipantsList.length === 0) {
    return {
      boloes: currentBoloes.length > 0 ? currentBoloes : INITIAL_BOLOES,
      participants: currentParticipants.length > 0 ? currentParticipants : INITIAL_PARTICIPANTS,
    };
  }

  // Aggregate all unique participants
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

  // Preserve any other pre-registered participants
  currentParticipants.forEach((p) => {
    const norm = normalizeName(p.name);
    if (!participantIdByNameMap.has(norm)) {
      updatedParticipants.push(p);
      participantIdByNameMap.set(norm, p.id);
    }
  });

  // Build Bolao 1 Participants
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
    const amountPaid = data.isPaid ? totalDue : 0;
    return {
      participantId: pId,
      quotas,
      quotaNumbers: data.quotaNumbers.sort((a, b) => a - b),
      status: data.isPaid ? 'pago' : 'pendente',
      amountPaid,
      totalDue,
    };
  });

  // Build Bolao 2 Participants
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
    const amountPaid = data.isPaid ? totalDue : 0;
    return {
      participantId: pId,
      quotas,
      quotaNumbers: data.quotaNumbers.sort((a, b) => a - b),
      status: data.isPaid ? 'pago' : 'pendente',
      amountPaid,
      totalDue,
    };
  });

  // Update existing boloes or build standard ones
  const finalBoloes: Bolao[] = (currentBoloes.length > 0 ? currentBoloes : INITIAL_BOLOES).map((b) => {
    if (
      b.id === 'bolao-1-independencia-60' ||
      b.title.toLowerCase().includes('independência 1') ||
      b.title.toLowerCase().includes('bolão 1')
    ) {
      return {
        ...b,
        title: 'Bolão 1 da Lotofácil da Independência (1 aposta de 18 dezenas)',
        contestNumber: '3790',
        drawDate: '2026-09-15',
        totalQuotas: 50,
        totalCotas: 50,
        dezenas: 18,
        quotaPrice: 60.0,
        participants: bolao1Participants.length > 0 ? bolao1Participants : b.participants,
        updatedAt: new Date().toISOString(),
      };
    }
    if (
      b.id === 'bolao-2-independencia-39' ||
      b.title.toLowerCase().includes('independência 2') ||
      b.title.toLowerCase().includes('bolão 2')
    ) {
      return {
        ...b,
        title: 'Bolão 2 da Lotofácil da Independência (3 apostas de 17 dezenas)',
        contestNumber: '3790',
        drawDate: '2026-09-15',
        totalQuotas: 40,
        totalCotas: 40,
        dezenas: 17,
        quotaPrice: 39.0,
        participants: bolao2Participants.length > 0 ? bolao2Participants : b.participants,
        updatedAt: new Date().toISOString(),
      };
    }
    return b;
  });

  return {
    boloes: finalBoloes,
    participants: updatedParticipants,
  };
}
