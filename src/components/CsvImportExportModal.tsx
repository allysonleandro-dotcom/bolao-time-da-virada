import React, { useState } from 'react';
import { X, FileSpreadsheet, Upload, Download, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Bolao, Participant } from '../types';
import { downloadFile, exportParticipantsToCSV, parseParticipantsCSV } from '../utils/storage';

interface CsvImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  boloes: Bolao[];
  onImportParticipants: (newParticipants: Participant[]) => void;
  onRestoreAllData: (data: { participants: Participant[]; boloes: Bolao[] }) => void;
}

export const CsvImportExportModal: React.FC<CsvImportExportModalProps> = ({
  isOpen,
  onClose,
  participants,
  boloes,
  onImportParticipants,
  onRestoreAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'backup'>('import');
  const [csvInput, setCsvInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Partial<Participant>[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvInput(text);
      const parsed = parseParticipantsCSV(text);
      setParsedPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setCsvInput(text);
    const parsed = parseParticipantsCSV(text);
    setParsedPreview(parsed);
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) {
      alert('Nenhum participante válido encontrado para importar.');
      return;
    }

    const created: Participant[] = parsedPreview.map((p, idx) => ({
      id: `part-${Date.now()}-${idx}`,
      name: p.name || 'Participante',
      phone: p.phone || '',
      pixKey: p.pixKey || '',
      pixKeyType: p.pixKeyType || 'cpf',
      notes: p.notes || '',
      createdAt: new Date().toISOString(),
    }));

    onImportParticipants(created);
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      onClose();
    }, 1500);
  };

  const handleExportParticipantsCSV = () => {
    const csv = exportParticipantsToCSV(participants);
    downloadFile(csv, `participantes_boloes_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportBoloesSummaryCSV = () => {
    const headers = ['Bolao_ID', 'Titulo', 'Loteria', 'Concurso', 'Data_Sorteio', 'Total_Cotas', 'Valor_Cota', 'Status', 'Total_Premios'];
    const rows = boloes.map((b) => [
      `"${b.id}"`,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.lotteryType}"`,
      `"${b.contestNumber}"`,
      `"${b.drawDate}"`,
      b.totalQuotas,
      `"R$ ${b.quotaPrice.toFixed(2)}"`,
      `"${b.status}"`,
      `"R$ ${(b.totalPrizeWon || 0).toFixed(2)}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    downloadFile(csvContent, `resumo_boloes_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportJSONBackup = () => {
    const fullBackup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      participants,
      boloes,
    };
    const jsonStr = JSON.stringify(fullBackup, null, 2);
    downloadFile(jsonStr, `backup_bolao_master_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        if (raw.participants && raw.boloes) {
          if (confirm(`Restaurar ${raw.participants.length} participantes e ${raw.boloes.length} bolões?`)) {
            onRestoreAllData({
              participants: raw.participants,
              boloes: raw.boloes,
            });
            alert('Dados restaurados com sucesso!');
            onClose();
          }
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch {
        alert('Erro ao ler arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Importar e Exportar Planilhas (CSV / Excel)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Sincronize com suas planilhas de participantes e faça backup
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl text-xs font-black gap-1">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'import' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📥 Importar Participantes (CSV)
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'export' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📤 Exportar Relatórios (CSV)
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'backup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💾 Backup Completo (JSON)
          </button>
        </div>

        {/* TAB 1: IMPORT CSV */}
        {activeTab === 'import' && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Selecione um arquivo CSV ou cole os dados abaixo:
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ou cole o texto da sua planilha (separado por vírgula ou ponto e vírgula):
              </label>
              <textarea
                rows={4}
                value={csvInput}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Nome;Telefone;Chave_Pix;Observações&#10;Carlos Silva;(11) 98765-4321;carlos@email.com;Amigo da faculdade&#10;Mariana Costa;(21) 99876-5432;123.456.789-00;2 cotas"
                className="w-full p-3 bg-slate-50 font-mono text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              ></textarea>
            </div>

            {/* Preview of Parsed Rows */}
            {parsedPreview.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-semibold">
                  <span>Pré-visualização: {parsedPreview.length} participante(s) identificados</span>
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                  {parsedPreview.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100 flex justify-between">
                      <div>
                        <strong>{p.name}</strong> {p.phone && <span className="text-slate-500">• {p.phone}</span>}
                      </div>
                      <span className="font-mono text-slate-600">{p.pixKey || '-'}</span>
                    </div>
                  ))}
                  {parsedPreview.length > 5 && (
                    <div className="text-center text-slate-400 text-[10px] pt-1">
                      + outros {parsedPreview.length - 5} registros
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={parsedPreview.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                {importSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Importado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Importar {parsedPreview.length} Participantes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EXPORT CSV */}
        {activeTab === 'export' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Baixe os dados estruturados em formato CSV compatível com Excel, Google Planilhas e LibreOffice.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="font-bold text-slate-900 text-sm">
                  Planilha de Participantes
                </div>
                <p className="text-slate-500 text-xs">
                  Exporta todos os {participants.length} contatos, telefones e chaves Pix.
                </p>
                <button
                  onClick={handleExportParticipantsCSV}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar CSV de Participantes</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="font-bold text-slate-900 text-sm">
                  Resumo dos Bolões
                </div>
                <p className="text-slate-500 text-xs">
                  Exporta todos os {boloes.length} bolões cadastrados com cotas, valores e status.
                </p>
                <button
                  onClick={handleExportBoloesSummaryCSV}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar CSV de Bolões</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BACKUP JSON */}
        {activeTab === 'backup' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Faça backup completo de todos os bolões, apostas registradas, participantes e histórico para transferir entre dispositivos ou salvar em segurança.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="font-bold text-slate-900 text-sm">Salvar Backup Completo</div>
                <p className="text-slate-500 text-xs">
                  Gera um arquivo JSON contendo todos os dados do sistema.
                </p>
                <button
                  onClick={handleExportJSONBackup}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo de Backup</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="font-bold text-slate-900 text-sm">Restaurar Backup</div>
                <p className="text-slate-500 text-xs">
                  Carregue um arquivo JSON gerado anteriormente.
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreJSON}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
