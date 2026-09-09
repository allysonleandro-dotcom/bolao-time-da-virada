import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  Layers,
  HelpCircle,
  Trophy,
  Edit3,
  RotateCcw,
  Check,
  ClipboardPaste,
  Save,
} from 'lucide-react';
import { LotteryType } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { combinations, formatCurrency, formatCurrencyNumber, parseCurrencyBRL, getOfficialGameCost } from '../utils/calculator';
import { CustomPriceTable, loadCustomPrices, saveCustomPrices } from '../utils/storage';

interface CalculadoraViewProps {
  onCreateBolaoFromSimulation: (simulationData: {
    lotteryType: LotteryType;
    quotaPrice: number;
    totalQuotas: number;
    adminFeePercent: number;
    extraCost: number;
    notes: string;
    tickets: { lotteryType?: LotteryType; numbersCount: number; cost: number; quantity: number }[];
  }) => void;
}

interface GameMixItem {
  id: string;
  lotteryType?: LotteryType;
  numbersCount: number;
  quantity: number;
}

export const CalculadoraView: React.FC<CalculadoraViewProps> = ({
  onCreateBolaoFromSimulation,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'simulador' | 'tabelas' | 'rateio_rapido'>('simulador');

  // Simulator state
  const [selectedLottery, setSelectedLottery] = useState<LotteryType>('mega-sena');
  const [gameMix, setGameMix] = useState<GameMixItem[]>([
    { id: '1', lotteryType: 'mega-sena', numbersCount: 9, quantity: 1 },
    { id: '2', lotteryType: 'mega-sena', numbersCount: 8, quantity: 1 },
    { id: '3', lotteryType: 'mega-sena', numbersCount: 6, quantity: 113 },
  ]);
  const [targetQuotas, setTargetQuotas] = useState(45);
  const [adminFeePercent, setAdminFeePercent] = useState(0);
  const [extraCost, setExtraCost] = useState(0);
  const [extraCostInput, setExtraCostInput] = useState('0,00');
  const [reserveFund, setReserveFund] = useState(0);

  // Load preset from shared spreadsheet or Multi-lottery Combos
  const handleLoadSpreadsheetPreset = (presetType: 'regular_25' | 'indep_60' | 'indep_39' | 'combo_milionario' | 'combo_diario' | 'combo_mega_loto' | 'combo_fds') => {
    if (presetType === 'regular_25') {
      setSelectedLottery('mega-sena');
      setGameMix([
        { id: '1', lotteryType: 'mega-sena', numbersCount: 9, quantity: 1 }, // 504.00
        { id: '2', lotteryType: 'mega-sena', numbersCount: 8, quantity: 1 }, // 168.00
        { id: '3', lotteryType: 'mega-sena', numbersCount: 6, quantity: 113 }, // 678.00
      ]);
      setTargetQuotas(45);
      setAdminFeePercent(0);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    } else if (presetType === 'indep_60') {
      setSelectedLottery('lotofacil');
      setGameMix([
        { id: '1', lotteryType: 'lotofacil', numbersCount: 18, quantity: 1 }, // 2856.00 (1 aposta de 18 dezenas)
      ]);
      setTargetQuotas(50);
      setAdminFeePercent(0);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    } else if (presetType === 'indep_39') {
      setSelectedLottery('lotofacil');
      setGameMix([
        { id: '1', lotteryType: 'lotofacil', numbersCount: 17, quantity: 3 }, // 3 x 476.00 = 1428.00 (3 apostas de 17 dezenas)
      ]);
      setTargetQuotas(40);
      setAdminFeePercent(0);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    } else if (presetType === 'combo_milionario') {
      setSelectedLottery('combo');
      setGameMix([
        { id: '1', lotteryType: 'mega-sena', numbersCount: 8, quantity: 1 }, // 140.00
        { id: '2', lotteryType: 'lotofacil', numbersCount: 17, quantity: 1 }, // 408.00
        { id: '3', lotteryType: 'quina', numbersCount: 7, quantity: 1 }, // 52.50
        { id: '4', lotteryType: 'milionaria', numbersCount: 6, quantity: 1 }, // 6.00
      ]);
      setTargetQuotas(30);
      setAdminFeePercent(10);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    } else if (presetType === 'combo_diario') {
      setSelectedLottery('combo');
      setGameMix([
        { id: '1', lotteryType: 'lotofacil', numbersCount: 16, quantity: 2 }, // 2 x 48.00 = 96.00
        { id: '2', lotteryType: 'quina', numbersCount: 6, quantity: 3 }, // 3 x 15.00 = 45.00
        { id: '3', lotteryType: 'dia-de-sorte', numbersCount: 8, quantity: 2 }, // 2 x 20.00 = 40.00
      ]);
      setTargetQuotas(20);
      setAdminFeePercent(10);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    } else if (presetType === 'combo_mega_loto') {
      setSelectedLottery('combo');
      setGameMix([
        { id: '1', lotteryType: 'lotofacil', numbersCount: 18, quantity: 1 }, // 2448.00
        { id: '2', lotteryType: 'mega-sena', numbersCount: 7, quantity: 2 }, // 2 x 35.00 = 70.00
      ]);
      setTargetQuotas(50);
      setAdminFeePercent(5);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    } else if (presetType === 'combo_fds') {
      setSelectedLottery('combo');
      setGameMix([
        { id: '1', lotteryType: 'mega-sena', numbersCount: 8, quantity: 1 }, // 140.00
        { id: '2', lotteryType: 'dupla-sena', numbersCount: 7, quantity: 2 }, // 2 x 17.50 = 35.00
        { id: '3', lotteryType: 'dia-de-sorte', numbersCount: 8, quantity: 2 }, // 2 x 20.00 = 40.00
      ]);
      setTargetQuotas(25);
      setAdminFeePercent(10);
      setExtraCost(0);
      setExtraCostInput('0,00');
      setReserveFund(0);
    }
  };

  // Quick Prize Split Simulator State
  const [quickGrossPrize, setQuickGrossPrize] = useState(50000);
  const [quickGrossPrizeInput, setQuickGrossPrizeInput] = useState('50.000,00');
  const [quickQuotasCount, setQuickQuotasCount] = useState(10);
  const [quickAdminFee, setQuickAdminFee] = useState(10);

  // Custom Price Table Manager State
  const [customPrices, setCustomPrices] = useState<CustomPriceTable>(() => loadCustomPrices());
  const [pastedCSV, setPastedCSV] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const config = LOTTERY_CONFIGS[selectedLottery] || LOTTERY_CONFIGS['mega-sena'];

  // Current active price table (with custom overrides applied)
  const currentBasePrice = customPrices[selectedLottery]?.basePrice ?? config.basePrice;
  const [basePriceInput, setBasePriceInput] = useState<string>(() => formatCurrencyNumber(currentBasePrice));

  // Sync formatted base price whenever selectedLottery or stored basePrice changes
  useEffect(() => {
    setBasePriceInput(formatCurrencyNumber(currentBasePrice));
  }, [selectedLottery, currentBasePrice]);

  const currentPriceTable = config.priceTable.map((item) => {
    const customEntry = customPrices[selectedLottery]?.customTable?.find((p) => p.numbersCount === item.numbersCount);
    if (customEntry) {
      return { ...item, price: customEntry.price };
    }
    if (customPrices[selectedLottery]?.basePrice && customPrices[selectedLottery]?.basePrice !== config.basePrice) {
      return { ...item, price: item.combinations * currentBasePrice };
    }
    return item;
  });

  // Handler: Update base price of a lottery and recalculate all combinations
  const handleUpdateBasePrice = (newBasePrice: number) => {
    const updated = {
      ...customPrices,
      [selectedLottery]: {
        ...customPrices[selectedLottery],
        basePrice: newBasePrice,
      },
    };
    setCustomPrices(updated);
    saveCustomPrices(updated);
    showFeedback('Preço base atualizado e desdobramentos recalculados!');
  };

  const handleBasePriceBlur = () => {
    const parsed = parseCurrencyBRL(basePriceInput);
    if (parsed > 0 && parsed !== currentBasePrice) {
      handleUpdateBasePrice(parsed);
      setBasePriceInput(formatCurrencyNumber(parsed));
    } else {
      setBasePriceInput(formatCurrencyNumber(currentBasePrice));
    }
  };

  // Handler: Update individual row price
  const handleUpdateRowPrice = (numbersCount: number, newPrice: number) => {
    const existingTable = customPrices[selectedLottery]?.customTable || [...currentPriceTable];
    const itemIndex = existingTable.findIndex((p) => p.numbersCount === numbersCount);
    let updatedTable = [...existingTable];

    if (itemIndex >= 0) {
      updatedTable[itemIndex] = { ...updatedTable[itemIndex], price: newPrice };
    } else {
      const standardComb = combinations(numbersCount, config.standardBetCount);
      updatedTable.push({ numbersCount, price: newPrice, combinations: standardComb });
    }

    const updated = {
      ...customPrices,
      [selectedLottery]: {
        ...customPrices[selectedLottery],
        customTable: updatedTable,
      },
    };
    setCustomPrices(updated);
    saveCustomPrices(updated);
    showFeedback(`Preço de ${numbersCount} dezenas atualizado para ${formatCurrency(newPrice)}!`);
  };

  // Handler: Reset prices back to Caixa standard
  const handleResetPrices = () => {
    const updated = { ...customPrices };
    delete updated[selectedLottery];
    setCustomPrices(updated);
    saveCustomPrices(updated);
    showFeedback('Preços restaurados para o padrão oficial Caixa!');
  };

  // Handler: Parse and apply pasted CSV / Spreadsheet data
  const handleParseAndApplyPastedCSV = () => {
    if (!pastedCSV.trim()) return;

    const lines = pastedCSV.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsedRows: { numbersCount: number; price: number; combinations: number }[] = [];

    for (const line of lines) {
      // Split by tab, semicolon or comma
      const parts = line.split(/[\t;,]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      // Extract numbers count (e.g. "6", "6 dezenas", "8 Jogos")
      const numMatch = parts[0].match(/\d+/);
      // Extract price (e.g. "5,00", "R$ 5.00", "140,00")
      const priceClean = parts[1].replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim();
      const parsedPrice = parseFloat(priceClean);

      if (numMatch && !isNaN(parsedPrice) && parsedPrice > 0) {
        const count = parseInt(numMatch[0], 10);
        const comb = combinations(count, config.standardBetCount);
        parsedRows.push({
          numbersCount: count,
          price: parsedPrice,
          combinations: comb,
        });
      }
    }

    if (parsedRows.length > 0) {
      const updated = {
        ...customPrices,
        [selectedLottery]: {
          ...customPrices[selectedLottery],
          customTable: parsedRows,
        },
      };
      setCustomPrices(updated);
      saveCustomPrices(updated);
      setPastedCSV('');
      setShowPasteBox(false);
      showFeedback(`${parsedRows.length} preços importados da planilha com sucesso!`);
    } else {
      alert('Não foi possível identificar as colunas de dezenas e preços. Verifique o formato colado (ex: "6 dezenas	5,00" ou "15; 3,00").');
    }
  };

  const showFeedback = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Calculate simulator totals
  const totalGamesCost = gameMix.reduce((acc, item) => {
    const lot = item.lotteryType || (selectedLottery !== 'combo' ? selectedLottery : 'mega-sena');
    const unitCost = getOfficialGameCost(lot, item.numbersCount);
    return acc + unitCost * (item.quantity || 1);
  }, 0);

  const totalCombinations = gameMix.reduce((acc, item) => {
    const lot = item.lotteryType || (selectedLottery !== 'combo' ? selectedLottery : 'mega-sena');
    const cfg = LOTTERY_CONFIGS[lot] || LOTTERY_CONFIGS['mega-sena'];
    const comb = combinations(item.numbersCount, cfg.standardBetCount);
    return acc + comb * (item.quantity || 1);
  }, 0);

  const totalTicketsCount = gameMix.reduce((acc, item) => acc + (item.quantity || 1), 0);

  // Group breakdown by modality
  const modalityBreakdown = React.useMemo(() => {
    const map = new Map<LotteryType, { quantity: number; cost: number; combinations: number; itemsCount: number }>();
    for (const item of gameMix) {
      const lot = item.lotteryType || (selectedLottery !== 'combo' ? selectedLottery : 'mega-sena');
      const cfg = LOTTERY_CONFIGS[lot] || LOTTERY_CONFIGS['mega-sena'];
      const unitCost = getOfficialGameCost(lot, item.numbersCount);
      const comb = combinations(item.numbersCount, cfg.standardBetCount);
      const prev = map.get(lot) || { quantity: 0, cost: 0, combinations: 0, itemsCount: 0 };
      map.set(lot, {
        quantity: prev.quantity + (item.quantity || 1),
        cost: prev.cost + unitCost * (item.quantity || 1),
        combinations: prev.combinations + comb * (item.quantity || 1),
        itemsCount: prev.itemsCount + 1,
      });
    }
    return Array.from(map.entries()).map(([lType, data]) => ({
      lotteryType: lType,
      config: LOTTERY_CONFIGS[lType] || LOTTERY_CONFIGS['mega-sena'],
      ...data,
    }));
  }, [gameMix, selectedLottery]);

  const adminFeeAmount = (totalGamesCost * (adminFeePercent || 0)) / 100;
  const totalExpenses = totalGamesCost + extraCost + reserveFund + adminFeeAmount;

  const rawQuotaPrice = targetQuotas > 0 ? totalExpenses / targetQuotas : 0;
  const roundedQuotaPrice = Math.ceil(rawQuotaPrice * 10) / 10;
  const totalRevenue = targetQuotas * roundedQuotaPrice;
  const netBalance = totalRevenue - (totalGamesCost + extraCost);

  // Add game mix item
  const handleAddGameMix = () => {
    const defaultLot = selectedLottery !== 'combo' ? selectedLottery : 'lotofacil';
    const cfg = LOTTERY_CONFIGS[defaultLot] || LOTTERY_CONFIGS['mega-sena'];
    setGameMix([
      ...gameMix,
      {
        id: String(Date.now()),
        lotteryType: defaultLot,
        numbersCount: cfg.standardBetCount,
        quantity: 1,
      },
    ]);
  };

  // Remove game mix item
  const handleRemoveGameMix = (id: string) => {
    setGameMix(gameMix.filter((g) => g.id !== id));
  };

  // Update game mix item
  const handleUpdateGameMix = (id: string, field: 'lotteryType' | 'numbersCount' | 'quantity', value: any) => {
    setGameMix(
      gameMix.map((g) => {
        if (g.id === id) {
          if (field === 'lotteryType') {
            const nextLot = value as LotteryType;
            const nextCfg = LOTTERY_CONFIGS[nextLot] || LOTTERY_CONFIGS['mega-sena'];
            return {
              ...g,
              lotteryType: nextLot,
              numbersCount: nextCfg.standardBetCount,
            };
          }
          return { ...g, [field]: Math.max(1, value) };
        }
        return g;
      })
    );
  };

  // Create bolão from this simulation
  const handleTransferToBolao = () => {
    const isComboMode =
      selectedLottery === 'combo' ||
      modalityBreakdown.length > 1;

    const formattedTickets = gameMix.map((item) => {
      const itemLot = item.lotteryType || (selectedLottery !== 'combo' ? selectedLottery : 'mega-sena');
      return {
        lotteryType: itemLot,
        numbersCount: item.numbersCount,
        cost: getOfficialGameCost(itemLot, item.numbersCount),
        quantity: item.quantity,
      };
    });

    const targetLotteryType = isComboMode ? 'combo' : selectedLottery;

    onCreateBolaoFromSimulation({
      lotteryType: targetLotteryType,
      quotaPrice: roundedQuotaPrice,
      totalQuotas: targetQuotas,
      adminFeePercent,
      extraCost,
      notes: isComboMode
        ? `Super Combo com ${totalTicketsCount} apostas em ${modalityBreakdown.length} modalidades (${totalCombinations} combinações simples equivalentes).`
        : `Simulação com ${totalTicketsCount} apostas (equivalente a ${totalCombinations} combinações).`,
      tickets: formattedTickets,
    });
  };

  // Quick prize split calculations
  const quickFeeAmount = (quickGrossPrize * (quickAdminFee || 0)) / 100;
  const quickNetPrize = Math.max(0, quickGrossPrize - quickFeeAmount);
  const quickNetPerQuota = quickQuotasCount > 0 ? quickNetPrize / quickQuotasCount : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Calculator className="w-7 h-7 text-emerald-600" />
          <span>Calculadora <span className="text-emerald-600 underline decoration-4 underline-offset-4">Personalizada</span> de Bolões</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
          Simule desdobramentos, custos oficiais da Caixa, precifique cotas com margem de segurança e calcule rateio de prêmios.
        </p>
      </div>

      {/* Bento Sub tabs */}
      <div className="flex flex-wrap bg-slate-200/70 p-1.5 rounded-2xl w-fit text-xs font-black gap-1">
        <button
          onClick={() => setActiveSubTab('simulador')}
          className={`px-4 py-2.5 rounded-xl transition ${
            activeSubTab === 'simulador'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Simulador de Bolão & Cotas
        </button>
        <button
          onClick={() => setActiveSubTab('tabelas')}
          className={`px-4 py-2.5 rounded-xl transition ${
            activeSubTab === 'tabelas'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tabela Oficial Caixa & Probabilidades
        </button>
        <button
          onClick={() => setActiveSubTab('rateio_rapido')}
          className={`px-4 py-2.5 rounded-xl transition ${
            activeSubTab === 'rateio_rapido'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Rateio Rápido de Premiação
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: SIMULADOR DE BOLÃO */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Inputs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Quick Presets from Shared Spreadsheet and Multi-Modality Combos */}
            <div className="bg-emerald-950 text-white rounded-3xl border border-emerald-800 p-6 sm:p-7 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-xs font-black text-emerald-200 uppercase tracking-wider">
                    Modelos Rápidos & Combos Multi-Modalidades
                  </h3>
                </div>
                <span className="text-[10px] font-black uppercase bg-emerald-800/80 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-700">
                  Preços Oficiais Caixa
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Carregue instantaneamente a composição exata, número de cotas e valores de bolões simples ou combos multi-loterias:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('regular_25')}
                  className="p-3 rounded-2xl bg-white/10 hover:bg-emerald-600 border border-white/10 hover:border-emerald-400 text-left transition group active:scale-95 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[10px] font-black text-emerald-400 group-hover:text-emerald-100 uppercase">
                      Mega-Sena
                    </div>
                    <div className="font-black text-xs text-white mt-0.5">
                      Bolão Regular (9D+8D+6D)
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-black text-emerald-300 group-hover:text-white">
                      R$ 25,00 <span className="text-[10px] font-normal text-slate-300">/ 45 cotas</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium">
                      Total: R$ 1.125,00
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('indep_60')}
                  className="p-3 rounded-2xl bg-white/10 hover:bg-purple-600 border border-white/10 hover:border-purple-400 text-left transition group active:scale-95 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[10px] font-black text-purple-300 group-hover:text-purple-100 uppercase">
                      Lotofácil
                    </div>
                    <div className="font-black text-xs text-white mt-0.5">
                      Independência 1 (18 dezenas)
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-black text-purple-200 group-hover:text-white">
                      R$ 60,00 <span className="text-[10px] font-normal text-slate-300">/ 50 cotas</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium">
                      Total: R$ 3.000,00
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('indep_39')}
                  className="p-3 rounded-2xl bg-white/10 hover:bg-indigo-600 border border-white/10 hover:border-indigo-400 text-left transition group active:scale-95 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[10px] font-black text-indigo-300 group-hover:text-indigo-100 uppercase">
                      Lotofácil
                    </div>
                    <div className="font-black text-xs text-white mt-0.5">
                      Independência 2 (3x 17D)
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-black text-indigo-200 group-hover:text-white">
                      R$ 39,00 <span className="text-[10px] font-normal text-slate-300">/ 40 cotas</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium">
                      Total: R$ 1.560,00
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('combo_milionario')}
                  className="p-3 rounded-2xl bg-gradient-to-br from-purple-900/60 to-indigo-900/60 hover:from-purple-600 hover:to-indigo-600 border border-purple-400/30 hover:border-purple-300 text-left transition group active:scale-95 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[10px] font-black text-amber-300 group-hover:text-amber-100 uppercase flex items-center gap-1">
                      <span>👑 Super Combo</span>
                    </div>
                    <div className="font-black text-xs text-white mt-0.5">
                      Mega(8D) + Loto(17D) + Quina(7D)
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-black text-amber-300 group-hover:text-white">
                      R$ 22,50 <span className="text-[10px] font-normal text-slate-300">/ 30 cotas</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium">
                      Multi-loterias (4 jogos)
                    </div>
                  </div>
                </button>
              </div>

              {/* Extra Combo presets chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-900/60 text-[11px]">
                <span className="text-emerald-400 font-bold">Mais Combos:</span>
                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('combo_diario')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 font-bold text-slate-200 transition"
                >
                  🎯 Combo Diário (Loto 16D + Quina 6D + Dia de Sorte 8D)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('combo_mega_loto')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 font-bold text-slate-200 transition"
                >
                  ⭐ Combo Mega + Loto (Loto 18D + 2x Mega 7D)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSpreadsheetPreset('combo_fds')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 font-bold text-slate-200 transition"
                >
                  🍀 Super Fim de Semana (Mega 8D + 2x Dupla Sena 7D)
                </button>
              </div>
            </div>

            {/* Lottery Selector */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  1. Selecione a Modalidade ou Combo
                </h3>
                <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${config.bgLight}`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }}></span>
                  Ativa: {config.name}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {Object.values(LOTTERY_CONFIGS).map((lot) => {
                  const isSelected = selectedLottery === lot.id;
                  const isCombo = lot.id === 'combo';
                  return (
                    <button
                      key={lot.id}
                      onClick={() => {
                        setSelectedLottery(lot.id);
                        if (lot.id === 'combo') {
                          setGameMix([
                            { id: '1', lotteryType: 'mega-sena', numbersCount: 8, quantity: 1 },
                            { id: '2', lotteryType: 'lotofacil', numbersCount: 17, quantity: 1 },
                            { id: '3', lotteryType: 'quina', numbersCount: 7, quantity: 1 },
                          ]);
                        } else {
                          setGameMix([
                            { id: '1', lotteryType: lot.id, numbersCount: lot.standardBetCount, quantity: 10 },
                          ]);
                        }
                      }}
                      style={{
                        borderColor: isSelected ? lot.color : undefined,
                        backgroundColor: isSelected ? `${lot.color}12` : undefined,
                      }}
                      className={`p-3 rounded-2xl border text-left transition relative overflow-hidden flex flex-col justify-between group ${
                        isSelected
                          ? 'ring-2 shadow-sm font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                      }`}
                    >
                      {/* Top official color line indicator */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1 transition"
                        style={{
                          backgroundColor: lot.color,
                          opacity: isSelected ? 1 : 0.4,
                        }}
                      />

                      <div className="flex items-center justify-between w-full pt-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-2 ring-white"
                            style={{ backgroundColor: lot.color }}
                          />
                          <span className="font-black text-xs text-slate-900 tracking-tight truncate">
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
                          {isCombo ? 'Múltiplas' : `Base (${lot.standardBetCount}D)`}
                        </span>
                        <span
                          className="font-black px-1.5 py-0.5 rounded-md text-[10px]"
                          style={{
                            color: lot.color,
                            backgroundColor: `${lot.color}15`,
                          }}
                        >
                          {isCombo ? 'Variável' : formatCurrency(lot.basePrice)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Game Mix Builder */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-slate-100">
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    2. Composição das Apostas
                  </h3>
                  <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wide border flex items-center gap-1.5 ${config.bgLight}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }}></span>
                    {selectedLottery === 'combo'
                      ? `Combo Multi-Modalidades (${modalityBreakdown.length} modalidades)`
                      : `Modalidade: ${config.name} (Base: ${formatCurrency(config.basePrice)})`}
                  </span>
                </div>
                <button
                  onClick={handleAddGameMix}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Faixa / Modalidade</span>
                </button>
              </div>

              <div className="space-y-3">
                {gameMix.map((item) => {
                  const itemLottery = item.lotteryType || (selectedLottery !== 'combo' ? selectedLottery : 'mega-sena');
                  const itemConfig = LOTTERY_CONFIGS[itemLottery] || LOTTERY_CONFIGS['mega-sena'];
                  const unitCost = getOfficialGameCost(itemLottery, item.numbersCount);
                  const subTotal = unitCost * item.quantity;
                  const itemComb = combinations(item.numbersCount, itemConfig.standardBetCount);

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Modality Dropdown (allows selecting individual modality per row) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Modalidade
                          </label>
                          <select
                            value={itemLottery}
                            onChange={(e) =>
                              handleUpdateGameMix(item.id, 'lotteryType', e.target.value as LotteryType)
                            }
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                          >
                            {Object.values(LOTTERY_CONFIGS)
                              .filter((l) => l.id !== 'combo')
                              .map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Qtd. Apostas
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateGameMix(item.id, 'quantity', parseInt(e.target.value, 10) || 1)
                            }
                            className="w-16 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-center font-black"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Dezenas Marcadas no Volante
                          </label>
                          <select
                            value={item.numbersCount}
                            onChange={(e) =>
                              handleUpdateGameMix(
                                item.id,
                                'numbersCount',
                                parseInt(e.target.value, 10) || itemConfig.standardBetCount
                              )
                            }
                            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                          >
                            {itemConfig.priceTable.map((p, idx) => (
                              <option key={`${p.numbersCount}-${p.label || idx}`} value={p.numbersCount}>
                                {p.label || `${p.numbersCount} dezenas`} ({formatCurrency(p.price)} — Equivale a {p.combinations} {p.combinations === 1 ? 'aposta simples' : 'apostas simples'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block mb-1">
                          ⚡ Equivale a {item.quantity * itemComb} {item.quantity * itemComb === 1 ? 'aposta simples' : 'apostas simples'} ({itemConfig.standardBetCount}D)
                          {item.quantity > 1 && itemComb > 1 ? ` — ${itemComb} por jogo` : ''}
                        </span>
                        <div className="font-black text-slate-900 text-sm">
                          {formatCurrency(subTotal)}
                        </div>
                      </div>

                      {gameMix.length > 1 && (
                        <button
                          onClick={() => handleRemoveGameMix(item.id)}
                          className="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quotas & Organizer Fee parameters */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                3. Parâmetros de Cotas & Taxas
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Cotas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={targetQuotas}
                    onChange={(e) => setTargetQuotas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-black text-slate-900 text-center focus:bg-white transition"
                  />
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">Ex: 10, 15, 20 amigos</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Taxa do Organizador (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={adminFeePercent}
                    onChange={(e) => setAdminFeePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-black text-slate-900 text-center focus:bg-white transition"
                  />
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">Remuneração ou margem</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custos Extras / Fundo (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={extraCostInput}
                      onChange={(e) => setExtraCostInput(e.target.value)}
                      onBlur={() => {
                        const val = parseCurrencyBRL(extraCostInput);
                        setExtraCost(val);
                        setExtraCostInput(formatCurrencyNumber(val));
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3.5 py-2.5 text-sm font-black text-slate-900 text-center focus:bg-white transition focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">Impressão, envio, etc.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Real-time Calculation Result Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6 sticky top-24">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                  Resultado da Simulação
                </span>
                <h3 className="text-xl font-black text-white mt-1 tracking-tight">
                  Precificação Inteligente
                </h3>
              </div>

              {/* Big Quota Price Highlight */}
              <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 text-center space-y-1">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Valor Sugerido por Cota
                </span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400">
                  {formatCurrency(roundedQuotaPrice)}
                </div>
                <span className="text-[11px] text-slate-400 block font-medium">
                  Dividido em <strong>{targetQuotas} cotas</strong>
                </span>
              </div>

              {/* Breakdown Matrix */}
              <div className="space-y-2.5 text-xs text-slate-300 font-medium">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span>Custo dos Jogos na Lotérica:</span>
                  <span className="font-black text-white">{formatCurrency(totalGamesCost)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span>Quantidade de Bilhetes / Jogos:</span>
                  <span className="font-black text-white">{totalTicketsCount} aposta(s)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span>Equivalência em Apostas Simples:</span>
                  <span className="font-black text-emerald-300">
                    {totalCombinations} apostas simples equivalentes
                  </span>
                </div>

                {/* Modality Breakdown Pills if multi-lottery */}
                {modalityBreakdown.length > 0 && (
                  <div className="py-2 border-b border-slate-800/80 space-y-2">
                    <div className="text-[10px] font-black uppercase text-slate-400">
                      {modalityBreakdown.length > 1 ? 'Detalhamento por Modalidade:' : 'Modalidade Selecionada:'}
                    </div>
                    <div className="space-y-1.5">
                      {modalityBreakdown.map((m) => (
                        <div
                          key={m.lotteryType}
                          className="p-2 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: m.config.color }}
                            />
                            <span className="font-black text-white">{m.config.name}</span>
                            <span className="text-[10px] text-slate-400">
                              ({m.quantity} {m.quantity === 1 ? 'jogo' : 'jogos'})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-300">{formatCurrency(m.cost)}</span>
                            <span className="text-[10px] text-slate-400 block">
                              {m.combinations} {m.combinations === 1 ? 'aposta simples' : 'apostas simples'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {totalCombinations > totalTicketsCount && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-black">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Probabilidades Multiplicadas!</span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-normal leading-relaxed">
                      Ao escolher apostas com mais dezenas ou combos combinados, estes <strong>{totalTicketsCount} bilhete(s)</strong> equivalem a <strong>{totalCombinations} apostas simples</strong> no total, com múltiplas chances de acertos e faixas de premiação secundária.
                    </p>
                  </div>
                )}

                {adminFeeAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span>Taxa Administrativa ({adminFeePercent}%):</span>
                    <span className="font-black text-white">{formatCurrency(adminFeeAmount)}</span>
                  </div>
                )}

                {extraCost > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span>Custos Operacionais:</span>
                    <span className="font-black text-white">{formatCurrency(extraCost)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b border-slate-800/80 font-bold text-white">
                  <span>Total Arrecadado ({targetQuotas} cotas):</span>
                  <span className="text-emerald-400 font-black">{formatCurrency(totalRevenue)}</span>
                </div>

                <div className="flex justify-between py-1 text-emerald-300 font-bold">
                  <span>Margem de Sobra / Lucro:</span>
                  <span className="font-black">{formatCurrency(netBalance)}</span>
                </div>
              </div>

              <button
                id="transfer-simulation-to-bolao-btn"
                onClick={handleTransferToBolao}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Criar Bolão a partir desta Simulação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: TABELA DE PREÇOS OFICIAIS & PROBABILIDADES */}
      {/* ========================================================================= */}
      {activeSubTab === 'tabelas' && (
        <div className="space-y-6">
          {/* Card: Planilha Compartilhada de Bolões */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">
                  Referência da Planilha Compartilhada
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Tabela de Preços e Estrutura dos Bolões Ativos
                </h3>
              </div>
              <span className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                3 Bolões em Andamento
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bolão 1 */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Mega-Sena
                  </span>
                  <span className="text-xs font-black text-slate-700">45 Cotas</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">BOLÃO REGULAR</h4>
                  <div className="text-xl font-black text-emerald-600 mt-1">R$ 25,00 <span className="text-xs text-slate-500 font-medium">/ cota</span></div>
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-medium pt-2 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span>Arrecadação Total:</span>
                    <strong className="text-slate-900">R$ 1.125,00</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Custo Estimado Jogos:</span>
                    <span>R$ 1.125,00</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleLoadSpreadsheetPreset('regular_25');
                    setActiveSubTab('simulador');
                  }}
                  className="w-full text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 py-2 rounded-xl transition text-center mt-2 block active:scale-95"
                >
                  Simular este Bolão
                </button>
              </div>

              {/* Bolão 2 */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    Lotofácil
                  </span>
                  <span className="text-xs font-black text-slate-700">50 Cotas</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">BOLÃO 1 DA INDEPENDÊNCIA</h4>
                  <div className="text-xl font-black text-purple-600 mt-1">R$ 60,00 <span className="text-xs text-slate-500 font-medium">/ cota</span></div>
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-medium pt-2 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span>Arrecadação Total:</span>
                    <strong className="text-slate-900">R$ 3.000,00</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Custo Estimado Jogos:</span>
                    <span>R$ 2.856,00</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleLoadSpreadsheetPreset('indep_60');
                    setActiveSubTab('simulador');
                  }}
                  className="w-full text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 py-2 rounded-xl transition text-center mt-2 block active:scale-95"
                >
                  Simular este Bolão
                </button>
              </div>

              {/* Bolão 3 */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Lotofácil
                  </span>
                  <span className="text-xs font-black text-slate-700">40 Cotas</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">BOLÃO 2 DA INDEPENDÊNCIA</h4>
                  <div className="text-xl font-black text-indigo-600 mt-1">R$ 39,00 <span className="text-xs text-slate-500 font-medium">/ cota</span></div>
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-medium pt-2 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span>Arrecadação Total:</span>
                    <strong className="text-slate-900">R$ 1.560,00</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Custo Estimado Jogos:</span>
                    <span>R$ 1.428,00</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleLoadSpreadsheetPreset('indep_39');
                    setActiveSubTab('simulador');
                  }}
                  className="w-full text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 py-2 rounded-xl transition text-center mt-2 block active:scale-95"
                >
                  Simular este Bolão
                </button>
              </div>
            </div>
          </div>

          {/* Caixa Official Price Table & Custom Price Manager */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Tabela de Preços & Desdobramentos
                  </h3>
                  {customPrices[selectedLottery] && (
                    <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      Personalizada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Consulte os valores oficiais, edite os preços unitários ou cole a tabela direta da sua planilha.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <label className="text-xs font-bold text-slate-700">Loteria:</label>
                      <select
                        value={selectedLottery}
                        onChange={(e) => setSelectedLottery(e.target.value as LotteryType)}
                        className="bg-transparent text-xs font-black text-slate-900 focus:outline-none"
                      >
                        <option value="mega-sena">Mega-Sena</option>
                        <option value="lotofacil">Lotofácil</option>
                        <option value="quina">Quina</option>
                        <option value="dia-de-sorte">Dia de Sorte</option>
                        <option value="timemania">Timemania</option>
                        <option value="dupla-sena">Dupla Sena</option>
                        <option value="super-sete">Super Sete</option>
                        <option value="milionaria">+Milionária</option>
                        <option value="lotomania">Lotomania</option>
                      </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="flex items-center gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl transition active:scale-95"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Colar da Planilha</span>
                </button>

                {customPrices[selectedLottery] && (
                  <button
                    type="button"
                    onClick={handleResetPrices}
                    className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Padrão</span>
                  </button>
                )}
              </div>
            </div>

            {/* Success Feedback Alert */}
            {saveSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Paste Box Accordion */}
            {showPasteBox && (
              <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardPaste className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      Colar Dados da Aba "Tabela de Preços" da Planilha
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Fechar
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  Copie as linhas da sua planilha (ex: coluna com quantidade de dezenas e coluna com o valor em R$) e cole no campo abaixo:
                </p>
                <textarea
                  value={pastedCSV}
                  onChange={(e) => setPastedCSV(e.target.value)}
                  placeholder={`Exemplo de linhas coladas:\n6 dezenas\t5,00\n7 dezenas\t35,00\n8 dezenas\t140,00\n9 dezenas\t420,00`}
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3.5 text-xs font-mono text-emerald-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleParseAndApplyPastedCSV}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95"
                  >
                    Processar e Aplicar Preços
                  </button>
                </div>
              </div>
            )}

            {/* Base Price Quick Adjuster */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-slate-900 block">
                  Preço da Aposta Simples ({config.standardBetCount} dezenas):
                </span>
                <span className="text-[11px] text-slate-500">
                  Alterar este valor recalcula proporcionalmente todos os jogos múltiplos ({config.minNumbers} a {config.maxNumbers} dezenas).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative inline-flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-500 pointer-events-none">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={basePriceInput}
                    onChange={(e) => setBasePriceInput(e.target.value)}
                    onBlur={handleBasePriceBlur}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-28 bg-white border border-slate-300 text-xs font-black rounded-xl pl-9 pr-3 py-1.5 text-slate-900 text-center shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-400">/ aposta</span>
              </div>
            </div>

            {/* Price Table with Inline Edit */}
            <div className="overflow-x-auto border border-slate-200 rounded-3xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Dezenas Marcadas</th>
                    <th className="py-3.5 px-4">Jogos Equivalentes</th>
                    <th className="py-3.5 px-4">Valor Atual</th>
                    <th className="py-3.5 px-4">Ajustar Valor (R$)</th>
                    <th className="py-3.5 px-4">Probabilidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {currentPriceTable.map((entry) => {
                    const totalCombinationsLottery = combinations(config.totalRange, config.standardBetCount);
                    const odds = Math.round(totalCombinationsLottery / entry.combinations);

                    return (
                      <tr key={`${entry.numbersCount}-${entry.label || ''}`} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                          {entry.label || `${entry.numbersCount} dezenas`}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {entry.combinations.toLocaleString('pt-BR')} aposta(s) simples
                        </td>
                        <td className="py-3.5 px-4 font-black text-emerald-700 text-sm">
                          {formatCurrency(entry.price)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative inline-flex items-center">
                            <span className="absolute left-2.5 text-[11px] font-bold text-slate-400 pointer-events-none">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              defaultValue={formatCurrencyNumber(entry.price)}
                              key={`${selectedLottery}-${entry.numbersCount}-${entry.label || ''}-${entry.price}`}
                              onFocus={(e) => e.target.select()}
                              onBlur={(e) => {
                                const val = parseCurrencyBRL(e.target.value);
                                if (!isNaN(val) && val > 0 && val !== entry.price) {
                                  handleUpdateRowPrice(entry.numbersCount, val);
                                } else {
                                  e.target.value = formatCurrencyNumber(entry.price);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-32 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl pl-8 pr-2.5 py-1 text-xs font-black text-slate-900 text-right shadow-xs transition"
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                          1 em {odds.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: RATEIO RÁPIDO DE PREMIAÇÃO */}
      {/* ========================================================================= */}
      {activeSubTab === 'rateio_rapido' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>Simulador Rápido de Rateio de Prêmio</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Calcule quanto cada participante receberá por cota sem precisar vincular a um bolão salvo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Valor Bruto do Prêmio (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickGrossPrizeInput}
                  onChange={(e) => setQuickGrossPrizeInput(e.target.value)}
                  onBlur={() => {
                    const val = parseCurrencyBRL(quickGrossPrizeInput);
                    setQuickGrossPrize(val);
                    setQuickGrossPrizeInput(formatCurrencyNumber(val));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total de Cotas do Bolão
              </label>
              <input
                type="number"
                min="1"
                value={quickQuotasCount}
                onChange={(e) => setQuickQuotasCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-base font-black text-slate-900 text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Taxa Organizador (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={quickAdminFee}
                onChange={(e) => setQuickAdminFee(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-base font-black text-slate-900 text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-400 uppercase font-black tracking-wider block">
                Taxa do Organizador
              </span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {formatCurrency(quickFeeAmount)}
              </span>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-400 uppercase font-black tracking-wider block">
                Prêmio Líquido a Distribuir
              </span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {formatCurrency(quickNetPrize)}
              </span>
            </div>

            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200">
              <span className="text-xs text-emerald-800 uppercase font-black tracking-wider block">
                Valor Líquido por Cota
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {formatCurrency(quickNetPerQuota)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
