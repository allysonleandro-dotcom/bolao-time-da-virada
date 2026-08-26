import React, { useState, useEffect } from 'react';
import { X, Sparkles, Layers, DollarSign, Calendar, Clock, Ticket } from 'lucide-react';
import { Bolao, LotteryType, SystemSettings, TicketGame } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { formatCurrency, getOfficialGameCost } from '../utils/calculator';

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
    tickets: { numbersCount: number; cost: number; quantity: number }[];
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
  const [totalQuotas, setTotalQuotas] = useState(10);
  const [quotaPrice, setQuotaPrice] = useState(50.0);
  const [adminFeePercent, setAdminFeePercent] = useState(settings.defaultAdminFeePercent || 0);
  const [adminFeeFixed, setAdminFeeFixed] = useState(0);
  const [extraCost, setExtraCost] = useState(0);
  const [reserveFundAmount, setReserveFundAmount] = useState(0);
  const [pixKeyRecipient, setPixKeyRecipient] = useState(settings.defaultPixKey || '');
  const [organizerName, setOrganizerName] = useState(settings.defaultOrganizerName || '');
  const [notes, setNotes] = useState('');

  // Initial populate
  useEffect(() => {
    if (editingBolao) {
      setLotteryType(editingBolao.lotteryType);
      setTitle(editingBolao.title);
      setContestNumber(editingBolao.contestNumber);
      setDrawDate(editingBolao.drawDate);
      setTotalQuotas(editingBolao.totalQuotas);
      setQuotaPrice(editingBolao.quotaPrice);
      setAdminFeePercent(editingBolao.adminFeePercent || 0);
      setAdminFeeFixed(editingBolao.adminFeeFixed || 0);
      setExtraCost(editingBolao.extraCost || 0);
      setReserveFundAmount(editingBolao.reserveFundAmount || 0);
      setPixKeyRecipient(editingBolao.pixKeyRecipient || settings.defaultPixKey || '');
      setOrganizerName(editingBolao.organizerName || settings.defaultOrganizerName || '');
      setNotes(editingBolao.notes || '');
    } else if (simulationPreset) {
      setLotteryType(simulationPreset.lotteryType);
      setTitle(`${LOTTERY_CONFIGS[simulationPreset.lotteryType].name} Especial`);
      setDrawDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
      setTotalQuotas(simulationPreset.totalQuotas);
      setQuotaPrice(simulationPreset.quotaPrice);
      setAdminFeePercent(simulationPreset.adminFeePercent);
      setExtraCost(simulationPreset.extraCost);
      setPixKeyRecipient(settings.defaultPixKey || '');
      setOrganizerName(settings.defaultOrganizerName || '');
      setNotes(simulationPreset.notes || '');
    } else {
      setLotteryType('mega-sena');
      setTitle('Bolão Mega-Sena Especial');
      setContestNumber('');
      setDrawDate(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]);
      setTotalQuotas(10);
      setQuotaPrice(50.0);
      setAdminFeePercent(settings.defaultAdminFeePercent || 0);
      setAdminFeeFixed(0);
      setExtraCost(0);
      setReserveFundAmount(0);
      setPixKeyRecipient(settings.defaultPixKey || '');
      setOrganizerName(settings.defaultOrganizerName || '');
      setNotes('');
    }
  }, [editingBolao, simulationPreset, settings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor, informe um título para o bolão.');
      return;
    }

    let initialTickets: TicketGame[] = editingBolao ? editingBolao.tickets : [];

    // If generated from simulation preset
    if (!editingBolao && simulationPreset && simulationPreset.tickets) {
      const config = LOTTERY_CONFIGS[lotteryType];
      let tId = 1;
      simulationPreset.tickets.forEach((presetGroup) => {
        for (let q = 0; q < presetGroup.quantity; q++) {
          const numbers = new Set<number>();
          while (numbers.size < presetGroup.numbersCount) {
            numbers.add(Math.floor(Math.random() * config.totalRange) + 1);
          }
          initialTickets.push({
            id: `ticket-sim-${Date.now()}-${tId}`,
            name: `Jogo ${tId} (${presetGroup.numbersCount} dezenas)`,
            numbersCount: presetGroup.numbersCount,
            numbers: Array.from(numbers).sort((a, b) => a - b),
            cost: presetGroup.cost,
          });
          tId++;
        }
      });
    }

    const savedBolao: Bolao = {
      id: editingBolao ? editingBolao.id : `bolao-${lotteryType}-${Date.now()}`,
      title: title.trim(),
      lotteryType,
      contestNumber: contestNumber.trim(),
      drawDate,
      totalQuotas: totalQuotas || 1,
      quotaPrice: quotaPrice || 10,
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
                Defina loteria, cotas, valor e regras financeiras do bolão.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Lottery Type selection */}
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
                    onClick={() => {
                      setLotteryType(lot.id);
                      if (!editingBolao) {
                        setTitle(`Bolão ${lot.name} Especial`);
                      }
                    }}
                    style={{
                      borderColor: isSelected ? lot.color : undefined,
                      backgroundColor: isSelected ? `${lot.color}15` : undefined,
                      color: isSelected ? lot.color : undefined,
                    }}
                    className={`py-2 px-2 text-center rounded-2xl border font-black text-xs transition flex items-center justify-center gap-1.5 ${
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

          {/* Title & Contest */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Título do Bolão *</label>
              <input
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
                type="text"
                placeholder="Ex: 2780"
                value={contestNumber}
                onChange={(e) => setContestNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Date & Quotas & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data do Sorteio</label>
              <input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Total de Cotas *</label>
              <input
                type="number"
                min="1"
                required
                value={totalQuotas}
                onChange={(e) => setTotalQuotas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-extrabold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor por Cota (R$) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={quotaPrice}
                onChange={(e) => setQuotaPrice(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-extrabold"
              />
            </div>
          </div>

          {/* Financial Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Taxa Organizador (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={adminFeePercent}
                onChange={(e) => setAdminFeePercent(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 text-center font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Custos Extras (R$)</label>
              <input
                type="number"
                min="0"
                value={extraCost}
                onChange={(e) => setExtraCost(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 text-center font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fundo Reserva (R$)</label>
              <input
                type="number"
                min="0"
                value={reserveFundAmount}
                onChange={(e) => setReserveFundAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 text-center font-bold"
              />
            </div>
          </div>

          {/* Organizer Pix & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Chave PIX para Arrecadação
              </label>
              <input
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
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-2.5 rounded-2xl shadow-md shadow-emerald-200 transition active:scale-95"
            >
              {editingBolao ? 'Atualizar Bolão' : 'Salvar e Abrir Bolão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
