import { google } from 'googleapis';

export interface SheetsConfig {
  spreadsheetId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface ParticipantSyncData {
  usuarioId?: string;
  nome: string;
  statusPagamento: 'Pago' | 'Pendente' | 'pago' | 'pendente' | 'TRUE' | 'FALSE' | string;
  dataEnvio?: string;
  palpite?: string;
  cotaNumbers?: number[];
  quotas?: number;
  valor?: number;
  bolaoId?: string;
}

export const DEFAULT_SHEET_ID = '1rcxVn3q3eG_7zf_fM6n0t2w9FWBdTcCFshZ3TiKQMIk';

/**
 * Extrai de forma robusta o Spreadsheet ID a partir de qualquer URL ou string de ID
 */
export function extractSpreadsheetId(idOrUrl?: string): string {
  if (!idOrUrl) {
    return process.env.GOOGLE_SPREADSHEET_ID || DEFAULT_SHEET_ID;
  }
  const clean = idOrUrl.trim();
  const match = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  const direct = clean.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (direct) return clean;
  return clean.split('/')[0].split('?')[0].split('#')[0].trim() || DEFAULT_SHEET_ID;
}

/**
 * Cria cliente autenticado Google Sheets usando Service Account das variáveis de ambiente
 */
export function getGoogleSheetsClient(customConfig?: SheetsConfig) {
  let privateKey = customConfig?.privateKey || process.env.GOOGLE_PRIVATE_KEY;
  let clientEmail =
    customConfig?.clientEmail ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL;

  if (privateKey && privateKey.startsWith('{')) {
    try {
      const parsed = JSON.parse(privateKey);
      privateKey = parsed.private_key || privateKey;
      clientEmail = parsed.client_email || clientEmail;
    } catch {
      // continua com valor original
    }
  }

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!privateKey || !clientEmail) {
    throw new Error(
      'Credenciais do Google Sheets não encontradas. Configure GOOGLE_PRIVATE_KEY e GOOGLE_SERVICE_ACCOUNT_EMAIL no ambiente.'
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Normaliza strings para busca robusta
 */
export function normalizeStr(str: string): string {
  return (str || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.*_#\-]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function parseMoneyValue(val: any, fallback: number = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const clean = String(val)
    .replace('R$', '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? fallback : num;
}

/**
 * Detecta com precisão o tipo de bolão
 */
export function identifyBolaoType(
  nomeDoBolao: string,
  bolaoId?: string
): 'mega_virada_1' | 'mega_virada_2' | 'independencia_1' | 'independencia_2' | 'regular' | 'custom' {
  const normTitle = normalizeStr(nomeDoBolao);
  const normId = (bolaoId || '').toLowerCase();

  // Se o ID indicar explicitamente customizado
  if (normId.startsWith('bolao-custom-') || normId.startsWith('custom-')) {
    return 'custom';
  }

  // Bolão 1 da Mega da Virada (50 cotas / 2 apostas de 11 números / R$ 57,12)
  if (
    normId === 'bolao-1-mega-virada-57' ||
    normId === 'bolao-1-mega-da-virada' ||
    normId.includes('mega-virada-1') ||
    normId.includes('virada-1') ||
    normId === 'bolao-1-independencia-60' ||
    normId === 'independencia-1' ||
    (normTitle.includes('VIRADA') && (normTitle.includes('BOLAO 1') || normTitle.includes('11'))) ||
    normTitle === 'BOLAO 1 DA MEGA DA VIRADA' ||
    normTitle === 'BOLAO 1 MEGA DA VIRADA' ||
    normTitle === 'BOLAO 1 DA INDEPENDENCIA' ||
    normTitle === 'BOLAO 1 INDEPENDENCIA'
  ) {
    return 'mega_virada_1';
  }

  // Bolão 2 da Mega da Virada (40 cotas / 1 aposta de 13 números / R$ 35,70)
  if (
    normId === 'bolao-2-mega-virada-35' ||
    normId === 'bolao-2-mega-da-virada' ||
    normId.includes('mega-virada-2') ||
    normId.includes('virada-2') ||
    normId === 'bolao-2-independencia-39' ||
    normId === 'independencia-2' ||
    (normTitle.includes('VIRADA') && (normTitle.includes('BOLAO 2') || normTitle.includes('13'))) ||
    normTitle === 'BOLAO 2 DA MEGA DA VIRADA' ||
    normTitle === 'BOLAO 2 MEGA DA VIRADA' ||
    normTitle === 'BOLAO 2 DA INDEPENDENCIA' ||
    normTitle === 'BOLAO 2 INDEPENDENCIA'
  ) {
    return 'mega_virada_2';
  }

  // Bolão Regular (somente o bolão padrão fixo associado à aba BOLÕES_REGULARES)
  if (
    normId === 'bolao-regular-lotofacil-25' ||
    normId === 'bolao-regular-25' ||
    normId === 'bolao-regular' ||
    normTitle === 'BOLOES_REGULARES' ||
    normTitle === 'BOLOES REGULARES' ||
    normTitle === 'BOLAO REGULAR'
  ) {
    return 'regular';
  }

  return 'custom';
}

/**
 * Obtém o nome real da aba da Mega da Virada / Independência presente na planilha
 */
export async function getViradaTabTitle(sheets: any, spreadsheetId: string): Promise<string> {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabList = (meta?.data?.sheets || []).map((s: any) => s.properties?.title || '');
    const viradaTab = tabList.find((t: string) => {
      const u = t.trim().toUpperCase();
      return u.includes('MEGA DA VIRADA') || (u.includes('VIRADA') && !u.includes('VERIFICA'));
    });
    if (viradaTab) return viradaTab;
    const indTab = tabList.find((t: string) => t.trim().toUpperCase() === 'ADM.INDEPENDÊNCIA');
    if (indTab) return indTab;
  } catch {}
  return 'MEGA DA VIRADA';
}

/**
 * 1. CRIAÇÃO DE ABA PERSONALIZADA PARA NOVO BOLÃO
 */
export async function criarAbaParaNovoBolao(
  spreadsheetId: string,
  nomeDoBolao: string,
  bolaoDetailsOrConfig?: any,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string; sheetId?: number; alreadyExisted?: boolean }> {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    
    // Suporte flexível para os parâmetros
    let details: { totalQuotas?: number; quotaPrice?: number; organizerName?: string } = {};
    let config: SheetsConfig | undefined = customConfig;
    
    if (bolaoDetailsOrConfig) {
      if ('clientEmail' in bolaoDetailsOrConfig || 'privateKey' in bolaoDetailsOrConfig) {
        config = bolaoDetailsOrConfig;
      } else {
        details = bolaoDetailsOrConfig;
      }
    }

    const sheets = getGoogleSheetsClient(config);
    const sanitizedTitle = nomeDoBolao
      .trim()
      .replace(/[:\\/?*\[\]]/g, '-')
      .substring(0, 95);

    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: cleanSpreadsheetId });
    const existingSheets = spreadsheetMeta.data.sheets || [];
    const foundSheet = existingSheets.find(
      (s) => s.properties?.title?.toLowerCase() === sanitizedTitle.toLowerCase()
    );

    if (!foundSheet) {
      const totalQuotasCount = Math.max(details?.totalQuotas || 10, 1);
      const rowCount = Math.max(totalQuotasCount + 20, 100);

      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: cleanSpreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sanitizedTitle,
                  gridProperties: { rowCount, columnCount: 10 },
                  tabColor: { red: 0.05, green: 0.65, blue: 0.4 }, // Verde esmeralda elegante
                },
              },
            },
          ],
        },
      });

      const sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

      // Cabeçalho da aba + slots de cotas pré-alocados para preenchimento
      const rows: string[][] = [
        ['COTA', 'PARTICIPANTE', 'VALOR (R$)', 'STATUS PAGAMENTO', 'DATA/HORA', 'OBSERVAÇÕES/COTAS'],
      ];

      for (let c = 1; c <= totalQuotasCount; c++) {
        rows.push([c.toString(), '', '', 'FALSE', '', '']);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${sanitizedTitle}'!A1:F${rows.length}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });

      // Registra no HISTÓRICO_BOLÕES
      const dataHora = new Date().toLocaleString('pt-BR');
      const totalVal = details?.totalQuotas && details?.quotaPrice
        ? `R$ ${(details.totalQuotas * details.quotaPrice).toFixed(2)}`
        : '';
      await sheets.spreadsheets.values.append({
        spreadsheetId: cleanSpreadsheetId,
        range: "'HISTÓRICO_BOLÕES'!A:E",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            [
              dataHora,
              sanitizedTitle,
              (details?.totalQuotas || '').toString(),
              totalVal,
              details?.organizerName || 'Aplicativo',
            ],
          ],
        },
      }).catch(() => null);

      return {
        success: true,
        message: `Nova aba "${sanitizedTitle}" criada com sucesso na planilha com ${totalQuotasCount} cotas!`,
        sheetId,
        alreadyExisted: false,
      };
    } else {
      return {
        success: true,
        message: `Aba "${sanitizedTitle}" já existe na planilha.`,
        sheetId: foundSheet.properties?.sheetId,
        alreadyExisted: true,
      };
    }
  } catch (error: any) {
    console.error('Erro ao criar aba no Google Sheets:', error);
    throw new Error(`Falha ao criar aba na planilha: ${error?.message || error}`);
  }
}

