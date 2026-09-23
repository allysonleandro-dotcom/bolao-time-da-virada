import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  Download,
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  ShieldCheck,
  Check,
  AlertCircle,
  ExternalLink,
  Users,
  Calendar,
  CalendarRange,
  X,
} from 'lucide-react';
import { Bolao, Participant, PixTransactionRecord, PixSummaryData } from '../types';
import {
  parseCurrencyValue,
  parseDateFromString,
  parseRegistroPixTab,
  parseHistoricoPixTab,
  parsePixPessoalTab,
} from '../utils/pixParser';
import {
  fetchPixDataFromSheets,
  triggerAddPixRecordInSheets,
  DEFAULT_SHEET_URL,
} from '../services/googleSheetsSync';
import { formatCurrency } from '../utils/calculator';

interface RegistroPixViewProps {
  boloes: Bolao[];
  participants: Participant[];
  spreadsheetUrl?: string;
  onUpdateBolao?: (updatedBolao: Bolao) => void;
}

export const RegistroPixView: React.FC<RegistroPixViewProps> = ({
  boloes,
  participants,
  spreadsheetUrl = DEFAULT_SHEET_URL,
  onUpdateBolao,
}) => {
  // Estado das abas
  const [activeTab, setActiveTab] = useState<'registro_pix' | 'historico_pix' | 'pix_pessoal'>(
    'registro_pix'
  );

  // Estados de dados
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dados brutos vindos da planilha
  const [rawRegistroRows, setRawRegistroRows] = useState<string[][]>([]);
  const [rawHistoricoRows, setRawHistoricoRows] = useState<string[][]>([]);
  const [rawPessoalRows, setRawPessoalRows] = useState<string[][]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [selectedBolaoFilter, setSelectedBolaoFilter] = useState<string>('all');

  // Busca por período
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickPeriod, setQuickPeriod] = useState<
    'all' | 'today' | '7days' | '30days' | 'this_month' | 'this_year' | 'custom'
  >('all');

  const handleSelectQuickPeriod = (
    period: 'all' | 'today' | '7days' | '30days' | 'this_month' | 'this_year'
  ) => {
    setQuickPeriod(period);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (period === 'today') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (period === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (period === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (period === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    } else if (period === 'this_year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    }
  };

  const clearPeriodFilter = () => {
    setStartDate('');
    setEndDate('');
    setQuickPeriod('all');
  };

  // Modal de novo registro
  const [isNewRecordModalOpen, setIsNewRecordModalOpen] = useState<boolean>(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState<boolean>(false);
  const [recordSuccessToast, setRecordSuccessToast] = useState<string | null>(null);

  // Form de novo registro
  const [newRecordForm, setNewRecordForm] = useState({
    nome: '',
    valor: '',
    dataHora: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    statusPagamento: 'TRUE',
    statusEnvio: 'TRUE',
    numeroCota: '',
    bolao: 'Bolão 1 - Mega da Virada',
    targetTab: 'REGISTRO_PIX' as 'REGISTRO_PIX' | 'HISTORICO_PIX' | 'PIX_PESSOAL',
    observacao: '',
  });

  // Função para carregar dados
  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetchPixDataFromSheets(spreadsheetUrl);
      if (res.success) {
        setRawRegistroRows(res.registroPix || []);
        setRawHistoricoRows(res.historicoPix || []);
        setRawPessoalRows(res.pixPessoal || []);
        setLastUpdated(new Date());
      } else {
        setErrorMessage(res.error || 'Não foi possível carregar os registros de PIX da planilha.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao consultar a planilha Google Sheets.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetUrl]);

  // Parsing memorizado dos dados da aba REGISTRO_PIX
  const parsedRegistroPix = useMemo(() => {
    return parseRegistroPixTab(rawRegistroRows);
  }, [rawRegistroRows]);

  // Parsing memorizado dos dados de HISTÓRICO PIX
  const parsedHistoricoPix = useMemo(() => {
    return parseHistoricoPixTab(rawHistoricoRows);
  }, [rawHistoricoRows]);

  // Parsing memorizado dos dados de PIX PESSOAL
  const parsedPixPessoal = useMemo(() => {
    return parsePixPessoalTab(rawPessoalRows);
  }, [rawPessoalRows]);

  // Registros atuais baseado na aba ativa
  const currentRecords = useMemo(() => {
    if (activeTab === 'registro_pix') return parsedRegistroPix.records;
    if (activeTab === 'historico_pix') return parsedHistoricoPix;
    return parsedPixPessoal;
  }, [activeTab, parsedRegistroPix, parsedHistoricoPix, parsedPixPessoal]);

  // Lista de bolões únicos presentes nos registros para filtro
  const availableBoloes = useMemo(() => {
    const set = new Set<string>();
    currentRecords.forEach((r) => {
      if (r.bolao && r.bolao.trim()) set.add(r.bolao.trim());
    });
    return Array.from(set);
  }, [currentRecords]);

  // Filtragem dos registros
  const filteredRecords = useMemo(() => {
    return currentRecords.filter((rec) => {
      // Busca por termo
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        rec.nome.toLowerCase().includes(term) ||
        (rec.dataHora && rec.dataHora.toLowerCase().includes(term)) ||
        (rec.bolao && rec.bolao.toLowerCase().includes(term)) ||
        (rec.observacao && rec.observacao.toLowerCase().includes(term));

      if (!matchSearch) return false;

      // Filtro por status
      if (statusFilter === 'paid' && !rec.statusPagamento) return false;
      if (statusFilter === 'pending' && rec.statusPagamento) return false;

      // Filtro por bolão
      if (selectedBolaoFilter !== 'all' && rec.bolao !== selectedBolaoFilter) return false;

      // Filtro por período (Data Inicial e Data Final)
      if (startDate || endDate) {
        const recDate = parseDateFromString(rec.dataHora);
        if (recDate) {
          if (startDate) {
            const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
            const startLimit = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
            if (recDate < startLimit) return false;
          }
          if (endDate) {
            const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
            const endLimit = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
            if (recDate > endLimit) return false;
          }
        } else {
          // Registro sem data válida não entra no intervalo de período
          return false;
        }
      }

      return true;
    });
  }, [currentRecords, searchTerm, statusFilter, selectedBolaoFilter, startDate, endDate]);

  // Métricas calculadas para a aba atual
  const stats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const totalValue = filteredRecords.reduce((sum, r) => sum + r.valor, 0);
    const paidRecords = filteredRecords.filter((r) => r.statusPagamento).length;
    const paidValue = filteredRecords
      .filter((r) => r.statusPagamento)
      .reduce((sum, r) => sum + r.valor, 0);
    const pendingCount = totalRecords - paidRecords;

    return {
      totalRecords,
      totalValue,
      paidRecords,
      paidValue,
      pendingCount,
      summary: parsedRegistroPix.summary,
    };
  }, [filteredRecords, parsedRegistroPix.summary]);

  // Submissão do novo registro PIX
  const handleCreatePixRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordForm.nome.trim()) return;

    setIsSubmittingRecord(true);
    try {
      const valNum = parseCurrencyValue(newRecordForm.valor);
      const res = await triggerAddPixRecordInSheets(
        {
          dataHora: newRecordForm.dataHora,
          nome: newRecordForm.nome.trim(),
          valor: valNum,
          statusPagamento: newRecordForm.statusPagamento,
          statusEnvio: newRecordForm.statusEnvio,
          numeroCota: newRecordForm.numeroCota,
          bolao: newRecordForm.bolao,
          targetTab: newRecordForm.targetTab,
          observacao: newRecordForm.observacao,
        },
        spreadsheetUrl
      );

      if (res.success) {
        setRecordSuccessToast('Registro PIX adicionado e gravado com sucesso na planilha!');
        setIsNewRecordModalOpen(false);
        // Reseta form
        setNewRecordForm({
          nome: '',
          valor: '',
          dataHora: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          statusPagamento: 'TRUE',
          statusEnvio: 'TRUE',
          numeroCota: '',
          bolao: 'Bolão 1 - Mega da Virada',
          targetTab: 'REGISTRO_PIX',
          observacao: '',
        });
        // Recarrega dados em tempo real da planilha
        await loadData(false);
      } else {
        alert(res.message || 'Erro ao gravar registro na planilha.');
      }
    } catch (err: any) {
      alert(`Falha ao registrar PIX: ${err?.message || err}`);
    } finally {
      setIsSubmittingRecord(false);
      setTimeout(() => setRecordSuccessToast(null), 5000);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast de Sucesso */}
      {recordSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-400 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold">{recordSuccessToast}</span>
        </div>
      )}

      {/* Header & Identidade da Aba */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-200/50 flex-shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Leitura de PIX & Financeiro
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-200">
                Sincronizado com Google Sheets
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Visualização, auditoria e conciliação em tempo real das abas de PIX da planilha oficial.
            </p>
          </div>
        </div>

        {/* Botões de Ação Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="pix-refresh-btn"
            onClick={() => loadData(false)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Recarregar dados da planilha Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}</span>
          </button>

          <button
            id="pix-add-btn"
            onClick={() => {
              setNewRecordForm((prev) => ({
                ...prev,
                targetTab:
                  activeTab === 'historico_pix'
                    ? 'HISTORICO_PIX'
                    : activeTab === 'pix_pessoal'
                    ? 'PIX_PESSOAL'
                    : 'REGISTRO_PIX',
              }));
              setIsNewRecordModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro PIX</span>
          </button>
        </div>
      </div>

      {/* Sub-navegação das Abas da Planilha */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 rounded-2xl shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-2 py-2">
          <button
            id="tab-btn-registro-pix"
            onClick={() => setActiveTab('registro_pix')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'registro_pix'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Aba REGISTRO_PIX (Nubank / Bolões)</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'registro_pix' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {parsedRegistroPix.records.length}
            </span>
          </button>

          <button
            id="tab-btn-historico-pix"
            onClick={() => setActiveTab('historico_pix')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'historico_pix'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Aba HISTÓRICO DE TRANSAÇÕES PIX</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'historico_pix' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {parsedHistoricoPix.length}
            </span>
          </button>

          <button
            id="tab-btn-pix-pessoal"
            onClick={() => setActiveTab('pix_pessoal')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'pix_pessoal'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Aba PIX_PESSOAL</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'pix_pessoal' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {parsedPixPessoal.length}
            </span>
          </button>
        </div>

        {lastUpdated && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 pr-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Última leitura: {lastUpdated.toLocaleTimeString('pt-BR')}</span>
          </div>
        )}
      </div>

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <strong>Aviso de Conexão:</strong> {errorMessage}
          </div>
          <button
            onClick={() => loadData(true)}
            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-500 cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Cards de Métricas Principais (Bento Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Financeiro na Aba */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total de Pagamentos</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {formatCurrency(stats.totalValue)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>{stats.totalRecords} transferências registradas</span>
            </div>
          </div>
        </div>

        {/* Card 2: Caixa na Planilha */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Caixa Registrado (Planilha)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-900">
              {formatCurrency(stats.summary.caixa || 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats.summary.cotasDisponiveis !== undefined
                ? `${stats.summary.cotasDisponiveis} cotas disponíveis⚠️`
                : 'Saldo em conta / caixa do bolão'}
            </div>
          </div>
        </div>

        {/* Card 3: Confirmados vs Pendentes */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Status dos PIX</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{stats.paidRecords}</span>
              <span className="text-xs font-bold text-slate-400">confirmados</span>
              {stats.pendingCount > 0 && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="text-sm font-bold text-amber-600">{stats.pendingCount} pendentes</span>
                </>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {((stats.paidRecords / (stats.totalRecords || 1)) * 100).toFixed(0)}% de taxa de confirmação
            </div>
          </div>
        </div>

        {/* Card 4: Cotas & Bolão */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Preço por Cota / Dados</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-900">
              {stats.summary.valorPorCota ? formatCurrency(stats.summary.valorPorCota) : 'R$ 57,12'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats.summary.totalCotas ? `Total de ${stats.summary.totalCotas} cotas no bolão` : 'Mega da Virada (Preset oficial)'}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Busca e Busca por Período */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Linha 1: Busca textual e Status / Bolão */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              id="pix-search-input"
              type="text"
              placeholder="Buscar por participante, bolão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
            {/* Filtro Status */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                id="filter-status-all"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Todos ({currentRecords.length})
              </button>
              <button
                id="filter-status-paid"
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusFilter === 'paid' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-600'
                }`}
              >
                Pagos ({stats.paidRecords})
              </button>
              <button
                id="filter-status-pending"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs font-black' : 'text-slate-600'
                }`}
              >
                Pendentes ({stats.pendingCount})
              </button>
            </div>

            {/* Filtro Bolão */}
            {availableBoloes.length > 1 && (
              <select
                id="pix-bolao-filter"
                value={selectedBolaoFilter}
                onChange={(e) => setSelectedBolaoFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todos os Bolões</option>
                {availableBoloes.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Linha 2: Busca por Período */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-slate-700 flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Busca por Período:
            </span>

            {/* Atalhos rápidos de período */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                id="btn-period-all"
                onClick={() => handleSelectQuickPeriod('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                  quickPeriod === 'all' && !startDate && !endDate
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                id="btn-period-today"
                onClick={() => handleSelectQuickPeriod('today')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                  quickPeriod === 'today'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hoje
              </button>
              <button
                id="btn-period-7d"
                onClick={() => handleSelectQuickPeriod('7days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                  quickPeriod === '7days'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Últimos 7 dias
              </button>
              <button
                id="btn-period-30d"
                onClick={() => handleSelectQuickPeriod('30days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                  quickPeriod === '30days'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Últimos 30 dias
              </button>
              <button
                id="btn-period-month"
                onClick={() => handleSelectQuickPeriod('this_month')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                  quickPeriod === 'this_month'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Este Mês
              </button>
              <button
                id="btn-period-year"
                onClick={() => handleSelectQuickPeriod('this_year')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                  quickPeriod === 'this_year'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ano 2026
              </button>
            </div>
          </div>

          {/* Seletores de Data Inicial e Data Final */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500">De:</span>
              <input
                id="pix-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickPeriod('custom');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500">Até:</span>
              <input
                id="pix-end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickPeriod('custom');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {(startDate || endDate) && (
              <button
                id="btn-clear-period"
                onClick={clearPeriodFilter}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold transition cursor-pointer text-xs"
                title="Limpar filtro de período"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar Período</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mb-3"></div>
            <p className="text-sm font-bold text-slate-700">Lendo registros de PIX da planilha...</p>
            <p className="text-xs text-slate-400 mt-1">Conectando ao Google Sheets em tempo real</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum registro encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchTerm || statusFilter !== 'all' || selectedBolaoFilter !== 'all' || startDate || endDate
                ? 'Tente ajustar os filtros, período ou termos da pesquisa.'
                : 'A aba selecionada na planilha ainda não possui dados de PIX cadastrados.'}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSelectedBolaoFilter('all');
                clearPeriodFilter();
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Limpar Filtros e Período
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Participante</th>
                  <th className="py-3 px-4">Valor (R$)</th>
                  <th className="py-3 px-4 text-center">Status Pagamento</th>
                  {activeTab === 'registro_pix' && (
                    <>
                      <th className="py-3 px-4 text-center">Envio Nubank</th>
                      <th className="py-3 px-4">Bolão</th>
                    </>
                  )}
                  {activeTab === 'pix_pessoal' && <th className="py-3 px-4">Observação</th>}
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRecords.map((record) => {
                  const isMatchingBolaoParticipant = participants.some(
                    (p) => p.name.trim().toLowerCase() === record.nome.trim().toLowerCase()
                  );

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition">
                      {/* Data / Hora */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{record.dataHora}</span>
                        </div>
                      </td>

                      {/* Nome do Participante */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{record.nome}</span>
                          {isMatchingBolaoParticipant && (
                            <span
                              className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-black border border-emerald-200"
                              title="Participante cadastrado no sistema"
                            >
                              Cadastrado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 font-black text-slate-900 whitespace-nowrap">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                          {formatCurrency(record.valor)}
                        </span>
                      </td>

                      {/* Status de Pagamento */}
                      <td className="py-3 px-4 text-center">
                        {record.statusPagamento ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            Pago
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Colunas específicas de REGISTRO_PIX */}
                      {activeTab === 'registro_pix' && (
                        <>
                          {/* Envio Nubank */}
                          <td className="py-3 px-4 text-center">
                            {record.statusEnvio ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <Check className="w-2.5 h-2.5" />
                                Enviado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                Não enviado
                              </span>
                            )}
                          </td>

                          {/* Bolão */}
                          <td className="py-3 px-4 text-slate-700 font-bold whitespace-nowrap">
                            {record.bolao ? (
                              <span className="bg-slate-100 px-2 py-1 rounded-lg text-slate-700">
                                {record.bolao}
                              </span>
                            ) : (
                              <span className="text-slate-400">Geral</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Observação para PIX PESSOAL */}
                      {activeTab === 'pix_pessoal' && (
                        <td className="py-3 px-4 text-slate-700 font-bold">
                          {record.observacao ? (
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                              {record.observacao}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Ação */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            // Copia comprovante formatado
                            const info = `*COMPROVANTE DE PAGAMENTO PIX*\nParticipante: ${record.nome}\nValor: ${formatCurrency(record.valor)}\nData: ${record.dataHora}\nStatus: ${record.statusPagamento ? 'CONFIRMADO' : 'PENDENTE'}${record.numeroCota ? `\nCota: #${record.numeroCota}` : ''}`;
                            navigator.clipboard.writeText(info);
                            alert(`Dados de ${record.nome} copiados para a área de transferência!`);
                          }}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                          title="Copiar dados da transferência"
                        >
                          Copiar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da tabela com totais da visualização */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <span>
            Exibindo <strong>{filteredRecords.length}</strong> de <strong>{currentRecords.length}</strong> transferências registradas na aba <strong>{activeTab.toUpperCase()}</strong>.
          </span>
          <div className="flex items-center gap-4 font-bold">
            <span>
              Total Filtrado:{' '}
              <strong className="text-emerald-700">
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + r.valor, 0))}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Novo Registro PIX */}
      {isNewRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Novo Registro PIX</h3>
                  <p className="text-xs text-slate-500">
                    Gravar transferência diretamente na planilha Google Sheets
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl transition cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePixRecord} className="space-y-4">
              {/* Aba de destino */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Aba de Destino na Planilha
                </label>
                <select
                  value={newRecordForm.targetTab}
                  onChange={(e) =>
                    setNewRecordForm({ ...newRecordForm, targetTab: e.target.value as any })
                  }
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="REGISTRO_PIX">Aba REGISTRO_PIX (Bolões & Nubank)</option>
                  <option value="HISTORICO_PIX">Aba HISTÓRICO DE TRANSAÇÕES PIX</option>
                  <option value="PIX_PESSOAL">Aba PIX_PESSOAL</option>
                </select>
              </div>

              {/* Nome do Participante com sugestões */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Participante *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Allyson Leandro"
                  value={newRecordForm.nome}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, nome: e.target.value })}
                  list="participants-datalist"
                  className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <datalist id="participants-datalist">
                  {participants.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 57,12"
                    value={newRecordForm.valor}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, valor: e.target.value })}
                    className="w-full text-xs font-bold text-emerald-800 rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setNewRecordForm({ ...newRecordForm, valor: '57,12' })}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-700 cursor-pointer"
                    >
                      57,12 (Mega)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRecordForm({ ...newRecordForm, valor: '35,70' })}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-700 cursor-pointer"
                    >
                      35,70
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRecordForm({ ...newRecordForm, valor: '99,00' })}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-700 cursor-pointer"
                    >
                      99,00
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Data / Hora
                  </label>
                  <input
                    type="text"
                    value={newRecordForm.dataHora}
                    onChange={(e) => setNewRecordForm({ ...newRecordForm, dataHora: e.target.value })}
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bolão se for REGISTRO_PIX */}
              {newRecordForm.targetTab === 'REGISTRO_PIX' && (
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Bolão
                  </label>
                  <select
                    value={newRecordForm.bolao}
                    onChange={(e) =>
                      setNewRecordForm({ ...newRecordForm, bolao: e.target.value })
                    }
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Bolão 1 - Mega da Virada">Bolão 1 - Mega da Virada</option>
                    <option value="Bolão 2 - Mega da Virada">Bolão 2 - Mega da Virada</option>
                    <option value="Bolão Regular Lotofácil">Bolão Regular Lotofácil</option>
                    {boloes.map((b) => (
                      <option key={b.id} value={b.title}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Observação para PIX PESSOAL */}
              {newRecordForm.targetTab === 'PIX_PESSOAL' && (
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Observação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Empréstimo, Venda, Mensalidade..."
                    value={newRecordForm.observacao}
                    onChange={(e) =>
                      setNewRecordForm({ ...newRecordForm, observacao: e.target.value })
                    }
                    className="w-full text-xs font-medium rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewRecordModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecord}
                  className="px-5 py-2.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingRecord ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Gravando na Planilha...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Gravar no Google Sheets</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
