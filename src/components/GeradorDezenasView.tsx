import React, { useState, useMemo } from 'react';
import {
  Dices,
  Sparkles,
  FileText,
  Printer,
  Copy,
  Check,
  Share2,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Layers,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Settings2,
  X,
  Shuffle,
  Zap,
} from 'lucide-react';
import { LotteryType } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { formatCurrency, getOfficialGameCost, combinations } from '../utils/calculator';
import { exportGeneratedTicketsPDF, GeneratedTicketPDFItem } from '../utils/pdfGenerator';

interface GeradorDezenasViewProps {
  onCreateBolaoWithTickets?: (params: {
    lotteryType: LotteryType;
    tickets: { numbers: number[]; numbersCount: number; cost: number; name?: string }[];
  }) => void;
}

interface GeneratedTicket {
  id: string;
  name: string;
  numbers: number[];
  numbersCount: number;
  cost: number;
  specialPick?: string; // Trevos, Team, Month, Columns
  evenCount: number;
  oddCount: number;
  sum: number;
}

// Special lists for modalities
const MESES_DIA_DE_SORTE = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const TIMES_TIMEMANIA = [
  'Flamengo / RJ', 'Corinthians / SP', 'Santos / SP', 'Palmeiras / SP', 'São Paulo / SP',
  'Grêmio / RS', 'Internacional / RS', 'Vasco da Gama / RJ', 'Cruzeiro / MG', 'Atlético / MG',
  'Botafogo / RJ', 'Fluminense / RJ', 'Bahia / BA', 'Fortaleza / CE', 'Ceará / CE',
  'Sport / PE', 'Vitória / BA', 'Coritiba / PR', 'Athletico / PR', 'Goiás / GO',
  'América / MG', 'Avaí / SC', 'Chapecoense / SC', 'Ponte Preta / SP', 'Guarani / SP',
  'Remo / PA', 'Paysandu / PA', 'Santa Cruz / PE', 'Náutico / PE', 'Figueirense / SC'
];