/**
 * 2. ATUALIZAR OU ADICIONAR PARTICIPANTE INDIVIDUAL
 */
export async function adicionarOuAtualizarParticipante(
  spreadsheetId: string,
  nomeDoBolao: string,
  dados: ParticipantSyncData,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; action: 'created' | 'updated'; rowNumber: number; message: string }> {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    const sheets = getGoogleSheetsClient(customConfig);
    const bolaoType = identifyBolaoType(nomeDoBolao, dados.bolaoId);
    const isPaid =
      dados.statusPagamento === 'Pago' ||
      dados.statusPagamento === 'pago' ||
      dados.statusPagamento === 'TRUE' ||
      String(dados.statusPagamento).toLowerCase() === 'true';
    const statusBoolStr = isPaid ? 'TRUE' : 'FALSE';
    const cleanName = dados.nome?.trim().toUpperCase() || 'PARTICIPANTE';

    // CASO 1: BOLÃO 1 DA MEGA DA VIRADA / INDEPENDÊNCIA (Col A:D)
    if (bolaoType === 'mega_virada_1' || bolaoType === 'independencia_1') {
      const maxSlots = 50;
      const viradaTab = await getViradaTabTitle(sheets, cleanSpreadsheetId);
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!A8:D57`,
      });
      const rows = readRes.data.values || [];
      const searchNorm = normalizeStr(cleanName);
      let targetRowIndexes: number[] = [];

      // 1. Busca por cotas específicas se fornecidas (1 a 50)
      if (dados.cotaNumbers && dados.cotaNumbers.length > 0) {
        targetRowIndexes = dados.cotaNumbers
          .map((cota) => Number(cota))
          .filter((cota) => !isNaN(cota) && cota >= 1 && cota <= maxSlots)
          .map((cota) => cota + 7);
      }

      // 2. Se não foi fornecido cotaNumbers, busca todas as linhas que contêm o participante pelo nome
      if (targetRowIndexes.length === 0 && searchNorm) {
        for (let i = 0; i < Math.min(rows.length, maxSlots); i++) {
          const rowName = normalizeStr(rows[i][1] || '');
          if (rowName && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
            targetRowIndexes.push(i + 8);
          }
        }
      }

      // 3. Primeira cota vazia se não foi encontrado (até no máximo linha 57)
      if (targetRowIndexes.length === 0) {
        const quotasRequested = Math.max(1, Math.round(dados.quotas || 1));
        for (let i = 0; i < maxSlots; i++) {
          const rowName = (rows[i]?.[1] || '').trim();
          if (!rowName || rowName === '-') {
            targetRowIndexes.push(i + 8);
            if (targetRowIndexes.length >= quotasRequested) break;
          }
        }
      }

      // Se ainda não achou e não atingiu o limite de 50 cotas
      if (targetRowIndexes.length === 0 && rows.length < maxSlots) {
        targetRowIndexes.push(8 + rows.length);
      }

      if (targetRowIndexes.length === 0) {
        throw new Error('Todas as 50 cotas do Bolão 1 já estão preenchidas.');
      }

      const defaultPrice = 57.12;
      const valorNum = isPaid ? (dados.valor ? (parseMoneyValue(dados.valor) || defaultPrice) : defaultPrice) : 0;

      for (const targetRowIndex of targetRowIndexes) {
        if (targetRowIndex > 57) continue; // Nunca ultrapassar a linha 57 (Cota 50)
        const cotaNumber = targetRowIndex - 7;
        const cotaStr = `${cotaNumber}.`;

        // Grava na aba da Mega da Virada (A8:D57)
        await sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `'${viradaTab}'!A${targetRowIndex}:D${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, valorNum, statusBoolStr]],
          },
        });

        // Grava em PARTICIPANTES INDEPENDÊNCIA (se existir na planilha antiga)
        const partRow = targetRowIndex - 3;
        await sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `'PARTICIPANTES INDEPENDÊNCIA'!A${partRow}:C${partRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, statusBoolStr]],
          },
        }).catch(() => null);

        if (isPaid) {
          await registrarTransacaoPix(
            cleanSpreadsheetId,
            cleanName,
            'R$ 57,12',
            cotaNumber.toString(),
            'BOLÃO 1 MEGA DA VIRADA',
            customConfig
          ).catch(() => null);
        }
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: targetRowIndexes[0],
        message: `Participante "${cleanName}" atualizado no Bolão 1 (${viradaTab}) (${targetRowIndexes.length} cota(s))!`,
      };
    }

    // CASO 2: BOLÃO 2 DA MEGA DA VIRADA / INDEPENDÊNCIA (Col F:I)
    if (bolaoType === 'mega_virada_2' || bolaoType === 'independencia_2') {
      const maxSlots = 40; // Bolão 2 possui estritamente 40 cotas (linhas 8 a 47)
      const viradaTab = await getViradaTabTitle(sheets, cleanSpreadsheetId);
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!F8:I47`,
      });
      const rows = readRes.data.values || [];
      const searchNorm = normalizeStr(cleanName);
      let targetRowIndexes: number[] = [];

      // 1. Busca por cotas específicas (1 a 40)
      if (dados.cotaNumbers && dados.cotaNumbers.length > 0) {
        targetRowIndexes = dados.cotaNumbers
          .map((cota) => Number(cota))
          .filter((cota) => !isNaN(cota) && cota >= 1 && cota <= maxSlots)
          .map((cota) => cota + 7);
      }

      // 2. Busca por nome dentro das 40 cotas
      if (targetRowIndexes.length === 0 && searchNorm) {
        for (let i = 0; i < Math.min(rows.length, maxSlots); i++) {
          const rowName = normalizeStr(rows[i][1] || '');
          if (rowName && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
            targetRowIndexes.push(i + 8);
          }
        }
      }

      // 3. Primeira cota vazia dentro das 40 cotas (linhas 8 a 47)
      if (targetRowIndexes.length === 0) {
        const quotasRequested = Math.max(1, Math.round(dados.quotas || 1));
        for (let i = 0; i < maxSlots; i++) {
          const rowName = (rows[i]?.[1] || '').trim();
          if (!rowName || rowName === '-') {
            targetRowIndexes.push(i + 8);
            if (targetRowIndexes.length >= quotasRequested) break;
          }
        }
      }

      // Se ainda não achou e não atingiu 40 cotas
      if (targetRowIndexes.length === 0 && rows.length < maxSlots) {
        targetRowIndexes.push(8 + rows.length);
      }

      if (targetRowIndexes.length === 0) {
        throw new Error('Todas as 40 cotas do Bolão 2 já estão preenchidas.');
      }

      const defaultPrice = 35.70;
      const valorNum = isPaid ? (dados.valor ? (parseMoneyValue(dados.valor) || defaultPrice) : defaultPrice) : 0;

      for (const targetRowIndex of targetRowIndexes) {
        if (targetRowIndex > 47) continue; // NUNCA ultrapassar a linha 47 (Cota 40 do Bolão 2)
        const cotaNumber = targetRowIndex - 7;
        const cotaStr = `${cotaNumber}.`;

        // Grava na aba da Mega da Virada (F8:I47)
        await sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `'${viradaTab}'!F${targetRowIndex}:I${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, valorNum, statusBoolStr]],
          },
        });

        // Grava em PARTICIPANTES INDEPENDÊNCIA se existir
        const partRow = targetRowIndex - 3;
        await sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `'PARTICIPANTES INDEPENDÊNCIA'!E${partRow}:G${partRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, statusBoolStr]],
          },
        }).catch(() => null);

        if (isPaid) {
          await registrarTransacaoPix(
            cleanSpreadsheetId,
            cleanName,
            'R$ 35,70',
            cotaNumber.toString(),
            'BOLÃO 2 MEGA DA VIRADA',
            customConfig
          ).catch(() => null);
        }
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: targetRowIndexes[0],
        message: `Participante "${cleanName}" atualizado no Bolão 2 (${viradaTab}) (${targetRowIndexes.length} cota(s))!`,
      };
    }

    // CASO 3: BOLÕES REGULARES
    if (bolaoType === 'regular') {
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'BOLÕES_REGULARES'!A7:D50",
      });
      const rows = readRes.data.values || [];
      const searchNorm = normalizeStr(cleanName);
      let targetRowIndexes: number[] = [];

      if (dados.cotaNumbers && dados.cotaNumbers.length > 0) {
        targetRowIndexes = dados.cotaNumbers.map((cota) => cota + 6);
      }

      if (targetRowIndexes.length === 0 && searchNorm) {
        for (let i = 0; i < rows.length; i++) {
          const rowName = normalizeStr(rows[i][1] || '');
          if (rowName && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
            targetRowIndexes.push(i + 7);
          }
        }
      }

      if (targetRowIndexes.length === 0) {
        for (let i = 0; i < rows.length; i++) {
          const rowName = (rows[i][1] || '').trim();
          if (!rowName) {
            targetRowIndexes.push(i + 7);
            break;
          }
        }
      }

      if (targetRowIndexes.length === 0) {
        targetRowIndexes.push(7 + rows.length);
      }

      const valorStr = isPaid
        ? dados.valor
          ? `R$ ${dados.valor.toFixed(2)}`
          : 'R$ 25,00'
        : 'R$ 0,00';

      for (const targetRowIndex of targetRowIndexes) {
        const cotaNumber = targetRowIndex - 6;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'BOLÕES_REGULARES'!A${targetRowIndex}:D${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaNumber.toString(), cleanName, valorStr, statusBoolStr]],
          },
        });

        if (isPaid) {
          await registrarTransacaoPix(
            spreadsheetId,
            cleanName,
            valorStr || 'R$ 25,00',
            cotaNumber.toString(),
            'BOLÃO REGULAR',
            customConfig
          ).catch(() => null);
        }
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: targetRowIndexes[0],
        message: `Participante "${cleanName}" atualizado na aba "BOLÕES_REGULARES" (${targetRowIndexes.length} cota(s))!`,
      };
    }

    // CASO 4: ABA CUSTOMIZADA
    const sanitizedTitle = nomeDoBolao
      .trim()
      .replace(/[:\\/?*\[\]]/g, '-')
      .substring(0, 95);
    await criarAbaParaNovoBolao(cleanSpreadsheetId, sanitizedTitle, customConfig).catch(() => null);

    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: cleanSpreadsheetId,
      range: `'${sanitizedTitle}'!A:F`,
    });

    const rows = readResponse.data.values || [];
    const searchNorm = normalizeStr(cleanName);
    const dataEnvio = dados.dataEnvio || new Date().toLocaleString('pt-BR');
    const valorFormatted = dados.valor ? `R$ ${dados.valor.toFixed(2)}` : '';
    const obs = dados.palpite || (dados.quotas ? `${dados.quotas} cota(s)` : '');

    // Se os números das cotas foram especificados (ex: [1, 2])
    if (dados.cotaNumbers && dados.cotaNumbers.length > 0) {
      for (const cNum of dados.cotaNumbers) {
        const targetRow = cNum + 1; // Linha 1 é cabeçalho, Cota 1 é Linha 2
        await sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `'${sanitizedTitle}'!A${targetRow}:F${targetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cNum.toString(), cleanName, valorFormatted, statusBoolStr, dataEnvio, obs]],
          },
        });
      }

      if (isPaid) {
        await registrarTransacaoPix(
          cleanSpreadsheetId,
          cleanName,
          valorFormatted || 'R$ 0,00',
          dados.cotaNumbers.join(', '),
          sanitizedTitle,
          customConfig
        ).catch(() => null);
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: dados.cotaNumbers[0] + 1,
        message: `Participante "${cleanName}" gravado nas cotas ${dados.cotaNumbers.join(', ')} da aba "${sanitizedTitle}".`,
      };
    }

    // Busca por linhas existentes com o nome do participante
    const matchingRowIndexes: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const rowName = normalizeStr(rows[i][1] || '');
      if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
        matchingRowIndexes.push(i + 1);
      }
    }

    if (matchingRowIndexes.length > 0) {
      for (const rIdx of matchingRowIndexes) {
        const cotaNum = rIdx - 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `'${sanitizedTitle}'!A${rIdx}:F${rIdx}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaNum.toString(), cleanName, valorFormatted, statusBoolStr, dataEnvio, obs]],
          },
        });
      }

      if (isPaid) {
        await registrarTransacaoPix(
          cleanSpreadsheetId,
          cleanName,
          valorFormatted || 'R$ 0,00',
          matchingRowIndexes.map((r) => r - 1).join(', '),
          sanitizedTitle,
          customConfig
        ).catch(() => null);
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: matchingRowIndexes[0],
        message: `Participante "${cleanName}" atualizado na aba "${sanitizedTitle}"!`,
      };
    }

    // Se for novo e houver slot vazio de cota pré-alocado
    let emptySlotIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][1] || rows[i][1].trim() === '') {
        emptySlotIndex = i + 1;
        break;
      }
    }

    if (emptySlotIndex > 0) {
      const cotaNum = emptySlotIndex - 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${sanitizedTitle}'!A${emptySlotIndex}:F${emptySlotIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[cotaNum.toString(), cleanName, valorFormatted, statusBoolStr, dataEnvio, obs]],
        },
      });

      if (isPaid) {
        await registrarTransacaoPix(
          cleanSpreadsheetId,
          cleanName,
          valorFormatted || 'R$ 0,00',
          cotaNum.toString(),
          sanitizedTitle,
          customConfig
        ).catch(() => null);
      }

      return {
        success: true,
        action: 'created',
        rowNumber: emptySlotIndex,
        message: `Participante "${cleanName}" gravado na cota ${cotaNum} da aba "${sanitizedTitle}"!`,
      };
    }

    // Se não houver slot vazio, faz append de nova linha
    const newCota = rows.length;
    await sheets.spreadsheets.values.append({
      spreadsheetId: cleanSpreadsheetId,
      range: `'${sanitizedTitle}'!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[newCota.toString(), cleanName, valorFormatted, statusBoolStr, dataEnvio, obs]],
      },
    });

    if (isPaid) {
      await registrarTransacaoPix(
        cleanSpreadsheetId,
        cleanName,
        valorFormatted || 'R$ 0,00',
        newCota.toString(),
        sanitizedTitle,
        customConfig
      ).catch(() => null);
    }

    return {
      success: true,
      action: 'created',
      rowNumber: rows.length + 1,
      message: `Participante "${cleanName}" adicionado à aba "${sanitizedTitle}"!`,
    };
  } catch (error: any) {
    console.error('Erro em adicionarOuAtualizarParticipante:', error);
    throw new Error(`Falha na sincronização do participante: ${error?.message || error}`);
  }
}

/**
 * 3. REMOVER PARTICIPANTE DO BOLÃO NA PLANILHA
 */
export async function removerParticipanteDoBolao(
  spreadsheetId: string,
  nomeDoBolao: string,
  nomeParticipante: string,
  bolaoId?: string,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    const sheets = getGoogleSheetsClient(customConfig);
    const bolaoType = identifyBolaoType(nomeDoBolao, bolaoId);
    const cleanName = nomeParticipante.trim().toUpperCase();
    const searchNorm = normalizeStr(cleanName);
    let removedCount = 0;

    if (bolaoType === 'mega_virada_1' || bolaoType === 'independencia_1') {
      const viradaTab = await getViradaTabTitle(sheets, cleanSpreadsheetId);
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!A8:D57`,
      });
      const rows = readRes.data.values || [];
      for (let i = 0; i < rows.length; i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 8;
          const cotaNum = i + 1;
          // Limpa na aba da Mega da Virada
          await sheets.spreadsheets.values.update({
            spreadsheetId: cleanSpreadsheetId,
            range: `'${viradaTab}'!A${targetRow}:D${targetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[`${cotaNum}.`, '', '-', 'FALSE']],
            },
          });
          // Limpa PARTICIPANTES INDEPENDÊNCIA (se existir)
          const partRow = targetRow - 3;
          await sheets.spreadsheets.values.update({
            spreadsheetId: cleanSpreadsheetId,
            range: `'PARTICIPANTES INDEPENDÊNCIA'!A${partRow}:C${partRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[`${cotaNum}.`, '', 'FALSE']],
            },
          }).catch(() => null);

          removedCount++;
        }
      }

      if (removedCount > 0) {
        return {
          success: true,
          message: `Participante "${cleanName}" removido de ${removedCount} cota(s) no Bolão 1 (${viradaTab})!`,
        };
      }
    }

    if (bolaoType === 'mega_virada_2' || bolaoType === 'independencia_2') {
      const viradaTab = await getViradaTabTitle(sheets, cleanSpreadsheetId);
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!F8:I47`,
      });
      const rows = readRes.data.values || [];
      for (let i = 0; i < Math.min(rows.length, 40); i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 8;
          const cotaNum = i + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId: cleanSpreadsheetId,
            range: `'${viradaTab}'!F${targetRow}:I${targetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[`${cotaNum}.`, '', '-', 'FALSE']],
            },
          });
          const partRow = targetRow - 3;
          await sheets.spreadsheets.values.update({
            spreadsheetId: cleanSpreadsheetId,
            range: `'PARTICIPANTES INDEPENDÊNCIA'!E${partRow}:G${partRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[`${cotaNum}.`, '', 'FALSE']],
            },
          }).catch(() => null);

          removedCount++;
        }
      }

      if (removedCount > 0) {
        return {
          success: true,
          message: `Participante "${cleanName}" removido de ${removedCount} cota(s) no Bolão 2 (${viradaTab})!`,
        };
      }
    }

    if (bolaoType === 'regular') {
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: "'BOLÕES_REGULARES'!A7:D50",
      });
      const rows = readRes.data.values || [];
      for (let i = 0; i < rows.length; i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 7;
          const cotaNum = i + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId: cleanSpreadsheetId,
            range: `'BOLÕES_REGULARES'!A${targetRow}:D${targetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[cotaNum.toString(), '', '', 'FALSE']],
            },
          });
          removedCount++;
        }
      }

      if (removedCount > 0) {
        return {
          success: true,
          message: `Participante "${cleanName}" removido de ${removedCount} cota(s) na aba "BOLÕES_REGULARES"!`,
        };
      }
    }

    if (bolaoType === 'custom') {
      const sanitizedTitle = nomeDoBolao
        .trim()
        .replace(/[:\\/?*\[\]]/g, '-')
        .substring(0, 95);

      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${sanitizedTitle}'!A:F`,
      }).catch(() => null);

      const rows = readRes?.data?.values || [];
      for (let i = 1; i < rows.length; i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 1;
          const cotaNum = rows[i][0] || i.toString();
          await sheets.spreadsheets.values.update({
            spreadsheetId: cleanSpreadsheetId,
            range: `'${sanitizedTitle}'!A${targetRow}:F${targetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[cotaNum, '', '', 'FALSE', '', '']],
            },
          });
          removedCount++;
        }
      }

      if (removedCount > 0) {
        return {
          success: true,
          message: `Participante "${cleanName}" removido de ${removedCount} cota(s) na aba "${sanitizedTitle}"!`,
        };
      }
    }

    return {
      success: true,
      message: `Participante "${cleanName}" não encontrado na planilha para remoção.`,
    };
  } catch (err: any) {
    console.error('Erro ao remover participante:', err);
    throw new Error(`Falha ao remover participante: ${err?.message || err}`);
  }
}

/**
 * 4. SINCRONIZAR CONTATO NA ABA CONTATO
 */
export async function adicionarOuAtualizarContato(
  spreadsheetId: string,
  nome: string,
  telefone: string,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    const sheets = getGoogleSheetsClient(customConfig);
    const cleanName = nome.trim().toUpperCase();
    const cleanPhone = telefone.trim();
    const searchNorm = normalizeStr(cleanName);

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: cleanSpreadsheetId,
      range: "'CONTATO'!A3:B350",
    }).catch(() => ({ data: { values: [] } }));
    const rows = readRes.data.values || [];
    let targetRow = -1;

    for (let i = 0; i < rows.length; i++) {
      const rowName = normalizeStr(rows[i][0] || '');
      if (rowName && searchNorm && rowName === searchNorm) {
        targetRow = i + 3;
        break;
      }
    }

    if (targetRow > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `'CONTATO'!A${targetRow}:B${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[cleanName, cleanPhone]],
        },
      });
      return {
        success: true,
        message: `Contato "${cleanName}" atualizado na aba "CONTATO" (Linha ${targetRow})!`,
      };
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: cleanSpreadsheetId,
        range: "'CONTATO'!A:B",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[cleanName, cleanPhone]],
        },
      });
      return {
        success: true,
        message: `Contato "${cleanName}" adicionado à aba "CONTATO"!`,
      };
    }
  } catch (err: any) {
    console.error('Erro em adicionarOuAtualizarContato:', err);
    throw new Error(`Falha ao sincronizar contato: ${err?.message || err}`);
  }
}

