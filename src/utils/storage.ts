import { Bolao, Participant, SystemSettings, LotteryPriceEntry } from '../types';
import { INITIAL_BOLOES, INITIAL_PARTICIPANTS } from '../data/lotteries';

const STORAGE_KEYS = {
  BOLOES: 'bolao_master_boloes_v2',
  PARTICIPANTS: 'bolao_master_participants_v1',
  SETTINGS: 'bolao_master_settings_v1',
  CUSTOM_PRICES: 'bolao_master_custom_prices_v1',
};

export interface CustomPriceTable {
  [lotteryId: string]: {
    basePrice?: number;
    customTable?: LotteryPriceEntry[];
  };
}

export function loadCustomPrices(): CustomPriceTable {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PRICES);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveCustomPrices(customPrices: CustomPriceTable): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PRICES, JSON.stringify(customPrices));
  } catch (err) {
    console.error('Failed to save custom prices', err);
  }
}

export const DEFAULT_SETTINGS: SystemSettings = {
  defaultOrganizerName: 'Allyson Leandro',
  defaultPixKey: 'allyson.leandro@gmail.com',
  defaultPixKeyType: 'email',
  defaultAdminFeePercent: 0,
};

export function loadParticipants(): Participant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(INITIAL_PARTICIPANTS));
      return INITIAL_PARTICIPANTS;
    }
    const parsed: Participant[] = JSON.parse(raw);
    const initialMap = new Map(INITIAL_PARTICIPANTS.map((p) => [p.id, p]));
    
    // Update existing participants with latest phones/names if they are standard records
    const updated = parsed.map((p) => {
      const init = initialMap.get(p.id);
      if (init) {
        return {
          ...p,
          phone: init.phone || p.phone,
          name: init.name || p.name,
        };
      }
      return p;
    });

    const existingIds = new Set(updated.map((p) => p.id));
    const missing = INITIAL_PARTICIPANTS.filter((p) => !existingIds.has(p.id));
    const finalParticipants = [...updated, ...missing];
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(finalParticipants));
    return finalParticipants;
  } catch (err) {
    console.error('Failed to load participants from localStorage', err);
    return INITIAL_PARTICIPANTS;
  }
}

export function saveParticipants(participants: Participant[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
  } catch (err) {
    console.error('Failed to save participants to localStorage', err);
  }
}

export function loadBoloes(): Bolao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOLOES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BOLOES, JSON.stringify(INITIAL_BOLOES));
      return INITIAL_BOLOES;
    }
    const parsed: Bolao[] = JSON.parse(raw);
    // Sync renamed default boloes and their updated tickets with current Caixa prices
    const updated = parsed.map((b) => {
      if (
        b.id === 'bolao-1-independencia-60' ||
        b.title?.toLowerCase().includes('independência 1') ||
        b.title?.toLowerCase().includes('bolão 1 da independência')
      ) {
        const defaultB1 = INITIAL_BOLOES.find((ib) => ib.id === 'bolao-1-independencia-60');
        return {
          ...b,
          title: 'Bolão 1 da Lotofácil da Independência (1 aposta de 18 dezenas)',
          contestNumber: '3790',
          drawDate: '2026-09-15',
          totalQuotas: 50,
          notes: 'Bolão 1 Especial da Lotofácil da Independência (1 aposta de 18 dezenas) • 50 cotas de R$ 60,00 cada.',
          tickets: defaultB1 ? defaultB1.tickets : b.tickets,
          participants: defaultB1 ? defaultB1.participants : b.participants,
        };
      }
      if (
        b.id === 'bolao-2-independencia-39' ||
        b.title?.toLowerCase().includes('independência 2') ||
        b.title?.toLowerCase().includes('bolão 2 da independência')
      ) {
        const defaultB2 = INITIAL_BOLOES.find((ib) => ib.id === 'bolao-2-independencia-39');
        return {
          ...b,
          title: 'Bolão 2 da Lotofácil da Independência (3 apostas de 17 dezenas)',
          contestNumber: '3790',
          drawDate: '2026-09-15',
          totalQuotas: 40,
          notes: 'Bolão 2 Especial da Lotofácil da Independência (3 apostas de 17 dezenas) • 40 cotas de R$ 39,00 cada.',
          tickets: defaultB2 ? defaultB2.tickets : b.tickets,
          participants: defaultB2 ? defaultB2.participants : b.participants,
        };
      }
      return b;
    });
    // Save synchronized updates
    localStorage.setItem(STORAGE_KEYS.BOLOES, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to load boloes from localStorage', err);
    return INITIAL_BOLOES;
  }
}

export function saveBoloes(boloes: Bolao[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOLOES, JSON.stringify(boloes));
  } catch (err) {
    console.error('Failed to save boloes to localStorage', err);
  }
}

export function loadSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SystemSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}

// CSV Export for Participants
export function exportParticipantsToCSV(participants: Participant[]): string {
  const headers = ['Nome', 'Telefone', 'Chave_PIX', 'Tipo_PIX', 'Observações', 'Data_Cadastro'];
  const rows = participants.map((p) => [
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    `"${(p.pixKey || '').replace(/"/g, '""')}"`,
    `"${(p.pixKeyType || '').replace(/"/g, '""')}"`,
    `"${(p.notes || '').replace(/"/g, '""')}"`,
    `"${p.createdAt || ''}"`,
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

// CSV Import for Participants (handles commas or semicolons)
export function parseParticipantsCSV(csvText: string): Partial<Participant>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // Parse header
  const headerTokens = lines[0]
    .split(delimiter)
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const nameIdx = headerTokens.findIndex((h) => h.includes('nome') || h.includes('participante') || h.includes('name'));
  const phoneIdx = headerTokens.findIndex((h) => h.includes('tel') || h.includes('cel') || h.includes('fone') || h.includes('phone') || h.includes('whatsapp'));
  const pixIdx = headerTokens.findIndex((h) => h.includes('pix') || h.includes('chave'));
  const pixTypeIdx = headerTokens.findIndex((h) => h.includes('tipo') || h.includes('type'));
  const notesIdx = headerTokens.findIndex((h) => h.includes('obs') || h.includes('nota') || h.includes('notes'));

  const results: Partial<Participant>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Simple regex splitter respecting quotes
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    for (let char of rawLine) {
      if (char === '"' || char === "'") {
        inQuote = !inQuote;
      } else if (char === delimiter && !inQuote) {
        tokens.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    tokens.push(current.trim().replace(/^["']|["']$/g, ''));

    const name = nameIdx !== -1 ? tokens[nameIdx] : tokens[0];
    if (!name || name.length < 2) continue;

    const phone = phoneIdx !== -1 ? tokens[phoneIdx] : tokens[1] || '';
    const pixKey = pixIdx !== -1 ? tokens[pixIdx] : tokens[2] || '';
    const pixKeyType = (pixTypeIdx !== -1 ? tokens[pixTypeIdx] : 'outro') as any;
    const notes = notesIdx !== -1 ? tokens[notesIdx] : tokens[3] || '';

    results.push({
      name,
      phone,
      pixKey,
      pixKeyType,
      notes,
    });
  }

  return results;
}

export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
