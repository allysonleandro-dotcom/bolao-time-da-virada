import React from 'react';
import {
  Trophy,
  Users,
  Layers,
  Calculator,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Plus,
  Share2,
  CheckCircle2,
  Clock,
  Sparkles,
  Ticket,
  DollarSign,
  FileSpreadsheet,
} from 'lucide-react';
import { Bolao, Participant } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { calculateBolaoFinancials, formatCurrency, formatDateBR, formatBolaoBetSummary } from '../utils/calculator';
import { AppTab } from './Header';

interface DashboardViewProps {
  boloes: Bolao[];
  participants: Participant[];
  onSelectBolao: (bolaoId: string) => void;
  onOpenNewBolao: () => void;
  onNavigate: (tab: AppTab) => void;
  onOpenWhatsAppShare: (bolao: Bolao, type: 'convite' | 'jogos' | 'resultado') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  boloes,
  participants,
  onSelectBolao,
  onOpenNewBolao,
  onNavigate,
  onOpenWhatsAppShare,
}) => {
  // Aggregate calculations
  let totalRevenueCollected = 0;
  let totalPendingToCollect = 0;
  let totalPrizesWon = 0;
  let totalRegisteredTickets = 0;

  boloes.forEach((b) => {
    const fin = calculateBolaoFinancials(b);
    totalRevenueCollected += fin.totalCollected;
    totalPendingToCollect += fin.totalPending;
    totalPrizesWon += b.totalPrizeWon || 0;
    totalRegisteredTickets += b.tickets.length;
  });

  const activeBoloes = boloes.filter(
    (b) => b.status === 'arrecadando' || b.status === 'jogos_registrados' || b.status === 'aguardando_sorteio'
  );

  const wonBoloes = boloes.filter((b) => b.status === 'premiado');

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bento Row: Dark Spotlight Hero Card & Stats Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dark Bento Hero Spotlight */}
        <div className="lg:col-span-7 bg-slate-900 rounded-3xl p-7 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800 flex flex-col justify-between min-h-[260px]">
          {/* Glowing Emerald Blur Accent */}
          <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-emerald-600 rounded-full blur-[80px] opacity-40 pointer-events-none"></div>
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-teal-700 rounded-full blur-[70px] opacity-20 pointer-events-none"></div>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PAINEL DO ORGANIZADOR</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
              CONTROLE DE BOLÕES CAIXA
            </h2>

            <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              Arrecadação via Pix, conferência instantânea dos bilhetes da Caixa e envio automatizado de relatórios e comprovantes para o WhatsApp.
            </p>
          </div>

          <div className="relative z-10 pt-6 flex flex-wrap items-center gap-3">
            <button
              id="dashboard-new-bolao-hero"
              onClick={onOpenNewBolao}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm px-5 py-3 rounded-xl shadow-lg shadow-emerald-950/40 transition active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Bolão</span>
            </button>

            <button
              id="dashboard-calc-hero"
              onClick={() => onNavigate('calculadora')}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-xl border border-white/15 transition flex items-center gap-2"
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Calculadora de Jogos</span>
            </button>
          </div>
        </div>

        {/* Bento Live Stats Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Panorama Financeiro
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                Resumo Consolidado
              </h3>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-1 rounded-full">
              ATUALIZADO
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Arrecadado
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900">
                {formatCurrency(totalRevenueCollected)}
              </p>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                Confirmado
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                A Receber
              </span>
              <p className="text-xl sm:text-2xl font-black text-amber-600">
                {formatCurrency(totalPendingToCollect)}
              </p>
              <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                Pendente
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <strong>{participants.length}</strong> participantes cadastrados
            </span>
            <span className="flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-emerald-600" />
              <strong>{totalRegisteredTickets}</strong> apostas
            </span>
          </div>
        </div>
      </div>

      {/* Bento Stats Ribbon */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
        <div className="text-center md:text-left px-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Total Arrecadado
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatCurrency(totalRevenueCollected)}
          </div>
        </div>

        <div className="text-center md:text-left px-3 border-l border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Pendente a Receber
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-600">
            {formatCurrency(totalPendingToCollect)}
          </div>
        </div>

        <div className="text-center md:text-left px-3 border-l border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Prêmios Conquistados
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {formatCurrency(totalPrizesWon)}
          </div>
        </div>

        <div className="text-center md:text-left px-3 border-l border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Bolões Ativos
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {activeBoloes.length} <span className="text-xs text-slate-400 font-bold">em andamento</span>
          </div>
        </div>
      </div>

      {/* Won Bolões Celebration Banner (if any) */}
      {wonBoloes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-white rounded-3xl p-6 sm:p-7 shadow-lg flex flex-col md:flex-row items-center justify-between gap-5 border border-amber-400/40">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
              🏆
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider bg-black/20 px-3 py-1 rounded-full">
                Premiação Confirmada!
              </span>
              <h3 className="text-xl font-black mt-1">
                {wonBoloes[0].title} foi premiado com {formatCurrency(wonBoloes[0].totalPrizeWon)}!
              </h3>
              <p className="text-amber-100 text-xs mt-0.5">
                Valor líquido por cota: <strong>{formatCurrency(wonBoloes[0].netPrizePerQuota)}</strong>. Realize o rateio e envie comprovantes via Pix.
              </p>
            </div>
          </div>
          <button
            id={`dashboard-view-winner-${wonBoloes[0].id}`}
            onClick={() => onSelectBolao(wonBoloes[0].id)}
            className="bg-slate-950 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-2xl shadow-md transition whitespace-nowrap"
          >
            Ver Rateio e Pagamentos
          </button>
        </div>
      )}

      {/* Section: Active Bolões in Progress (Bento Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Bolões em Andamento</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Acompanhe arrecadação, apostas registradas e próximos sorteios
            </p>
          </div>
          <button
            onClick={() => onNavigate('boloes')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 transition"
          >
            <span>Ver todos ({boloes.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeBoloes.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Ticket className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Nenhum bolão ativo no momento</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Crie seu primeiro bolão para começar a registrar jogos e arrecadar cotas com seus amigos.
            </p>
            <button
              onClick={onOpenNewBolao}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2 shadow-md shadow-emerald-200"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeiro Bolão</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeBoloes.map((bolao) => {
              const config = LOTTERY_CONFIGS[bolao.lotteryType] || LOTTERY_CONFIGS['mega-sena'];
              const fin = calculateBolaoFinancials(bolao);
              const percentSold = Math.min(100, Math.round((fin.totalQuotasSold / (bolao.totalQuotas || 1)) * 100));
              const percentPaid = Math.min(100, Math.round((fin.totalQuotasPaid / (bolao.totalQuotas || 1)) * 100));

              return (
                <div
                  key={bolao.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div>
                    {/* Top Color Accent */}
                    <div
                      className="h-2 w-full"
                      style={{ backgroundColor: config.color }}
                    ></div>

                    <div className="p-6">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-[11px] font-bold px-3 py-1 rounded-full border ${config.bgLight}`}
                        >
                          {config.name} • Concurso {bolao.contestNumber || '-'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDateBR(bolao.drawDate)}
                        </span>
                      </div>

                      {/* Google Sheets Tab Chip */}
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {bolao.id.includes('regular') || bolao.title.toUpperCase().includes('REGULAR')
                            ? 'Aba BOLÕES_REGULARES'
                            : 'Aba Independência'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {(bolao.totalQuotas || 0) - fin.totalQuotasSold} cotas livres
                        </span>
                      </div>

                      <h4 className="font-black text-slate-900 text-lg mt-2 line-clamp-1 group-hover:text-emerald-600 transition tracking-tight">
                        {bolao.title}
                      </h4>

                      {/* Quotas & Financials Bento Box */}
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
                          <span className="text-slate-600">
                            Cotas: <strong>{fin.totalQuotasSold}</strong> / {bolao.totalQuotas}
                          </span>
                          <span className="text-emerald-600 font-bold">{percentPaid}% pagas</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${percentPaid}%` }}
                            title={`Pagas: ${fin.totalQuotasPaid}`}
                          ></div>
                          <div
                            className="bg-amber-400 h-full transition-all duration-500"
                            style={{ width: `${percentSold - percentPaid}%` }}
                            title={`Pendentes: ${fin.totalQuotasPending}`}
                          ></div>
                        </div>
                      </div>

                      {/* Summary stats */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5 text-slate-400" />
                          {formatBolaoBetSummary(bolao)}
                        </span>
                        <span>{bolao.participants.length} participantes</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      id={`dashboard-whatsapp-${bolao.id}`}
                      onClick={() => onOpenWhatsAppShare(bolao, 'convite')}
                      className="px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-emerald-200/50"
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      id={`dashboard-open-bolao-${bolao.id}`}
                      onClick={() => onSelectBolao(bolao.id)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Abrir Bolão</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Bento Grid Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => onNavigate('calculadora')}
          className="bg-white border border-slate-200 rounded-3xl p-6 cursor-pointer hover:shadow-md hover:border-purple-300 transition group flex flex-col justify-between shadow-xs"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Calculator className="w-6 h-6" />
            </div>
            <h4 className="font-black text-slate-900 text-base group-hover:text-purple-700 transition">
              Calculadora & Desdobramentos
            </h4>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-medium">
              Simule custos de apostas múltiplas na Mega-Sena, Lotofácil e Quina com cálculo exato de cotas e arrecadação.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-purple-700 flex items-center gap-1">
            <span>Abrir calculadora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('participantes')}
          className="bg-white border border-slate-200 rounded-3xl p-6 cursor-pointer hover:shadow-md hover:border-sky-300 transition group flex flex-col justify-between shadow-xs"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-black text-slate-900 text-base group-hover:text-sky-700 transition">
              Registro de Participantes & Pix
            </h4>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-medium">
              Importe planilhas de amigos, controle histórico de cotas, pendências financeiras e envie comprovantes via WhatsApp.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-sky-700 flex items-center gap-1">
            <span>Gerenciar participantes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={onOpenNewBolao}
          className="bg-white border border-slate-200 rounded-3xl p-6 cursor-pointer hover:shadow-md hover:border-emerald-300 transition group flex flex-col justify-between shadow-xs"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <h4 className="font-black text-slate-900 text-base group-hover:text-emerald-700 transition">
              Lançar Novo Bolão
            </h4>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-medium">
              Defina o concurso, configure cotas e valores, adicione os jogos e gere a mensagem oficial pronta para o WhatsApp.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-emerald-700 flex items-center gap-1">
            <span>Criar novo bolão</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