/**
 * 4.1 SINCRONIZAÇÃO EM LOTE (BATCH) DE CONTATOS NA ABA CONTATO
 */
export async function sincronizarContatosEmLote(
  spreadsheetId: string,
  contatos: Array<{ nome: string; telefone: string }>,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string; totalSynced: number }> {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    const sheets = getGoogleSheetsClient(customConfig);

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: cleanSpreadsheetId,
      range: "'CONTATO'!A3:B350",
    }).catch(() => ({ data: { values: [] } }));

    const existingRows = readRes.data.values || [];
    const nameToRowIndex = new Map<string, number>();

    for (let i = 0; i < existingRows.length; i++) {
      const rowName = normalizeStr(existingRows[i][0] || '');
      if (rowName) {
        nameToRowIndex.set(rowName, i + 3);
      }
    }

    const updates: Array<{ range: string; values: string[][] }> = [];
    const toAppend: string[][] = [];
    let count = 0;

    for (const c of contatos) {
      const cleanName = c.nome.trim().toUpperCase();
      const cleanPhone = (c.telefone || '').trim();
      if (!cleanName) continue;

      const norm = normalizeStr(cleanName);
      const existingRow = nameToRowIndex.get(norm);

      if (existingRow) {
        updates.push({
          range: `'CONTATO'!A${existingRow}:B${existingRow}`,
          values: [[cleanName, cleanPhone]],
        });
      } else {
        toAppend.push([cleanName, cleanPhone]);
        nameToRowIndex.set(norm, existingRows.length + toAppend.length + 2);
      }
      count++;
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: cleanSpreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    }

    if (toAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: cleanSpreadsheetId,
        range: "'CONTATO'!A:B",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: toAppend,
        },
      });
    }

    return {
      success: true,
      message: `${count} contato(s) sincronizado(s) na aba "CONTATO"!`,
      totalSynced: count,
    };
  } catch (err: any) {
    console.error('Erro em sincronizarContatosEmLote:', err);
    return {
      success: false,
      message: `Falha ao sincronizar contatos em lote: ${err?.message || err}`,
      totalSynced: 0,
    };
  }
}

