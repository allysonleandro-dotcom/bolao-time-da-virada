import React, { useState } from 'react';
import {
  FileDown,
  Layers,
  Trophy,
  Search,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Ticket,
} from 'lucide-react';
import { Bolao, Participant } from '../types';
import { formatCurrency, formatBolaoBetSummary } from '../utils/calculator';
import { exportBoloesHistoryPDF, formatDateBR } from '../utils/pdfGenerator';

interface HistoricoBoloesProps {
  boloes: Bolao[];
  onSelectBolao: (id: string) => void;
  onOpenNewBolao: () => void;
}

export const HistoricoBoloesView: React.FC<HistoricoBoloesProps> = ({
  boloes,
  onSelectBolao,
  onOpenNewBolao,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [lotteryFilter, setLotteryFilter] = useState<string>('todos');

  // Metrics
  const totalArrecadado = boloes.reduce(
    (acc, b) => acc + b.participants.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
    0
  );
  const totalPremios = boloes.reduce((acc, b) => acc + (b.totalPrizeWon || 0), 0);
  const totalCotas = boloes.reduce((acc, b) => acc + b.totalQuotas, 0);
  const totalJogos = boloes.reduce((acc, b) => acc + (b.tickets?.length || 0), 0);

  // Filtered bolões
  const filteredBoloes = boloes.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.contestNumber.includes(searchTerm) ||
      (b.notes && b.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'todos' || b.status === statusFilter;
    const matchesLottery = lotteryFilter === 'todos' || b.lotteryType === lotteryFilter;

    return matchesSearch && matchesStatus && matchesLottery;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'premiado':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-black">
            <Trophy className="w-3 h-3 text-amber-600" />
            PREMIADO
          </span>
        );
      case 'conferido':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Conferido
          </span>
        );
      case 'aguardando_sorteio':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 border border-blue-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <Clock className="w-3 h-3 text-blue-600" />
            Aguardando Sorteio
          </span>
        );
      case 'jogos_registrados':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <Ticket className="w-3 h-3 text-purple-600" />
            Jogos Registrados
          </span>
        );
      case 'arrecadando':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            Arrecadando
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Arquivo & Livro de Registro</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Histórico de Registro de Bolões
            </h2>
            <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
              Consulte todo o histórico de bolões criados, valores totais arrecadados, prêmios
              conquistados, conferências realizadas e baixe o relatório consolidado em PDF.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportBoloesHistoryPDF(boloes)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-md shadow-emerald-200 transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Baixar Histórico (PDF)</span>
            </button>
          </div>
        </div>

        {/* Bento Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total de Bolões
            </span>
            <span className="text-2xl font-black text-slate-900">{boloes.length}</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Arrecadado
            </span>
            <span className="text-2xl font-black text-emerald-600">
              {formatCurrency(totalArrecadado)}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Prêmios Acumulados
            </span>
            <span className="text-2xl font-black text-amber-600">
              {formatCurrency(totalPremios)}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Cotas & Apostas
            </span>
            <span className="text-2xl font-black text-slate-800">
              {totalCotas} cotas <span className="text-xs text-slate-400 font-normal">({totalJogos} jogos)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por bolão, concurso ou nota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="arrecadando">Arrecadando</option>
            <option value="jogos_registrados">Jogos Registrados</option>
            <option value="aguardando_sorteio">Aguardando Sorteio</option>
            <option value="conferido">Conferido</option>
            <option value="premiado">Premiado</option>
          </select>

          <select
            value={lotteryFilter}
            onChange={(e) => setLotteryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="todos">Todas Loterias</option>
            <option value="lotofacil">Lotofácil</option>
            <option value="mega-sena">Mega-Sena</option>
            <option value="quina">Quina</option>
          </select>
        </div>
      </div>

      {/* Bolões Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Bolão & Concurso</th>
                <th className="py-3.5 px-4">Loteria</th>
                <th className="py-3.5 px-4 text-center">Data Sorteio</th>
                <th className="py-3.5 px-4 text-center">Cotas</th>
                <th className="py-3.5 px-4 text-right">Valor Cota</th>
                <th className="py-3.5 px-4 text-right">Arrecadado</th>
                <th className="py-3.5 px-4 text-right">Prêmio</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredBoloes.map((b) => {
                const arrecadado = b.participants.reduce(
                  (sum, p) => sum + (p.amountPaid || 0),
                  0
                );
                const cotasPagas = b.participants
                  .filter((p) => p.status === 'pago')
                  .reduce((s, p) => s + p.quotas, 0);

                return (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/60 transition cursor-pointer"
                    onClick={() => onSelectBolao(b.id)}
                  >
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-bold text-slate-900 line-clamp-1">{b.title}</div>
                      <div className="text-[11px] text-slate-400">
                        Conc. {b.contestNumber || 'N/A'} • {formatBolaoBetSummary(b)}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-700 uppercase">
                      {b.lotteryType}
                    </td>

                    <td className="py-4 px-4 text-center font-bold text-slate-600">
                      {formatDateBR(b.drawDate)}
                    </td>

                    <td className="py-4 px-4 text-center font-bold text-slate-700">
                      {cotasPagas}/{b.totalQuotas}
                    </td>

                    <td className="py-4 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(b.quotaPrice)}
                    </td>

                    <td className="py-4 px-4 text-right font-black text-emerald-600">
                      {formatCurrency(arrecadado)}
                    </td>

                    <td className="py-4 px-4 text-right font-black text-amber-600">
                      {b.totalPrizeWon ? formatCurrency(b.totalPrizeWon) : '-'}
                    </td>

                    <td className="py-4 px-4 text-center">{getStatusBadge(b.status)}</td>

                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBolao(b.id);
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredBoloes.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhum bolão encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
