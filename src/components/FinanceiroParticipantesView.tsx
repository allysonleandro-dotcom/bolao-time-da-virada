import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  FileDown,
  Search,
  Users,
  Calendar,
  Award,
  ArrowUpDown,
  FileText,
  MessageSquare,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Bolao, Participant } from '../types';
import { formatCurrency, getParticipantQuotaLabel } from '../utils/calculator';
import {
  exportParticipantsSpendingReportPDF,
  exportSingleParticipantStatementPDF,
  formatDateBR,
} from '../utils/pdfGenerator';

interface FinanceiroParticipantesProps {
  participants: Participant[];
  boloes: Bolao[];
}

export const FinanceiroParticipantesView: React.FC<FinanceiroParticipantesProps> = ({
  participants,
  boloes,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'spent' | 'monthly' | 'quotas' | 'name' | 'prizes'>('spent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedParticipantForModal, setSelectedParticipantForModal] =
    useState<Participant | null>(null);

  // Compute stats for all participants
  let grandTotalSpent = 0;
  let grandTotalPrizes = 0;
  let grandTotalQuotas = 0;

  const enrichedParticipants = participants.map((p) => {
    let totalSpent = 0;
    let totalQuotas = 0;
    let totalPrizes = 0;
    let bolaoCount = 0;
    const dates: Date[] = [];

    boloes.forEach((b) => {
      const entry = b.participants.find((bp) => bp.participantId === p.id);
      if (entry) {
        bolaoCount += 1;
        totalQuotas += entry.quotas;
        totalSpent += entry.amountPaid || 0;
        if (entry.paidAt) dates.push(new Date(entry.paidAt));
        else if (b.drawDate) dates.push(new Date(b.drawDate));

        if (b.totalPrizeWon && b.totalPrizeWon > 0 && b.totalQuotas > 0) {
          const quotaShare = b.totalPrizeWon / b.totalQuotas;
          totalPrizes += entry.quotas * quotaShare;
        }
      }
    });

    grandTotalSpent += totalSpent;
    grandTotalPrizes += totalPrizes;
    grandTotalQuotas += totalQuotas;

    // Monthly average calculation based on active timeframe
    let months = 1;
    if (dates.length > 1) {
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      const diff =
        (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
        (maxDate.getMonth() - minDate.getMonth()) +
        1;
      months = Math.max(1, diff);
    }
    const monthlyAverage = totalSpent / months;
    const netBalance = totalPrizes - totalSpent;

    return {
      participant: p,
      totalSpent,
      totalQuotas,
      totalPrizes,
      bolaoCount,
      monthlyAverage,
      netBalance,
      months,
    };
  });

  // Filter & Sort
  const filtered = enrichedParticipants.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.participant.name.toLowerCase().includes(term) ||
      (item.participant.phone && item.participant.phone.includes(term))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let factor = sortOrder === 'desc' ? -1 : 1;
    if (sortBy === 'spent') return (a.totalSpent - b.totalSpent) * factor;
    if (sortBy === 'monthly') return (a.monthlyAverage - b.monthlyAverage) * factor;
    if (sortBy === 'quotas') return (a.totalQuotas - b.totalQuotas) * factor;
    if (sortBy === 'prizes') return (a.totalPrizes - b.totalPrizes) * factor;
    if (sortBy === 'name') return a.participant.name.localeCompare(b.participant.name) * factor;
    return 0;
  });

  const handleSort = (field: 'spent' | 'monthly' | 'quotas' | 'name' | 'prizes') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Compute consolidated monthly average across the group
  const overallMonthlyAvg =
    participants.length > 0 ? grandTotalSpent / participants.length : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Controle Financeiro & Médias Mensais</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Histórico de Gastos por Participante
            </h2>
            <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
              Acompanhe o total investido por cada apostador, a média mensal de gastos, os prêmios
              recebidos e emita extratos individuais ou relatórios consolidados em PDF.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportParticipantsSpendingReportPDF(participants, boloes)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-md shadow-emerald-200 transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Baixar Relatório Financeiro (PDF)</span>
            </button>
          </div>
        </div>

        {/* Bento Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Investido (Grupo)
            </span>
            <span className="text-2xl font-black text-slate-900">
              {formatCurrency(grandTotalSpent)}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Média por Participante
            </span>
            <span className="text-2xl font-black text-emerald-600">
              {formatCurrency(overallMonthlyAvg)}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Prêmios Conquistados
            </span>
            <span className="text-2xl font-black text-amber-600">
              {formatCurrency(grandTotalPrizes)}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Cotas Compradas
            </span>
            <span className="text-2xl font-black text-slate-800">
              {grandTotalQuotas} cotas
            </span>
          </div>
        </div>
      </div>

      {/* Search and Sort Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar participante por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span>Ordenar por:</span>
          <button
            onClick={() => handleSort('spent')}
            className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              sortBy === 'spent'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Total Gasto {sortBy === 'spent' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('monthly')}
            className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              sortBy === 'monthly'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Média Mensal {sortBy === 'monthly' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('quotas')}
            className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              sortBy === 'quotas'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Cotas {sortBy === 'quotas' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Participante</th>
                <th className="py-3.5 px-4">Telefone / WhatsApp</th>
                <th className="py-3.5 px-4 text-center">Cotas / Bolões</th>
                <th className="py-3.5 px-4 text-right">Total Gasto</th>
                <th className="py-3.5 px-4 text-right">Média Mensal</th>
                <th className="py-3.5 px-4 text-right">Prêmios</th>
                <th className="py-3.5 px-4 text-right">Saldo Líquido</th>
                <th className="py-3.5 px-4 text-center">Extrato & PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sorted.map((item) => {
                const {
                  participant,
                  totalSpent,
                  totalQuotas,
                  totalPrizes,
                  bolaoCount,
                  monthlyAverage,
                  netBalance,
                } = item;

                const cleanPhone = (participant.phone || '').replace(/\D/g, '');
                const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

                return (
                  <tr key={participant.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-bold text-slate-900">{participant.name.toUpperCase()}</div>
                      {participant.notes && (
                        <div className="text-[11px] text-slate-400">{participant.notes}</div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">
                          {participant.phone || '-'}
                        </span>
                        {cleanPhone.length >= 10 && (
                          <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-md transition"
                            title="Conversar no WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {totalQuotas} cotas ({bolaoCount} bolões)
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(totalSpent)}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {formatCurrency(monthlyAverage)}/mês
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right font-black text-amber-600">
                      {totalPrizes > 0 ? formatCurrency(totalPrizes) : '-'}
                    </td>

                    <td
                      className={`py-4 px-4 text-right font-bold ${
                        netBalance >= 0 ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {netBalance >= 0 ? `+${formatCurrency(netBalance)}` : formatCurrency(netBalance)}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedParticipantForModal(participant)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Ver Extrato Detalhado"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>Extrato</span>
                        </button>

                        <button
                          onClick={() =>
                            exportSingleParticipantStatementPDF(participant, boloes)
                          }
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg transition cursor-pointer"
                          title="Baixar Extrato em PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum participante encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Participant Statement Modal */}
      {selectedParticipantForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  Extrato Financeiro
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  {selectedParticipantForModal.name.toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setSelectedParticipantForModal(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Participations in bolões list */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                Bolões em que Participou:
              </h4>

              <div className="space-y-2">
                {boloes
                  .filter((b) =>
                    b.participants.some(
                      (bp) => bp.participantId === selectedParticipantForModal.id
                    )
                  )
                  .map((b) => {
                    const bp = b.participants.find(
                      (p) => p.participantId === selectedParticipantForModal.id
                    )!;
                    const quotaShare =
                      b.totalPrizeWon && b.totalPrizeWon > 0 && b.totalQuotas > 0
                        ? (b.totalPrizeWon / b.totalQuotas) * bp.quotas
                        : 0;

                    return (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{b.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {b.lotteryType.toUpperCase()} • Conc. {b.contestNumber || 'N/A'} • Sorteio: {formatDateBR(b.drawDate)}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right">
                            <span className="font-black text-slate-800">
                              {getParticipantQuotaLabel(b, bp.participantId, bp)} • {formatCurrency(bp.amountPaid)}
                            </span>
                            <div className="text-[10px] text-emerald-600 font-bold uppercase">
                              {bp.status === 'pago' ? 'Pago' : 'Pendente'}
                            </div>
                          </div>

                          {quotaShare > 0 && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg text-xs font-black">
                              +{formatCurrency(quotaShare)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedParticipantForModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  exportSingleParticipantStatementPDF(selectedParticipantForModal, boloes);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                <span>Baixar Extrato (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
