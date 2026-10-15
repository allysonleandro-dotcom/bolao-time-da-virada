/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT - WEBHOOK API PARA SISTEMA DE BOLÃO
 * =========================================================================================
 * 
 * Como instalar no Google Planilhas:
 * 1. Abra sua Planilha no Google Sheets (ex: https://docs.google.com/spreadsheets/d/1rcxVn3q3eG_7zf_fM6n0t2w9FWBdTcCFshZ3TiKQMIk/edit)
 * 2. No menu superior, clique em: Extensões > Apps Script
 * 3. Apague o código padrão e cole todo este arquivo
 * 4. Clique no botão azul "Implantar" (Deploy) > "Nova implantação" (New deployment)
 * 5. Selecione o tipo: "App da Web" (Web app)
 * 6. Em "Executar como" (Execute as), selecione: "Eu" (seu e-mail)
 * 7. Em "Quem pode acessar" (Who has access), selecione: "Qualquer pessoa" (Anyone)
 * 8. Clique em "Implantar", conceda as permissões de acesso e COPIE a URL do Web App gerada.
 * =========================================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var action = data.action;
    var nomeDoBolao = data.nomeDoBolao;
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    var result = {};

    switch (action) {
      // -------------------------------------------------------------
      // 1. CRIAR NOVA ABA PARA O BOLÃO
      // -------------------------------------------------------------
      case 'criarAbaParaNovoBolao':
      case 'create_tab':
        result = criarAbaParaNovoBolao(spreadsheet, nomeDoBolao);
        break;

      // -------------------------------------------------------------
      // 2. ADICIONAR OU ATUALIZAR PARTICIPANTE
      // -------------------------------------------------------------
      case 'adicionarOuAtualizarParticipante':
      case 'sync_participant':
        result = adicionarOuAtualizarParticipante(
          spreadsheet,
          nomeDoBolao,
          data.dadosParticipante || data
        );
        break;

      // -------------------------------------------------------------
      // 3. ATUALIZAR STATUS DE PAGAMENTO
      // -------------------------------------------------------------
      case 'atualizarStatusPagamento':
      case 'update_payment_status':
        result = atualizarStatusPagamento(
          spreadsheet,
          nomeDoBolao,
          data.usuarioId,
          data.statusPagamento
        );
        break;

      // -------------------------------------------------------------
      // 4. SINCRONIZAÇÃO COMPLETA DE BOLÃO E PARTICIPANTES
      // -------------------------------------------------------------
      case 'sincronizarBolaoCompleto':
      case 'full_sync':
        result = sincronizarBolaoCompleto(
          spreadsheet,
          nomeDoBolao,
          data.participantes || []
        );
        break;

      default:
        throw new Error('Ação não reconhecida: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message || error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    message: 'Google Apps Script Webhook para Sistema de Bolão está ativo e pronto para receber POST requests.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------------------------
// FUNÇÕES AUXILIARES
// -----------------------------------------------------------------------------------------

/**
 * 1. Cria a aba para o Bolão com cabeçalho formatado
 */
function criarAbaParaNovoBolao(spreadsheet, nomeDoBolao) {
  var sanitizedTitle = (nomeDoBolao || 'Bolão').trim().replace(/[:\\/?*\[\]]/g, '-').substring(0, 95);
  var sheet = spreadsheet.getSheetByName(sanitizedTitle);
  var alreadyExisted = false;

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sanitizedTitle);
    
    // Cabeçalhos padronizados
    var headers = [
      ['ID Usuário', 'Nome do Participante', 'Status de Pagamento', 'Data do Envio', 'Palpite']
    ];

    sheet.getRange(1, 1, 1, 5).setValues(headers);

    // Formatação visual do cabeçalho
    var headerRange = sheet.getRange('A1:E1');
    headerRange.setBackground('#0f8760');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 5);
  } else {
    alreadyExisted = true;
  }

  return {
    success: true,
    message: alreadyExisted
      ? 'Aba "' + sanitizedTitle + '" já existia na planilha.'
      : 'Aba "' + sanitizedTitle + '" criada com sucesso com cabeçalhos padrão!',
    sheetName: sanitizedTitle,
    alreadyExisted: alreadyExisted
  };
}

/**
 * 2. Adiciona ou Atualiza participante na aba do Bolão
 */
