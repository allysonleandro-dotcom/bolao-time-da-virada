import React from 'react';
import {
  Trophy,
  Users,
  Calculator,
  Plus,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Target,
  History,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Bolao, Participant } from '../types';
import { formatCurrency } from '../utils/calculator';

export type AppTab =
  | 'dashboard'
  | 'boloes'
  | 'verificador'
  | 'historico'
  | 'financeiro'
  | 'participantes'
  | 'calculadora';

interface HeaderProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  boloes: Bolao[];
  participants: Participant[];
  onOpenNewBolao: () => void;
  onOpenImportExport: () => void;
  onOpenSettings: () => void;
  onSyncGoogleSheets?: () => void;
  isSyncing?: boolean;
  lastSyncedAt?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  boloes,
  participants,
  onOpenNewBolao,
  onOpenImportExport,
  onOpenSettings,
  onSyncGoogleSheets,
  isSyncing = false,
  lastSyncedAt,
}) => {
  // Quick metrics
  const activeBoloes = boloes.filter(
    (b) => b.status === 'arrecadando' || b.status === 'jogos_registrados' || b.status === 'aguardando_sorteio'
  ).length;

  const totalPrizeWon = boloes.reduce((sum, b) => sum + (b.totalPrizeWon || 0), 0);

  return (
    <header className="bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
          {/* Logo and Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setCurrentTab('dashboard')}
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200/60 font-black text-xl group-hover:scale-105 transition-transform">
              🍀
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  BOLÃO <span className="text-emerald-600 underline decoration-4 underline-offset-4">TIME DA VIRADA</span>
                </h1>
                <span className="text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  PRO
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Gestão Inteligente de Bolões & Loterias
              </p>
            </div>
          </div>

          {/* Quick Stats Bento Badge & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Status Pill */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center gap-2 shadow-2xs">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {activeBoloes} {activeBoloes === 1 ? 'Bolão Ativo' : 'Bolões Ativos'}
              </span>
            </div>

            {totalPrizeWon > 0 && (
              <div className="hidden md:flex bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 items-center gap-2 shadow-2xs">
                <Trophy className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-amber-900">
                  {formatCurrency(totalPrizeWon)}
                </span>
              </div>
            )}

            {onSyncGoogleSheets && (
              <button
                id="header-sync-sheets-btn"
                onClick={onSyncGoogleSheets}
                disabled={isSyncing}
                title={lastSyncedAt ? `Última sincronização: ${new Date(lastSyncedAt).toLocaleTimeString('pt-BR')}` : 'Sincronizar com Google Sheets'}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl px-3.5 py-2 text-xs font-black shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar Planilha'}</span>
              </button>
            )}

            <button
              id="header-import-export-btn"
              onClick={onOpenImportExport}
              title="Importar / Exportar Planilha"
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Planilhas</span>
            </button>

            <button
              id="header-settings-btn"
              onClick={onOpenSettings}
              title="Configurações e Chave Pix"
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl p-2 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              id="header-new-bolao-btn"
              onClick={onOpenNewBolao}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2 font-black text-xs sm:text-sm shadow-md shadow-emerald-200 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Bolão</span>
            </button>
          </div>
        </div>

        {/* Bento Navigation Bar */}
        <div className="pb-3 pt-1">
          <nav className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60 overflow-x-auto no-scrollbar max-w-fit">
            <button
              id="nav-tab-dashboard"
              onClick={() => setCurrentTab('dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Visão Geral</span>
            </button>

            <button
              id="nav-tab-verificador"
              onClick={() => setCurrentTab('verificador')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'verificador'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Target className="w-4 h-4 text-emerald-600" />
              <span>Conferência & Verificador</span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase">
                Ao Vivo
              </span>
            </button>

            <button
              id="nav-tab-boloes"
              onClick={() => setCurrentTab('boloes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'boloes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Bolões Ativos</span>
              <span className="bg-slate-200/80 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                {activeBoloes}
              </span>
            </button>

            <button
              id="nav-tab-historico"
              onClick={() => setCurrentTab('historico')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'historico'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <History className="w-4 h-4 text-emerald-600" />
              <span>Histórico de Bolões</span>
              <span className="bg-slate-200/80 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                {boloes.length}
              </span>
            </button>

            <button
              id="nav-tab-financeiro"
              onClick={() => setCurrentTab('financeiro')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'financeiro'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Gastos & Médias</span>
            </button>

            <button
              id="nav-tab-participantes"
              onClick={() => setCurrentTab('participantes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'participantes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Participantes</span>
              <span className="bg-slate-200/80 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                {participants.length}
              </span>
            </button>

            <button
              id="nav-tab-calculadora"
              onClick={() => setCurrentTab('calculadora')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                currentTab === 'calculadora'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Calculadora & Fechamentos</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

