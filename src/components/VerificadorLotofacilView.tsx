import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Camera,
  Eye,
  EyeOff,
  Zap,
  Globe,
  Loader2,
  Upload,
  Plus,
  Edit2,
  Check,
  X,
  Shuffle,
  ChevronDown,
  ChevronUp,
  Sliders,
  DollarSign,
  Star,
} from 'lucide-react';
import { Bolao, Participant, LotteryType, TicketGame, DigitalReceipt } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import {
  formatCurrency,
  formatNumbersList,
  calculateLotteryPrizeMultipliers,
  getDefaultPrizeEstimates,
  getOfficialGameCost,
} from '../utils/calculator';
import { exportBolaoConferencePDF } from '../utils/pdfGenerator';
import { fetchOfficialLotteryResult } from '../services/lotteryOfficialService';
import { ReceiptReferenceViewer } from './ReceiptReferenceViewer';

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

  // Current lottery type
  const currentLotteryType: LotteryType = activeBolao?.lotteryType || 'lotofacil';
  const lotteryConfig = LOTTERY_CONFIGS[currentLotteryType] || LOTTERY_CONFIGS['lotofacil'];

  const totalRange = lotteryConfig.totalRange || 60;
  const standardDrawnCount =
    lotteryConfig.standardBetCount || (currentLotteryType === 'mega-sena' ? 6 : 15);

  // Contest number input
  const [contestNumberInput, setContestNumberInput] = useState<string>(
    activeBolao?.contestNumber || ''
  );

  // 1. PAINEL SUPERIOR: Números Sorteados (Entrada Manual)
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

  // Digitação rápida de dezenas sorteadas
  const [realtimeInputText, setRealtimeInputText] = useState<string>('');

  // Status de conferência acionada
  const [hasCheckedConference, setHasCheckedConference] = useState<boolean>(true);

  // Edição manual das faixas de premiação
  const [prizeValues, setPrizeValues] = useState<Record<number, number>>(() =>
    getDefaultPrizeEstimates(currentLotteryType)
  );
  const [showPrizeEditor, setShowPrizeEditor] = useState<boolean>(false);

  // 2. CADASTRO / ENTRADA MANUAL DE APOSTAS
  const [showAddTicketForm, setShowAddTicketForm] = useState<boolean>(false);
  const [newTicketNumbers, setNewTicketNumbers] = useState<number[]>([]);
  const [newTicketInputText, setNewTicketInputText] = useState<string>('');
  const [newTicketName, setNewTicketName] = useState<string>('');
  const [newTicketNumbersCount, setNewTicketNumbersCount] = useState<number>(standardDrawnCount);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

  // Quick batch generator
  const [showBatchGenerator, setShowBatchGenerator] = useState<boolean>(false);
  const [batchCount, setBatchCount] = useState<number>(5);

  // Official API fetching states
  const [isFetchingOfficial, setIsFetchingOfficial] = useState<boolean>(false);
  const [officialFetchFeedback, setOfficialFetchFeedback] = useState<{
    message: string;
    type: 'success' | 'error';
    contestInfo?: string;
  } | null>(null);

  // Toast indicator
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Visual Reference Viewer
  const [showReceiptViewer, setShowReceiptViewer] = useState<boolean>(false);

  // Scroll ref to results
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // Synchronize when active bolão changes
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
      setNewTicketNumbersCount(lotteryConfig.standardBetCount || standardDrawnCount);
      setNewTicketName(`Jogo ${(activeBolao.tickets?.length || 0) + 1}`);
      setHasCheckedConference(true);
    }
  }, [activeBolao?.id, activeBolao?.lotteryType]);

  // Synchronize string input
  const syncInputTextFromNumbers = (nums: number[]) => {
    setRealtimeInputText(nums.map((n) => String(n).padStart(2, '0')).join(' '));
  };

  // Realtime typed numbers parser for drawn numbers
  const handleRealtimeInputChange = (text: string) => {
    setRealtimeInputText(text);
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

  // Toggle individual ball for drawn numbers
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

  const handleClearDrawnNumbers = () => {
    setDrawnNumbers([]);
    setRealtimeInputText('');
  };

  const handleRandomDrawnNumbers = () => {
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

  // Botão "Conferir Apostas"
  const handleTriggerConference = () => {
    setHasCheckedConference(true);
    if (resultsSectionRef.current) {
      resultsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setSaveSuccessMessage('✓ Apostas conferidas com sucesso com base nas dezenas sorteadas!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Official Caixa Fetch
  const handleFetchOfficialResult = async () => {
    setIsFetchingOfficial(true);
    setOfficialFetchFeedback(null);
    try {
      const result = await fetchOfficialLotteryResult(currentLotteryType, contestNumberInput);
      if (result.success && result.drawnNumbers && result.drawnNumbers.length > 0) {
        setDrawnNumbers(result.drawnNumbers);
        syncInputTextFromNumbers(result.drawnNumbers);
        if (result.contestNumber) {
          setContestNumberInput(result.contestNumber);
        }

        if (result.premiacoes && result.premiacoes.length > 0) {
          const newPrizes: Record<number, number> = { ...prizeValues };
          result.premiacoes.forEach((p: any) => {
            const val = p.valorPremio || p.valor || 0;
            const desc = (p.descricaoFaixa || p.faixaDescricao || '').toLowerCase();
            if (desc.includes('15') || desc.includes('1º')) newPrizes[15] = val || newPrizes[15];
            if (desc.includes('14') || desc.includes('2º')) newPrizes[14] = val || newPrizes[14];
            if (desc.includes('13') || desc.includes('3º')) newPrizes[13] = val || newPrizes[13];
            if (desc.includes('12') || desc.includes('4º')) newPrizes[12] = val || newPrizes[12];
            if (desc.includes('11') || desc.includes('5º')) newPrizes[11] = val || newPrizes[11];
            if (desc.includes('sena') || desc.includes('6 acertos')) newPrizes[6] = val || newPrizes[6];
            if (desc.includes('quina') || desc.includes('5 acertos')) newPrizes[5] = val || newPrizes[5];
            if (desc.includes('quadra') || desc.includes('4 acertos')) newPrizes[4] = val || newPrizes[4];
          });
          setPrizeValues(newPrizes);
        }

        setOfficialFetchFeedback({
          message: `Concurso ${result.contestNumber} importado com sucesso! (${result.drawDate || 'Oficial Caixa'})`,
          type: 'success',
          contestInfo: result.drawDate ? `Data: ${result.drawDate}` : undefined,
        });
        setHasCheckedConference(true);
      } else {
        setOfficialFetchFeedback({
          message: 'Não foi possível obter as dezenas para o concurso informado.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setOfficialFetchFeedback({
        message: err.message || 'Erro ao conectar à API da Caixa.',
        type: 'error',
      });
    } finally {
      setIsFetchingOfficial(false);
      setTimeout(() => setOfficialFetchFeedback(null), 5000);
    }
  };

  // ----------------------------------------------------
  // GESTÃO DE APOSTAS / BILHETES NO BOLÃO
  // ----------------------------------------------------
  const handleOpenAddTicket = (ticketToEdit?: TicketGame) => {
    if (ticketToEdit) {
      setEditingTicketId(ticketToEdit.id);
      setNewTicketName(ticketToEdit.name || 'Jogo');
      setNewTicketNumbersCount(ticketToEdit.numbersCount || ticketToEdit.numbers.length);
      setNewTicketNumbers([...ticketToEdit.numbers].sort((a, b) => a - b));
      setNewTicketInputText(ticketToEdit.numbers.map((n) => String(n).padStart(2, '0')).join(' '));
    } else {
      setEditingTicketId(null);
      setNewTicketName(`Jogo ${(activeBolao?.tickets?.length || 0) + 1}`);
      setNewTicketNumbersCount(standardDrawnCount);
      setNewTicketNumbers([]);
      setNewTicketInputText('');
    }
    setShowAddTicketForm(true);
  };

  const handleToggleNewTicketNumber = (num: number) => {
    let updated: number[];
    if (newTicketNumbers.includes(num)) {
      updated = newTicketNumbers.filter((n) => n !== num).sort((a, b) => a - b);
    } else {
      if (newTicketNumbers.length >= newTicketNumbersCount) return;
      updated = [...newTicketNumbers, num].sort((a, b) => a - b);
    }
    setNewTicketNumbers(updated);
    setNewTicketInputText(updated.map((n) => String(n).padStart(2, '0')).join(' '));
  };

  const handleNewTicketInputChange = (text: string) => {
    setNewTicketInputText(text);
    const matches = text.match(/\d+/g);
    if (!matches) {
      setNewTicketNumbers([]);
      return;
    }
    const parsed: number[] = [];
    for (const m of matches) {
      const num = parseInt(m, 10);
      if (num >= 1 && num <= totalRange && !parsed.includes(num)) {
        parsed.push(num);
        if (parsed.length >= newTicketNumbersCount) break;
      }
    }
    setNewTicketNumbers(parsed.sort((a, b) => a - b));
  };

  const handleRandomNewTicket = () => {
    const all = Array.from({ length: totalRange }, (_, i) => i + 1);
    const shuffled = all.sort(() => 0.5 - Math.random());
    const randomPicked = shuffled.slice(0, newTicketNumbersCount).sort((a, b) => a - b);
    setNewTicketNumbers(randomPicked);
    setNewTicketInputText(randomPicked.map((n) => String(n).padStart(2, '0')).join(' '));
  };

  const handleSaveTicket = () => {
    if (!activeBolao || !onUpdateBolao) return;
    if (newTicketNumbers.length !== newTicketNumbersCount) {
      alert(`Por favor, selecione exatamente ${newTicketNumbersCount} dezenas para este jogo.`);
      return;
    }

    const ticketCost = getOfficialGameCost(currentLotteryType, newTicketNumbersCount);
    let updatedTickets: TicketGame[] = [...(activeBolao.tickets || [])];

    if (editingTicketId) {
      updatedTickets = updatedTickets.map((t) =>
        t.id === editingTicketId
          ? {
              ...t,
              name: newTicketName || t.name,
              numbersCount: newTicketNumbersCount,
              numbers: [...newTicketNumbers].sort((a, b) => a - b),
              cost: ticketCost,
            }
          : t
      );
    } else {
      const newTicket: TicketGame = {
        id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: newTicketName || `Jogo ${updatedTickets.length + 1}`,
        numbersCount: newTicketNumbersCount,
        numbers: [...newTicketNumbers].sort((a, b) => a - b),
        cost: ticketCost,
      };
      updatedTickets.push(newTicket);
    }

    const updatedBolao: Bolao = {
      ...activeBolao,
      tickets: updatedTickets,
    };

    onUpdateBolao(updatedBolao);
    setShowAddTicketForm(false);
    setSaveSuccessMessage(
      editingTicketId ? '✓ Aposta atualizada com sucesso!' : '✓ Nova aposta adicionada ao bolão!'
    );
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (!activeBolao || !onUpdateBolao) return;
    if (!confirm('Deseja realmente remover esta aposta do bolão?')) return;
    const updatedTickets = (activeBolao.tickets || []).filter((t) => t.id !== ticketId);
    const updatedBolao: Bolao = {
      ...activeBolao,
      tickets: updatedTickets,
    };
    onUpdateBolao(updatedBolao);
    setSaveSuccessMessage('✓ Aposta removida do bolão.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Gerador em lote de apostas aleatórias
  const handleGenerateBatch = () => {
    if (!activeBolao || !onUpdateBolao) return;
    const count = Math.min(Math.max(batchCount, 1), 30);
    const newBatch: TicketGame[] = [];
    const baseCount = activeBolao.tickets?.length || 0;

    for (let i = 0; i < count; i++) {
      const all = Array.from({ length: totalRange }, (_, idx) => idx + 1);
      const shuffled = all.sort(() => 0.5 - Math.random());
      const nums = shuffled.slice(0, standardDrawnCount).sort((a, b) => a - b);
      newBatch.push({
        id: `ticket-gen-${Date.now()}-${i}`,
        name: `Jogo ${baseCount + i + 1}`,
        numbersCount: standardDrawnCount,
        numbers: nums,
        cost: getOfficialGameCost(currentLotteryType, standardDrawnCount),
      });
    }

    const updatedBolao: Bolao = {
      ...activeBolao,
      tickets: [...(activeBolao.tickets || []), ...newBatch],
    };
    onUpdateBolao(updatedBolao);
    setShowBatchGenerator(false);
    setSaveSuccessMessage(`✓ ${count} apostas geradas e registradas no bolão!`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // Receipt Management
  const handleAddReceipt = (newReceipt: DigitalReceipt) => {
    if (!activeBolao || !onUpdateBolao) return;
    const updatedReceipts = [newReceipt, ...(activeBolao.digitalReceipts || [])];
    const updatedBolao: Bolao = {
      ...activeBolao,
      digitalReceipts: updatedReceipts,
    };
    onUpdateBolao(updatedBolao);
    setSaveSuccessMessage('✓ Comprovante anexado para consulta visual!');
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleRemoveReceipt = (receiptId: string) => {
    if (!activeBolao || !onUpdateBolao) return;
    const updatedReceipts = (activeBolao.digitalReceipts || []).filter((r) => r.id !== receiptId);
    const updatedBolao: Bolao = {
      ...activeBolao,
      digitalReceipts: updatedReceipts,
    };
    onUpdateBolao(updatedBolao);
  };

  // ----------------------------------------------------
  // 3. CRUZAMENTO DE DADOS E CÁLCULO DE RESULTADOS
  // ----------------------------------------------------
  const ticketsToConfer: TicketGame[] = activeBolao?.tickets || [];

  // Hit thresholds definition for current lottery
  const minWinningTierHits = useMemo(() => {
    const hitsArr = lotteryConfig.prizeTiers
      .map((t) => Number(t.hits))
      .filter((n) => !isNaN(n));
    return hitsArr.length > 0 ? Math.min(...hitsArr) : 4;
  }, [lotteryConfig]);

  const topTierHits = useMemo(() => {
    const hitsArr = lotteryConfig.prizeTiers
      .map((t) => Number(t.hits))
      .filter((n) => !isNaN(n));
    return hitsArr.length > 0 ? Math.max(...hitsArr) : standardDrawnCount;
  }, [lotteryConfig, standardDrawnCount]);

  // Contadores por faixa
  const tierCountSummary: Record<number, number> = {};
  lotteryConfig.prizeTiers.forEach((tier) => {
    const hitsNum = Number(tier.hits);
    if (!isNaN(hitsNum)) {
      tierCountSummary[hitsNum] = 0;
    }
  });

  let totalPrizeWonCalculated = 0;
  let totalWinningTicketsCount = 0;

  // Process tickets conference
  const processedTickets = ticketsToConfer.map((ticket, originalIndex) => {
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
    const isWinner = hitsCount >= minWinningTierHits || ticketPrize > 0;
    if (isWinner) totalWinningTicketsCount++;

    return {
      ticket,
      originalIndex,
      hitsArray,
      hitsCount,
      multipliers,
      prizeThisTicket: ticketPrize,
      isWinner,
    };
  });

  // ORDENAÇÃO: Maiores pontuações / bilhetes premiados no topo!
  const sortedTicketResults = useMemo(() => {
    return [...processedTickets].sort((a, b) => {
      // 1. Sort by hits descending
      if (b.hitsCount !== a.hitsCount) {
        return b.hitsCount - a.hitsCount;
      }
      // 2. Sort by prize won descending
      if (b.prizeThisTicket !== a.prizeThisTicket) {
        return b.prizeThisTicket - a.prizeThisTicket;
      }
      // 3. Keep original index order
      return a.originalIndex - b.originalIndex;
    });
  }, [processedTickets]);

  const totalQuotas = activeBolao?.totalQuotas || 1;
  const prizePerQuota = totalPrizeWonCalculated > 0 ? totalPrizeWonCalculated / totalQuotas : 0;

  // Salvar no Bolão
  const handleSaveToBolao = () => {
    if (!activeBolao || !onUpdateBolao) return;

    const updatedTickets = activeBolao.tickets.map((t, idx) => {
      const res = processedTickets[idx];
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
      `✓ Resultado oficial salvo no bolão "${updatedBolao.title}" com sucesso!`
    );
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Exportar PDF
  const handleExportPDF = () => {
    if (!activeBolao) return;
    const modifiedBolao: Bolao = {
      ...activeBolao,
      contestNumber: contestNumberInput || activeBolao.contestNumber,
      drawnNumbers: drawnNumbers,
      totalPrizeWon: totalPrizeWonCalculated,
      tickets: activeBolao.tickets.map((t, idx) => {
        const res = processedTickets[idx];
        return {
          ...t,
          prizeWonAmount: res?.prizeThisTicket || 0,
        };
      }),
    };
    exportBolaoConferencePDF(modifiedBolao, participants, drawnNumbers);
  };

  // Grid columns for keypad
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
    <div className="space-y-6 pb-16">
      {/* ---------------------------------------------------- */}
      {/* HEADER & BOLÃO SELECTION                             */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs relative overflow-hidden">
        <div
          className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: lotteryConfig.color }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Conferidor Inteligente Multi-Loterias (Manual)</span>
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
              Marque as <strong>{standardDrawnCount} dezenas sorteadas</strong> pelo teclado
              numérico interativo abaixo. O sistema cruza os números com todos os bilhetes
              cadastrados, ordenando os jogos premiados no topo com destaque visual em tempo real.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowReceiptViewer(!showReceiptViewer)}
              className={`rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer border ${
                showReceiptViewer
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showReceiptViewer ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              <span>{showReceiptViewer ? 'Ocultar Bilhete' : 'Ver Comprovante Anexo'}</span>
            </button>

            <button
              onClick={handleSaveToBolao}
              disabled={!activeBolao || drawnNumbers.length === 0}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-400" />
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
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-2xl px-4 py-2.5 font-black text-xs sm:text-sm shadow-2xs transition active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>Baixar PDF</span>
            </button>
          </div>
        </div>

        {/* Save Toast Notification */}
        {saveSuccessMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {/* Official Fetch Feedback Notification */}
        {officialFetchFeedback && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn border shadow-xs ${
              officialFetchFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {officialFetchFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{officialFetchFeedback.message}</span>
            </div>
            {officialFetchFeedback.contestInfo && (
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                {officialFetchFeedback.contestInfo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* BOLÃO SELECTOR & CONCURSO BAR                        */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Bolão Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-800 font-bold text-xs flex items-center gap-1.5 shrink-0">
            <ListFilter className="w-4 h-4 text-emerald-600" />
            <span>Bolão Ativo:</span>
          </div>
          <select
            value={selectedBolaoId}
            onChange={(e) => {
              setSelectedBolaoId(e.target.value);
              if (onSelectBolao) onSelectBolao(e.target.value);
            }}
            className="w-full sm:w-80 md:w-96 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {boloes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} (Conc. {b.contestNumber || 'N/A'}) - {LOTTERY_CONFIGS[b.lotteryType]?.name || b.lotteryType}
              </option>
            ))}
          </select>
        </div>

        {/* Contest Number Input & Official API Fetch Helper */}
        <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500 font-bold">Nº do Concurso:</span>
            <input
              type="text"
              value={contestNumberInput}
              onChange={(e) => setContestNumberInput(e.target.value)}
              placeholder="Ex: 3772"
              className="w-24 font-black text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={handleFetchOfficialResult}
            disabled={isFetchingOfficial}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-3.5 py-2 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Buscar dezenas oficiais no webservice da Caixa"
          >
            {isFetchingOfficial ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Consultando Caixa...</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                <span>Buscar Caixa (Opcional)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visual Reference Receipt Viewer (Optional) */}
      {showReceiptViewer && (
        <ReceiptReferenceViewer
          receipts={activeBolao?.digitalReceipts || []}
          onAddReceipt={handleAddReceipt}
          onRemoveReceipt={handleRemoveReceipt}
          bolaoTitle={activeBolao?.title}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. PAINEL SUPERIOR: ENTRADA MANUAL DOS NÚMEROS       */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-xs"
                style={{ backgroundColor: lotteryConfig.color }}
              >
                1
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Painel Superior: Entrada Manual do Resultado Sorteado
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Marque no teclado as <strong>{standardDrawnCount} dezenas sorteadas</strong> do
              concurso {contestNumberInput ? `#${contestNumberInput}` : ''} ({lotteryConfig.name}).
            </p>
          </div>

          {/* Quick Counter Badge */}
          <div className="flex items-center gap-2">
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border transition ${
                isDrawnComplete
                  ? 'bg-emerald-500/20 text-emerald-800 border-emerald-400 shadow-xs'
                  : 'bg-amber-500/15 text-amber-800 border-amber-400'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isDrawnComplete ? 'bg-emerald-600 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span>
                {drawnNumbers.length} de {standardDrawnCount} dezenas marcadas
              </span>
            </div>
          </div>
        </div>

        {/* Real-time typing & paste helper bar */}
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 text-white flex flex-col md:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={realtimeInputText}
              onChange={(e) => handleRealtimeInputChange(e.target.value)}
              placeholder={`Digite ou cole as dezenas (ex: ${
                currentLotteryType === 'mega-sena'
                  ? '05 12 28 34 45 59'
                  : '01 02 03 05 07 09 11 12 14 15 18 20 21 23 25'
              })`}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
            />
            {drawnNumbers.length > 0 && (
              <button
                onClick={handleClearDrawnNumbers}
                title="Limpar campo"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePasteClipboard}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-400" />
              <span>Colar</span>
            </button>

            <button
              onClick={handleRandomDrawnNumbers}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Aleatório</span>
            </button>
          </div>
        </div>

        {/* Interactive Numeric Keypad Grid (Seletor Visual de Dezenas) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Teclado Numérico Interativo (1 a {totalRange}):
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearDrawnNumbers}
                className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                Limpar Todos
              </button>
            </div>
          </div>

          <div className={`grid ${gridColClass} gap-1.5 sm:gap-2`}>
            {Array.from({ length: totalRange }, (_, i) => i + 1).map((num) => {
              const isSelected = drawnNumbers.includes(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => toggleDrawnNumber(num)}
                  className={`h-11 sm:h-12 rounded-2xl font-black text-sm sm:text-base transition flex items-center justify-center cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-95 ring-2 ring-emerald-400'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {String(num).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Numbers Summary & Conference Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Dezenas Marcadas:
            </span>
            {drawnNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 items-center">
                {drawnNumbers.map((num) => (
                  <span
                    key={num}
                    className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs"
                  >
                    {String(num).padStart(2, '0')}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Nenhum número marcado</span>
            )}
          </div>

          {/* MAIN BUTTON: CONFERIR APOSTAS & LIMPAR */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleClearDrawnNumbers}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition cursor-pointer"
            >
              Limpar
            </button>

            <button
              onClick={handleTriggerConference}
              disabled={drawnNumbers.length === 0}
              className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-200 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Conferir Apostas</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. CADASTRO / ENTRADA MANUAL DOS JOGOS REGISTRADOS   */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-xs"
                style={{ backgroundColor: lotteryConfig.color }}
              >
                2
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Cadastro e Gestão Manual das Apostas do Bolão
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre e gerencie as apostas/bilhetes reais registrados na casa lotérica (
              {ticketsToConfer.length} aposta(s) cadastrada(s)).
            </p>
          </div>

          {/* Action Buttons: Add ticket / Batch generate */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBatchGenerator(!showBatchGenerator)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-500" />
              <span>Gerar em Lote</span>
            </button>

            <button
              onClick={() => handleOpenAddTicket()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Nova Aposta</span>
            </button>
          </div>
        </div>

        {/* Batch Generator Drawer */}
        {showBatchGenerator && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-emerald-600" />
                <span>Gerar apostas aleatórias rápidas ({lotteryConfig.name})</span>
              </span>
              <button
                onClick={() => setShowBatchGenerator(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-bold">Quantidade de jogos:</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                  className="w-16 font-bold text-center border-none bg-transparent focus:outline-none"
                />
              </div>
              <button
                onClick={handleGenerateBatch}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Gerar {batchCount} Jogo(s)
              </button>
            </div>
          </div>
        )}

        {/* ADD / EDIT TICKET FORM (Modal / Inline Expander) */}
        {showAddTicketForm && (
          <div className="p-5 sm:p-6 bg-slate-50 rounded-3xl border-2 border-emerald-300 space-y-5 animate-fadeIn shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-black text-slate-900 uppercase">
                  {editingTicketId ? 'Editar Aposta Registrada' : 'Adicionar Nova Aposta Manual'}
                </h4>
              </div>
              <button
                onClick={() => setShowAddTicketForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome / Identificação da Aposta
                </label>
                <input
                  type="text"
                  value={newTicketName}
                  onChange={(e) => setNewTicketName(e.target.value)}
                  placeholder="Ex: Jogo 1, Bilhete A..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantidade de Dezenas ({lotteryConfig.minNumbers} a {lotteryConfig.maxNumbers})
                </label>
                <select
                  value={newTicketNumbersCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    setNewTicketNumbersCount(count);
                    if (newTicketNumbers.length > count) {
                      setNewTicketNumbers(newTicketNumbers.slice(0, count));
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Array.from(
                    { length: lotteryConfig.maxNumbers - lotteryConfig.minNumbers + 1 },
                    (_, i) => lotteryConfig.minNumbers + i
                  ).map((cnt) => (
                    <option key={cnt} value={cnt}>
                      {cnt} Dezenas (Custo oficial:{' '}
                      {formatCurrency(getOfficialGameCost(currentLotteryType, cnt))})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Typing for New Ticket */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Digite ou Cole as Dezenas deste Jogo:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTicketInputText}
                  onChange={(e) => handleNewTicketInputChange(e.target.value)}
                  placeholder={`Digite ${newTicketNumbersCount} dezenas (ex: 01 02 03 04...)`}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleRandomNewTicket}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  Sortear {newTicketNumbersCount}
                </button>
              </div>
            </div>

            {/* Ball Matrix for New Ticket */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">
                  Ou clique nas dezenas para selecionar ({newTicketNumbers.length}/
                  {newTicketNumbersCount}):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNewTicketNumbers([]);
                    setNewTicketInputText('');
                  }}
                  className="text-rose-600 font-bold hover:underline"
                >
                  Limpar Dezenas
                </button>
              </div>

              <div className={`grid ${gridColClass} gap-1 sm:gap-1.5`}>
                {Array.from({ length: totalRange }, (_, i) => i + 1).map((num) => {
                  const isSelected = newTicketNumbers.includes(num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToggleNewTicketNumber(num)}
                      className={`h-9 sm:h-10 rounded-xl font-bold text-xs transition flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs scale-95 ring-2 ring-emerald-400'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {String(num).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Ticket Action */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddTicketForm(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTicket}
                disabled={newTicketNumbers.length !== newTicketNumbersCount}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Aposta no Bolão</span>
              </button>
            </div>
          </div>
        )}

        {/* Registered Tickets Mini Cards / Overview */}
        {ticketsToConfer.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-700">Nenhuma aposta cadastrada ainda.</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Clique em "Adicionar Nova Aposta" ou "Gerar em Lote" para cadastrar os bilhetes do
              bolão.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ticketsToConfer.map((ticket, idx) => (
              <div
                key={ticket.id}
                className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-2 hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    {ticket.name || `Jogo #${idx + 1}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenAddTicket(ticket)}
                      className="p-1 text-slate-400 hover:text-emerald-700 transition"
                      title="Editar aposta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTicket(ticket.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Excluir aposta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dezenas chips */}
                <div className="flex flex-wrap gap-1">
                  {ticket.numbers.map((n) => (
                    <span
                      key={n}
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center"
                    >
                      {String(n).padStart(2, '0')}
                    </span>
                  ))}
                </div>

                <div className="text-[10px] text-slate-500 font-bold flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span>{ticket.numbersCount || ticket.numbers.length} Dezenas</span>
                  <span>{formatCurrency(ticket.cost || getOfficialGameCost(currentLotteryType, ticket.numbers.length))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. CRUZAMENTO DE DADOS E PAINEL DE BILHETES PREMIADOS */}
      {/* ---------------------------------------------------- */}
      <div
        ref={resultsSectionRef}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-xs"
                style={{ backgroundColor: lotteryConfig.color }}
              >
                3
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Cruzamento de Dados e Bilhetes Premiados
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cruzamento de <strong>{ticketsToConfer.length} aposta(s)</strong> contra as{' '}
              <strong>{drawnNumbers.length} dezenas sorteadas</strong>. Bilhetes premiados no topo.
            </p>
          </div>

          {/* Toggle Prize Value Editor */}
          <button
            onClick={() => setShowPrizeEditor(!showPrizeEditor)}
            className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showPrizeEditor ? 'Ocultar Valores de Premiação' : 'Ajustar Valores das Faixas'}</span>
          </button>
        </div>

        {/* Optional Manual Prize Values Editor */}
        {showPrizeEditor && (
          <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Valores Unitários de Premiação por Faixa ({lotteryConfig.name})</span>
              </span>
              <button
                onClick={() => setPrizeValues(getDefaultPrizeEstimates(currentLotteryType))}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
              >
                Restaurar Padrões
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {lotteryConfig.prizeTiers.map((tier) => {
                const hitsNum = Number(tier.hits);
                const currentVal = prizeValues[hitsNum] || 0;
                return (
                  <div key={tier.hits} className="bg-white p-3 rounded-2xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                      {tier.name} ({tier.hits} pts)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentVal}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPrizeValues((prev) => ({ ...prev, [hitsNum]: val }));
                        }}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RESUMO DO BOLÃO (Top Summary Card Bento Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Prize Won Card */}
          <div className="lg:col-span-6 bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 text-[11px] font-black uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                <span>Resumo Financeiro do Bolão</span>
              </div>
              <div className="pt-2">
                <span className="text-xs text-emerald-200 font-bold block">
                  Premiação Total Conquistada:
                </span>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-1">
                  {formatCurrency(totalPrizeWonCalculated)}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-emerald-600/40 relative z-10 flex items-center justify-between text-xs">
              <div>
                <span className="text-emerald-300 block text-[11px]">Rateio por Cota:</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {formatCurrency(prizePerQuota)} / cota
                </span>
              </div>
              <div className="text-right">
                <span className="text-emerald-300 block text-[11px]">Apostas Premiadas:</span>
                <span className="text-sm font-black text-white">
                  {totalWinningTicketsCount} de {ticketsToConfer.length} jogos
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown by Prize Tiers (Contagem Total de Prêmios) */}
          <div className="lg:col-span-6 bg-slate-50 rounded-3xl p-6 border border-slate-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Contagem de Prêmios por Faixa</span>
              </h4>
              <span className="text-[11px] font-bold text-slate-500">
                {totalWinningTicketsCount} premiado(s)
              </span>
            </div>

            <div className="space-y-2">
              {lotteryConfig.prizeTiers.map((tier) => {
                const count = tierCountSummary[tier.hits] || 0;
                const unitPrize = prizeValues[tier.hits] || 0;
                const tierTotal = count * unitPrize;
                const hasWon = count > 0;

                return (
                  <div
                    key={tier.hits}
                    className={`p-2.5 rounded-2xl border transition flex items-center justify-between text-xs ${
                      hasWon
                        ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950 font-black shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          hasWon ? 'bg-emerald-600 animate-pulse' : 'bg-slate-300'
                        }`}
                      />
                      <span className="font-bold">{tier.name}:</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({formatCurrency(unitPrize)} cada)
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                          hasWon ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {count} jogo(s)
                      </span>
                      {tierTotal > 0 && (
                        <span className="text-xs font-black text-emerald-800">
                          {formatCurrency(tierTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* LISTA DE BILHETES ORDENADOS POR PONTUAÇÃO (PREMIADOS NO TOPO) */}
        {/* ---------------------------------------------------- */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Apostas Ordenadas por Pontuação (Premiados no Topo)</span>
            </h4>
            <span className="text-xs font-bold text-slate-500">
              {sortedTicketResults.length} bilhete(s) conferido(s)
            </span>
          </div>

          {sortedTicketResults.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">
                Nenhum bilhete cadastrado para conferir neste bolão.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {sortedTicketResults.map(
                ({ ticket, originalIndex, hitsArray, hitsCount, prizeThisTicket, multipliers, isWinner }) => {
                  const sortedNums = [...ticket.numbers].sort((a, b) => a - b);
                  const isTopWinner = hitsCount >= topTierHits;

                  return (
                    <div
                      key={ticket.id || originalIndex}
                      className={`p-4 sm:p-5 rounded-3xl border-2 transition relative overflow-hidden ${
                        isTopWinner
                          ? 'bg-gradient-to-r from-amber-50 via-yellow-50/50 to-white border-amber-400 shadow-md shadow-amber-200/50 ring-2 ring-amber-300'
                          : isWinner
                          ? 'bg-emerald-50/60 border-emerald-400 shadow-sm ring-1 ring-emerald-300'
                          : 'bg-slate-50/70 border-slate-200 opacity-80'
                      }`}
                    >
                      {/* Top status bar of ticket */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                            {ticket.name || `Jogo #${originalIndex + 1}`}
                          </span>

                          <span className="text-xs font-bold text-slate-600">
                            {ticket.numbersCount || ticket.numbers.length} Dezenas
                          </span>

                          {/* PREMIADO BADGE HIGHLIGHT */}
                          {isWinner && (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs ${
                                isTopWinner
                                  ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                                  : 'bg-emerald-600 text-white font-black'
                              }`}
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              <span>PREMIADO</span>
                            </span>
                          )}
                        </div>

                        {/* Hits Counter & Prize Amount */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs sm:text-sm font-black px-3.5 py-1 rounded-xl flex items-center gap-1.5 ${
                              isTopWinner
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : isWinner
                                ? 'bg-emerald-200 text-emerald-950'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span>🎯 {hitsCount} Acertos</span>
                          </span>

                          {prizeThisTicket > 0 && (
                            <span className="text-xs sm:text-sm font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl">
                              + {formatCurrency(prizeThisTicket)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Number Balls with VISUAL HIGHLIGHT IN GREEN / GOLD ON HITS */}
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {sortedNums.map((n) => {
                          const isHit = drawnNumbers.includes(n);
                          return (
                            <span
                              key={n}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center transition ${
                                isHit
                                  ? isTopWinner
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-300 scale-105 ring-2 ring-amber-300'
                                    : 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-105 ring-2 ring-emerald-300'
                                  : 'bg-white text-slate-700 border border-slate-200'
                              }`}
                            >
                              {String(n).padStart(2, '0')}
                            </span>
                          );
                        })}
                      </div>

                      {/* Multiple bet award details if multiple hits */}
                      {(ticket.numbersCount || ticket.numbers.length) > standardDrawnCount && isWinner && (
                        <div className="mt-3 pt-2.5 border-t border-emerald-200 text-[11px] text-emerald-900 font-bold flex flex-wrap items-center gap-2">
                          <span className="text-slate-500 font-normal">
                            Desdobramento de premiações múltiplas:
                          </span>
                          {Object.entries(multipliers)
                            .filter(([_, count]) => Number(count) > 0)
                            .map(([hits, count]) => {
                              const tier = lotteryConfig.prizeTiers.find((t) => t.hits === Number(hits));
                              return (
                                <span
                                  key={hits}
                                  className="bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-300"
                                >
                                  {count}x {tier?.name || `${hits} acertos`}
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Total conferido: <strong>{ticketsToConfer.length} bilhete(s)</strong> • Premiação total:{' '}
            <strong className="text-emerald-600">{formatCurrency(totalPrizeWonCalculated)}</strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleSaveToBolao}
              disabled={!activeBolao || drawnNumbers.length === 0}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-5 py-3 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-200 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Salvar no Bolão</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-5 py-3 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Baixar Relatório PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