/**
 * 5. REGISTRAR TRANSAÇÃO PIX NO HISTÓRICO PIX DA PLANILHA
 */
export async function registrarTransacaoPix(
  spreadsheetId: string,
  nome: string,
  valor: string,
  cota: string,
  bolaoNome: string,
  customConfig?: SheetsConfig
) {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    const sheets = getGoogleSheetsClient(customConfig);
    const dataHora = new Date().toLocaleDateString('pt-BR');

    // Identifica dinamicamente os nomes das abas de histórico/registro de PIX existentes na planilha
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId: cleanSpreadsheetId }).catch(() => null);
    const tabList = (metaRes?.data?.sheets || []).map((s) => s.properties?.title || '');
    const findTab = (fragment: string) =>
      tabList.find((t) => t.trim().toUpperCase().includes(fragment.toUpperCase()));

    const tabHistorico =
      findTab('HISTÓRICO DE TRANSAÇÕES PIX') ||
      findTab('HISTORICO DE TRANSACOES PIX') ||
      findTab('TRANSAÇÕES PIX') ||
      findTab('TRANSACOES PIX');

    const tabRegistro =
      findTab('REGISTRO DE PIX') ||
      findTab('REGISTRO_PIX') ||
      findTab('REGISTRO PIX');

    // Registra em HISTÓRICO DE TRANSAÇÕES PIX (se existir)
    if (tabHistorico) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${tabHistorico}'!A:F`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[dataHora, nome.toUpperCase(), valor, 'TRUE', '', cota]],
        },
      }).catch(() => null);
    }

    // Registra em REGISTRO_PIX / REGISTRO DE PIX (se existir)
    if (tabRegistro) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${tabRegistro}'!A:G`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[dataHora, nome.toUpperCase(), valor, 'TRUE', 'TRUE', cota, bolaoNome]],
        },
      }).catch(() => null);
    }
  } catch (err) {
    console.warn('Aviso ao registrar histórico PIX:', err);
  }
}