function adicionarOuAtualizarParticipante(spreadsheet, nomeDoBolao, dadosParticipante) {
  var abaResult = criarAbaParaNovoBolao(spreadsheet, nomeDoBolao);
  var sheet = spreadsheet.getSheetByName(abaResult.sheetName);

  var usuarioId = (dadosParticipante.usuarioId || '').toString().trim();
  var nome = (dadosParticipante.nome || '').toString().trim();
  var statusPagamento = (dadosParticipante.statusPagamento || 'Pendente').toString().trim();
  var dataEnvio = dadosParticipante.dataEnvio || Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
  var palpite = dadosParticipante.palpite || '';

  var data = sheet.getDataRange().getValues();
  var targetRow = -1;

  var searchId = usuarioId.toLowerCase();
  var searchName = nome.toLowerCase();

  // Procura se o participante já existe (busca a partir da linha 2)
  for (var i = 1; i < data.length; i++) {
    var rowId = (data[i][0] || '').toString().trim().toLowerCase();
    var rowName = (data[i][1] || '').toString().trim().toLowerCase();

    if ((searchId && rowId === searchId) || (searchName && rowName === searchName)) {
      targetRow = i + 1; // Linhas no Sheet são 1-indexed
      break;
    }
  }

  var rowValues = [[usuarioId || ('part-' + new Date().getTime()), nome, statusPagamento, dataEnvio, palpite]];

  if (targetRow > 0) {
    // Atualiza linha existente
    sheet.getRange(targetRow, 1, 1, 5).setValues(rowValues);
    return {
      success: true,
      action: 'updated',
      rowNumber: targetRow,
      message: 'Participante "' + nome + '" atualizado na linha ' + targetRow + '.'
    };
  } else {
    // Insere nova linha no fim da aba
    sheet.appendRow(rowValues[0]);
    var newRow = sheet.getLastRow();
    return {
      success: true,
      action: 'created',
      rowNumber: newRow,
      message: 'Novo participante "' + nome + '" inserido na linha ' + newRow + '.'
    };
  }
}

/**
 * 3. Atualiza apenas o Status de Pagamento do participante
 */
function atualizarStatusPagamento(spreadsheet, nomeDoBolao, usuarioId, statusPagamento) {
  var sanitizedTitle = (nomeDoBolao || 'Bolão').trim().replace(/[:\\/?*\[\]]/g, '-').substring(0, 95);
  var sheet = spreadsheet.getSheetByName(sanitizedTitle);

  if (!sheet) {
    throw new Error('Aba "' + sanitizedTitle + '" não encontrada na planilha.');
  }

  var data = sheet.getDataRange().getValues();
  var targetRow = -1;
  var searchId = (usuarioId || '').toString().trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowId = (data[i][0] || '').toString().trim().toLowerCase();
    var rowName = (data[i][1] || '').toString().trim().toLowerCase();

    if (rowId === searchId || rowName === searchId) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error('Participante "' + usuarioId + '" não foi encontrado na aba "' + sanitizedTitle + '".');
  }

  // Atualiza coluna C (Status de Pagamento)
  sheet.getRange(targetRow, 3).setValue(statusPagamento);

  return {
    success: true,
    rowNumber: targetRow,
    statusPagamento: statusPagamento,
    message: 'Status de pagamento alterado para "' + statusPagamento + '" na linha ' + targetRow + '.'
  };
}

/**
 * 4. Sincronização em Lote de Participantes de um Bolão
 */
function sincronizarBolaoCompleto(spreadsheet, nomeDoBolao, participantes) {
  criarAbaParaNovoBolao(spreadsheet, nomeDoBolao);
  var sanitizedTitle = (nomeDoBolao || 'Bolão').trim().replace(/[:\\/?*\[\]]/g, '-').substring(0, 95);
  var sheet = spreadsheet.getSheetByName(sanitizedTitle);

  var total = 0;
  for (var i = 0; i < participantes.length; i++) {
    var p = participantes[i];
    adicionarOuAtualizarParticipante(spreadsheet, sanitizedTitle, p);
    total++;
  }

  return {
    success: true,
    totalSync: total,
    message: total + ' participante(s) sincronizado(s) na aba "' + sanitizedTitle + '".'
  };
}
