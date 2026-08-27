import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Layers,
  Clock,
  Ticket,
  Users,
  Share2,
  Trophy,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Bolao, BolaoStatus, LotteryType } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { calculateBolaoFinancials, formatCurrency, formatDateBR, formatBolaoBetSummary } from '../utils/calculator';

interface BoloesViewProps {
  boloes: Bolao[];
  onSelectBolao: (bolaoId: string) => void;
  onOpenNewBolao: () => void;
  onEditBolao: (bolao: Bolao) => void;
  onDeleteBolao: (bolaoId: string) => void;
  onOpenWhatsAppShare: (bolao: Bolao, type: 'convite' | 'jogos' | 'resultado') => void;
}

export const BoloesView: React.FC<BoloesViewProps> = ({
  boloes,
  onSelectBolao,
  onOpenNewBolao,
  onEditBolao,
  onDeleteBolao,
  onOpenWhatsAppShare,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lotteryFilter, setLotteryFilter] = useState<string>('all');

  const filteredBoloes = boloes.filter((bolao) => {
    const matchesSearch =
      bolao.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bolao.contestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bolao.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || bolao.status === statusFilter;
    const matchesLottery = lotteryFilter === 'all' || bolao.lotteryType === lotteryFilter;

    return matchesSearch && matchesStatus && matchesLottery;
  });

  const getStatusBadge = (status: BolaoStatus) => {
    switch (status) {
      case 'arrecadando':
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 text-[11px] px-3 py-1 rounded-full font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Arrecadando
          </span>
        );
      case 'jogos_registrados':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 border border-blue-200 text-[11px] px-3 py-1 rounded-full font-bold">
            <Ticket className="w-3 h-3" />
            Jogos Registrados
          </span>
        );
      case 'aguardando_sorteio':
        return (
          <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] px-3 py-1 rounded-full font-bold">
            <Clock className="w-3 h-3" />
            Aguardando Sorteio
          </span>
        );
      case 'premiado':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] px-3 py-1 rounded-full font-black">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            PREMIADO!
          </span>
        );
      case 'conferido':
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-3 py-1 rounded-full font-bold">
            <CheckCircle2 className="w-3 h-3 text-slate-500" />
            Conferido
          </span>
        );
      case 'finalizado':
        return (
          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 border border-gray-200 text-[11px] px-3 py-1 rounded-full font-bold">
            Finalizado
          </span>
        );
      case 'rascunho':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 text-[11px] px-3 py-1 rounded-full font-bold">
            Rascunho
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Search / Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-7 h-7 text-emerald-600" />
            <span>Gerenciamento de <span className="text-emerald-600 underline decoration-4 underline-offset-4">Bolões</span></span>
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
            Organize participantes, registre bilhetes oficiais, acompanhe sorteios e faça o rateio transparente.
          </p>
        </div>

        <button
          id="boloes-btn-new-bolao"
          onClick={onOpenNewBolao}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl shadow-md shadow-emerald-200 flex items-center space-x-2 transition active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Bolão</span>
        </button>
      </div>

      {/* Filter and Search Bento Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            id="boloes-search-input"
            type="text"
            placeholder="Buscar por título, concurso ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            id="boloes-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os Status</option>
            <option value="arrecadando">Arrecadando</option>
            <option value="jogos_registrados">Jogos Registrados</option>
            <option value="aguardando_sorteio">Aguardando Sorteio</option>
            <option value="premiado">Premiados 🏆</option>
            <option value="conferido">Conferidos</option>
            <option value="finalizado">Finalizados</option>
          </select>

          {/* Lottery Type Filter */}
          <select
            id="boloes-lottery-filter"
            value={lotteryFilter}
            onChange={(e) => setLotteryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todas as Loterias</option>
            <option value="mega-sena">Mega-Sena</option>
            <option value="lotofacil">Lotofácil</option>
            <option value="quina">Quina</option>
            <option value="lotomania">Lotomania</option>
            <option value="dupla-sena">Dupla Sena</option>
            <option value="milionaria">+Milionária</option>
          </select>
        </div>
      </div>

      {/* Bolões Bento Grid */}
      {filteredBoloes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhum bolão encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Não encontramos nenhum bolão correspondente aos filtros selecionados. Tente limpar os filtros ou crie um novo bolão.
          </p>
          <button
            onClick={onOpenNewBolao}
            className="mt-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2 shadow-md shadow-emerald-200"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Bolão</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBoloes.map((bolao) => {
            const config = LOTTERY_CONFIGS[bolao.lotteryType] || LOTTERY_CONFIGS['mega-sena'];
            const fin = calculateBolaoFinancials(bolao);
            const percentSold = Math.min(100, Math.round((fin.totalQuotasSold / (bolao.totalQuotas || 1)) * 100));
            const percentPaid = Math.min(100, Math.round((fin.totalQuotasPaid / (bolao.totalQuotas || 1)) * 100));

            return (
              <div
                key={bolao.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Top Color Line */}
                  <div className="h-2.5 w-full" style={{ backgroundColor: config.color }}></div>

                  {/* Header content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-3 py-1 rounded-full border ${config.bgLight}`}
                        >
                          {config.name} {bolao.contestNumber ? `• Nº ${bolao.contestNumber}` : ''}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {bolao.dezenas || config.standardBetCount}D
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {bolao.id.includes('regular') || bolao.title.toUpperCase().includes('REGULAR')
                            ? 'Aba BOLÕES_REGULARES'
                            : 'Aba Independência'}
                        </span>
                      </div>
                      {getStatusBadge(bolao.status)}
                    </div>

                    <h3
                      onClick={() => onSelectBolao(bolao.id)}
                      className="font-black text-slate-900 text-lg mt-3 cursor-pointer hover:text-emerald-600 transition line-clamp-1 tracking-tight"
                    >
                      {bolao.title}
                    </h3>

                    {/* Date and Organizer */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Sorteio: <strong>{formatDateBR(bolao.drawDate)}</strong>
                      </span>
                    </div>

                    {/* Prize Highlight if won */}
                    {bolao.totalPrizeWon && bolao.totalPrizeWon > 0 && (
                      <div className="mt-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-200" />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-90">
                              Prêmio Conquistado
                            </span>
                            <span className="text-base font-black">
                              {formatCurrency(bolao.totalPrizeWon)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] block opacity-90 font-medium">Por cota</span>
                          <span className="text-xs font-black text-yellow-100">
                            {formatCurrency(bolao.netPrizePerQuota)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Financial Matrix Bento Box */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Valor da Cota
                        </span>
                        <span className="font-black text-slate-900 text-base">
                          {formatCurrency(bolao.quotaPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Valor Total do Bolão
                        </span>
                        <span className="font-black text-slate-900 text-base">
                          {formatCurrency(fin.totalTicketsCost)}
                        </span>
                      </div>
                    </div>

                    {/* Quota Progress */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700">
                          Cotas: <strong>{fin.totalQuotasSold}</strong> de {bolao.totalQuotas} vendidas
                        </span>
                        <span className="text-emerald-700 font-bold">{percentPaid}% pagas</span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${percentPaid}%` }}
                          title={`Cotas pagas: ${fin.totalQuotasPaid}`}
                        ></div>
                        <div
                          className="bg-amber-400 h-full transition-all"
                          style={{ width: `${percentSold - percentPaid}%` }}
                          title={`Cotas pendentes: ${fin.totalQuotasPending}`}
                        ></div>
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500 font-medium pt-0.5">
                        <span>Arrecadado: {formatCurrency(fin.totalCollected)}</span>
                        {fin.totalPending > 0 && (
                          <span className="text-amber-600 font-bold">
                            A receber: {formatCurrency(fin.totalPending)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Summary row */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5 text-slate-400" />
                        {formatBolaoBetSummary(bolao)} ({fin.totalCombinations} comb.)
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {bolao.participants.length} participantes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`bolao-share-btn-${bolao.id}`}
                      onClick={() => onOpenWhatsAppShare(bolao, 'convite')}
                      className="px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1 transition border border-emerald-200/50"
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                    <button
                      id={`bolao-edit-btn-${bolao.id}`}
                      onClick={() => onEditBolao(bolao)}
                      className="p-2 text-slate-600 hover:bg-slate-200/70 rounded-xl text-xs transition"
                      title="Editar informações do bolão"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`bolao-delete-btn-${bolao.id}`}
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir o bolão "${bolao.title}"?`)) {
                          onDeleteBolao(bolao.id);
                        }
                      }}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs transition"
                      title="Excluir bolão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    id={`bolao-open-detail-${bolao.id}`}
                    onClick={() => onSelectBolao(bolao.id)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-2xs flex items-center gap-1.5"
                  >
                    <span>Abrir Bolão</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
