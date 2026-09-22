import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Check,
  User,
  DollarSign,
  Database,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  DownloadCloud,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { SystemSettings } from '../types';
import {
  DEFAULT_SHEET_URL,
  testGoogleSheetsConnection,
  getServiceAccountInfo,
  SheetsConnectionTestResult,
} from '../services/googleSheetsSync';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  onSyncGoogleSheets?: () => Promise<void>;
  onWriteAllToSheets?: () => Promise<void>;
  onPullFromSheets?: () => Promise<void>;
  isSyncing?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onSyncGoogleSheets,
  onWriteAllToSheets,
  onPullFromSheets,
  isSyncing = false,
}) => {
  const [organizerName, setOrganizerName] = useState(settings.defaultOrganizerName || '');
  const [pixKey, setPixKey] = useState(settings.defaultPixKey || '');
  const [pixKeyType, setPixKeyType] = useState(settings.defaultPixKeyType || 'email');
  const [adminFeePercent, setAdminFeePercent] = useState(settings.defaultAdminFeePercent || 0);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(
    settings.googleSheetsUrl || DEFAULT_SHEET_URL
  );
  const [autoSync, setAutoSync] = useState(settings.autoSyncGoogleSheets ?? true);
  const [isSaved, setIsSaved] = useState(false);

  // Diagnostic states
  const [serviceAccountEmail, setServiceAccountEmail] = useState(
    'bol-o-time-da-virada@project-7581b4f6-d053-4a21-b93.iam.gserviceaccount.com'
  );
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<SheetsConnectionTestResult | null>(null);
  const [isLocalWriting, setIsLocalWriting] = useState(false);
  const [isLocalPulling, setIsLocalPulling] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getServiceAccountInfo()
        .then((info) => {
          if (info.serviceAccountEmail) setServiceAccountEmail(info.serviceAccountEmail);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(serviceAccountEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testGoogleSheetsConnection(googleSheetsUrl);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        canRead: false,
        canWrite: false,
        serviceAccountEmail,
        message: 'Falha ao executar teste de conexão.',
        error: err?.message,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleExecuteWriteAll = async () => {
    if (onWriteAllToSheets) {
      setIsLocalWriting(true);
      try {
        await onWriteAllToSheets();
      } finally {
        setIsLocalWriting(false);
      }
    } else if (onSyncGoogleSheets) {
      setIsLocalWriting(true);
      try {
        await onSyncGoogleSheets();
      } finally {
        setIsLocalWriting(false);
      }
    }
  };

  const handleExecutePull = async () => {
    if (onPullFromSheets) {
      setIsLocalPulling(true);
      try {
        await onPullFromSheets();
      } finally {
        setIsLocalPulling(false);
      }
    } else if (onSyncGoogleSheets) {
      setIsLocalPulling(true);
      try {
        await onSyncGoogleSheets();
      } finally {
        setIsLocalPulling(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      defaultOrganizerName: organizerName.trim(),
      defaultPixKey: pixKey.trim(),
      defaultPixKeyType: pixKeyType,
      defaultAdminFeePercent: adminFeePercent,
      googleSheetsUrl: googleSheetsUrl.trim() || DEFAULT_SHEET_URL,
      autoSyncGoogleSheets: autoSync,
      lastSyncedAt: settings.lastSyncedAt,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Configurações & Planilha Google Sheets
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Preferências gerais, permissões de gravação e sincronização
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Google Sheets Sync Integration Section */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-700" />
                <span className="font-black text-emerald-950 text-xs uppercase tracking-tight">
                  Integração Google Sheets (Leitura e Gravação)
                </span>
              </div>
              {settings.lastSyncedAt && (
                <span className="text-[10px] text-emerald-700 font-bold">
                  Última sincronização: {new Date(settings.lastSyncedAt).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>

            {/* Email de permissão da Conta de Serviço */}
            <div className="bg-white border border-emerald-300/80 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Permissão de Gravação (Salvar Dados na Planilha)
                  </span>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                    Para que o app possa <strong>gravar e alterar</strong> dados na sua planilha, abra-a no Google Sheets, clique em <strong>Compartilhar</strong> e adicione o e-mail do sistema como <strong>Editor</strong>:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <code className="text-[11px] font-mono text-emerald-900 font-bold flex-1 truncate select-all">
                  {serviceAccountEmail}
                </code>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-[10px] font-black transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-200" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar E-mail</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Input Link da Planilha */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Link ou ID da Planilha Google Sheets
              </label>
              <input
                type="text"
                value={googleSheetsUrl}
                onChange={(e) => {
                  setGoogleSheetsUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Planilha padrão configurada com suporte a Bolão 1, Bolão 2, Bolões Regulares e Contatos.
              </span>
            </div>

            {/* Botão de Testar Permissão / Diagnóstico */}
            <div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="w-full bg-white hover:bg-slate-50 border border-emerald-400 text-emerald-900 font-black px-3 py-2 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isTestingConnection ? 'animate-spin' : ''}`} />
                <span>{isTestingConnection ? 'Testando Permissões de Leitura e Gravação...' : '🧪 Testar Permissão de Gravação (Diagnóstico)'}</span>
              </button>

              {/* Resultado do Diagnóstico */}
              {testResult && (
                <div
                  className={`mt-2 p-2.5 rounded-xl border text-[11px] font-medium leading-relaxed ${
                    testResult.canWrite
                      ? 'bg-emerald-100/70 border-emerald-400 text-emerald-950'
                      : testResult.canRead
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-red-50 border-red-300 text-red-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.canWrite ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-black block">
                        {testResult.canWrite
                          ? '✅ Gravação e Leitura 100% Confirmadas!'
                          : testResult.canRead
                          ? '⚠️ Leitura Ativa, mas Gravação Bloqueada (Necessita Editor)'
                          : '❌ Falha de Acesso à Planilha'}
                      </span>
                      <p className="mt-0.5">{testResult.message}</p>
                      {testResult.spreadsheetTitle && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          Planilha identificada: <strong>{testResult.spreadsheetTitle}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ações Explícitas: Gravar vs Ler */}
            <div className="border-t border-emerald-200/80 pt-3 space-y-2">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                Sincronização Manual (Ações Diretas)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExecuteWriteAll}
                  disabled={isSyncing || isLocalWriting}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <UploadCloud className={`w-4 h-4 ${isLocalWriting ? 'animate-bounce' : ''}`} />
                  <span>{isLocalWriting ? 'Gravando dados...' : '📤 Gravar Tudo na Planilha'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExecutePull}
                  disabled={isSyncing || isLocalPulling}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 px-3 py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <DownloadCloud className={`w-4 h-4 text-emerald-600 ${isLocalPulling ? 'animate-bounce' : ''}`} />
                  <span>{isLocalPulling ? 'Carregando dados...' : '📥 Carregar da Planilha'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-bold text-slate-700 text-xs">
                  Sincronizar automaticamente ao abrir o app
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nome Padrão do Organizador
            </label>
            <input
              type="text"
              placeholder="Ex: Allyson Leandro"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipo PIX</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900"
              >
                <option value="email">E-mail</option>
                <option value="cpf">CPF</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Aleatória</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Chave PIX Padrão</label>
              <input
                type="text"
                placeholder="sua-chave-pix@email.com"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Taxa Padrão do Organizador (%)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={adminFeePercent}
              onChange={(e) => setAdminFeePercent(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:bg-white transition"
            />
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">
              Pode ser ajustada individualmente em cada bolão.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-2xl shadow-md shadow-emerald-200 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              {isSaved ? <Check className="w-4 h-4" /> : null}
              <span>{isSaved ? 'Salvo!' : 'Salvar Preferências'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