export const GeradorDezenasView: React.FC<GeradorDezenasViewProps> = ({
  onCreateBolaoWithTickets,
}) => {
  // 1. Lottery selection state
  const [selectedLottery, setSelectedLottery] = useState<LotteryType>('mega-sena');
  const config = LOTTERY_CONFIGS[selectedLottery] || LOTTERY_CONFIGS['mega-sena'];

  // 2. Generation Parameters
  const [numbersCount, setNumbersCount] = useState<number>(config.standardBetCount);
  const [gamesQuantity, setGamesQuantity] = useState<number>(5);
  const [strategy, setStrategy] = useState<'balanced' | 'random' | 'primes_fibonacci' | 'quadrants'>('balanced');
  
  // Fixed & Excluded Numbers
  const [fixedNumbers, setFixedNumbers] = useState<number[]>([]);
  const [excludedNumbers, setExcludedNumbers] = useState<number[]>([]);
  const [activePickerMode, setActivePickerMode] = useState<'none' | 'fixed' | 'excluded'>('none');

  // Special parameters
  const [milionariaTrevosCount, setMilionariaTrevosCount] = useState<number>(2);
  const [fixedTeam, setFixedTeam] = useState<string>('');
  const [fixedMonth, setFixedMonth] = useState<string>('');

  // 3. Confirmation Dialog State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isGeneratingAnim, setIsGeneratingAnim] = useState(false);

  // 4. Generated Tickets List State
  const [generatedTickets, setGeneratedTickets] = useState<GeneratedTicket[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAllSuccess, setCopiedAllSuccess] = useState(false);

  // Synchronize numbersCount when lottery changes
  const handleSelectLottery = (lot: LotteryType) => {
    setSelectedLottery(lot);
    const newCfg = LOTTERY_CONFIGS[lot] || LOTTERY_CONFIGS['mega-sena'];
    setNumbersCount(newCfg.standardBetCount);
    setFixedNumbers([]);
    setExcludedNumbers([]);
    setActivePickerMode('none');
  };

  // Calculations
  const unitGameCost = useMemo(() => {
    return getOfficialGameCost(selectedLottery, numbersCount);
  }, [selectedLottery, numbersCount]);

  const totalEstimatedCost = useMemo(() => {
    return unitGameCost * gamesQuantity;
  }, [unitGameCost, gamesQuantity]);

  const combinationsPerTicket = useMemo(() => {
    return combinations(numbersCount, config.standardBetCount);
  }, [numbersCount, config.standardBetCount]);

  const totalCombinations = useMemo(() => {
    return combinationsPerTicket * gamesQuantity;
  }, [combinationsPerTicket, gamesQuantity]);

  // Handle number click in ball picker
  const handleToggleBall = (num: number) => {
    if (activePickerMode === 'fixed') {
      if (fixedNumbers.includes(num)) {
        setFixedNumbers(fixedNumbers.filter((n) => n !== num));
      } else {
        if (fixedNumbers.length >= numbersCount - 1) {
          alert(`Você só pode fixar no máximo ${numbersCount - 1} dezenas para um jogo de ${numbersCount} dezenas.`);
          return;
        }
        // Remove from excluded if present
        setExcludedNumbers(excludedNumbers.filter((n) => n !== num));
        setFixedNumbers([...fixedNumbers, num].sort((a, b) => a - b));
      }
    } else if (activePickerMode === 'excluded') {
      if (excludedNumbers.includes(num)) {
        setExcludedNumbers(excludedNumbers.filter((n) => n !== num));
      } else {
        const maxExcl = config.totalRange - numbersCount;
        if (excludedNumbers.length >= maxExcl) {
          alert(`Você não pode excluir tantas dezenas. O jogo precisa de pelo menos ${numbersCount} dezenas disponíveis.`);
          return;
        }
        // Remove from fixed if present
        setFixedNumbers(fixedNumbers.filter((n) => n !== num));
        setExcludedNumbers([...excludedNumbers, num].sort((a, b) => a - b));
      }
    }
  };

  // Pre-generate check: opens confirmation modal
  const handleRequestGeneration = () => {
    // Basic validations
    if (numbersCount < config.minNumbers || numbersCount > config.maxNumbers) {
      alert(`Quantidade de dezenas inválida para ${config.name}. Escolha entre ${config.minNumbers} e ${config.maxNumbers}.`);
      return;
    }
    if (gamesQuantity < 1 || gamesQuantity > 100) {
      alert('Por favor, selecione entre 1 e 100 jogos para gerar.');
      return;
    }
    if (fixedNumbers.length >= numbersCount) {
      alert(`A quantidade de dezenas fixas (${fixedNumbers.length}) deve ser menor que a quantidade do volante (${numbersCount}).`);
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Helper generator function for a single ticket
  const generateSingleTicket = (index: number): GeneratedTicket => {
    const availablePool: number[] = [];
    for (let i = 1; i <= config.totalRange; i++) {
      if (!excludedNumbers.includes(i) && !fixedNumbers.includes(i)) {
        availablePool.push(i);
      }
    }

    const chosenNumbers = new Set<number>(fixedNumbers);
    const needed = numbersCount - chosenNumbers.size;

    if (strategy === 'balanced') {
      // Balance even / odd
      const targetEvens = Math.floor(numbersCount / 2);
      let currentEvens = Array.from(chosenNumbers).filter((n) => n % 2 === 0).length;
      
      // Shuffle pool
      const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
      
      for (const num of shuffled) {
        if (chosenNumbers.size >= numbersCount) break;
        const isEven = num % 2 === 0;
        if (isEven && currentEvens < targetEvens) {
          chosenNumbers.add(num);
          currentEvens++;
        } else if (!isEven && (chosenNumbers.size - currentEvens) < (numbersCount - targetEvens)) {
          chosenNumbers.add(num);
        }
      }

      // Fill remaining if needed
      if (chosenNumbers.size < numbersCount) {
        for (const num of shuffled) {
          if (chosenNumbers.size >= numbersCount) break;
          chosenNumbers.add(num);
        }
      }
    } else {
      // Pure Random or Quadrants
      const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
      for (let i = 0; i < needed && i < shuffled.length; i++) {
        chosenNumbers.add(shuffled[i]);
      }
    }

    const sorted = Array.from(chosenNumbers).sort((a, b) => a - b);
    const evenCount = sorted.filter((n) => n % 2 === 0).length;
    const oddCount = sorted.length - evenCount;
    const sum = sorted.reduce((a, b) => a + b, 0);

    // Special picks
    let specialPick: string | undefined = undefined;
    if (selectedLottery === 'milionaria') {
      // Pick 2 random trevos from 1 to 6
      const trevos = new Set<number>();
      while (trevos.size < milionariaTrevosCount) {
        trevos.add(Math.floor(Math.random() * 6) + 1);
      }
      specialPick = `Trevos: ${Array.from(trevos).sort().join(' e ')}`;
    } else if (selectedLottery === 'dia-de-sorte') {
      const month = fixedMonth || MESES_DIA_DE_SORTE[Math.floor(Math.random() * MESES_DIA_DE_SORTE.length)];
      specialPick = `Mês da Sorte: ${month}`;
    } else if (selectedLottery === 'timemania') {
      const team = fixedTeam || TIMES_TIMEMANIA[Math.floor(Math.random() * TIMES_TIMEMANIA.length)];
      specialPick = `Time do Coração: ${team}`;
    }

    return {
      id: `ticket-gen-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      name: `Jogo #${index + 1} • ${config.name}`,
      numbers: sorted,
      numbersCount,
      cost: unitGameCost,
      specialPick,
      evenCount,
      oddCount,
      sum,
    };
  };

  // Perform confirmed generation
  const handleExecuteGeneration = () => {
    setIsGeneratingAnim(true);

    setTimeout(() => {
      const newTickets: GeneratedTicket[] = [];
      for (let i = 0; i < gamesQuantity; i++) {
        newTickets.push(generateSingleTicket(i));
      }
      setGeneratedTickets(newTickets);
      setIsGeneratingAnim(false);
      setIsConfirmModalOpen(false);
    }, 450);
  };

  // Regenerate an individual ticket
  const handleRegenerateIndividualTicket = (ticketId: string, index: number) => {
    const updated = generateSingleTicket(index);
    setGeneratedTickets(generatedTickets.map((t) => (t.id === ticketId ? updated : t)));
  };

  // Delete an individual ticket
  const handleDeleteTicket = (ticketId: string) => {
    setGeneratedTickets(generatedTickets.filter((t) => t.id !== ticketId));
  };

  // Copy individual ticket numbers
  const handleCopyTicket = (ticket: GeneratedTicket) => {
    const formatted = ticket.numbers.map((n) => n.toString().padStart(2, '0')).join(' - ');
    const text = `${ticket.name}: ${formatted}${ticket.specialPick ? ` (${ticket.specialPick})` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(ticket.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy all tickets for WhatsApp
  const handleCopyAllToWhatsApp = () => {
    if (generatedTickets.length === 0) return;

    let text = `🍀 *PALPITES GERADOS - ${config.name.toUpperCase()}*\n`;
    text += `📅 Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `🎯 Dezenas por Volante: ${numbersCount} dezenas\n`;
    text += `🎟️ Total de Jogos: ${generatedTickets.length} (${totalCombinations} apostas simples equiv.)\n`;
    text += `💰 Custo Total Oficial: ${formatCurrency(generatedTickets.length * unitGameCost)}\n\n`;
    text += `*JOGOS REGISTRADOS:*\n`;

    generatedTickets.forEach((t, i) => {
      const nums = t.numbers.map((n) => n.toString().padStart(2, '0')).join(' - ');
      text += `👉 *Jogo ${i + 1}:* [ ${nums} ]`;
      if (t.specialPick) {
        text += ` • _${t.specialPick}_`;
      }
      text += `\n`;
    });

    text += `\n✨ _Palpites gerados pelo Bolão Time da Virada PRO. Registre na sua lotérica oficial!_`;

    navigator.clipboard.writeText(text);
    setCopiedAllSuccess(true);
    setTimeout(() => setCopiedAllSuccess(false), 2500);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (generatedTickets.length === 0) return;

    const pdfItems: GeneratedTicketPDFItem[] = generatedTickets.map((t) => ({
      id: t.id,
      name: t.name,
      numbers: t.numbers,
      numbersCount: t.numbersCount,
      cost: t.cost,
      specialValue: t.specialPick || `${t.evenCount}P / ${t.oddCount}I (Soma: ${t.sum})`,
    }));

    let stratLabel = 'Surpresinha Balanceada';
    if (strategy === 'random') stratLabel = 'Aleatória Uniforme';
    if (strategy === 'primes_fibonacci') stratLabel = 'Filtro Primos & Fibonacci';
    if (strategy === 'quadrants') stratLabel = 'Distribuição por Quadrantes';

    exportGeneratedTicketsPDF({
      lotteryType: selectedLottery,
      lotteryName: config.name,
      numbersCount,
      tickets: pdfItems,
      totalCost: generatedTickets.length * unitGameCost,
      totalCombinations: combinationsPerTicket * generatedTickets.length,
      strategyName: stratLabel,
      fixedNumbers,
      excludedNumbers,
    });
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    window.print();
  };

  // Transfer to new Bolão
  const handleTransferToBolao = () => {
    if (!onCreateBolaoWithTickets || generatedTickets.length === 0) return;

    onCreateBolaoWithTickets({
      lotteryType: selectedLottery,
      tickets: generatedTickets.map((t, idx) => ({
        numbers: t.numbers,
        numbersCount: t.numbersCount,
        cost: t.cost,
        name: `Jogo ${idx + 1} (${t.numbersCount} dezenas)`,
      })),
    });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
              <Dices className="w-3.5 h-3.5" />
              <span>Gerador Oficial de Dezenas & Desdobramentos</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Palpites Inteligentes para Loterias Caixa
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Gere palpites matemáticos para todas as modalidades oficiais da Caixa Econômica Federal.
              Personalize a quantidade de dezenas, dezenas fixas, excluídas e confirme os parâmetros antes de emitir o PDF oficial para impressão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {generatedTickets.length > 0 && (
              <>
                <button
                  onClick={handleExportPDF}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-lg shadow-emerald-900/40 transition flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Baixar PDF dos Palpites</span>
                </button>

                <button
                  onClick={handleDirectPrint}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-2xl border border-white/20 transition flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Configuration */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card: 1. Seleção da Modalidade */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
                  1
                </span>
                <span>Selecione a Modalidade Caixa</span>
              </h3>
              <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${config.bgLight}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }}></span>
                {config.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Object.values(LOTTERY_CONFIGS)
                .filter((l) => l.id !== 'combo' && l.id !== 'personalizado')
                .map((lot) => {
                  const isSelected = selectedLottery === lot.id;
                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => handleSelectLottery(lot.id)}
                      style={{
                        borderColor: isSelected ? lot.color : undefined,
                        backgroundColor: isSelected ? `${lot.color}0d` : undefined,
                      }}
                      className={`p-3 rounded-2xl border text-left transition relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
                        isSelected
                          ? 'ring-2 shadow-sm font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: lot.color }}
                          />
                          <span className="font-black text-xs text-slate-900 truncate">
                            {lot.name}
                          </span>
                        </div>
                        {isSelected && (
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: lot.color }}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-500">
                          Base {lot.standardBetCount}D
                        </span>
                        <span
                          className="font-black px-1.5 py-0.5 rounded-md text-[10px]"
                          style={{
                            color: lot.color,
                            backgroundColor: `${lot.color}15`,
                          }}
                        >
                          {formatCurrency(lot.basePrice)}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Card: 2. Quantidade de Dezenas & Jogos */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
                  2
                </span>
                <span>Dezenas no Volante & Qtd. de Jogos</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500">
                Regra: {config.minNumbers} a {config.maxNumbers} dezenas
              </span>
            </div>

            {/* Dezenas Selector Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Selecione a Quantidade de Dezenas por Aposta:
              </label>
              <div className="flex flex-wrap gap-2">
                {config.priceTable.map((p) => {
                  const isSel = numbersCount === p.numbersCount;
                  return (
                    <button
                      key={p.numbersCount}
                      type="button"
                      onClick={() => {
                        setNumbersCount(p.numbersCount);
                        // Reset fixed numbers if exceed
                        if (fixedNumbers.length >= p.numbersCount) {
                          setFixedNumbers(fixedNumbers.slice(0, p.numbersCount - 1));
                        }
                      }}
                      style={{
                        borderColor: isSel ? config.color : undefined,
                        backgroundColor: isSel ? config.color : undefined,
                        color: isSel ? '#ffffff' : undefined,
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer ${
                        isSel
                          ? 'shadow-md shadow-emerald-600/30'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span>{p.numbersCount} Dezenas</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isSel ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {formatCurrency(p.price)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {numbersCount > config.standardBetCount && (
                <div className="mt-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Aposta Múltipla / Desdobramento:</span>
                  </span>
                  <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-lg text-xs font-black">
                    Equivale a {combinationsPerTicket} apostas simples ({config.standardBetCount}D)
                  </span>
                </div>
              )}
            </div>

            {/* Quantidade de Jogos */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  Quantidade de Palpites/Jogos a Gerar:
                </label>
                <span className="text-xs font-black text-emerald-700">
                  {gamesQuantity} {gamesQuantity === 1 ? 'jogo' : 'jogos'} ({totalCombinations} apostas simples equiv.)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[1, 3, 5, 10, 20, 50].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setGamesQuantity(qty)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                      gamesQuantity === qty
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {qty} {qty === 1 ? 'jogo' : 'jogos'}
                  </button>
                ))}

                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs font-bold text-slate-500">Outro:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={gamesQuantity}
                    onChange={(e) => setGamesQuantity(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                    className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-center font-black text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: 3. Estratégias & Filtros Avançados */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
                  3
                </span>
                <span>Estratégia & Filtros (Fixas / Excluídas)</span>
              </h3>
            </div>

            {/* Strategy radio cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStrategy('balanced')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  strategy === 'balanced'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">⚖️ Surpresinha Balanceada</span>
                  {strategy === 'balanced' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Equilíbrio estatístico de números pares e ímpares, sem sequências excessivas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('random')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  strategy === 'random'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">🎲 Aleatória Pura</span>
                  {strategy === 'random' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Distribuição 100% randômica uniforme em todo o universo da loteria.
                </p>
              </button>
            </div>

            {/* Special Modality Inputs */}
            {selectedLottery === 'milionaria' && (
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs space-y-2">
                <span className="font-black text-sky-950 block">Trevos da +Milionária (1 a 6):</span>
                <div className="flex items-center gap-2">
                  <span className="text-sky-800">Qtd. de Trevos por aposta:</span>
                  {[2, 3, 4, 5, 6].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMilionariaTrevosCount(t)}
                      className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                        milionariaTrevosCount === t
                          ? 'bg-sky-700 text-white'
                          : 'bg-white text-sky-900 border border-sky-200'
                      }`}
                    >
                      {t} Trevos
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedLottery === 'timemania' && (
              <div className="p-3.5 rounded-2xl bg-lime-50 border border-lime-200 text-xs space-y-1.5">
                <label className="font-black text-lime-950 block">Time do Coração (opcional):</label>
                <select
                  value={fixedTeam}
                  onChange={(e) => setFixedTeam(e.target.value)}
                  className="w-full bg-white border border-lime-300 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                >
                  <option value="">Aleatório (Sorteado pela Caixa)</option>
                  {TIMES_TIMEMANIA.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedLottery === 'dia-de-sorte' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                <label className="font-black text-amber-950 block">Mês da Sorte (opcional):</label>
                <select
                  value={fixedMonth}
                  onChange={(e) => setFixedMonth(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                >
                  <option value="">Aleatório (Sorteado pela Caixa)</option>
                  {MESES_DIA_DE_SORTE.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Interactive Ball Picker for Fixed and Excluded */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">Dezenas Fixas e Excluídas:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActivePickerMode(activePickerMode === 'fixed' ? 'none' : 'fixed')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border transition cursor-pointer ${
                      activePickerMode === 'fixed'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    🔒 Fixar Dezenas ({fixedNumbers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePickerMode(activePickerMode === 'excluded' ? 'none' : 'excluded')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border transition cursor-pointer ${
                      activePickerMode === 'excluded'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    🚫 Excluir Dezenas ({excludedNumbers.length})
                  </button>

                  {(fixedNumbers.length > 0 || excludedNumbers.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFixedNumbers([]);
                        setExcludedNumbers([]);
                        setActivePickerMode('none');
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      title="Limpar todas as fixas e excluídas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Active Picker Grid */}
              {activePickerMode !== 'none' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800">
                      {activePickerMode === 'fixed' ? (
                        <span className="text-emerald-700">Clique nas dezenas para FIXAR em todos os jogos:</span>
                      ) : (
                        <span className="text-rose-700">Clique nas dezenas para BLOQUEAR/EXCLUIR dos jogos:</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePickerMode('none')}
                      className="text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-1">
                    {Array.from({ length: config.totalRange }, (_, i) => i + 1).map((num) => {
                      const isFix = fixedNumbers.includes(num);
                      const isExcl = excludedNumbers.includes(num);
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleToggleBall(num)}
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs transition flex items-center justify-center cursor-pointer ${
                            isFix
                              ? 'bg-emerald-600 text-white shadow-xs scale-105'
                              : isExcl
                              ? 'bg-rose-600 text-white line-through shadow-xs scale-105'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {num.toString().padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Primary Action Button: Opens Confirmation Modal */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleRequestGeneration}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-200/80 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <Dices className="w-5 h-5" />
                <span>Gerar {gamesQuantity} Palpites ({numbersCount} dezenas)</span>
              </button>
              <p className="text-[11px] text-center text-slate-500 mt-2 font-medium">
                ⚠️ Você poderá confirmar a quantidade de dezenas e o valor antes da geração.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Summary & Generated Tickets */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card: Live Financial & Equivalence Summary */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-black text-base text-white">{config.name}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full">
                Preço Oficial Caixa
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Dezenas por Jogo
                </span>
                <div className="text-2xl font-black text-white">
                  {numbersCount} <span className="text-xs font-normal text-slate-400">dezenas</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {numbersCount === config.standardBetCount ? 'Aposta Simples' : 'Desdobramento'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Equivalência Simples
                </span>
                <div className="text-2xl font-black text-emerald-300">
                  {totalCombinations} <span className="text-xs font-normal text-slate-400">jogos</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {combinationsPerTicket}x por bilhete
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                  Custo Total ({gamesQuantity} jogos)
                </span>
                <div className="text-2xl font-black text-emerald-400 mt-0.5">
                  {formatCurrency(totalEstimatedCost)}
                </div>
              </div>
              <div className="text-right text-[11px] text-emerald-200">
                <span>{formatCurrency(unitGameCost)} / aposta</span>
              </div>
            </div>
          </div>

          {/* Card: Generated Tickets Display */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Palpites Gerados ({generatedTickets.length})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {generatedTickets.length === 0
                    ? 'Configure os parâmetros e clique em Gerar para ver os bilhetes.'
                    : `Total de ${generatedTickets.length} jogos prontos para registro e impressão.`}
                </p>
              </div>

              {generatedTickets.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllToWhatsApp}
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
                    title="Copiar formatado para WhatsApp"
                  >
                    {copiedAllSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Baixar PDF formatado"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Ticket Cards List */}
            {generatedTickets.length === 0 ? (
              <div className="py-14 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <Dices className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-slate-800">Nenhum palpite gerado ainda</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Escolha a modalidade da Caixa, confirme o número de dezenas e gere seus jogos otimizados.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
                {generatedTickets.map((ticket, index) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-black text-xs text-slate-900">
                          {ticket.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          ({ticket.numbersCount} dezenas)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">
                          {formatCurrency(ticket.cost)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCopyTicket(ticket)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                          title="Copiar dezenas deste jogo"
                        >
                          {copiedId === ticket.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRegenerateIndividualTicket(ticket.id, index)}
                          className="p-1 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-slate-200 transition"
                          title="Sortear novamente este jogo"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteTicket(ticket.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200 transition"
                          title="Excluir este jogo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Ball Numbers */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ticket.numbers.map((num) => {
                        const isFix = fixedNumbers.includes(num);
                        return (
                          <span
                            key={num}
                            style={{
                              backgroundColor: isFix ? config.color : `${config.color}15`,
                              color: isFix ? '#ffffff' : config.color,
                              borderColor: config.color,
                            }}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs flex items-center justify-center border shadow-2xs ${
                              isFix ? 'ring-2 ring-emerald-300' : ''
                            }`}
                          >
                            {num.toString().padStart(2, '0')}
                          </span>
                        );
                      })}
                    </div>

                    {/* Extra details (Special pick, even/odd, sum) */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          ⚖️ {ticket.evenCount} Pares / {ticket.oddCount} Ímpares
                        </span>
                        <span>•</span>
                        <span className="font-semibold">Soma: {ticket.sum}</span>
                      </div>

                      {ticket.specialPick && (
                        <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {ticket.specialPick}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Transfer to Bolão Action Button */}
                {onCreateBolaoWithTickets && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTransferToBolao}
                      className="w-full py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-black text-xs transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Criar Bolão Oficial com estes {generatedTickets.length} Palpites</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Mandatory Confirmation Modal ("Confirme a quantidade de dezenas antes de gerar") */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-6 relative animate-scaleUp">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: config.color }}
              >
                <Dices className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Confirmar Parâmetros de Geração
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Verifique a quantidade de dezenas e o valor antes de prosseguir
                </p>
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-600">Modalidade:</span>
                <span className="font-black text-slate-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }}></span>
                  {config.name}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-600">Dezenas por Volante:</span>
                <span className="font-black text-emerald-700 text-sm bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {numbersCount} dezenas marcadas
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-600">Quantidade de Jogos:</span>
                <span className="font-black text-slate-900">
                  {gamesQuantity} {gamesQuantity === 1 ? 'bilhete' : 'bilhetes'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-600">Equivalência Simples:</span>
                <span className="font-black text-slate-900">
                  {totalCombinations} apostas simples ({config.standardBetCount}D)
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-600">Custo Unitário Caixa:</span>
                <span className="font-black text-slate-900">
                  {formatCurrency(unitGameCost)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="font-black text-slate-900 text-sm">Custo Total Oficial:</span>
                <span className="font-black text-emerald-600 text-base">
                  {formatCurrency(totalEstimatedCost)}
                </span>
              </div>
            </div>

            {/* Notice if multiple bet */}
            {numbersCount > config.standardBetCount && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                <span className="font-black text-amber-950 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Aposta Múltipla Confirmada
                </span>
                <p className="text-[11px] leading-relaxed">
                  Você selecionou <strong>{numbersCount} dezenas</strong> (a aposta simples tem {config.standardBetCount} dezenas). Cada bilhete equivalerá a <strong>{combinationsPerTicket} combinações simples</strong> com múltiplas faixas de premiação.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Ajustar Dezenas
              </button>

              <button
                type="button"
                disabled={isGeneratingAnim}
                onClick={handleExecuteGeneration}
                className="flex-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-emerald-200 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingAnim ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gerando Palpites...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar e Gerar Dezenas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
