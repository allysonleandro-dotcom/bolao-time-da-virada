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

/**
 * Detecta com precisão o tipo de bolão
 */
export function identifyBolaoType(
  nomeDoBolao: string,
  bolaoId?: string
): 'independencia_1' | 'independencia_2' | 'regular' | 'custom' {
  const normTitle = normalizeStr(nomeDoBolao);
  const normId = (bolaoId || '').toLowerCase();

  // Bolão 1 da Independência
  if (
    normId === 'bolao-1-independencia-60' ||
    normId.includes('independencia-1') ||
    (normTitle.includes('INDEPENDENCIA') && (normTitle.includes('BOLAO 1') || normTitle.includes('60') || normTitle.includes('18 DEZENAS'))) ||
    normTitle.includes('BOLAO 1 DA INDEPENDENCIA')
  ) {
    return 'independencia_1';
  }

  // Bolão 2 da Independência
  if (
    normId === 'bolao-2-independencia-39' ||
    normId.includes('independencia-2') ||
    (normTitle.includes('INDEPENDENCIA') && (normTitle.includes('BOLAO 2') || normTitle.includes('39') || normTitle.includes('17 DEZENAS'))) ||
    normTitle.includes('BOLAO 2 DA INDEPENDENCIA')
  ) {
    return 'independencia_2';
  }

  // Bolão Regular (especificamente a aba BOLÕES_REGULARES)
  if (
    normId === 'bolao-regular-lotofacil-25' ||
    normId === 'bolao-regular-25' ||
    normId === 'bolao-regular' ||
    normTitle === 'BOLOES_REGULARES' ||
    normTitle === 'BOLAO REGULAR' ||
    normTitle.startsWith('BOLAO REGULAR') ||
    normTitle.includes('TESTE APLICATIVO LOTOFACIL 8 MILHOES')
  ) {
    return 'regular';
  }

  return 'custom';
}

/**
 * 1. CRIAÇÃO DE ABA PERSONALIZADA PARA NOVO BOLÃO
 */
