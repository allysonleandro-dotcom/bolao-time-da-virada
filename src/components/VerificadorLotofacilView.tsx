import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Trophy,
  FileDown,
  ListFilter,
  Share2,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  ClipboardPaste,
  HelpCircle,
  TrendingUp,
  Award,
  Layers,
  Search,
} from 'lucide-react';
import { Bolao, Participant, LotteryType, TicketGame } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import {
  formatCurrency,
  formatNumbersList,
  calculateLotteryPrizeMultipliers,
  getDefaultPrizeEstimates,
} from '../utils/calculator';
import { exportBolaoConferencePDF } from '../utils/pdfGenerator';

interface VerificadorViewProps {
  boloes: Bolao[];
  participants?: Participant[];
  onUpdateBolao?: (updatedBolao: Bolao) => void;
  onOpenWhatsAppShare?: (bolao: Bolao, type: any) => void;
  onSelectBolao?: (id: string) => void;
}

export const VerificadorLotofacilView: React.FC<VerificadorViewProps> = ({
  boloes,
  participants = [],
  onUpdateBolao,
  onOpenWhatsAppShare,
  onSelectBolao,
}) => {
  // 1. Bolão selection state
  const [selectedBolaoId, setSelectedBolaoId] = useState<string>(boloes[0]?.id || '');

  // Find active bolão
  const activeBolao = useMemo(() => {
    return boloes.find((b) => b.id === selectedBolaoId) || boloes[0] || null;
  }, [boloes, selectedBolaoId]);

  // Current lottery type (from active bolão or fallback)
  const currentLotteryType: LotteryType = activeBolao?.lotteryType || 'lotofacil';
  const lotteryConfig = LOTTERY_CONFIGS[currentLotteryType] || LOTTERY_CONFIGS['lotofacil'];

  const totalRange = lotteryConfig.totalRange || 60;
  const standardDrawnCount = lotteryConfig.standardBetCount || (currentLotteryType === 'mega-sena' ? 6 : 15);

  // Contest number input
  const [contestNumberInput, setContestNumberInput] = useState<string>(
    activeBolao?.contestNumber || ''
  );

  // Drawn numbers state
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>(() => {
    if (activeBolao?.drawnNumbers && activeBolao.drawnNumbers.length > 0) {
      return [...activeBolao.drawnNumbers].sort((a, b) => a - b);
    }
    if (currentLotteryType === 'mega-sena') {
      return [5, 12, 28, 34, 45, 59];
    }
    if (currentLotteryType === 'lotofacil') {
      return [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 20, 21, 23, 25];
    }
    return [];
  });

  // Real-time quick text input state
  const [realtimeInputText, setRealtimeInputText] = useState<string>('');

  // Prize estimates state (per hit count)
  const [prizeValues, setPrizeValues] = useState<Record<number, number>>(() =>
    getDefaultPrizeEstimates(currentLotteryType)
  );

  // Success toast indicator for saving
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sync when active bolão changes
  useEffect(() => {
    if (activeBolao) {
      setContestNumberInput(activeBolao.contestNumber || '');
      const newDrawn =
        activeBolao.drawnNumbers && activeBolao.drawnNumbers.length > 0
          ? [...activeBolao.drawnNumbers].sort((a, b) => a - b)
          : currentLotteryType === 'mega-sena'
          ? [5, 12, 28, 34, 45, 59]
          : currentLotteryType === 'lotofacil'
          ? [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 20, 21, 23, 25]
          : [];
      setDrawnNumbers(newDrawn);
      setRealtimeInputText(newDrawn.map((n) => String(n).padStart(2, '0')).join(' '));
      setPrizeValues(getDefaultPrizeEstimates(activeBolao.lotteryType));
    }
  }, [activeBolao?.id, activeBolao?.lotteryType]);

  // Synchronize realtimeInputText when drawnNumbers changes via ball clicks
  const syncInputTextFromNumbers = (nums: number[]) => {
    setRealtimeInputText(nums.map((n) => String(n).padStart(2, '0')).join(' '));
  };

  // Real-time parser for typed text (handles spaces, commas, semicolons, dashes)
  const handleRealtimeInputChange = (text: string) => {
    setRealtimeInputText(text);

    // Extract all numbers
    const matches = text.match(/\d+/g);
    if (!matches) {
      setDrawnNumbers([]);
      return;
    }

    const parsed: number[] = [];
    for (const m of matches) {
      const num = parseInt(m, 10);
      if (num >= 1 && num <= totalRange && !parsed.includes(num)) {
        parsed.push(num);
        if (parsed.length >= standardDrawnCount) break;
      }
    }

    setDrawnNumbers(parsed.sort((a, b) => a - b));
  };

  // Toggle individual number ball
  const toggleDrawnNumber = (num: number) => {
    let updated: number[];
    if (drawnNumbers.includes(num)) {
      updated = drawnNumbers.filter((n) => n !== num).sort((a, b) => a - b);
    } else {
      if (drawnNumbers.length >= standardDrawnCount) return;
      updated = [...drawnNumbers, num].sort((a, b) => a - b);
    }
    setDrawnNumbers(updated);
    syncInputTextFromNumbers(updated);
  };

  const handleClear = () => {
    setDrawnNumbers([]);
    setRealtimeInputText('');
  };

  const handleRandomDraw = () => {
    const all = Array.from({ length: totalRange }, (_, i) => i + 1);
    const shuffled = all.sort(() => 0.5 - Math.random());
    const randomPicked = shuffled.slice(0, standardDrawnCount).sort((a, b) => a - b);
    setDrawnNumbers(randomPicked);
    syncInputTextFromNumbers(randomPicked);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          handleRealtimeInputChange(clipText);
          return;
        }
      }
    } catch {
      // ignore
    }
    const promptText = window.prompt(
      `Cole as dezenas sorteadas da ${lotteryConfig.name} (ex: 04 12 28 35 44 59):`
    );
    if (promptText) {
      handleRealtimeInputChange(promptText);
    }
  };

  // Compute conference results for activeBolao
  const ticketsToConfer: TicketGame[] = activeBolao ? activeBolao.tickets : [];

  // Prize counters by hit tier
  const tierCountSummary: Record<number, number> = {};
  lotteryConfig.prizeTiers.forEach((tier) => {
    const hitsNum = Number(tier.hits);
    if (!isNaN(hitsNum)) {
      tierCountSummary[hitsNum] = 0;
    }
  });

  let totalPrizeWonCalculated = 0;

  const ticketResults = ticketsToConfer.map((ticket, index) => {
    const hitsArray = ticket.numbers.filter((n) => drawnNumbers.includes(n));
    const hitsCount = hitsArray.length;
    const multipliers = calculateLotteryPrizeMultipliers(
      currentLotteryType,
      ticket.numbersCount || ticket.numbers.length,
      hitsCount
    );

    let ticketPrize = 0;
    Object.entries(multipliers).forEach(([hitsStr, count]) => {
      const h = Number(hitsStr);
      if (tierCountSummary[h] !== undefined) {
        tierCountSummary[h] += count;
      }
      const prizePerUnit = prizeValues[h] || 0;
      ticketPrize += count * prizePerUnit;
    });

    totalPrizeWonCalculated += ticketPrize;

    return {
      ticket,
      index,
      hitsArray,
      hitsCount,
      multipliers,
      prizeThisTicket: ticketPrize,
    };
  });

  const totalQuotas = activeBolao?.totalQuotas || 1;
  const prizePerQuota = totalPrizeWonCalculated > 0 ? totalPrizeWonCalculated / totalQuotas : 0;

  // Save conference results to Bolão
  const handleSaveToBolao = () => {
    if (!activeBolao || !onUpdateBolao) return;

    const updatedTickets = activeBolao.tickets.map((t, idx) => {
      const res = ticketResults[idx];
      return {
        ...t,
        prizeWonAmount: res?.prizeThisTicket || 0,
      };
    });

    const updatedBolao: Bolao = {
      ...activeBolao,
      contestNumber: contestNumberInput || activeBolao.contestNumber,
      drawnNumbers: drawnNumbers,
      totalPrizeWon: totalPrizeWonCalculated,
      netPrizePerQuota: prizePerQuota,
      status: totalPrizeWonCalculated > 0 ? 'premiado' : 'sorteado',
      tickets: updatedTickets,
    };

    onUpdateBolao(updatedBolao);
    setSaveSuccessMessage(
      `Resultado oficial salvo no bolão "${updatedBolao.title}" com sucesso!`
    );
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Handle PDF Export
  const handleExportPDF = () => {
    if (!activeBolao) return;
    const modifiedBolao: Bolao = {
      ...activeBolao,
      contestNumber: contestNumberInput || activeBolao.contestNumber,
      drawnNumbers: drawnNumbers,
      totalPrizeWon: totalPrizeWonCalculated,
      tickets: activeBolao.tickets.map((t, idx) => {
        const res = ticketResults[idx];
        return {
          ...t,
          prizeWonAmount: res?.prizeThisTicket || 0,
        };
      }),
    };
    exportBolaoConferencePDF(modifiedBolao, participants, drawnNumbers);
  };

  // Determine grid columns based on range
  const gridColClass =
    totalRange <= 25
      ? 'grid-cols-5'
      : totalRange <= 50
      ? 'grid-cols-5 sm:grid-cols-10'
      : totalRange <= 60
      ? 'grid-cols-6 sm:grid-cols-10'
      : 'grid-cols-8 sm:grid-cols-10';

  const isDrawnComplete = drawnNumbers.length === standardDrawnCount;

  return (
    <div className="space-y-6 pb-14">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div
          className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: lotteryConfig.color }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Conferidor Inteligente Multi-Loterias</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span>Conferência de Resultados:</span>
              <span
                className="px-3 py-1 rounded-xl text-white text-xl sm:text-2xl font-black shadow-xs"
                style={{ backgroundColor: lotteryConfig.color }}
              >
                {lotteryConfig.name}
              </span>
            </h2>
            <p className="text-slate-500 text-sm max-w-3xl leading-relaxed">
              Digite ou marque as <strong>{standardDrawnCount} dezenas sorteadas</strong> da Caixa
              (de 1 a {totalRange}). A regra oficial de desdobramentos, multiplicadores de
              premiação e rateio por cota são calculados em <strong>tempo real</strong>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSaveToBolao}
              disabled={!activeBolao || drawnNumbers.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-md shadow-emerald-200 transition active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar no Bolão</span>
            </button>

            {onOpenWhatsAppShare && activeBolao && (
              <button
                onClick={() => onOpenWhatsAppShare(activeBolao, 'resultado')}
                className="bg-green-600 hover:bg-green-500 text-white rounded-2xl px-3.5 py-2.5 font-black text-xs sm:text-sm shadow-md shadow-green-200 transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            )}

            <button
              onClick={handleExportPDF}
              disabled={!activeBolao}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Baixar PDF</span>
            </button>
          </div>
        </div>

        {/* Save Toast Notification */}
        {saveSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Bolão Selector & Contest Info Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Bolão Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-800 font-bold text-xs flex items-center gap-1.5 shrink-0">
            <ListFilter className="w-4 h-4 text-emerald-600" />
            <span>Selecionar Bolão:</span>
          </div>
          <select
            value={selectedBolaoId}
            onChange={(e) => {
              setSelectedBolaoId(e.target.value);
              if (onSelectBolao) onSelectBolao(e.target.value);
            }}
            className="w-full sm:w-80 md:w-96 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {boloes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} (Conc. {b.contestNumber || 'N/A'}) - {LOTTERY_CONFIGS[b.lotteryType]?.name || b.lotteryType}
              </option>
            ))}
          </select>
        </div>

        {/* Contest & Modality Info Tags */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-500 font-bold">Concurso:</span>
            <input
              type="text"
              value={contestNumberInput}
              onChange={(e) => setContestNumberInput(e.target.value)}
              placeholder="Ex: 3790"
              className="w-20 font-black text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
            <span>Regra:</span>
            <span className="text-emerald-700 font-black">
              {standardDrawnCount} dezenas sorteadas de {totalRange}
            </span>
          </div>
        </div>
      </div>

      {/* ⚡ REAL-TIME FAST ENTRY BAR (Espaço para Digitação Rápida em Tempo Real) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-5 sm:p-6 text-white border border-slate-750 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/30">
              ⚡
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white uppercase">
                Digitação Rápida em Tempo Real
              </h3>
              <p className="text-xs text-slate-400">
                Digite ou cole as dezenas separadas por espaço, vírgula ou traço (ex:{' '}
                <span className="text-emerald-300 font-mono">
                  {currentLotteryType === 'mega-sena' ? '05 12 28 34 45 59' : '01 02 03 05 07 09...'}
                </span>
                )
              </p>
            </div>
          </div>

          {/* Status Badge of Drawn Count */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border transition ${
                isDrawnComplete
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isDrawnComplete ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span>
                {drawnNumbers.length} / {standardDrawnCount} dezenas sorteadas
              </span>
            </div>
          </div>
        </div>

        {/* Input Box and Action Controls */}
        <div className="flex flex-col md:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={realtimeInputText}
              onChange={(e) => handleRealtimeInputChange(e.target.value)}
              placeholder={`Digite as ${standardDrawnCount} dezenas aqui (ex: ${
                currentLotteryType === 'mega-sena'
                  ? '05 14 26 38 41 57'
                  : '01 03 04 05 07 09 11 12 15 16 18 19 20 22 25'
              })`}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-2xl px-4 py-3 text-sm sm:text-base font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-inner"
            />
            {drawnNumbers.length > 0 && (
              <button
                onClick={handleClear}
                title="Limpar campo"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePasteClipboard}
              className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3.5 py-3 rounded-2xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-400" />
              <span>Colar</span>
            </button>

            <button
              onClick={handleRandomDraw}
              className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3.5 py-3 rounded-2xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Sortear {standardDrawnCount}</span>
            </button>
          </div>
        </div>

        {/* Visual Live Chips of current drawn numbers */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Dezenas em Tempo Real:
          </span>
          {drawnNumbers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              {drawnNumbers.map((num) => (
                <span
                  key={num}
                  className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center shadow-xs ring-1 ring-emerald-300"
                >
                  {String(num).padStart(2, '0')}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic">
              Nenhuma dezena preenchida. Digite no campo acima ou clique nas bolinhas abaixo.
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Interactive Ball Matrix + Prize Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Number Matrix (Dynamic Range) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-xs"
                style={{ backgroundColor: lotteryConfig.color }}
              >
                {totalRange}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Painel Interativo de {totalRange} Dezenas ({lotteryConfig.name})
                </h3>
                <p className="text-xs text-slate-500">
                  {drawnNumbers.length}/{standardDrawnCount} dezenas selecionadas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRandomDraw}
                className="text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Aleatório</span>
              </button>
              <button
                onClick={handleClear}
                className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Dynamic Grid of Numbers */}
          <div className={`grid ${gridColClass} gap-1.5 sm:gap-2`}>
            {Array.from({ length: totalRange }, (_, i) => i + 1).map((num) => {
              const isSelected = drawnNumbers.includes(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => toggleDrawnNumber(num)}
                  className={`h-10 sm:h-11 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-95 ring-2 ring-emerald-400'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {String(num).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          {/* Quick Helper Note */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center gap-2 text-xs text-slate-600">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Clique nas dezenas para marcar/desmarcar ou use o campo de digitação rápida no topo.
            </span>
          </div>
        </div>

        {/* Right Column: Prize Breakdown & Real-Time Multipliers */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Resumo de Premiação ({lotteryConfig.name})
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {activeBolao?.tickets.length || 0} aposta(s)
              </span>
            </div>

            {/* Total Prize Bento Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200/50 relative overflow-hidden">
              <div className="relative z-10 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-emerald-200 font-bold">
                  Premiação Total Conquistada
                </span>
                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  {formatCurrency(totalPrizeWonCalculated)}
                </div>
                <div className="pt-2 flex items-center justify-between text-xs text-emerald-100 border-t border-emerald-500/40 mt-2">
                  <span>Rateio por cota ({totalQuotas} cotas):</span>
                  <span className="font-black text-sm text-white">
                    {formatCurrency(prizePerQuota)} / cota
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Multiplier Breakdown Tiers according to the lottery modality */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Acertos e Multiplicadores Oficiais ({lotteryConfig.name}):
              </span>

              {lotteryConfig.prizeTiers.map((tier) => {
                const count = tierCountSummary[tier.hits] || 0;
                const unitPrize = prizeValues[tier.hits] || 0;
                const totalTierPrize = count * unitPrize;

                return (
                  <div
                    key={tier.hits}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition ${
                      count > 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 ring-1 ring-emerald-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            count > 0 ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{tier.name}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Estimativa: {formatCurrency(unitPrize)} cada
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm font-black ${
                          count > 0 ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {count}x
                      </span>
                      {totalTierPrize > 0 && (
                        <div className="text-[10px] text-emerald-600 font-bold">
                          {formatCurrency(totalTierPrize)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 space-y-2 border-t border-slate-100">
            <button
              onClick={handleSaveToBolao}
              disabled={!activeBolao || drawnNumbers.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-200 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Resultado Oficial no Bolão</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-2.5 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Gerar Relatório Completo em PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Details List (Aposta por Aposta com Destaque de Acertos em Tempo Real) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Conferência Aposta por Aposta ({activeBolao?.title || 'Bolão'})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Concurso {contestNumberInput || 'N/A'} • {ticketsToConfer.length} bilhete(s) registrado(s)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              {drawnNumbers.length} dezenas conferidas
            </span>
          </div>
        </div>

        {/* Tickets Grid */}
        <div className="grid grid-cols-1 gap-4">
          {ticketResults.map(({ ticket, index, hitsArray, hitsCount, prizeThisTicket, multipliers }) => {
            const sortedNums = [...ticket.numbers].sort((a, b) => a - b);
            const isWinner = prizeThisTicket > 0 || hitsCount >= (lotteryConfig.prizeTiers[lotteryConfig.prizeTiers.length - 1]?.hits || 4);

            return (
              <div
                key={ticket.id || index}
                className={`p-4 rounded-2xl border transition ${
                  isWinner
                    ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                      Jogo #{index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {ticket.numbersCount || ticket.numbers.length} Dezenas Jogadas
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full ${
                        hitsCount >= (lotteryConfig.prizeTiers[0]?.hits || 6)
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          : hitsCount >= (lotteryConfig.prizeTiers[lotteryConfig.prizeTiers.length - 1]?.hits || 4)
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      🎯 {hitsCount} Acertos
                    </span>

                    {prizeThisTicket > 0 && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                        Prêmio: {formatCurrency(prizeThisTicket)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Number balls with instant visual match highlighting */}
                <div className="flex flex-wrap gap-1.5">
                  {sortedNums.map((n) => {
                    const isHit = drawnNumbers.includes(n);
                    return (
                      <span
                        key={n}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs flex items-center justify-center transition ${
                          isHit
                            ? 'bg-emerald-600 text-white shadow-xs scale-105 ring-2 ring-emerald-300'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {String(n).padStart(2, '0')}
                      </span>
                    );
                  })}
                </div>

                {/* Multiple bet award details if expanded */}
                {(ticket.numbersCount || ticket.numbers.length) > standardDrawnCount && isWinner && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800 font-bold flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">Premiações múltiplas deste bilhete:</span>
                    {Object.entries(multipliers)
                      .filter(([_, count]) => count > 0)
                      .map(([hits, count]) => {
                        const tier = lotteryConfig.prizeTiers.find((t) => t.hits === Number(hits));
                        return (
                          <span
                            key={hits}
                            className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300"
                          >
                            {count}x {tier?.name || `${hits} acertos`}
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
