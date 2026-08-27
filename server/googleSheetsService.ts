import { google } from 'googleapis';

export interface ParticipantSyncData {
  usuarioId: string;
  nome: string;
  statusPagamento: 'Pago' | 'Pendente' | string;
  dataEnvio?: string;
  palpite?: string;
}

export interface SheetsConfig {
  serviceAccountEmail?: string;
  privateKey?: string;
  spreadsheetId?: string;
}

/**
 * Cria ou obtém o cliente autenticado da Google Sheets API v4
 */
export function getGoogleSheetsClient(customConfig?: SheetsConfig) {
  const clientEmail =
    customConfig?.serviceAccountEmail ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL;

  let privateKey =
    customConfig?.privateKey ||
    process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Credenciais do Google Service Account não configuradas. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.'
    );
  }

  // Tratamento para quebras de linha na chave privada PEM
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * 1. CRIAÇÃO DE NOVA ABA (Ao criar um Bolão no App)
 * - Cria uma nova aba com o nome do bolão caso ainda não exista.
 * - Insere automaticamente o cabeçalho padrão na Linha 1:
 *   [ "ID Usuário", "Nome do Participante", "Status de Pagamento", "Data do Envio", "Palpite" ]
 */
export async function criarAbaParaNovoBolao(
  spreadsheetId: string,
  nomeDoBolao: string,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; message: string; sheetId?: number; alreadyExisted?: boolean }> {
  try {
    const sheets = getGoogleSheetsClient(customConfig);
    const sanitizedTitle = nomeDoBolao.trim().replace(/[:\\/?*\[\]]/g, '-').substring(0, 95);

    // 1. Obter metadados da planilha para verificar se a aba já existe
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const existingSheets = metadata.data.sheets || [];
    const sheetExists = existingSheets.some(
      (s) => s.properties?.title?.toLowerCase() === sanitizedTitle.toLowerCase()
    );

    let sheetId: number | undefined;

    if (!sheetExists) {
      // Cria a nova aba (sheet)
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sanitizedTitle,
                  gridProperties: {
                    frozenRowCount: 1, // Congela a primeira linha de cabeçalho
                  },
                },
              },
            },
          ],
        },
      });

      sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;

      // 2. Insere os cabeçalhos padrão na primeira linha
      const headers = [
        ['ID Usuário', 'Nome do Participante', 'Status de Pagamento', 'Data do Envio', 'Palpite'],
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sanitizedTitle}'!A1:E1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: headers,
        },
      });

      // 3. Formatação visual do cabeçalho (Fundo verde esmeralda, texto branco em negrito)
      if (sheetId !== undefined) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  repeatCell: {
                    range: {
                      sheetId,
                      startRowIndex: 0,
                      endRowIndex: 1,
                      startColumnIndex: 0,
                      endColumnIndex: 5,
                    },
                    cell: {
                      userEnteredFormat: {
                        backgroundColor: { red: 0.06, green: 0.53, blue: 0.38 }, // #0f8760
                        textFormat: {
                          foregroundColor: { red: 1, green: 1, blue: 1 },
                          bold: true,
                          fontSize: 11,
                        },
                        horizontalAlignment: 'CENTER',
                      },
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                  },
                },
                {
                  autoResizeDimensions: {
                    dimensions: {
                      sheetId,
                      dimension: 'COLUMNS',
                      startIndex: 0,
                      endIndex: 5,
                    },
                  },
                },
              ],
            },
          });
        } catch (formatErr) {
          console.warn('Aviso ao estilizar cabeçalho da planilha:', formatErr);
        }
      }

      return {
        success: true,
        message: `Aba "${sanitizedTitle}" criada com sucesso na planilha com cabeçalhos estruturados!`,
        sheetId,
        alreadyExisted: false,
      };
    } else {
      return {
        success: true,
        message: `Aba "${sanitizedTitle}" já existe na planilha. Pronta para receber dados.`,
        alreadyExisted: true,
      };
    }
  } catch (error: any) {
    console.error('Erro ao criar aba no Google Sheets:', error);
    throw new Error(`Falha ao criar aba na planilha: ${error?.message || error}`);
  }
}

/**
 * 2. ATUALIZAÇÃO E INSERÇÃO DE DADOS EM TEMPO REAL
 * - Se o participante já existir na aba do bolão (busca por ID ou Nome), atualiza sua linha.
 * - Se for novo, insere uma nova linha no final da aba.
 */