/**
 * 6. SINCRONIZAÇÃO COMPLETA ATÔMICA (BATCH) DE UM BOLÃO
 */
export async function sincronizarBolaoCompleto(
  spreadsheetId: string,
  bolao: {
    id: string;
    title: string;
    quotaPrice: number;
    totalQuotas: number;
    participants: Array<{
      participantId: string;
      quotas: number;
      quotaNumbers?: number[];
      status: string;
      amountPaid: number;
      name?: string;
    }>;
  },
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string; totalSynced: number }> {
  try {
    const cleanSpreadsheetId = extractSpreadsheetId(spreadsheetId);
    const bolaoType = identifyBolaoType(bolao.title, bolao.id);
    const sheets = getGoogleSheetsClient(customConfig);

    // 1. BOLÃO 1 DA MEGA DA VIRADA / INDEPENDÊNCIA -> Gravação atômica em lote em A8:D57
    if (bolaoType === 'mega_virada_1' || bolaoType === 'independencia_1') {
      const viradaTab = await getViradaTabTitle(sheets, cleanSpreadsheetId);
      const totalSlots = 50; // Bolão 1 possui exatamente 50 cotas
      const admRows: (string | number)[][] = [];
      const partRows: string[][] = [];
      const quotaVal = bolao.quotaPrice || 57.12;

      // Lê o estado atual da planilha para preservar cotas existentes caso não venham no envio
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!A8:D57`,
      }).catch(() => null);
      const existingRows = readRes?.data?.values || [];

      // Monta mapa de cota -> participante
      const cotaSlotMap = new Map<number, { name: string; isPaid: boolean }>();
      let currentSeq = 1;

      for (const p of bolao.participants) {
        let pName = (p.name || p.participantId || '').trim();
        if (pName.toLowerCase().startsWith('part-')) {
          pName = pName.substring(5).replace(/-/g, ' ').trim();
        }
        pName = pName.toUpperCase();

        const isPaid =
          p.status === 'pago' ||
          p.status === 'Pago' ||
          p.status === 'TRUE' ||
          String(p.status).toLowerCase() === 'true';

        if (p.quotaNumbers && p.quotaNumbers.length > 0) {
          for (const rawNum of p.quotaNumbers) {
            const num = Number(rawNum);
            if (!isNaN(num) && num >= 1 && num <= totalSlots) {
              cotaSlotMap.set(num, { name: pName, isPaid });
            }
          }
        } else {
          const qty = Math.max(1, Math.round(p.quotas || 1));
          for (let q = 0; q < qty; q++) {
            while (cotaSlotMap.has(currentSeq) && currentSeq <= totalSlots) currentSeq++;
            if (currentSeq <= totalSlots) {
              cotaSlotMap.set(currentSeq, { name: pName, isPaid });
              currentSeq++;
            }
          }
        }
      }

      for (let c = 1; c <= totalSlots; c++) {
        const slot = cotaSlotMap.get(c);
        if (slot && slot.name) {
          const statusStr = slot.isPaid ? 'TRUE' : 'FALSE';
          const valorNum = slot.isPaid ? quotaVal : 0;
          admRows.push([`${c}.`, slot.name, valorNum, statusStr]);
          partRows.push([`${c}.`, slot.name, statusStr]);
        } else {
          // Preserva participante existente na planilha se não veio no envio (evita apagar cotas existentes)
          const existingRow = existingRows[c - 1];
          const existingName = (existingRow?.[1] || '').trim();
          if (existingName && existingName !== '-' && existingName.length >= 2) {
            const rawStatus = (existingRow?.[3] || '').toString().trim().toUpperCase();
            const existingPaid =
              rawStatus === 'TRUE' ||
              rawStatus === 'VERDADEIRO' ||
              rawStatus === 'PAGO' ||
              rawStatus === 'SIM';
            const existingVal = existingPaid ? quotaVal : 0;
            admRows.push([`${c}.`, existingName, existingVal, existingPaid ? 'TRUE' : 'FALSE']);
            partRows.push([`${c}.`, existingName, existingPaid ? 'TRUE' : 'FALSE']);
          } else {
            admRows.push([`${c}.`, '', 0, 'FALSE']);
            partRows.push([`${c}.`, '', 'FALSE']);
          }
        }
      }

      // Atualiza na aba da Mega da Virada (A8:D57)
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!A8:D57`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: admRows },
      });

      // Atualiza PARTICIPANTES INDEPENDÊNCIA (se existir na planilha antiga)
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: "'PARTICIPANTES INDEPENDÊNCIA'!A5:C54",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: partRows },
      }).catch(() => null);

      return {
        success: true,
        message: `Bolão 1 da Mega da Virada sincronizado com sucesso (${bolao.participants.length} participantes, ${totalSlots} cotas na aba "${viradaTab}")!`,
        totalSynced: bolao.participants.length,
      };
    }

    // 2. BOLÃO 2 DA MEGA DA VIRADA / INDEPENDÊNCIA -> Gravação atômica em lote estritamente em F8:I47
    if (bolaoType === 'mega_virada_2' || bolaoType === 'independencia_2') {
      const viradaTab = await getViradaTabTitle(sheets, cleanSpreadsheetId);
      const totalSlots = 40; // Bolão 2 possui estritamente 40 cotas
      const admRows: (string | number)[][] = [];
      const partRows: string[][] = [];
      const quotaVal = bolao.quotaPrice || 35.70;

      // Lê o estado atual da planilha para preservar cotas existentes do Bolão 2
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!F8:I47`,
      }).catch(() => null);
      const existingRows = readRes?.data?.values || [];

      const cotaSlotMap = new Map<number, { name: string; isPaid: boolean }>();
      let currentSeq = 1;

      for (const p of bolao.participants) {
        let pName = (p.name || p.participantId || '').trim();
        if (pName.toLowerCase().startsWith('part-')) {
          pName = pName.substring(5).replace(/-/g, ' ').trim();
        }
        pName = pName.toUpperCase();

        const isPaid =
          p.status === 'pago' ||
          p.status === 'Pago' ||
          p.status === 'TRUE' ||
          String(p.status).toLowerCase() === 'true';

        if (p.quotaNumbers && p.quotaNumbers.length > 0) {
          for (const rawNum of p.quotaNumbers) {
            const num = Number(rawNum);
            if (!isNaN(num) && num >= 1 && num <= totalSlots) {
              cotaSlotMap.set(num, { name: pName, isPaid });
            }
          }
        } else {
          const qty = Math.max(1, Math.round(p.quotas || 1));
          for (let q = 0; q < qty; q++) {
            while (cotaSlotMap.has(currentSeq) && currentSeq <= totalSlots) currentSeq++;
            if (currentSeq <= totalSlots) {
              cotaSlotMap.set(currentSeq, { name: pName, isPaid });
              currentSeq++;
            }
          }
        }
      }

      for (let c = 1; c <= totalSlots; c++) {
        const slot = cotaSlotMap.get(c);
        if (slot && slot.name) {
          const statusStr = slot.isPaid ? 'TRUE' : 'FALSE';
          const valorNum = slot.isPaid ? quotaVal : 0;
          admRows.push([`${c}.`, slot.name, valorNum, statusStr]);
          partRows.push([`${c}.`, slot.name, statusStr]);
        } else {
          const existingRow = existingRows[c - 1];
          const existingName = (existingRow?.[1] || '').trim();
          if (existingName && existingName !== '-' && existingName.length >= 2) {
            const rawStatus = (existingRow?.[3] || '').toString().trim().toUpperCase();
            const existingPaid =
              rawStatus === 'TRUE' ||
              rawStatus === 'VERDADEIRO' ||
              rawStatus === 'PAGO' ||
              rawStatus === 'SIM';
            const existingVal = existingPaid ? quotaVal : 0;
            admRows.push([`${c}.`, existingName, existingVal, existingPaid ? 'TRUE' : 'FALSE']);
            partRows.push([`${c}.`, existingName, existingPaid ? 'TRUE' : 'FALSE']);
          } else {
            admRows.push([`${c}.`, '', 0, 'FALSE']);
            partRows.push([`${c}.`, '', 'FALSE']);
          }
        }
      }

      // Atualiza na aba da Mega da Virada (F8:I47)
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `'${viradaTab}'!F8:I47`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: admRows },
      });

      // Atualiza PARTICIPANTES INDEPENDÊNCIA se existir
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: "'PARTICIPANTES INDEPENDÊNCIA'!E5:G44",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: partRows },
      }).catch(() => null);

      return {
        success: true,
        message: `Bolão 2 da Mega da Virada sincronizado com sucesso (${bolao.participants.length} participantes, ${totalSlots} cotas na aba "${viradaTab}")!`,
        totalSynced: bolao.participants.length,
      };
    }

    // 3. BOLÕES REGULARES
    if (bolaoType === 'regular') {
      const totalSlots = Math.max(bolao.totalQuotas || 50, 40);
      const regRows: string[][] = [];

      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: "'BOLÕES_REGULARES'!A5:D5",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[bolao.title]] },
      }).catch(() => null);

      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: "'BOLÕES_REGULARES'!C4:D4",
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[`R$ ${bolao.quotaPrice.toFixed(2)}`, bolao.totalQuotas.toString()]],
        },
      }).catch(() => null);

      const cotaSlotMap = new Map<number, { name: string; isPaid: boolean; valor: number }>();
      let currentSeq = 1;

      for (const p of bolao.participants) {
        let pName = (p.name || p.participantId || '').trim();
        if (pName.toLowerCase().startsWith('part-')) {
          pName = pName.substring(5).replace(/-/g, ' ').trim();
        }
        pName = pName.toUpperCase();

        const isPaid =
          p.status === 'pago' ||
          p.status === 'Pago' ||
          p.status === 'TRUE' ||
          String(p.status).toLowerCase() === 'true';
        const val = p.amountPaid || p.quotas * bolao.quotaPrice;

        if (p.quotaNumbers && p.quotaNumbers.length > 0) {
          for (const rawNum of p.quotaNumbers) {
            const num = Number(rawNum);
            if (!isNaN(num)) {
              cotaSlotMap.set(num, { name: pName, isPaid, valor: val });
            }
          }
        } else {
          const qty = Math.max(1, Math.round(p.quotas || 1));
          for (let q = 0; q < qty; q++) {
            while (cotaSlotMap.has(currentSeq)) currentSeq++;
            cotaSlotMap.set(currentSeq, { name: pName, isPaid, valor: val });
            currentSeq++;
          }
        }
      }

      for (let c = 1; c <= totalSlots; c++) {
        const slot = cotaSlotMap.get(c);
        if (slot && slot.name) {
          const statusStr = slot.isPaid ? 'TRUE' : 'FALSE';
          const valorStr = slot.isPaid ? `R$ ${(slot.valor || bolao.quotaPrice).toFixed(2)}` : 'R$ 0,00';
          regRows.push([c.toString(), slot.name, valorStr, statusStr]);
        } else {
          regRows.push([c.toString(), '', '', 'FALSE']);
        }
      }

      const endRow = 6 + totalSlots;
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `'BOLÕES_REGULARES'!A7:D${endRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: regRows },
      });

      return {
        success: true,
        message: `Bolão Regular sincronizado com sucesso (${bolao.participants.length} participantes)!`,
        totalSynced: bolao.participants.length,
      };
    }

    // 4. BOLÃO CUSTOMIZADO
    const sanitizedTitle = bolao.title
      .trim()
      .replace(/[:\\/?*\[\]]/g, '-')
      .substring(0, 95);
    await criarAbaParaNovoBolao(cleanSpreadsheetId, sanitizedTitle, customConfig);

    const customRows: string[][] = [
      ['COTA', 'PARTICIPANTE', 'VALOR (R$)', 'STATUS PAGAMENTO', 'DATA/HORA', 'OBSERVAÇÕES/COTAS'],
    ];

    let count = 0;
    for (let i = 0; i < bolao.participants.length; i++) {
      const p = bolao.participants[i];
      const pName = (p.name || p.participantId || '').trim().toUpperCase();
      const isPaid =
        p.status === 'pago' ||
        p.status === 'Pago' ||
        p.status === 'TRUE' ||
        String(p.status).toLowerCase() === 'true';
      const statusBoolStr = isPaid ? 'TRUE' : 'FALSE';
      const valorStr = `R$ ${(p.amountPaid || p.quotas * bolao.quotaPrice).toFixed(2)}`;
      const obs = `${p.quotas} cota(s)`;
      customRows.push([
        (i + 1).toString(),
        pName,
        valorStr,
        statusBoolStr,
        new Date().toLocaleString('pt-BR'),
        obs,
      ]);
      count++;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sanitizedTitle}'!A1:F${customRows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: customRows },
    });

    return {
      success: true,
      message: `Aba "${sanitizedTitle}" atualizada com ${count} participantes!`,
      totalSynced: count,
    };
  } catch (err: any) {
    console.error('Erro em sincronizarBolaoCompleto:', err);
    throw new Error(`Falha na sincronização completa: ${err?.message || err}`);
  }
}

