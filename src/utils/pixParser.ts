import { PixTransactionRecord, PixSummaryData } from '../types';

/**
 * Converte strings de moeda em número decimal (ex: "R$ 60,00" -> 60, "57,12" -> 57.12)
 */
export function parseCurrencyValue(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val)
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Tenta converter uma string de data (ex: "27/08/2026", "22/09", "21/09/2026 14:30", "2026-09-22") para objeto Date
 */
export function parseDateFromString(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.toLowerCase() === 'sem data') return null;

  // Formato ISO: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Formato brasileiro: DD/MM/YYYY ou DD/MM/YY ou DD-MM-YYYY
  const brMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    let year = brMatch[3] ? parseInt(brMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback Date.parse
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Converte valores booleanos / status de planilha em boolean
 */
export function parseStatusBoolean(val: any): boolean {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const str = String(val).trim().toUpperCase();
  return (
    str === 'TRUE' ||
    str === 'VERDADEIRO' ||
    str === 'SIM' ||
    str === 'PAGO' ||
    str === 'PAGA' ||
    str === 'CONFIRMADO' ||
    str === 'OK' ||
    str === 'TRANSFERIDO' ||
    str === '1'
  );
}

/**
 * Analisa e extrai dados da aba REGISTRO_PIX (incluindo sumário de caixa/cotas e transações)
 */
export function parseRegistroPixTab(rows: string[][]): {
  records: PixTransactionRecord[];
  summary: PixSummaryData;
  headers: string[];
} {
  const records: PixTransactionRecord[] = [];
  const summary: PixSummaryData = {
    totalArrecadado: 0,
    totalRegistros: 0,
    totalConfirmados: 0,
  };

  if (!rows || rows.length === 0) {
    return { records, summary, headers: [] };
  }

  // Identifica linhas de resumo no topo (ex: CAIXA, TOTAL DE COTAS, COTAS DISPONÍVEIS)
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const rowStr = row.join(' ').toUpperCase();
    if (rowStr.includes('CAIXA') || rowStr.includes('TOTAL DE COTAS') || rowStr.includes('COTAS DISPONÍVEIS')) {
      const nextRow = rows[i + 1] || [];
      row.forEach((cell, idx) => {
        const c = (cell || '').toUpperCase();
        const val = nextRow[idx] || '';
        if (c.includes('CAIXA')) {
          summary.caixa = parseCurrencyValue(val);
        } else if (c.includes('FALTA')) {
          summary.falta = val;
        } else if (c.includes('CUSTO')) {
          summary.custoBolao = val;
        } else if (c.includes('COTAS DISPONÍVEIS') || c.includes('DISPONIVEIS')) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) summary.cotasDisponiveis = num;
        } else if (c.includes('TOTAL DE COTAS')) {
          const num = parseInt(val, 10);
          if (!isNaN(num) && !summary.totalCotas) summary.totalCotas = num;
        } else if (c.includes('VALOR POR COTA')) {
          summary.valorPorCota = parseCurrencyValue(val);
        }
      });
    }
  }

  // Localiza a linha de cabeçalho da tabela de transações
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    const joined = row.join(' ').toLowerCase();
    if (
      joined.includes('data') &&
      (joined.includes('nome') || joined.includes('participante') || joined.includes('valor'))
    ) {
      headerIndex = i;
      headers = row;
      break;
    }
  }

  if (headerIndex === -1) {
    // Se não achou por texto, procura linha 4 ou 5 padrão
    if (rows.length >= 6) {
      headerIndex = 5;
      headers = rows[5];
    } else {
      headerIndex = 0;
      headers = rows[0] || [];
    }
  }

  // Processa as linhas a partir do cabeçalho
  const dataRows = rows.slice(headerIndex + 1);

  dataRows.forEach((row, index) => {
    // Pula linhas vazias
    if (!row || !row.some((cell) => cell && cell.trim())) return;

    const dataHora = (row[0] || '').trim();
    const nome = (row[1] || '').trim();
    const valorRaw = (row[2] || '').trim();
    const status1 = row[3];
    const status2 = row[4];
    const numeroCota = (row[5] || '').trim();
    const bolao = (row[6] || '').trim();

    // Linha só é válida se tiver nome de participante
    if (!nome || nome.length < 2) return;

    // Pula se for cabeçalho duplicado
    if (
      nome.toLowerCase().includes('nome do participante') ||
      dataHora.toLowerCase().includes('data / hora') ||
      nome.toUpperCase().includes('TOTAL')
    ) {
      return;
    }

    const valorNum = parseCurrencyValue(valorRaw);
    const isPago = parseStatusBoolean(status1);
    const isEnviado = parseStatusBoolean(status2);

    summary.totalRegistros++;
    summary.totalArrecadado += valorNum;
    if (isPago) summary.totalConfirmados++;

    records.push({
      id: `pix-reg-${index}-${nome.replace(/\s+/g, '_')}`,
      dataHora: dataHora || 'Sem data',
      nome: nome || 'Participante Não Identificado',
      valor: valorNum,
      valorOriginalText: valorRaw || (valorNum ? `R$ ${valorNum.toFixed(2).replace('.', ',')}` : 'R$ 0,00'),
      statusPagamento: isPago,
      statusEnvio: isEnviado,
      numeroCota: numeroCota || undefined,
      bolao: bolao || 'Mega da Virada',
      sourceTab: 'REGISTRO_PIX',
    });
  });

  return { records, summary, headers };
}