export async function adicionarOuAtualizarParticipante(
  spreadsheetId: string,
  nomeDoBolao: string,
  dadosParticipante: ParticipantSyncData,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; action: 'created' | 'updated'; rowNumber: number; message: string }> {
  try {
    const sheets = getGoogleSheetsClient(customConfig);
    const sanitizedTitle = nomeDoBolao.trim().replace(/[:\\/?*\[\]]/g, '-').substring(0, 95);

    // Garante que a aba existe antes de inserir/atualizar
    await criarAbaParaNovoBolao(spreadsheetId, sanitizedTitle, customConfig).catch(() => null);

    // 1. Lê todos os dados atuais da aba para localizar se o usuário já existe
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sanitizedTitle}'!A:E`,
    });

    const rows = readResponse.data.values || [];
    let rowIndex = -1; // 1-based index na planilha

    const targetId = (dadosParticipante.usuarioId || '').trim().toLowerCase();
    const targetNome = (dadosParticipante.nome || '').trim().toLowerCase();

    // Começa na linha 2 (índice 1) para pular cabeçalho
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowId = (row[0] || '').toString().trim().toLowerCase();
      const rowNome = (row[1] || '').toString().trim().toLowerCase();

      // Verifica correspondência por ID ou por Nome
      if ((targetId && rowId === targetId) || (targetNome && rowNome === targetNome)) {
        rowIndex = i + 1; // Linhas na planilha começam em 1
        break;
      }
    }

    const dataEnvio = dadosParticipante.dataEnvio || new Date().toLocaleString('pt-BR');
    const palpite = dadosParticipante.palpite || '';
    const status = dadosParticipante.statusPagamento || 'Pendente';

    if (rowIndex > 0) {
      // 2. O usuário já existe: ATUALIZA a linha existente
      const updatedValues = [
        [
          dadosParticipante.usuarioId || `part-${Date.now()}`,
          dadosParticipante.nome,
          status,
          dataEnvio,
          palpite,
        ],
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sanitizedTitle}'!A${rowIndex}:E${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: updatedValues,
        },
      });

      return {
        success: true,
        action: 'updated',
        rowNumber: rowIndex,
        message: `Participante "${dadosParticipante.nome}" atualizado na linha ${rowIndex} da aba "${sanitizedTitle}".`,
      };
    } else {
      // 3. Usuário NOVO: ADICIONA no final da aba (append)
      const newRowValues = [
        [
          dadosParticipante.usuarioId || `part-${Date.now()}`,
          dadosParticipante.nome,
          status,
          dataEnvio,
          palpite,
        ],
      ];

      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sanitizedTitle}'!A:E`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: newRowValues,
        },
      });

      const updatedRange = appendResponse.data.updates?.updatedRange || '';
      const matchRow = updatedRange.match(/([0-9]+)$/);
      const insertedRow = matchRow ? parseInt(matchRow[1], 10) : rows.length + 1;

      return {
        success: true,
        action: 'created',
        rowNumber: insertedRow,
        message: `Novo participante "${dadosParticipante.nome}" inserido na linha ${insertedRow} da aba "${sanitizedTitle}".`,
      };
    }
  } catch (error: any) {
    console.error('Erro ao adicionar ou atualizar participante no Google Sheets:', error);
    throw new Error(`Falha na sincronização do participante: ${error?.message || error}`);
  }
}

/**
 * 3. ATUALIZAÇÃO DO STATUS DE PAGAMENTO
 * - Busca o participante pelo usuarioId (ou nome) na aba correspondente do bolão.
 * - Atualiza a coluna C ("Status de Pagamento") para o novo status (ex: 'Pago', 'Pendente').
 */
export async function atualizarStatusPagamento(
  spreadsheetId: string,
  nomeDoBolao: string,
  usuarioId: string,
  statusPagamento: 'Pago' | 'Pendente' | string,
  customConfig?: SheetsConfig
): Promise<{ success: boolean; rowNumber: number; message: string }> {
  try {
    const sheets = getGoogleSheetsClient(customConfig);
    const sanitizedTitle = nomeDoBolao.trim().replace(/[:\\/?*\[\]]/g, '-').substring(0, 95);

    // 1. Lê a aba para encontrar em qual linha o usuário está
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sanitizedTitle}'!A:E`,
    });

    const rows = readResponse.data.values || [];
    let targetRowIndex = -1;

    const searchId = (usuarioId || '').trim().toLowerCase();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowId = (row[0] || '').toString().trim().toLowerCase();
      const rowName = (row[1] || '').toString().trim().toLowerCase();

      if (rowId === searchId || rowName === searchId) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(
        `Participante com ID ou Nome "${usuarioId}" não foi encontrado na aba "${sanitizedTitle}".`
      );
    }

    // 2. Atualiza especificamente a célula da coluna C (Status de Pagamento)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sanitizedTitle}'!C${targetRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[statusPagamento]],
      },
    });

    return {
      success: true,
      rowNumber: targetRowIndex,
      message: `Status de pagamento do usuário "${usuarioId}" alterado para "${statusPagamento}" na linha ${targetRowIndex}.`,
    };
  } catch (error: any) {
    console.error('Erro ao atualizar status de pagamento no Google Sheets:', error);
    throw new Error(`Falha ao atualizar status de pagamento: ${error?.message || error}`);
  }
}