/**
 * 7. LEITURA EM TEMPO REAL DE TODAS AS ABAS DA PLANILHA (SEM CACHE DE CDN)
 */
export async function lerDadosCompletosPlanilha(
  spreadsheetId: string,
  customConfig?: SheetsConfig
): Promise<{
  success: boolean;
  megaDaVirada: string[][];
  admIndependencia: string[][];
  participantesIndependencia: string[][];
  boloesRegulares: string[][];
  contatos: string[][];
  historicoBoloes: string[][];
  registroPix: string[][];
  customBoloes: Array<{ title: string; sheetId: number; rows: string[][] }>;
  tabs: Array<{ title: string; sheetId: number }>;
}> {
  try {
    const sheets = getGoogleSheetsClient(customConfig);

    // 1. Metadados das abas
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    const tabs = (metaRes.data.sheets || []).map((s) => ({
      title: s.properties?.title || '',
      sheetId: s.properties?.sheetId || 0,
    }));

    // Identificar abas personalizadas de novos bolões
    const systemTabs = new Set([
      'DIAS DE SORTEIO',
      'MENU',
      'REGISTRO_PIX',
      'CALCULADORA',
      'HISTÓRICO DE TRANSAÇÕES PIX',
      'FECHAMENTO MEGA 7 DEZENAS',
      'CALCULADORA DE PORCENTAGEM',
      'RELATÓRIO_ANUAL',
      'TABELA_PREÇOS',
      'VERIFICADOR LOTOFÁCIL',
      'PRÊMIO PRINCIPAL',
      'CÁLCULOS',
      'MEGA DA VIRADA',
      'MEGA_DA_VIRADA',
      'ADM.INDEPENDÊNCIA',
      'PARTICIPANTES INDEPENDÊNCIA',
      'BOLÕES_REGULARES',
      'CONTATO',
      'HISTÓRICO_BOLÕES',
    ]);

    const customTabTitles = tabs
      .map((t) => t.title)
      .filter((title) => title && !systemTabs.has(title.trim().toUpperCase()));

    const findTab = (nameOrFragment: string) =>
      tabs.find((t) => t.title.trim().toUpperCase().includes(nameOrFragment.toUpperCase()))?.title;

    const megaDaViradaTitle =
      findTab('MEGA DA VIRADA') ||
      findTab('MEGA_VIRADA') ||
      (findTab('VIRADA') && !findTab('VIRADA')?.toUpperCase().includes('VERIFICA') ? findTab('VIRADA') : undefined);
    const admIndependenciaTitle = findTab('ADM.INDEPENDÊNCIA') || (findTab('INDEPENDÊNCIA') && !findTab('INDEPENDÊNCIA')?.toUpperCase().includes('VERIFICA') ? findTab('INDEPENDÊNCIA') : undefined);
    const participantesIndependenciaTitle = findTab('PARTICIPANTES INDEPENDÊNCIA');
    const boloesRegularesTitle = findTab('BOLÕES_REGULARES') || findTab('BOLOES_REGULARES');
    const contatosTitle = findTab('CONTATO');
    const historicoBoloesTitle = findTab('HISTÓRICO_BOLÕES') || findTab('HISTORICO_BOLOES');
    const registroPixTitle =
      findTab('REGISTRO DE PIX') ||
      findTab('REGISTRO_PIX') ||
      findTab('REGISTRO PIX') ||
      findTab('HISTÓRICO DE TRANSAÇÕES PIX') ||
      findTab('HISTORICO DE TRANSACOES PIX');

    const rangeRequests: { key: string; range: string; title: string }[] = [];

    if (megaDaViradaTitle) {
      rangeRequests.push({ key: 'megaDaVirada', range: `'${megaDaViradaTitle}'!A1:I125`, title: megaDaViradaTitle });
    }
    if (admIndependenciaTitle && admIndependenciaTitle !== megaDaViradaTitle) {
      rangeRequests.push({ key: 'admIndependencia', range: `'${admIndependenciaTitle}'!A1:I120`, title: admIndependenciaTitle });
    }
    if (participantesIndependenciaTitle) {
      rangeRequests.push({ key: 'participantesIndependencia', range: `'${participantesIndependenciaTitle}'!A1:G100`, title: participantesIndependenciaTitle });
    }
    if (boloesRegularesTitle) {
      rangeRequests.push({ key: 'boloesRegulares', range: `'${boloesRegularesTitle}'!A1:D100`, title: boloesRegularesTitle });
    }
    if (contatosTitle) {
      rangeRequests.push({ key: 'contatos', range: `'${contatosTitle}'!A1:B350`, title: contatosTitle });
    }
    if (historicoBoloesTitle) {
      rangeRequests.push({ key: 'historicoBoloes', range: `'${historicoBoloesTitle}'!A1:E100`, title: historicoBoloesTitle });
    }
    if (registroPixTitle) {
      rangeRequests.push({ key: 'registroPix', range: `'${registroPixTitle}'!A1:G150`, title: registroPixTitle });
    }

    customTabTitles.forEach((t) => {
      rangeRequests.push({ key: `custom_${t}`, range: `'${t}'!A1:F100`, title: t });
    });

    const allRanges = rangeRequests.map((r) => r.range);

    // 2. Leitura em lote atômica de todas as abas
    let megaDaVirada: string[][] = [];
    let admIndependencia: string[][] = [];
    let participantesIndependencia: string[][] = [];
    let boloesRegulares: string[][] = [];
    let contatos: string[][] = [];
    let historicoBoloes: string[][] = [];
    let registroPix: string[][] = [];
    const customBoloes: Array<{ title: string; sheetId: number; rows: string[][] }> = [];

    if (allRanges.length > 0) {
      const batchRes = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: allRanges,
      });

      const valueRanges = batchRes.data.valueRanges || [];

      rangeRequests.forEach((reqItem, idx) => {
        const rows = valueRanges[idx]?.values || [];
        if (reqItem.key === 'megaDaVirada') megaDaVirada = rows;
        else if (reqItem.key === 'admIndependencia') admIndependencia = rows;
        else if (reqItem.key === 'participantesIndependencia') participantesIndependencia = rows;
        else if (reqItem.key === 'boloesRegulares') boloesRegulares = rows;
        else if (reqItem.key === 'contatos') contatos = rows;
        else if (reqItem.key === 'historicoBoloes') historicoBoloes = rows;
        else if (reqItem.key === 'registroPix') registroPix = rows;
        else if (reqItem.key.startsWith('custom_')) {
          const tabMeta = tabs.find((t) => t.title === reqItem.title);
          customBoloes.push({
            title: reqItem.title,
            sheetId: tabMeta?.sheetId || 0,
            rows,
          });
        }
      });
    }

    if (megaDaVirada.length > 0 && admIndependencia.length === 0) {
      admIndependencia = megaDaVirada;
    }

    return {
      success: true,
      megaDaVirada,
      admIndependencia,
      participantesIndependencia,
      boloesRegulares,
      contatos,
      historicoBoloes,
      registroPix,
      customBoloes,
      tabs,
    };
  } catch (err: any) {
    console.error('Erro em lerDadosCompletosPlanilha:', err);
    throw new Error(`Falha ao ler dados da planilha: ${err?.message || err}`);
  }
}

