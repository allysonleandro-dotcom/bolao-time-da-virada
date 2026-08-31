import React, { useState, useEffect } from 'react';
import { X, Layers, Calculator, CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { Bolao, LotteryType, SystemSettings, TicketGame } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import {
  formatCurrency,
  formatCurrencyNumber,
  parseCurrencyBRL,
  getOfficialGameCost,
  combinations,
} from '../utils/calculator';

interface BolaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bolao: Bolao) => void;
  editingBolao?: Bolao | null;
  settings: SystemSettings;
  simulationPreset?: {
    lotteryType: LotteryType;
    quotaPrice: number;
    totalQuotas: number;
    adminFeePercent: number;
    extraCost: number;
    notes: string;
    tickets: {
      lotteryType?: LotteryType;
      numbersCount: number;
      cost: number;
      quantity?: number;
      numbers?: number[];
    }[];
  } | null;
}

export const BolaoFormModal: React.FC<BolaoFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingBolao,
  settings,
  simulationPreset,
}) => {
  const [lotteryType, setLotteryType] = useState<LotteryType>('mega-sena');
  const [title, setTitle] = useState('');
  const [contestNumber, setContestNumber] = useState('');
  const [drawDate, setDrawDate] = useState('');

  // Calculation Core States (numeric)
  const [calcBase, setCalcBase] = useState<'byGames' | 'byQuotaPrice' | 'byTotalBolao'>('byGames');
  const [dezenas, setDezenas] = useState<number>(6);
  const [gameCount, setGameCount] = useState<number>(10);
  const [totalQuotas, setTotalQuotas] = useState<number>(10);
  const [quotaPrice, setQuotaPrice] = useState<number>(50.0);
  const [totalBolaoValue, setTotalBolaoValue] = useState<number>(500.0);

  // Formatted String Inputs for BRL Currency
  const [quotaPriceInput, setQuotaPriceInput] = useState<string>('50,00');
  const [totalBolaoInput, setTotalBolaoInput] = useState<string>('500,00');
  const [extraCostInput, setExtraCostInput] = useState<string>('0,00');
  const [reserveFundInput, setReserveFundInput] = useState<string>('0,00');

  // Financial Deductions (numeric)
  const [adminFeePercent, setAdminFeePercent] = useState(settings.defaultAdminFeePercent || 0);
  const [adminFeeFixed, setAdminFeeFixed] = useState(0);
  const [extraCost, setExtraCost] = useState(0);
  const [reserveFundAmount, setReserveFundAmount] = useState(0);

  // Organizer Info
  const [pixKeyRecipient, setPixKeyRecipient] = useState(settings.defaultPixKey || '');
  const [organizerName, setOrganizerName] = useState(settings.defaultOrganizerName || '');
  const [notes, setNotes] = useState('');

  // Synchronize internal numeric states to formatted inputs
  const syncInputsFromValues = (quota: number, total: number, extra: number, reserve: number) => {
    setQuotaPrice(quota);
    setTotalBolaoValue(total);
    setExtraCost(extra);
    setReserveFundAmount(reserve);

    setQuotaPriceInput(formatCurrencyNumber(quota));
    setTotalBolaoInput(formatCurrencyNumber(total));
    setExtraCostInput(formatCurrencyNumber(extra));
    setReserveFundInput(formatCurrencyNumber(reserve));
  };

  // Initial populate
  useEffect(() => {
    if (editingBolao) {
      const lot = editingBolao.lotteryType;
      const dez =
        editingBolao.dezenas ||
        editingBolao.tickets?.[0]?.numbersCount ||
        LOTTERY_CONFIGS[lot]?.standardBetCount ||
        6;
      const quotas = editingBolao.totalCotas || editingBolao.totalQuotas || 10;
      const qPrice = editingBolao.quotaPrice || 10;
      const gCount =
        editingBolao.tickets && editingBolao.tickets.length > 0 ? editingBolao.tickets.length : 1;
      const totVal = quotas * qPrice;
      const curExtra = editingBolao.extraCost || 0;
      const curReserve = editingBolao.reserveFundAmount || 0;

      setLotteryType(lot);
      setTitle(editingBolao.title);
      setContestNumber(editingBolao.contestNumber || '');
      setDrawDate(editingBolao.drawDate);
      setTotalQuotas(quotas);
      setDezenas(dez);
      setGameCount(gCount);
      setCalcBase('byQuotaPrice');
      setAdminFeePercent(editingBolao.adminFeePercent || 0);
      setAdminFeeFixed(editingBolao.adminFeeFixed || 0);
      setPixKeyRecipient(editingBolao.pixKeyRecipient || settings.defaultPixKey || '');
      setOrganizerName(editingBolao.organizerName || settings.defaultOrganizerName || '');
      setNotes(editingBolao.notes || '');

      syncInputsFromValues(qPrice, totVal, curExtra, curReserve);
    } else if (simulationPreset) {
      const lot = simulationPreset.lotteryType;
      const dez =
        simulationPreset.tickets?.[0]?.numbersCount ||
        LOTTERY_CONFIGS[lot]?.standardBetCount ||
        6;
      const gCount =
        simulationPreset.tickets?.reduce((acc, t) => acc + (t.quantity || 1), 0) || 1;
      const quotas = simulationPreset.totalQuotas || 10;
      const qPrice = simulationPreset.quotaPrice || 10;
      const totVal = quotas * qPrice;
      const curExtra = simulationPreset.extraCost || 0;

      setLotteryType(lot);
      setTitle(`${LOTTERY_CONFIGS[lot]?.name || 'Bolão'} Especial`);
      setDrawDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
      setTotalQuotas(quotas);
      setDezenas(dez);
      setGameCount(gCount);
      setCalcBase('byGames');
      setAdminFeePercent(simulationPreset.adminFeePercent || 0);
      setAdminFeeFixed(0);
      setPixKeyRecipient(settings.defaultPixKey || '');
      setOrganizerName(settings.defaultOrganizerName || '');
      setNotes(simulationPreset.notes || '');

      syncInputsFromValues(qPrice, totVal, curExtra, 0);
    } else {
      const lot: LotteryType = 'mega-sena';
      const dez = LOTTERY_CONFIGS[lot].standardBetCount;
      const gCount = 10;
      const quotas = 10;
      const singleCost = getOfficialGameCost(lot, dez);
      const totalCost = gCount * singleCost;
      const calculatedQuota = totalCost / quotas;
      const initialQuota = calculatedQuota > 0 ? calculatedQuota : 50.0;
      const initialTotal = totalCost > 0 ? totalCost : 500.0;

      setLotteryType(lot);
      setTitle('Bolão Mega-Sena Especial');
      setContestNumber('');
      setDrawDate(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]);
      setDezenas(dez);
      setGameCount(gCount);
      setTotalQuotas(quotas);
      setCalcBase('byGames');
      setAdminFeePercent(settings.defaultAdminFeePercent || 0);
      setAdminFeeFixed(0);
      setPixKeyRecipient(settings.defaultPixKey || '');
      setOrganizerName(settings.defaultOrganizerName || '');
      setNotes('');

      syncInputsFromValues(initialQuota, initialTotal, 0, 0);
    }
  }, [editingBolao, simulationPreset, settings, isOpen]);

  if (!isOpen) return null;

  const currentConfig = LOTTERY_CONFIGS[lotteryType] || LOTTERY_CONFIGS['mega-sena'];
  const singleGameCost = getOfficialGameCost(lotteryType, dezenas);

  // Available dezenas options for current lottery
  const availableDezenasOptions: number[] = [];
  if (currentConfig) {
    for (let n = currentConfig.minNumbers; n <= currentConfig.maxNumbers; n++) {
      availableDezenasOptions.push(n);
    }
  }

  // Recalculate Quota Price & Total from Games + Deductions
  const recalculateFromGames = (
    currentLottery: LotteryType,
    currentDezenas: number,
    currentGameCount: number,
    currentQuotas: number,
    curAdminFeePct: number,
    curAdminFeeFix: number,
    curExtra: number,
    curReserve: number
  ) => {
    const costPerGame = getOfficialGameCost(currentLottery, currentDezenas);
    const totalGamesCost = Math.max(0, currentGameCount * costPerGame);
    const fixedDeductions = curAdminFeeFix + curExtra + curReserve;

    let grossTotal = totalGamesCost + fixedDeductions;
    if (curAdminFeePct > 0 && curAdminFeePct < 100) {
      grossTotal = (totalGamesCost + fixedDeductions) / (1 - curAdminFeePct / 100);
    }

    const safeQuotas = Math.max(1, currentQuotas);
    const rawPerQuota = grossTotal / safeQuotas;
    const roundedQuota = Math.round(rawPerQuota * 100) / 100;
    const finalTotal = Math.round(roundedQuota * safeQuotas * 100) / 100;

    setTotalBolaoValue(finalTotal);
    setQuotaPrice(roundedQuota);
    setTotalBolaoInput(formatCurrencyNumber(finalTotal));
    setQuotaPriceInput(formatCurrencyNumber(roundedQuota));
  };

  // Handler: Change Lottery Type
  const handleLotteryChange = (newLottery: LotteryType) => {
    setLotteryType(newLottery);
    const config = LOTTERY_CONFIGS[newLottery];
    const newDezenas = config.standardBetCount;
    setDezenas(newDezenas);

    if (!editingBolao) {
      setTitle(`Bolão ${config.name} Especial`);
    }

    if (calcBase === 'byGames') {
      recalculateFromGames(
        newLottery,
        newDezenas,
        gameCount,
        totalQuotas,
        adminFeePercent,
        adminFeeFixed,
        extraCost,
        reserveFundAmount
      );
    } else {
      const newCost = getOfficialGameCost(newLottery, newDezenas);
      const net = Math.max(0, totalBolaoValue - (extraCost + reserveFundAmount + adminFeeFixed));
      const estGames = newCost > 0 ? Math.max(1, Math.floor(net / newCost)) : 1;
      setGameCount(estGames);
    }
  };

  // Handler: Change Dezenas
  const handleDezenasChange = (newDezenas: number) => {
    setDezenas(newDezenas);
    if (calcBase === 'byGames') {
      recalculateFromGames(
        lotteryType,
        newDezenas,
        gameCount,
        totalQuotas,
        adminFeePercent,
        adminFeeFixed,
        extraCost,
        reserveFundAmount
      );
    } else {
      const newCost = getOfficialGameCost(lotteryType, newDezenas);
      const net = Math.max(0, totalBolaoValue - (extraCost + reserveFundAmount + adminFeeFixed));
      const estGames = newCost > 0 ? Math.max(1, Math.floor(net / newCost)) : 1;
      setGameCount(estGames);
    }
  };

  // Handler: Change Game Count
  const handleGameCountChange = (newGameCount: number) => {
    const safeGames = Math.max(1, newGameCount);
    setGameCount(safeGames);
    setCalcBase('byGames');
    recalculateFromGames(
      lotteryType,
      dezenas,
      safeGames,
      totalQuotas,
      adminFeePercent,
      adminFeeFixed,
      extraCost,
      reserveFundAmount
    );
  };

  // Handler: Change Total Quotas
  const handleTotalQuotasChange = (newQuotas: number) => {
    const safeQuotas = Math.max(1, newQuotas);
    setTotalQuotas(safeQuotas);

    if (calcBase === 'byGames') {
      recalculateFromGames(
        lotteryType,
        dezenas,
        gameCount,
        safeQuotas,
        adminFeePercent,
        adminFeeFixed,
        extraCost,
        reserveFundAmount
      );
    } else if (calcBase === 'byTotalBolao') {
      const newQuota = Math.round((totalBolaoValue / safeQuotas) * 100) / 100;
      setQuotaPrice(newQuota);
      setQuotaPriceInput(formatCurrencyNumber(newQuota));
    } else {
      // By Quota Price
      const newTotal = Math.round(safeQuotas * quotaPrice * 100) / 100;
      setTotalBolaoValue(newTotal);
      setTotalBolaoInput(formatCurrencyNumber(newTotal));
    }
  };

  // Handler: Change Quota Price text input
  const handleQuotaPriceInputChange = (rawVal: string) => {
    setQuotaPriceInput(rawVal);
    const parsed = parseCurrencyBRL(rawVal);
    setQuotaPrice(parsed);
    setCalcBase('byQuotaPrice');

    const newTotal = Math.round(totalQuotas * parsed * 100) / 100;
    setTotalBolaoValue(newTotal);
    setTotalBolaoInput(formatCurrencyNumber(newTotal));

    // Re-estimate games count
    const net = Math.max(0, newTotal - (extraCost + reserveFundAmount + adminFeeFixed));
    const estGames = singleGameCost > 0 ? Math.floor(net / singleGameCost) : 0;
    if (estGames > 0) {
      setGameCount(estGames);
    }
  };

  const handleQuotaPriceBlur = () => {
    setQuotaPriceInput(formatCurrencyNumber(quotaPrice));
  };

  // Handler: Change Total Bolão text input
  const handleTotalBolaoInputChange = (rawVal: string) => {
    setTotalBolaoInput(rawVal);
    const parsed = parseCurrencyBRL(rawVal);
    setTotalBolaoValue(parsed);
    setCalcBase('byTotalBolao');

    const safeQuotas = Math.max(1, totalQuotas);
    const newQuota = Math.round((parsed / safeQuotas) * 100) / 100;
    setQuotaPrice(newQuota);
    setQuotaPriceInput(formatCurrencyNumber(newQuota));

    // Re-estimate games count
    const net = Math.max(0, parsed - (extraCost + reserveFundAmount + adminFeeFixed));
    const estGames = singleGameCost > 0 ? Math.floor(net / singleGameCost) : 0;
    if (estGames > 0) {
      setGameCount(estGames);
    }
  };

  const handleTotalBolaoBlur = () => {
    setTotalBolaoInput(formatCurrencyNumber(totalBolaoValue));
  };

  // Handler: Custos Extras
  const handleExtraCostInputChange = (rawVal: string) => {
    setExtraCostInput(rawVal);
    const parsed = parseCurrencyBRL(rawVal);
    setExtraCost(parsed);

    if (calcBase === 'byGames') {
      recalculateFromGames(
        lotteryType,
        dezenas,
        gameCount,
        totalQuotas,
        adminFeePercent,
        adminFeeFixed,
        parsed,
        reserveFundAmount
      );
    }
  };

  const handleExtraCostBlur = () => {
    setExtraCostInput(formatCurrencyNumber(extraCost));
  };

  // Handler: Fundo Reserva
  const handleReserveFundInputChange = (rawVal: string) => {
    setReserveFundInput(rawVal);
    const parsed = parseCurrencyBRL(rawVal);
    setReserveFundAmount(parsed);

    if (calcBase === 'byGames') {
      recalculateFromGames(
        lotteryType,
        dezenas,
        gameCount,
        totalQuotas,
        adminFeePercent,
        adminFeeFixed,
        extraCost,
        parsed
      );
    }
  };

  const handleReserveFundBlur = () => {
    setReserveFundInput(formatCurrencyNumber(reserveFundAmount));
  };

  // Quick Action: Round Quota to next integer
  const handleRoundQuotaUp = () => {
    const rounded = Math.ceil(quotaPrice);
    setQuotaPrice(rounded);
    setQuotaPriceInput(formatCurrencyNumber(rounded));
    setCalcBase('byQuotaPrice');

    const newTotal = Math.round(totalQuotas * rounded * 100) / 100;
    setTotalBolaoValue(newTotal);
    setTotalBolaoInput(formatCurrencyNumber(newTotal));

    const net = Math.max(0, newTotal - (extraCost + reserveFundAmount + adminFeeFixed));
    const estGames = singleGameCost > 0 ? Math.floor(net / singleGameCost) : 0;
    if (estGames > 0) {
      setGameCount(estGames);
    }
  };

  // Quick Action: Sync Bolão to exact games cost (zero leftover)
  const handleFitExactGames = () => {
    setCalcBase('byGames');
    recalculateFromGames(
      lotteryType,
      dezenas,
      gameCount,
      totalQuotas,
      adminFeePercent,
      adminFeeFixed,
      extraCost,
      reserveFundAmount
    );
  };

  // Dynamic calculations for preview
  const currentTotalBolao = totalBolaoValue > 0 ? totalBolaoValue : totalQuotas * quotaPrice;
  const valorTaxaAdmin = adminFeePercent > 0 ? (currentTotalBolao * adminFeePercent) / 100 : 0;
  const totalDeducoes = valorTaxaAdmin + (adminFeeFixed || 0) + (extraCost || 0) + (reserveFundAmount || 0);
  const valorLiquidoJogos = Math.max(0, currentTotalBolao - totalDeducoes);
  const jogosPossiveisCalculados = singleGameCost > 0 ? Math.floor(valorLiquidoJogos / singleGameCost) : 0;
  const totalGastoJogos = (calcBase === 'byGames' ? gameCount : jogosPossiveisCalculados) * singleGameCost;
  const sobraOuTroco = Math.max(0, valorLiquidoJogos - totalGastoJogos);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor, informe um título para o bolão.');
      return;
    }

    let initialTickets: TicketGame[] = editingBolao ? editingBolao.tickets : [];

    // Pre-generate game slots if new bolão
    if (!editingBolao && initialTickets.length === 0) {
      if (simulationPreset?.tickets && simulationPreset.tickets.length > 0) {
        let ticketIdx = 1;
        simulationPreset.tickets.forEach((presetItem) => {
          const tLot = presetItem.lotteryType || (lotteryType !== 'combo' ? lotteryType : 'mega-sena');
          const tCfg = LOTTERY_CONFIGS[tLot] || LOTTERY_CONFIGS['mega-sena'];
          const qty = presetItem.quantity || 1;
          const dezCount = presetItem.numbersCount || tCfg.standardBetCount;
          const unitCost = presetItem.cost || getOfficialGameCost(tLot, dezCount);

          for (let q = 0; q < qty; q++) {
            let finalNumbers: number[] = [];
            if (presetItem.numbers && presetItem.numbers.length > 0) {
              finalNumbers = [...presetItem.numbers].sort((a, b) => a - b);
            } else {
              const numbers = new Set<number>();
              while (numbers.size < dezCount) {
                numbers.add(Math.floor(Math.random() * tCfg.totalRange) + 1);
              }
              finalNumbers = Array.from(numbers).sort((a, b) => a - b);
            }
            initialTickets.push({
              id: `ticket-${Date.now()}-${ticketIdx}`,
              lotteryType: tLot,
              name: `Jogo ${ticketIdx} - ${tCfg.name} (${dezCount} dezenas)`,
              numbersCount: dezCount,
              numbers: finalNumbers,
              cost: unitCost,
            });
            ticketIdx++;
          }
        });
      } else {
        const config = LOTTERY_CONFIGS[lotteryType] || LOTTERY_CONFIGS['mega-sena'];
        const count = calcBase === 'byGames' ? gameCount : Math.max(1, jogosPossiveisCalculados);

        for (let i = 1; i <= count; i++) {
          const numbers = new Set<number>();
          while (numbers.size < dezenas) {
            numbers.add(Math.floor(Math.random() * config.totalRange) + 1);
          }
          initialTickets.push({
            id: `ticket-${Date.now()}-${i}`,
            lotteryType: lotteryType !== 'combo' ? lotteryType : 'mega-sena',
            name: `Jogo ${i} (${dezenas} dezenas)`,
            numbersCount: dezenas,
            numbers: Array.from(numbers).sort((a, b) => a - b),
            cost: singleGameCost,
          });
        }
      }
    }

    const finalQuotas = totalQuotas || 1;
    const finalQuotaPrice = quotaPrice || 10;

    const savedBolao: Bolao = {
      id: editingBolao ? editingBolao.id : `bolao-${lotteryType}-${Date.now()}`,
      title: title.trim(),
      lotteryType,
      contestNumber: contestNumber.trim(),
      drawDate,
      totalQuotas: finalQuotas,
      totalCotas: finalQuotas,
      quotaPrice: finalQuotaPrice,
      dezenas: dezenas || currentConfig.standardBetCount,
      adminFeePercent,
      adminFeeFixed,
      extraCost,
      reserveFundAmount,
      pixKeyRecipient: pixKeyRecipient.trim(),
      organizerName: organizerName.trim(),
      notes: notes.trim(),
      status: editingBolao ? editingBolao.status : 'arrecadando',
      tickets: initialTickets,
      participants: editingBolao ? editingBolao.participants : [],
      drawnNumbers: editingBolao ? editingBolao.drawnNumbers : undefined,
      isDrawn: editingBolao ? editingBolao.isDrawn : false,
      totalPrizeWon: editingBolao ? editingBolao.totalPrizeWon : 0,
      netPrizePerQuota: editingBolao ? editingBolao.netPrizePerQuota : 0,
      createdAt: editingBolao ? editingBolao.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(savedBolao);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {editingBolao ? 'Editar Informações do Bolão' : 'Criar Novo Bolão'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Defina loteria, dezenas por jogo, cotas e cálculos financeiros sincronizados.
              </p>
            </div>
          </div>
          <button
            id="bolao-modal-close-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Modalidade de Loteria */}
          <div>
            <label className="block font-black text-slate-700 mb-2 uppercase text-[10px] tracking-wider">
              Modalidade de Loteria
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Object.values(LOTTERY_CONFIGS).map((lot) => {
                const isSelected = lotteryType === lot.id;
                return (
                  <button
                    type="button"
                    key={lot.id}
                    onClick={() => handleLotteryChange(lot.id)}
                    style={{
                      borderColor: isSelected ? lot.color : undefined,
                      backgroundColor: isSelected ? `${lot.color}15` : undefined,
                      color: isSelected ? lot.color : undefined,
                    }}
                    className={`py-2 px-2 text-center rounded-2xl border font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'ring-2 shadow-xs'
                        : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lot.color }}
                    />
                    <span className="truncate">{lot.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título & Concurso */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Título do Bolão *</label>
              <input
                id="bolao-form-title-input"
                type="text"
                required
                placeholder="Ex: Mega da Virada 2026 - Grupo Amigos"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nº Concurso</label>
              <input
                id="bolao-form-contest-input"
                type="text"
                placeholder="Ex: 2780"
                value={contestNumber}
                onChange={(e) => setContestNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Data do Sorteio, Dezenas por Jogo, Qtd. de Jogos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data do Sorteio</label>
              <input
                id="bolao-form-drawdate-input"
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* Dezenas por Jogo */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Dezenas por Jogo *</span>
                <span className="text-[10px] text-emerald-700 font-extrabold">{formatCurrency(singleGameCost)}</span>
              </label>
              <select
                id="bolao-form-dezenas-select"
                value={dezenas}
                onChange={(e) => handleDezenasChange(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer"
              >
                {availableDezenasOptions.map((num) => {
                  const cost = getOfficialGameCost(lotteryType, num);
                  const isBase = num === currentConfig.standardBetCount;
                  const comb = combinations(num, currentConfig.standardBetCount);
                  return (
                    <option key={num} value={num}>
                      {num} dezenas {isBase ? '(Aposta Simples)' : `(Equivale a ${comb} apostas simples)`} - {formatCurrency(cost)}
                    </option>
                  );
                })}
              </select>
              {dezenas > currentConfig.standardBetCount && (
                <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
                  ⚡ Equivale a {combinations(dezenas, currentConfig.standardBetCount)} jogos simples ({currentConfig.standardBetCount}D) por aposta
                </span>
              )}
            </div>

            {/* Qtd. de Jogos */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Qtd. de Jogos *</span>
                <span className="text-[10px] text-slate-500 font-bold">Total: {formatCurrency(gameCount * singleGameCost)}</span>
              </label>
              <input
                id="bolao-form-gamecount-input"
                type="number"
                min="1"
                required
                value={gameCount}
                onChange={(e) => handleGameCountChange(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-extrabold"
              />
            </div>
          </div>

          {/* Total de Cotas, Valor por Cota, Valor do Bolão com Formatação Nacional BRL (R$) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/70">
            {/* Total de Cotas */}
            <div>
              <label className="block font-bold text-emerald-950 mb-1 flex items-center justify-between">
                <span>Total de Cotas *</span>
              </label>
              <input
                id="bolao-form-totalcotas-input"
                type="number"
                min="1"
                required
                value={totalQuotas}
                onChange={(e) => handleTotalQuotasChange(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 text-center font-black"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">participantes/cotas</span>
            </div>

            {/* Valor por Cota */}
            <div>
              <label className="block font-bold text-emerald-950 mb-1 flex items-center justify-between">
                <span>Valor por Cota *</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 pointer-events-none">
                  R$
                </span>
                <input
                  id="bolao-form-quotaprice-input"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={quotaPriceInput}
                  onChange={(e) => handleQuotaPriceInputChange(e.target.value)}
                  onBlur={handleQuotaPriceBlur}
                  className="w-full bg-white border border-emerald-300 rounded-xl pl-9 pr-3.5 py-2 text-sm text-emerald-800 focus:ring-2 focus:ring-emerald-500 text-center font-black"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">por participante</span>
            </div>

            {/* Valor Total do Bolão */}
            <div>
              <label className="block font-bold text-emerald-950 mb-1 flex items-center justify-between">
                <span>Valor do Bolão *</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                  R$
                </span>
                <input
                  id="bolao-form-totalbolao-input"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={totalBolaoInput}
                  onChange={(e) => handleTotalBolaoInputChange(e.target.value)}
                  onBlur={handleTotalBolaoBlur}
                  className="w-full bg-white border border-emerald-300 rounded-xl pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 text-center font-black"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">arrecadação total</span>
            </div>
          </div>

          {/* PAINEL DINÂMICO DE CÁLCULOS DO BOLÃO */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl p-4 border border-emerald-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-700" />
                <span className="font-black text-emerald-950 text-xs uppercase tracking-wider">
                  Painel de Cálculos Sincronizado
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFitExactGames}
                  title="Ajustar arrecadação exatamente ao custo dos jogos"
                  className="bg-white hover:bg-emerald-100/60 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ajustar aos Jogos</span>
                </button>
                <button
                  type="button"
                  onClick={handleRoundQuotaUp}
                  title="Arredondar cota para valor inteiro superior"
                  className="bg-white hover:bg-emerald-100/60 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3 text-amber-600" />
                  <span>Arredondar Cota</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Valor do Bolão</span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {formatCurrency(currentTotalBolao)}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold block">
                  {totalQuotas} × {formatCurrency(quotaPrice)}
                </span>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Custo / Aposta ({dezenas}D)</span>
                <span className="text-sm sm:text-base font-black text-emerald-700">
                  {formatCurrency(singleGameCost)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">oficial Caixa</span>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Jogos Cobertos</span>
                <span className="text-sm sm:text-base font-black text-blue-700">
                  {gameCount} {gameCount === 1 ? 'jogo' : 'jogos'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {formatCurrency(gameCount * singleGameCost)}
                </span>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Sobra / Reserva</span>
                <span className={`text-sm sm:text-base font-black ${sobraOuTroco > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {formatCurrency(sobraOuTroco)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  {sobraOuTroco > 0 ? 'fundo de reserva' : 'sem sobra'}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-emerald-900 font-medium flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Arrecadação de <strong>{formatCurrency(currentTotalBolao)}</strong> dividida em{' '}
                <strong>{totalQuotas} cotas de {formatCurrency(quotaPrice)}</strong> garante{' '}
                <strong>{gameCount} jogo(s) de {dezenas} dezenas</strong> ({currentConfig.name}).
              </span>
            </div>
          </div>

          {/* Parâmetros Financeiros Opcionais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Taxa Organizador (%)</label>
              <div className="relative">
                <input
                  id="bolao-form-adminfee-input"
                  type="number"
                  min="0"
                  max="50"
                  value={adminFeePercent}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setAdminFeePercent(val);
                    if (calcBase === 'byGames') {
                      recalculateFromGames(
                        lotteryType,
                        dezenas,
                        gameCount,
                        totalQuotas,
                        val,
                        adminFeeFixed,
                        extraCost,
                        reserveFundAmount
                      );
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 text-center font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Custos Extras</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  id="bolao-form-extracost-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={extraCostInput}
                  onChange={(e) => handleExtraCostInputChange(e.target.value)}
                  onBlur={handleExtraCostBlur}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 text-center font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fundo Reserva</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  id="bolao-form-reservefund-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={reserveFundInput}
                  onChange={(e) => handleReserveFundInputChange(e.target.value)}
                  onBlur={handleReserveFundBlur}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 text-center font-bold"
                />
              </div>
            </div>
          </div>

          {/* Organizer Pix & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Chave PIX para Arrecadação
              </label>
              <input
                id="bolao-form-pixkey-input"
                type="text"
                placeholder="Chave que os amigos usarão para pagar"
                value={pixKeyRecipient}
                onChange={(e) => setPixKeyRecipient(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nome do Organizador
              </label>
              <input
                id="bolao-form-organizer-input"
                type="text"
                placeholder="Ex: Allyson Leandro"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Observações / Regras do Bolão
            </label>
            <textarea
              id="bolao-form-notes-input"
              rows={2}
              placeholder="Regras de fechamento, data limite de pagamento, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900"
            ></textarea>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              id="bolao-form-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="bolao-form-submit-btn"
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-2.5 rounded-2xl shadow-md shadow-emerald-200 transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editingBolao ? 'Atualizar Bolão' : 'Salvar e Abrir Bolão'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