/**
 * Analisa e extrai dados da aba HISTÓRICO DE TRANSAÇÕES PIX
 */
export function parseHistoricoPixTab(rows: string[][]): PixTransactionRecord[] {
  const records: PixTransactionRecord[] = [];
  if (!rows || rows.length === 0) return records;

  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const joined = (rows[i] || []).join(' ').toLowerCase();
    if (joined.includes('data') && (joined.includes('nome') || joined.includes('valor'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 1;

  const dataRows = rows.slice(headerIndex + 1);

  dataRows.forEach((row, idx) => {
    if (!row || !row.some((c) => c && c.trim())) return;
    const dataHora = (row[0] || '').trim();
    const nome = (row[1] || '').trim();
    const valorRaw = (row[2] || '').trim();
    const status = row[3];

    if (!nome || nome.length < 2) return;
    if (
      nome.toLowerCase().includes('nome do participante') ||
      dataHora.toLowerCase().includes('data / hora') ||
      nome.toUpperCase().includes('TOTAL')
    ) {
      return;
    }

    const valorNum = parseCurrencyValue(valorRaw);
    const isPago = parseStatusBoolean(status);

    records.push({
      id: `pix-hist-${idx}-${nome.replace(/\s+/g, '_')}`,
      dataHora: dataHora || 'Sem data',
      nome: nome || 'Participante',
      valor: valorNum,
      valorOriginalText: valorRaw || `R$ ${valorNum.toFixed(2).replace('.', ',')}`,
      statusPagamento: isPago,
      bolao: 'Histórico Geral',
      sourceTab: 'HISTORICO_PIX',
    });
  });

  return records;
}

/**
 * Analisa e extrai dados da aba PIX_PESSOAL
 */
export function parsePixPessoalTab(rows: string[][]): PixTransactionRecord[] {
  const records: PixTransactionRecord[] = [];
  if (!rows || rows.length === 0) return records;

  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const joined = (rows[i] || []).join(' ').toLowerCase();
    if (joined.includes('data') && (joined.includes('nome') || joined.includes('observação') || joined.includes('observacao'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 5;

  const dataRows = rows.slice(headerIndex + 1);

  dataRows.forEach((row, idx) => {
    if (!row || !row.some((c) => c && c.trim())) return;
    const dataHora = (row[0] || '').trim();
    const nome = (row[1] || '').trim();
    const valorRaw = (row[2] || '').trim();
    const status = row[3];
    const observacao = (row[4] || '').trim();

    if (!nome || nome.length < 2) return;
    if (
      nome.toLowerCase().includes('nome do participante') ||
      dataHora.toLowerCase().includes('data / hora') ||
      nome.toUpperCase().includes('TOTAL')
    ) {
      return;
    }

    const valorNum = parseCurrencyValue(valorRaw);
    const isPago = parseStatusBoolean(status);

    records.push({
      id: `pix-pessoal-${idx}-${nome.replace(/\s+/g, '_')}`,
      dataHora: dataHora || 'Sem data',
      nome: nome || 'Registro Pessoal',
      valor: valorNum,
      valorOriginalText: valorRaw || `R$ ${valorNum.toFixed(2).replace('.', ',')}`,
      statusPagamento: isPago,
      observacao,
      bolao: 'Pessoal',
      sourceTab: 'PIX_PESSOAL',
    });
  });

  return records;
}