/**
 * 8. OBTER EMAIL DA CONTA DE SERVIÇO ATIVA
 */
export function obterEmailContaServico(customConfig?: SheetsConfig): string {
  if (customConfig?.clientEmail) return customConfig.clientEmail;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (process.env.GOOGLE_CLIENT_EMAIL) return process.env.GOOGLE_CLIENT_EMAIL;

  if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.startsWith('{')) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_PRIVATE_KEY);
      if (parsed.client_email) return parsed.client_email;
    } catch {}
  }
  return 'bol-o-time-da-virada@project-7581b4f6-d053-4a21-b93.iam.gserviceaccount.com';
}

/**
 * 9. TESTE COMPLETO DE CONEXÃO E PERMISSÃO DE GRAVAÇÃO
 */
export async function testarConexaoPlanilha(
  spreadsheetId: string,
  customConfig?: SheetsConfig
): Promise<{
  success: boolean;
  canRead: boolean;
  canWrite: boolean;
  spreadsheetTitle?: string;
  tabs?: string[];
  serviceAccountEmail: string;
  message: string;
  error?: string;
}> {
  const serviceAccountEmail = obterEmailContaServico(customConfig);

  let sheets;
  try {
    sheets = getGoogleSheetsClient(customConfig);
  } catch (err: any) {
    return {
      success: false,
      canRead: false,
      canWrite: false,
      serviceAccountEmail,
      message: 'Falha na inicialização do cliente Google Sheets.',
      error: err?.message || 'Credenciais de serviço ausentes ou inválidas.',
    };
  }

  let spreadsheetTitle = '';
  let tabs: string[] = [];

  // 1. Testa Leitura
  try {
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    spreadsheetTitle = metaRes.data.properties?.title || 'Planilha Sem Título';
    tabs = (metaRes.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
  } catch (err: any) {
    const errMsg = err?.message || '';
    const is403 =
      errMsg.includes('403') ||
      errMsg.includes('permission') ||
      errMsg.includes('The caller does not have permission');
    const is404 = errMsg.includes('404') || errMsg.includes('not found');

    return {
      success: false,
      canRead: false,
      canWrite: false,
      serviceAccountEmail,
      message: is403
        ? `Acesso Negado (403): O Google Sheets bloqueou o acesso. Compartilhe sua planilha com o e-mail: ${serviceAccountEmail}`
        : is404
        ? 'Planilha não encontrada (404). Verifique o link ou ID da planilha.'
        : `Erro ao acessar planilha: ${errMsg}`,
      error: errMsg,
    };
  }

  // 2. Testa Gravação (Escrita)
  let canWrite = false;
  let writeError = '';
  try {
    const hasHistorico = tabs.includes('HISTÓRICO_BOLÕES');
    if (hasHistorico) {
      // Append de verificação rápida em HISTÓRICO_BOLÕES
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "'HISTÓRICO_BOLÕES'!A:E",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            [
              new Date().toLocaleString('pt-BR'),
              'TESTE_DIAGNOSTICO',
              '',
              '',
              'Verificação de Permissão de Gravação do App',
            ],
          ],
        },
      });
      canWrite = true;
    } else {
      // Se não tiver HISTÓRICO_BOLÕES, faz leitura e regravação segura da célula A1 da primeira aba
      const firstTab = tabs[0] || 'Sheet1';
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${firstTab}'!A1:A1`,
      });
      const currVal = readRes.data.values?.[0]?.[0] ?? '';
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${firstTab}'!A1:A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[currVal]],
        },
      });
      canWrite = true;
    }
  } catch (err: any) {
    writeError = err?.message || 'Erro desconhecido ao testar gravação.';
    canWrite = false;
  }

  if (!canWrite) {
    return {
      success: false,
      canRead: true,
      canWrite: false,
      spreadsheetTitle,
      tabs,
      serviceAccountEmail,
      message: `LEITURA ATIVA, MAS GRAVAÇÃO BLOQUEADA. Para gravar dados, abra sua planilha no Google Sheets, clique em "Compartilhar" e adicione o e-mail "${serviceAccountEmail}" com permissão de "Editor".`,
      error: writeError,
    };
  }

  return {
    success: true,
    canRead: true,
    canWrite: true,
    spreadsheetTitle,
    tabs,
    serviceAccountEmail,
    message: `CONEXÃO E GRAVAÇÃO 100% CONFIRMADAS! O aplicativo consegue ler e gravar na planilha "${spreadsheetTitle}".`,
  };
}