export async function criarAbaParaNovoBolao(
  spreadsheetId: string,
  nomeDoBolao: string,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string; sheetId?: number; alreadyExisted?: boolean }> {
  try {
    const sheets = getGoogleSheetsClient(customConfig);
    const sanitizedTitle = nomeDoBolao
      .trim()
      .replace(/[:\\/?*\[\]]/g, '-')
      .substring(0, 95);

    const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheetMeta.data.sheets || [];
    const sheetExists = existingSheets.some(
      (s) => s.properties?.title?.toLowerCase() === sanitizedTitle.toLowerCase()
    );

    if (!sheetExists) {
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sanitizedTitle,
                  gridProperties: { rowCount: 100, columnCount: 15 },
                },
              },
            },
          ],
        },
      });

      const sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

      const headers = [
        ['COTA', 'PARTICIPANTE', 'VALOR (R$)', 'STATUS PAGAMENTO', 'DATA/HORA', 'OBSERVAÇÕES/COTAS'],
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sanitizedTitle}'!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers },
      });

      // Registra no HISTÓRICO_BOLÕES
      const dataHora = new Date().toLocaleString('pt-BR');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "'HISTÓRICO_BOLÕES'!A:E",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[dataHora, sanitizedTitle, '', '', 'Aplicativo']],
        },
      }).catch(() => null);

      return {
        success: true,
        message: `Nova aba "${sanitizedTitle}" criada com sucesso na planilha!`,
        sheetId,
        alreadyExisted: false,
      };
    } else {
      return {
        success: true,
        message: `Aba "${sanitizedTitle}" já existe na planilha.`,
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
    const sheets = getGoogleSheetsClient(customConfig);
    const bolaoType = identifyBolaoType(nomeDoBolao, dados.bolaoId);
    const isPaid =
      dados.statusPagamento === 'Pago' ||
      dados.statusPagamento === 'pago' ||
      dados.statusPagamento === 'TRUE' ||
      String(dados.statusPagamento).toLowerCase() === 'true';
    const statusBoolStr = isPaid ? 'TRUE' : 'FALSE';
    const cleanName = dados.nome?.trim().toUpperCase() || 'PARTICIPANTE';

    // CASO 1: BOLÃO 1 DA INDEPENDÊNCIA (Col A:D em ADM.INDEPENDÊNCIA, Col A:C em PARTICIPANTES INDEPENDÊNCIA)
    if (bolaoType === 'independencia_1') {
      const maxSlots = 50;
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'ADM.INDEPENDÊNCIA'!A8:D57",
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

      const valorNum = isPaid ? 60 : 0;

      for (const targetRowIndex of targetRowIndexes) {
        if (targetRowIndex > 57) continue; // Nunca ultrapassar a linha 57 (Cota 50)
        const cotaNumber = targetRowIndex - 7;
        const cotaStr = `${cotaNumber}.`;

        // Grava em ADM.INDEPENDÊNCIA
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'ADM.INDEPENDÊNCIA'!A${targetRowIndex}:D${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, valorNum, statusBoolStr]],
          },
        });

        // Grava em PARTICIPANTES INDEPENDÊNCIA (Linha = targetRowIndex - 3)
        const partRow = targetRowIndex - 3;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'PARTICIPANTES INDEPENDÊNCIA'!A${partRow}:C${partRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, statusBoolStr]],
          },
        }).catch(() => null);

        if (isPaid) {
          await registrarTransacaoPix(
            spreadsheetId,
            cleanName,
            'R$ 60,00',
            cotaNumber.toString(),
            'BOLÃO 1 INDEPENDÊNCIA',
            customConfig
          ).catch(() => null);
        }
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: targetRowIndexes[0],
        message: `Participante "${cleanName}" atualizado no Bolão 1 (ADM.INDEPENDÊNCIA) (${targetRowIndexes.length} cota(s))!`,
      };
    }

    // CASO 2: BOLÃO 2 DA INDEPENDÊNCIA (Col F:I em ADM.INDEPENDÊNCIA, Col E:G em PARTICIPANTES INDEPENDÊNCIA)
    if (bolaoType === 'independencia_2') {
      const maxSlots = 40; // Bolão 2 possui estritamente 40 cotas (linhas 8 a 47)
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'ADM.INDEPENDÊNCIA'!F8:I47",
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

      const valorNum = isPaid ? 39 : 0;

      for (const targetRowIndex of targetRowIndexes) {
        if (targetRowIndex > 47) continue; // NUNCA ultrapassar a linha 47 (Cota 40 do Bolão 2)
        const cotaNumber = targetRowIndex - 7;
        const cotaStr = `${cotaNumber}.`;

        // Grava em ADM.INDEPENDÊNCIA (F:I)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'ADM.INDEPENDÊNCIA'!F${targetRowIndex}:I${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, valorNum, statusBoolStr]],
          },
        });

        // Grava em PARTICIPANTES INDEPENDÊNCIA (E:G)
        const partRow = targetRowIndex - 3;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'PARTICIPANTES INDEPENDÊNCIA'!E${partRow}:G${partRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cotaStr, cleanName, statusBoolStr]],
          },
        }).catch(() => null);

        if (isPaid) {
          await registrarTransacaoPix(
            spreadsheetId,
            cleanName,
            'R$ 39,00',
            cotaNumber.toString(),
            'BOLÃO 2 INDEPENDÊNCIA',
            customConfig
          ).catch(() => null);
        }
      }

      return {
        success: true,
        action: 'updated',
        rowNumber: targetRowIndexes[0],
        message: `Participante "${cleanName}" atualizado no Bolão 2 (ADM.INDEPENDÊNCIA) (${targetRowIndexes.length} cota(s))!`,
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
    await criarAbaParaNovoBolao(spreadsheetId, sanitizedTitle, customConfig).catch(() => null);

    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sanitizedTitle}'!A:F`,
    });

    const rows = readResponse.data.values || [];
    let rowIndex = -1;
    const searchNorm = normalizeStr(cleanName);

    for (let i = 1; i < rows.length; i++) {
      const rowName = normalizeStr(rows[i][1] || '');
      if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
        rowIndex = i + 1;
        break;
      }
    }

    const dataEnvio = dados.dataEnvio || new Date().toLocaleString('pt-BR');
    const valorFormatted = dados.valor ? `R$ ${dados.valor.toFixed(2)}` : '';
    const obs = dados.palpite || '';

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sanitizedTitle}'!A${rowIndex}:F${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[rowIndex - 1, cleanName, valorFormatted, statusBoolStr, dataEnvio, obs]],
        },
      });

      return {
        success: true,
        action: 'updated',
        rowNumber: rowIndex,
        message: `Participante "${cleanName}" atualizado na linha ${rowIndex} da aba "${sanitizedTitle}".`,
      };
    } else {
      const newCota = rows.length;
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sanitizedTitle}'!A:F`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[newCota, cleanName, valorFormatted, statusBoolStr, dataEnvio, obs]],
        },
      });

      return {
        success: true,
        action: 'created',
        rowNumber: rows.length + 1,
        message: `Participante "${cleanName}" adicionado à aba "${sanitizedTitle}"!`,
      };
    }
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
    const sheets = getGoogleSheetsClient(customConfig);
    const bolaoType = identifyBolaoType(nomeDoBolao, bolaoId);
    const cleanName = nomeParticipante.trim().toUpperCase();
    const searchNorm = normalizeStr(cleanName);
    let removedCount = 0;

    if (bolaoType === 'independencia_1') {
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'ADM.INDEPENDÊNCIA'!A8:D55",
      });
      const rows = readRes.data.values || [];
      for (let i = 0; i < rows.length; i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 8;
          const cotaNum = i + 1;
          // Limpa ADM.INDEPENDÊNCIA
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'ADM.INDEPENDÊNCIA'!A${targetRow}:D${targetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[`${cotaNum}.`, '', '-', 'FALSE']],
            },
          });
          // Limpa PARTICIPANTES INDEPENDÊNCIA
          const partRow = targetRow - 3;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
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
          message: `Participante "${cleanName}" removido de ${removedCount} cota(s) na aba "ADM.INDEPENDÊNCIA"!`,
        };
      }
    }

    if (bolaoType === 'independencia_2') {
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'ADM.INDEPENDÊNCIA'!F8:I47",
      });
      const rows = readRes.data.values || [];
      for (let i = 0; i < Math.min(rows.length, 40); i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 8;
          const cotaNum = i + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'ADM.INDEPENDÊNCIA'!F${targetRow}:I${targetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[`${cotaNum}.`, '', '-', 'FALSE']],
            },
          });
          const partRow = targetRow - 3;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
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
          message: `Participante "${cleanName}" removido de ${removedCount} cota(s) no Bolão 2 da aba "ADM.INDEPENDÊNCIA"!`,
        };
      }
    }

    if (bolaoType === 'regular') {
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'BOLÕES_REGULARES'!A7:D50",
      });
      const rows = readRes.data.values || [];
      for (let i = 0; i < rows.length; i++) {
        const rowName = normalizeStr(rows[i][1] || '');
        if (rowName && searchNorm && (rowName === searchNorm || rowName.includes(searchNorm) || searchNorm.includes(rowName))) {
          const targetRow = i + 7;
          const cotaNum = i + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
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
    const sheets = getGoogleSheetsClient(customConfig);
    const cleanName = nome.trim().toUpperCase();
    const cleanPhone = telefone.trim();
    const searchNorm = normalizeStr(cleanName);

    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'CONTATO'!A3:B150",
    });
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
        spreadsheetId,
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
        spreadsheetId,
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
    const sheets = getGoogleSheetsClient(customConfig);
    const dataHora = new Date().toLocaleDateString('pt-BR');

    // Registra em HISTÓRICO DE TRANSAÇÕES PIX
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'HISTÓRICO DE TRANSAÇÕES PIX'!A:F",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[dataHora, nome.toUpperCase(), valor, 'TRUE', '', cota]],
      },
    }).catch(() => null);

    // Registra em REGISTRO_PIX
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'REGISTRO_PIX'!A:G",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[dataHora, nome.toUpperCase(), valor, 'TRUE', 'TRUE', cota, bolaoNome]],
      },
    }).catch(() => null);
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
    const bolaoType = identifyBolaoType(bolao.title, bolao.id);
    const sheets = getGoogleSheetsClient(customConfig);

    // 1. BOLÃO 1 DA INDEPENDÊNCIA -> Gravação atômica em lote em ADM.INDEPENDÊNCIA e PARTICIPANTES INDEPENDÊNCIA
    if (bolaoType === 'independencia_1') {
      const totalSlots = 50; // Bolão 1 possui exatamente 50 cotas
      const admRows: (string | number)[][] = [];
      const partRows: string[][] = [];

      // Monta mapa de cota -> participante
      const cotaSlotMap = new Map<number, { name: string; isPaid: boolean }>();
      let currentSeq = 1;

      for (const p of bolao.participants) {
        const pName = (p.name || p.participantId || '').trim().toUpperCase();
        const isPaid =
          p.status === 'pago' ||
          p.status === 'Pago' ||
          p.status === 'TRUE' ||
          String(p.status).toLowerCase() === 'true';

        if (p.quotaNumbers && p.quotaNumbers.length > 0) {
          for (const num of p.quotaNumbers) {
            if (num >= 1 && num <= totalSlots) {
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
          const valorNum = slot.isPaid ? 60 : 0;
          admRows.push([`${c}.`, slot.name, valorNum, statusStr]);
          partRows.push([`${c}.`, slot.name, statusStr]);
        } else {
          admRows.push([`${c}.`, '', 0, 'FALSE']);
          partRows.push([`${c}.`, '', 'FALSE']);
        }
      }

      // Atualiza ADM.INDEPENDÊNCIA (A8:D57)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'ADM.INDEPENDÊNCIA'!A8:D57",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: admRows },
      });

      // Atualiza PARTICIPANTES INDEPENDÊNCIA (A5:C54)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'PARTICIPANTES INDEPENDÊNCIA'!A5:C54",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: partRows },
      }).catch(() => null);

      return {
        success: true,
        message: `Bolão 1 da Independência sincronizado com sucesso (${bolao.participants.length} participantes, ${totalSlots} cotas)!`,
        totalSynced: bolao.participants.length,
      };
    }

    // 2. BOLÃO 2 DA INDEPENDÊNCIA -> Gravação atômica em lote estritamente em F8:I47
    if (bolaoType === 'independencia_2') {
      const totalSlots = 40; // Bolão 2 possui estritamente 40 cotas
      const admRows: (string | number)[][] = [];
      const partRows: string[][] = [];

      const cotaSlotMap = new Map<number, { name: string; isPaid: boolean }>();
      let currentSeq = 1;

      for (const p of bolao.participants) {
        const pName = (p.name || p.participantId || '').trim().toUpperCase();
        const isPaid =
          p.status === 'pago' ||
          p.status === 'Pago' ||
          p.status === 'TRUE' ||
          String(p.status).toLowerCase() === 'true';

        if (p.quotaNumbers && p.quotaNumbers.length > 0) {
          for (const num of p.quotaNumbers) {
            if (num >= 1 && num <= totalSlots) {
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
          const valorNum = slot.isPaid ? 39 : 0;
          admRows.push([`${c}.`, slot.name, valorNum, statusStr]);
          partRows.push([`${c}.`, slot.name, statusStr]);
        } else {
          admRows.push([`${c}.`, '', 0, 'FALSE']);
          partRows.push([`${c}.`, '', 'FALSE']);
        }
      }

      // Atualiza ADM.INDEPENDÊNCIA (F8:I47) - Preserva rigorosamente as linhas 48 a 60
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'ADM.INDEPENDÊNCIA'!F8:I47",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: admRows },
      });

      // Atualiza PARTICIPANTES INDEPENDÊNCIA (E5:G44)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'PARTICIPANTES INDEPENDÊNCIA'!E5:G44",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: partRows },
      }).catch(() => null);

      return {
        success: true,
        message: `Bolão 2 da Independência sincronizado com sucesso (${bolao.participants.length} participantes, ${totalSlots} cotas)!`,
        totalSynced: bolao.participants.length,
      };
    }

    // 3. BOLÕES REGULARES
    if (bolaoType === 'regular') {
      const totalSlots = Math.max(bolao.totalQuotas || 50, 40);
      const regRows: string[][] = [];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'BOLÕES_REGULARES'!A5:D5",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[bolao.title]] },
      }).catch(() => null);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'BOLÕES_REGULARES'!C4:D4",
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[`R$ ${bolao.quotaPrice.toFixed(2)}`, bolao.totalQuotas.toString()]],
        },
      }).catch(() => null);

      const cotaSlotMap = new Map<number, { name: string; isPaid: boolean; valor: number }>();
      let currentSeq = 1;

      for (const p of bolao.participants) {
        const pName = (p.name || p.participantId || '').trim().toUpperCase();
        const isPaid =
          p.status === 'pago' ||
          p.status === 'Pago' ||
          p.status === 'TRUE' ||
          String(p.status).toLowerCase() === 'true';
        const val = p.amountPaid || p.quotas * bolao.quotaPrice;

        if (p.quotaNumbers && p.quotaNumbers.length > 0) {
          for (const num of p.quotaNumbers) {
            cotaSlotMap.set(num, { name: pName, isPaid, valor: val });
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
        spreadsheetId,
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
    await criarAbaParaNovoBolao(spreadsheetId, sanitizedTitle, customConfig);

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
  admIndependencia: string[][];
  participantesIndependencia: string[][];
  boloesRegulares: string[][];
  contatos: string[][];
  historicoBoloes: string[][];
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
      'ADM.INDEPENDÊNCIA',
      'PARTICIPANTES INDEPENDÊNCIA',
      'BOLÕES_REGULARES',
      'CONTATO',
      'HISTÓRICO_BOLÕES',
    ]);

    const customTabTitles = tabs
      .map((t) => t.title)
      .filter((title) => title && !systemTabs.has(title.trim().toUpperCase()));

    const baseRanges = [
      "'ADM.INDEPENDÊNCIA'!A1:I70",
      "'PARTICIPANTES INDEPENDÊNCIA'!A1:G70",
      "'BOLÕES_REGULARES'!A1:D70",
      "'CONTATO'!A1:B250",
      "'HISTÓRICO_BOLÕES'!A1:E50",
    ];

    const customRanges = customTabTitles.map((t) => `'${t}'!A1:F70`);
    const allRanges = [...baseRanges, ...customRanges];

    // 2. Leitura em lote atômica de todas as abas
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: allRanges,
    });

    const valueRanges = batchRes.data.valueRanges || [];
    const admIndependencia = valueRanges[0]?.values || [];
    const participantesIndependencia = valueRanges[1]?.values || [];
    const boloesRegulares = valueRanges[2]?.values || [];
    const contatos = valueRanges[3]?.values || [];
    const historicoBoloes = valueRanges[4]?.values || [];

    const customBoloes: Array<{ title: string; sheetId: number; rows: string[][] }> = [];
    for (let i = 0; i < customTabTitles.length; i++) {
      const tabTitle = customTabTitles[i];
      const tabMeta = tabs.find((t) => t.title === tabTitle);
      const rows = valueRanges[5 + i]?.values || [];
      customBoloes.push({
        title: tabTitle,
        sheetId: tabMeta?.sheetId || 0,
        rows,
      });
    }

    return {
      success: true,
      admIndependencia,
      participantesIndependencia,
      boloesRegulares,
      contatos,
      historicoBoloes,
      customBoloes,
      tabs,
    };
  } catch (err: any) {
    console.error('Erro em lerDadosCompletosPlanilha:', err);
    throw new Error(`Falha ao ler dados da planilha: ${err?.message || err}`);
  }
}
