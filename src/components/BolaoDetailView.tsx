import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Users,
  Ticket,
  Trophy,
  Share2,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  MessageSquare,
  FileSpreadsheet,
  Shuffle,
  Eye,
  Percent,
  ShieldCheck,
  UploadCloud,
  Maximize2,
  X,
  Download,
  FileDown,
  Image as ImageIcon,
  Camera,
  Scan,
  RefreshCw,
  Database,
} from 'lucide-react';
import { Bolao, BolaoParticipant, BolaoStatus, Participant, TicketGame, DigitalReceipt } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import {
  calculateBolaoFinancials,
  calculatePrizeSplit,
  checkTicketMatches,
  formatCurrency,
  formatCurrencyNumber,
  parseCurrencyBRL,
  formatDateBR,
  getOfficialGameCost,
  generateWhatsAppMessage,
  getParticipantQuotaLabel,
} from '../utils/calculator';
import { downloadFile } from '../utils/storage';
import { exportBolaoConferencePDF } from '../utils/pdfGenerator';
import { TicketOcrScannerModal } from './TicketOcrScannerModal';
import { ScannedGame } from '../services/ticketOcrService';
import {
  triggerCreateBolaoTabInSheets,
  triggerSyncParticipantInSheets,
  triggerUpdatePaymentStatusInSheets,
  triggerFullSyncBolaoInSheets,
} from '../services/googleSheetsSync';

interface BolaoDetailViewProps {
  bolao: Bolao;
  allParticipants: Participant[];
  onBack: () => void;
  onUpdateBolao: (updatedBolao: Bolao) => void;
  onOpenWhatsAppShare: (
    bolao: Bolao,
    type: 'convite' | 'comprovante' | 'jogos' | 'resultado' | 'rateio' | 'cobranca' | 'participantes',
    participant?: Participant,
    bolaoParticipant?: BolaoParticipant
  ) => void;
  onAddNewParticipantGlobal: (participant: Participant) => void;
}

export const BolaoDetailView: React.FC<BolaoDetailViewProps> = ({
  bolao,
  allParticipants,
  onBack,
  onUpdateBolao,
  onOpenWhatsAppShare,
  onAddNewParticipantGlobal,
}) => {
  const [activeTab, setActiveTab] = useState<'participantes' | 'jogos' | 'comprovantes' | 'conferidor' | 'rateio' | 'resumo'>('participantes');
  
  // Participant adding state
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [newQuotasInput, setNewQuotasInput] = useState('1');
  const [newStatusInput, setNewStatusInput] = useState<'pago' | 'pendente'>('pago');
  const [isInlineNewParticipant, setIsInlineNewParticipant] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlinePixKey, setInlinePixKey] = useState('');

  // Ticket creation state
  const [ticketNumbersCount, setTicketNumbersCount] = useState(
    bolao.dezenas || LOTTERY_CONFIGS[bolao.lotteryType]?.standardBetCount || 6
  );
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [customTicketName, setCustomTicketName] = useState('');
  const [ticketCreationMode, setTicketCreationMode] = useState<'manual' | 'gerador'>('manual');
  const [generatorQuantity, setGeneratorQuantity] = useState(5);

  // Result checking state
  const [drawnInputNumbers, setDrawnInputNumbers] = useState<number[]>(bolao.drawnNumbers || []);
  const [manualBallInput, setManualBallInput] = useState('');
  const [grossPrizeInput, setGrossPrizeInput] = useState<string>(
    bolao.totalPrizeWon ? formatCurrencyNumber(bolao.totalPrizeWon) : ''
  );

  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [lightboxReceipt, setLightboxReceipt] = useState<DigitalReceipt | null>(null);
  const [uploadReceiptTitle, setUploadReceiptTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isSyncingSheetsTab, setIsSyncingSheetsTab] = useState(false);
  const [sheetsSyncFeedback, setSheetsSyncFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const config = LOTTERY_CONFIGS[bolao.lotteryType] || LOTTERY_CONFIGS['mega-sena'];
  const financials = calculateBolaoFinancials(bolao);
  const participantMap = new Map<string, Participant>(allParticipants.map((p) => [p.id, p]));

  // Handle OCR extracted games
  const handleSaveOcrGames = (
    scannedGames: ScannedGame[],
    scannedLottery: any,
    scannedContest?: string,
    receiptImage?: string
  ) => {
    const newTickets: TicketGame[] = scannedGames.map((sg, idx) => ({
      id: `ticket-ocr-${Date.now()}-${idx}`,
      name: sg.label || `Jogo ${bolao.tickets.length + idx + 1}`,
      numbersCount: sg.numbersCount || sg.numbers.length,
      numbers: sg.numbers,
      cost: sg.cost || getOfficialGameCost(bolao.lotteryType, sg.numbersCount || sg.numbers.length),
    }));

    let updatedReceipts = bolao.digitalReceipts || [];
    if (receiptImage) {
      const newReceipt: DigitalReceipt = {
        id: `receipt-ocr-${Date.now()}`,
        title: `Comprovante Escaneado por IA (${new Date().toLocaleDateString('pt-BR')})`,
        url: receiptImage,
        uploadedAt: new Date().toISOString(),
        fileSize: 'Escaneamento IA OCR',
      };
      updatedReceipts = [newReceipt, ...updatedReceipts];
    }

    const updatedBolao: Bolao = {
      ...bolao,
      contestNumber: scannedContest || bolao.contestNumber,
      tickets: [...bolao.tickets, ...newTickets],
      digitalReceipts: updatedReceipts,
    };

    onUpdateBolao(updatedBolao);
  };

  // Handle upload photos/scans of physical receipts
  const handleUploadReceipts = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: File[] = [];
    if ('dataTransfer' in e) {
      e.preventDefault();
      files = Array.from(e.dataTransfer.files);
    } else if (e.target.files) {
      files = Array.from(e.target.files);
    }
    if (!files || files.length === 0) return;

    const validFiles = files.filter((f) => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i));
    if (validFiles.length === 0) {
      alert('Por favor, selecione arquivos de imagem válidos (JPG, PNG, WEBP).');
      return;
    }

    setIsUploading(true);
    const newReceipts: DigitalReceipt[] = [];
    let processed = 0;

    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const sizeKb = Math.round(file.size / 1024);
        const title = uploadReceiptTitle.trim()
          ? (validFiles.length > 1 ? `${uploadReceiptTitle.trim()} (${index + 1})` : uploadReceiptTitle.trim())
          : file.name.replace(/\.[^/.]+$/, '');

        newReceipts.push({
          id: `receipt-${Date.now()}-${index}`,
          title,
          url: base64,
          uploadedAt: new Date().toISOString(),
          fileSize: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
        });
        processed++;
        if (processed === validFiles.length) {
          onUpdateBolao({
            ...bolao,
            digitalReceipts: [...(bolao.digitalReceipts || []), ...newReceipts],
            updatedAt: new Date().toISOString(),
          });
          setUploadReceiptTitle('');
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveReceipt = (receiptId: string) => {
    if (confirm('Deseja excluir este bilhete digitalizado?')) {
      onUpdateBolao({
        ...bolao,
        digitalReceipts: (bolao.digitalReceipts || []).filter((r) => r.id !== receiptId),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Handle adding participant to bolao
  const handleAddParticipant = () => {
    let partId = selectedParticipantId;

    if (isInlineNewParticipant) {
      if (!inlineName.trim()) {
        alert('Por favor, informe o nome do participante.');
        return;
      }
      const newPart: Participant = {
        id: `part-${Date.now()}`,
        name: inlineName.trim(),
        phone: inlinePhone.trim(),
        pixKey: inlinePixKey.trim(),
        createdAt: new Date().toISOString(),
      };
      onAddNewParticipantGlobal(newPart);
      partId = newPart.id;
      setInlineName('');
      setInlinePhone('');
      setInlinePixKey('');
      setIsInlineNewParticipant(false);
    }

    if (!partId) {
      alert('Selecione ou cadastre um participante.');
      return;
    }

    const quotas = parseFloat(newQuotasInput) || 1;
    const totalDue = quotas * bolao.quotaPrice;
    const amountPaid = newStatusInput === 'pago' ? totalDue : 0;

    // Calculate next sequential quota numbers
    const currentMaxQuota = bolao.participants.reduce((acc, p) => {
      if (p.quotaNumbers && p.quotaNumbers.length > 0) {
        const nums = p.quotaNumbers.map((n) => Number(n)).filter((n) => !isNaN(n));
        if (nums.length > 0) return Math.max(acc, ...nums);
      }
      return acc + Math.max(1, Math.round(p.quotas || 1));
    }, 0);
    const assignedQuotaNumbers = Array.from(
      { length: Math.max(1, Math.round(quotas)) },
      (_, i) => currentMaxQuota + 1 + i
    );

    // Check if already in bolao
    const existingIndex = bolao.participants.findIndex((p) => p.participantId === partId);
    let updatedParticipants: BolaoParticipant[] = [...bolao.participants];

    if (existingIndex >= 0) {
      // update existing
      const existingQuotas = updatedParticipants[existingIndex].quotaNumbers || [];
      updatedParticipants[existingIndex] = {
        ...updatedParticipants[existingIndex],
        quotas: updatedParticipants[existingIndex].quotas + quotas,
        quotaNumbers: [...existingQuotas, ...assignedQuotaNumbers],
        totalDue: (updatedParticipants[existingIndex].quotas + quotas) * bolao.quotaPrice,
        amountPaid: updatedParticipants[existingIndex].amountPaid + amountPaid,
        status: newStatusInput,
        paidAt: newStatusInput === 'pago' ? new Date().toISOString() : undefined,
      };
    } else {
      updatedParticipants.push({
        participantId: partId,
        quotas,
        quotaNumbers: assignedQuotaNumbers,
        status: newStatusInput,
        amountPaid,
        totalDue,
        paidAt: newStatusInput === 'pago' ? new Date().toISOString() : undefined,
        paymentMethod: 'pix',
      });
    }

    onUpdateBolao({
      ...bolao,
      participants: updatedParticipants,
      updatedAt: new Date().toISOString(),
    });

    // Sincronização em tempo real com o Google Sheets
    const partInfo = allParticipants.find((p) => p.id === partId) || (isInlineNewParticipant ? { name: inlineName } : undefined);
    const participantName = partInfo?.name || 'Participante';
    triggerSyncParticipantInSheets(bolao.title, {
      usuarioId: partId,
      nome: participantName,
      statusPagamento: newStatusInput === 'pago' ? 'Pago' : 'Pendente',
      palpite: `${quotas} cota(s)`,
    }).catch((err) => console.warn('Sync participante sheets:', err));

    setSelectedParticipantId('');
    setNewQuotasInput('1');
  };

  // Toggle payment status for a participant
  const handleTogglePaymentStatus = (participantId: string) => {
    let nextStatus: 'pago' | 'pendente' = 'pago';
    const updated = bolao.participants.map((bp) => {
      if (bp.participantId === participantId) {
        nextStatus = bp.status === 'pago' ? 'pendente' : 'pago';
        const totalDue = (bp.quotas || 1) * bolao.quotaPrice;
        return {
          ...bp,
          status: nextStatus,
          amountPaid: nextStatus === 'pago' ? totalDue : 0,
          paidAt: nextStatus === 'pago' ? new Date().toISOString() : undefined,
        };
      }
      return bp;
    });

    onUpdateBolao({
      ...bolao,
      participants: updated,
      updatedAt: new Date().toISOString(),
    });

    // Atualiza status de pagamento em tempo real na planilha
    triggerUpdatePaymentStatusInSheets(
      bolao.title,
      participantId,
      nextStatus === 'pago' ? 'Pago' : 'Pendente'
    ).catch((err) => console.warn('Sync status pagamento sheets:', err));
  };

  // Sincronização manual completa deste bolão com o Google Sheets
  const handleSyncThisBolaoWithSheets = async () => {
    setIsSyncingSheetsTab(true);
    setSheetsSyncFeedback(null);
    try {
      // 1. Cria ou garante a aba
      const tabRes = await triggerCreateBolaoTabInSheets(bolao.title);
      // 2. Envia participantes
      const syncRes = await triggerFullSyncBolaoInSheets(bolao, allParticipants);
      if (syncRes.success) {
        setSheetsSyncFeedback({
          message: `Aba "${bolao.title}" sincronizada com ${syncRes.totalProcessed || bolao.participants.length} participante(s) na planilha!`,
          type: 'success',
        });
      } else {
        setSheetsSyncFeedback({
          message: `Aba "${bolao.title}" pronta para envio no Google Sheets!`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setSheetsSyncFeedback({
        message: err?.message || 'Erro ao sincronizar com Google Sheets.',
        type: 'error',
      });
    } finally {
      setIsSyncingSheetsTab(false);
      setTimeout(() => setSheetsSyncFeedback(null), 5000);
    }
  };

  // Remove participant from bolao
  const handleRemoveParticipant = (participantId: string) => {
    if (confirm('Deseja remover este participante deste bolão?')) {
      const updated = bolao.participants.filter((p) => p.participantId !== participantId);
      onUpdateBolao({
        ...bolao,
        participants: updated,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Toggle number in ball picker
  const handleToggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter((n) => n !== num));
    } else {
      if (selectedNumbers.length >= ticketNumbersCount) {
        return;
      }
      setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    }
  };

  // Add manually created ticket
  const handleAddManualTicket = () => {
    if (selectedNumbers.length !== ticketNumbersCount) {
      alert(`Selecione exatamente ${ticketNumbersCount} dezenas para este jogo.`);
      return;
    }

    const cost = getOfficialGameCost(bolao.lotteryType, ticketNumbersCount);
    const newTicket: TicketGame = {
      id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: customTicketName.trim() || `Jogo ${bolao.tickets.length + 1} (${ticketNumbersCount} dezenas)`,
      numbersCount: ticketNumbersCount,
      numbers: [...selectedNumbers],
      cost,
    };

    onUpdateBolao({
      ...bolao,
      tickets: [...bolao.tickets, newTicket],
      updatedAt: new Date().toISOString(),
    });

    setSelectedNumbers([]);
    setCustomTicketName('');
  };

  // Generate random tickets (Surpresinha inteligente)
  const handleGenerateRandomTickets = () => {
    const qty = Math.max(1, Math.min(generatorQuantity, 50));
    const newTickets: TicketGame[] = [];
    const costPerGame = getOfficialGameCost(bolao.lotteryType, ticketNumbersCount);

    for (let i = 0; i < qty; i++) {
      const nums = new Set<number>();
      while (nums.size < ticketNumbersCount) {
        const rand = Math.floor(Math.random() * config.totalRange) + 1;
        nums.add(rand);
      }
      const sortedNums = Array.from(nums).sort((a, b) => a - b);
      newTickets.push({
        id: `ticket-${Date.now()}-${i}`,
        name: `Surpresinha ${bolao.tickets.length + i + 1} (${ticketNumbersCount} dezenas)`,
        numbersCount: ticketNumbersCount,
        numbers: sortedNums,
        cost: costPerGame,
      });
    }

    onUpdateBolao({
      ...bolao,
      tickets: [...bolao.tickets, ...newTickets],
      updatedAt: new Date().toISOString(),
    });
  };

  // Remove ticket
  const handleRemoveTicket = (ticketId: string) => {
    const updated = bolao.tickets.filter((t) => t.id !== ticketId);
    onUpdateBolao({
      ...bolao,
      tickets: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // Check drawn results
  const handleCheckResults = () => {
    if (drawnInputNumbers.length === 0) {
      alert('Informe as dezenas sorteadas no concurso para realizar a conferência.');
      return;
    }

    let highestHits = 0;
    let winningTicketsCount = 0;

    const checkedTickets = bolao.tickets.map((t) => {
      const match = checkTicketMatches(t.numbers, drawnInputNumbers, bolao.lotteryType);
      if (match.hitCount > highestHits) {
        highestHits = match.hitCount;
      }
      if (match.prizeTier) {
        winningTicketsCount++;
      }
      return {
        ...t,
        hits: match.hits,
        prizeTierWon: match.prizeTier,
      };
    });

    const isWinning = winningTicketsCount > 0;
    const nextStatus: BolaoStatus = isWinning ? 'premiado' : 'conferido';

    if (isWinning) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }

    const grossPrize = parseCurrencyBRL(grossPrizeInput);
    const netPrize = Math.max(0, grossPrize - (bolao.reserveFundAmount || 0));
    const netPerQuota = bolao.totalQuotas > 0 ? netPrize / bolao.totalQuotas : 0;

    onUpdateBolao({
      ...bolao,
      drawnNumbers: drawnInputNumbers,
      isDrawn: true,
      tickets: checkedTickets,
      status: nextStatus,
      totalPrizeWon: grossPrize,
      netPrizePerQuota: netPerQuota,
      updatedAt: new Date().toISOString(),
    });
  };

  // Add drawn ball number
  const handleAddDrawnBall = (num: number) => {
    if (drawnInputNumbers.includes(num)) {
      setDrawnInputNumbers(drawnInputNumbers.filter((n) => n !== num));
    } else {
      if (drawnInputNumbers.length >= (config.standardBetCount || 6)) {
        return;
      }
      setDrawnInputNumbers([...drawnInputNumbers, num].sort((a, b) => a - b));
    }
  };

  // Export Bolão Report to CSV
  const handleExportBolaoCSV = () => {
    const headers = ['Participante', 'Telefone', 'Chave_PIX', 'Cotas', 'Valor_Devido', 'Valor_Pago', 'Status', 'Premio_Receber'];
    const prizeSplit = calculatePrizeSplit(bolao, allParticipants);
    const payoutMap = new Map(prizeSplit.payouts.map((p) => [p.participantId, p.amount]));

    const rows = bolao.participants.map((bp) => {
      const part = participantMap.get(bp.participantId);
      const prize = payoutMap.get(bp.participantId) || 0;
      return [
        `"${part?.name || 'Participante'}"`,
        `"${part?.phone || ''}"`,
        `"${part?.pixKey || ''}"`,
        bp.quotas,
        `"R$ ${bp.totalDue.toFixed(2)}"`,
        `"R$ ${bp.amountPaid.toFixed(2)}"`,
        `"${bp.status.toUpperCase()}"`,
        `"R$ ${prize.toFixed(2)}"`,
      ];
    });

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    downloadFile(csvContent, `bolao_${bolao.lotteryType}_conc_${bolao.contestNumber || 'relatorio'}.csv`);
  };

  const parsedGrossPrize = parseCurrencyBRL(grossPrizeInput);
  const prizeSplitSummary = calculatePrizeSplit(bolao, allParticipants, parsedGrossPrize > 0 ? parsedGrossPrize : bolao.totalPrizeWon);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="bolao-detail-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-bold transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Bolões</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Bolão Status Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3.5 py-2 shadow-xs">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Status:</span>
            <select
              id="bolao-detail-status-select"
              value={bolao.status}
              onChange={(e) =>
                onUpdateBolao({
                  ...bolao,
                  status: e.target.value as BolaoStatus,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="text-xs font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="arrecadando">🟡 Arrecadando Cotas</option>
              <option value="jogos_registrados">🔵 Jogos Registrados</option>
              <option value="aguardando_sorteio">🟣 Aguardando Sorteio</option>
              <option value="premiado">🏆 PREMIADO!</option>
              <option value="conferido">⚪ Conferido</option>
              <option value="finalizado">⚫ Finalizado</option>
              <option value="rascunho">📝 Rascunho</option>
            </select>
          </div>

          <button
            id="bolao-export-pdf-btn"
            onClick={() => exportBolaoConferencePDF(bolao, allParticipants, drawnInputNumbers)}
            title="Baixar Relatório e Conferência em PDF"
            className="p-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-2xl border border-emerald-200 text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </button>

          <button
            id="bolao-export-csv-btn"
            onClick={handleExportBolaoCSV}
            title="Exportar dados deste bolão para Planilha CSV"
            className="p-2 text-slate-700 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          <button
            id="bolao-sync-sheets-btn"
            onClick={handleSyncThisBolaoWithSheets}
            disabled={isSyncingSheetsTab}
            title="Sincronizar ou criar aba deste bolão no Google Sheets"
            className="p-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-2xl border border-emerald-300 text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${isSyncingSheetsTab ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncingSheetsTab ? 'Sincronizando...' : 'Sincronizar Planilha'}</span>
          </button>

          <button
            id="bolao-share-invite-btn"
            onClick={() => onOpenWhatsAppShare(bolao, 'convite')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-200 flex items-center gap-1.5 transition active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Divulgar WhatsApp</span>
          </button>
        </div>
      </div>

      {sheetsSyncFeedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-fade-in shadow-xs ${
            sheetsSyncFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sheetsSyncFeedback.message}</span>
          </div>
          <button
            onClick={() => setSheetsSyncFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Bolão Hero Bento Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-3 w-full" style={{ backgroundColor: config.color }}></div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${config.bgLight}`}>
                  {config.name} {bolao.contestNumber ? `• Concurso ${bolao.contestNumber}` : ''}
                </span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                  {bolao.dezenas || config.standardBetCount} dezenas / aposta
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Sorteio: <strong>{formatDateBR(bolao.drawDate)}</strong>
                </span>
                {bolao.organizerName && (
                  <span className="text-xs text-slate-500 font-medium">
                    Organizador: <strong>{bolao.organizerName}</strong>
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
                {bolao.title}
              </h2>
              {bolao.notes && <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium">{bolao.notes}</p>}
            </div>
          </div>

          {/* Quick Financial Snapshot Bento Grid (Full width, no overlapping) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 min-w-0 flex flex-col justify-between">
              <span className="text-slate-400 block text-[10px] sm:text-[11px] uppercase font-black tracking-wider truncate mb-1">
                Valor da Cota
              </span>
              <div className="font-black text-slate-900 text-base sm:text-xl truncate">
                {formatCurrency(bolao.quotaPrice)}
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-1">
                {bolao.totalQuotas} cotas totais
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 min-w-0 flex flex-col justify-between">
              <span className="text-slate-400 block text-[10px] sm:text-[11px] uppercase font-black tracking-wider truncate mb-1">
                Valor Total
              </span>
              <div className="font-black text-slate-900 text-base sm:text-xl truncate">
                {formatCurrency(
                  financials.totalTicketsCost > 0
                    ? financials.totalTicketsCost
                    : financials.totalExpectedRevenue
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-1">
                {financials.totalTicketsCount > 0
                  ? `${financials.totalTicketsCount} aposta(s) cadastradas`
                  : 'Meta de arrecadação'}
              </span>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 min-w-0 flex flex-col justify-between">
              <span className="text-emerald-700 block text-[10px] sm:text-[11px] uppercase font-black tracking-wider truncate mb-1">
                Arrecadado
              </span>
              <div className="font-black text-emerald-600 text-base sm:text-xl truncate">
                {formatCurrency(financials.totalCollected)}
              </div>
              <span className="text-[10px] text-emerald-700 font-bold mt-1">
                {financials.totalQuotasPaid} cota(s) pagas ({Math.round((financials.totalQuotasPaid / (bolao.totalQuotas || 1)) * 100)}%)
              </span>
            </div>

            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 min-w-0 flex flex-col justify-between">
              <span className="text-amber-700 block text-[10px] sm:text-[11px] uppercase font-black tracking-wider truncate mb-1">
                A Receber
              </span>
              <div className="font-black text-amber-600 text-base sm:text-xl truncate">
                {formatCurrency(financials.totalPending)}
              </div>
              <span className="text-[10px] text-amber-700 font-bold mt-1">
                {financials.totalQuotasPending} cota(s) pendentes ({Math.round((financials.totalQuotasPending / (bolao.totalQuotas || 1)) * 100)}%)
              </span>
            </div>
          </div>

          {/* Quotas Progress bar */}
          <div className="mt-6 space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-700">
                Progresso das Cotas: <strong>{financials.totalQuotasSold}</strong> / {bolao.totalQuotas} cotas vendidas ({financials.totalQuotasPaid} pagas)
              </span>
              <span className="text-emerald-700 font-bold">
                {Math.round((financials.totalQuotasPaid / (bolao.totalQuotas || 1)) * 100)}% confirmadas
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${(financials.totalQuotasPaid / (bolao.totalQuotas || 1)) * 100}%` }}
              ></div>
              <div
                className="bg-amber-400 h-full transition-all duration-500"
                style={{ width: `${(financials.totalQuotasPending / (bolao.totalQuotas || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-200 bg-slate-50/70 overflow-x-auto no-scrollbar">
          <button
            id="tab-participantes"
            onClick={() => setActiveTab('participantes')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'participantes'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Participantes & Cotas ({bolao.participants.length})</span>
          </button>

          <button
            id="tab-jogos"
            onClick={() => setActiveTab('jogos')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'jogos'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Jogos & Apostas ({bolao.tickets.length})</span>
          </button>

          <button
            id="tab-comprovantes"
            onClick={() => setActiveTab('comprovantes')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'comprovantes'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Bilhetes & Fotos ({bolao.digitalReceipts?.length || 0})</span>
          </button>

          <button
            id="tab-conferidor"
            onClick={() => setActiveTab('conferidor')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'conferidor'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Conferidor de Resultados</span>
          </button>

          <button
            id="tab-rateio"
            onClick={() => setActiveTab('rateio')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'rateio'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Rateio de Premiação</span>
          </button>

          <button
            id="tab-resumo"
            onClick={() => setActiveTab('resumo')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'resumo'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Resumo Financeiro</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PARTICIPANTES & COTAS */}
      {/* ========================================================================= */}
      {activeTab === 'participantes' && (
        <div className="space-y-6">
          {/* Add Participant Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Adicionar Participante ao Bolão</span>
            </h3>

            {!isInlineNewParticipant ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selecionar Participante Cadastrado
                  </label>
                  <select
                    id="bolao-participant-select"
                    value={selectedParticipantId}
                    onChange={(e) => setSelectedParticipantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="">-- Selecione na lista de contatos --</option>
                    {allParticipants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Qtd. Cotas
                  </label>
                  <input
                    id="bolao-quotas-input"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={newQuotasInput}
                    onChange={(e) => setNewQuotasInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Pagamento
                  </label>
                  <select
                    id="bolao-payment-status-select"
                    value={newStatusInput}
                    onChange={(e) => setNewStatusInput(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium"
                  >
                    <option value="pago">✅ Pago (Pix)</option>
                    <option value="pendente">⏳ Pendente</option>
                  </select>
                </div>

                <div className="sm:col-span-3 flex gap-2">
                  <button
                    id="bolao-add-part-btn"
                    onClick={handleAddParticipant}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar</span>
                  </button>
                  <button
                    onClick={() => setIsInlineNewParticipant(true)}
                    title="Cadastrar novo participante agora"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
                  >
                    + Novo
                  </button>
                </div>
              </div>
            ) : (
              /* Inline new participant form */
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Cadastrar Novo Participante Rápido
                  </h4>
                  <button
                    onClick={() => setIsInlineNewParticipant(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Voltar para lista existente
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Chave PIX (para prêmios)
                    </label>
                    <input
                      type="text"
                      placeholder="CPF, e-mail ou celular"
                      value={inlinePixKey}
                      onChange={(e) => setInlinePixKey(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsInlineNewParticipant(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddParticipant}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow transition"
                  >
                    Salvar e Adicionar Cota
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Participants Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Participantes Registrados no Bolão ({bolao.participants.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Total de cotas alocadas: {financials.totalQuotasSold} de {bolao.totalQuotas}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Arrecadado: <strong className="text-emerald-600">{formatCurrency(financials.totalCollected)}</strong>
              </span>
            </div>

            {bolao.participants.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum participante adicionado a este bolão ainda. Use o formulário acima para adicionar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">Participante</th>
                      <th className="py-3.5 px-3 text-center">Nº da Cota</th>
                      <th className="py-3.5 px-3 text-center">Qtd. Cotas</th>
                      <th className="py-3.5 px-3">Total Pago</th>
                      <th className="py-3.5 px-3 text-center">Status</th>
                      <th className="py-3.5 px-3">Chave PIX</th>
                      <th className="py-3.5 px-4 text-right">Ações & WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {bolao.participants.map((bp) => {
                      const part = participantMap.get(bp.participantId);
                      const isPaid = bp.status === 'pago';
                      const totalDue = (bp.quotas || 1) * bolao.quotaPrice;
                      const quotaLabel = getParticipantQuotaLabel(bolao, bp.participantId, bp);

                      return (
                        <tr key={bp.participantId} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">
                              {part?.name || 'Participante'}
                            </div>
                            {part?.phone && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <span>{part.phone}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              {quotaLabel}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-slate-900 text-sm">
                            {bp.quotas} cota{bp.quotas > 1 ? 's' : ''}
                          </td>

                          <td className="py-3.5 px-3 font-bold text-slate-900">
                            {formatCurrency(totalDue)}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <button
                              id={`toggle-payment-${bp.participantId}`}
                              onClick={() => handleTogglePaymentStatus(bp.participantId)}
                              title="Clique para alternar entre Pago e Pendente"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition shadow-2xs ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                              }`}
                            >
                              {isPaid ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Pago</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  <span>Pendente</span>
                                </>
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-3 text-slate-600 text-[11px]">
                            {part?.pixKey ? (
                              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {part.pixKey}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Não informada</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Message Trigger */}
                              <button
                                id={`whatsapp-part-btn-${bp.participantId}`}
                                onClick={() =>
                                  onOpenWhatsAppShare(
                                    bolao,
                                    isPaid ? 'comprovante' : 'cobranca',
                                    part,
                                    bp
                                  )
                                }
                                title={isPaid ? 'Enviar Comprovante de Cota' : 'Enviar Cobrança Amigável'}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>

                              {/* Remove button */}
                              <button
                                id={`remove-part-btn-${bp.participantId}`}
                                onClick={() => handleRemoveParticipant(bp.participantId)}
                                title="Remover do bolão"
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: JOGOS & APOSTAS */}
      {/* ========================================================================= */}
      {activeTab === 'jogos' && (
        <div className="space-y-6">
          {/* Add Game / Ticket Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-emerald-600" />
                  <span>Cadastrar Apostas & Jogos</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Cadastre jogos simples ou apostas múltiplas com cálculo do custo oficial da Caixa.
                </p>
              </div>

              {/* Mode Toggle & OCR button */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="bolao-detail-ocr-btn"
                  type="button"
                  onClick={() => setIsOcrModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-3 py-1.5 font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>📸 Escanear Bilhete (IA OCR)</span>
                </button>

                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setTicketCreationMode('manual')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      ticketCreationMode === 'manual'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Aposta Interativa
                  </button>
                  <button
                    onClick={() => setTicketCreationMode('gerador')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      ticketCreationMode === 'gerador'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Surpresinha</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-mode: Manual Ball Selector */}
            {ticketCreationMode === 'manual' ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Select number count */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">Dezenas no jogo:</label>
                    <select
                      id="ticket-numbers-count-select"
                      value={ticketNumbersCount}
                      onChange={(e) => {
                        const count = parseInt(e.target.value, 10);
                        setTicketNumbersCount(count);
                        setSelectedNumbers([]);
                      }}
                      className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500"
                    >
                      {config.priceTable.map((p) => (
                        <option key={p.numbersCount} value={p.numbersCount}>
                          {p.numbersCount} dezenas ({formatCurrency(p.price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Name of game */}
                  <div className="flex-1 max-w-xs">
                    <input
                      type="text"
                      placeholder="Nome/Etiqueta do jogo (opcional)"
                      value={customTicketName}
                      onChange={(e) => setCustomTicketName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>

                  {/* Selection counter */}
                  <div className="text-xs font-semibold text-slate-600">
                    Selecionadas: <strong className="text-emerald-600 font-bold">{selectedNumbers.length}</strong> de {ticketNumbersCount}
                  </div>
                </div>

                {/* Interactive Number Ball Grid */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {Array.from({ length: config.totalRange }, (_, i) => i + 1).map((num) => {
                      const isSelected = selectedNumbers.includes(num);
                      return (
                        <button
                          key={num}
                          id={`ball-btn-${num}`}
                          onClick={() => handleToggleNumber(num)}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full font-bold text-xs transition flex items-center justify-center shadow-2xs ${
                            isSelected
                              ? 'bg-emerald-600 text-white scale-105 ring-2 ring-emerald-300'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-400 hover:text-emerald-700'
                          }`}
                        >
                          {String(num).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Numbers Summary & Submit */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500">Dezenas:</span>
                    {selectedNumbers.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Clique nas bolas acima para escolher</span>
                    ) : (
                      selectedNumbers.map((n) => (
                        <span
                          key={n}
                          className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center"
                        >
                          {String(n).padStart(2, '0')}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedNumbers([])}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Limpar
                    </button>
                    <button
                      id="save-manual-ticket-btn"
                      onClick={handleAddManualTicket}
                      disabled={selectedNumbers.length !== ticketNumbersCount}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Salvar Jogo ({formatCurrency(getOfficialGameCost(bolao.lotteryType, ticketNumbersCount))})</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Generator / Surpresinha */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dezenas por aposta
                    </label>
                    <select
                      value={ticketNumbersCount}
                      onChange={(e) => setTicketNumbersCount(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2"
                    >
                      {config.priceTable.map((p) => (
                        <option key={p.numbersCount} value={p.numbersCount}>
                          {p.numbersCount} dezenas ({formatCurrency(p.price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quantidade de apostas aleatórias
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={generatorQuantity}
                      onChange={(e) => setGeneratorQuantity(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      id="generate-random-tickets-btn"
                      onClick={handleGenerateRandomTickets}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>
                        Gerar {generatorQuantity} jogos (
                        {formatCurrency(
                          generatorQuantity * getOfficialGameCost(bolao.lotteryType, ticketNumbersCount)
                        )}
                        )
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Registered Tickets List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Apostas Oficiais Registradas ({bolao.tickets.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Custo acumulado das apostas: <strong className="text-slate-900">{formatCurrency(financials.totalTicketsCost)}</strong> ({financials.totalCombinations} combinações)
                </p>
              </div>

              <button
                id="share-tickets-whatsapp-btn"
                onClick={() => onOpenWhatsAppShare(bolao, 'jogos')}
                className="text-xs text-emerald-700 font-semibold hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Enviar Lista de Jogos</span>
              </button>
            </div>

            {bolao.tickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
                Nenhuma aposta cadastrada neste bolão ainda. Use o criador acima para registrar os jogos.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bolao.tickets.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-emerald-300 transition shadow-2xs flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {t.name || `Jogo ${idx + 1}`}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-700">
                          {formatCurrency(t.cost)}
                        </span>
                        <button
                          id={`remove-ticket-${t.id}`}
                          onClick={() => handleRemoveTicket(t.id)}
                          className="text-slate-400 hover:text-rose-600 transition p-1"
                          title="Remover aposta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Ball Numbers */}
                    <div className="flex flex-wrap gap-1.5">
                      {[...t.numbers]
                        .sort((a, b) => a - b)
                        .map((n) => {
                          const isDrawn = (bolao.drawnNumbers || []).includes(n);
                          return (
                            <span
                              key={n}
                              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition ${
                                isDrawn
                                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm ring-2 ring-amber-300'
                                  : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                              }`}
                            >
                              {String(n).padStart(2, '0')}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: BILHETES DIGITALIZADOS & COMPROVANTES */}
      {/* ========================================================================= */}
      {activeTab === 'comprovantes' && (
        <div className="space-y-6">
          {/* Digital Vault Organizer Banner */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-800 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Arquivo Digital do Organizador</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Galeria e Armazenamento de Bilhetes Oficiais
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Faça o upload e mantenha guardadas as fotos das apostas e bilhetes autenticados pela Caixa. Você pode visualizar em tela cheia, baixar os arquivos ou divulgar os jogos diretamente pelo WhatsApp.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <button
                id="bolao-ocr-comprovante-btn"
                type="button"
                onClick={() => setIsOcrModalOpen(true)}
                className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-900 text-xs font-black px-4 py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Scan className="w-4 h-4 text-emerald-600" />
                <span>Escanear por Foto (IA OCR)</span>
              </button>

              <button
                id="bolao-share-jogos-btn"
                onClick={() => onOpenWhatsAppShare(bolao, 'jogos')}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2 active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Divulgar Jogos no WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Upload Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-600" />
              <span>Enviar Fotos ou Scans dos Bilhetes Físicos</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Identificação / Legenda do Bilhete (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aposta 01 a 05 - Registrada na Lotérica Central"
                  value={uploadReceiptTitle}
                  onChange={(e) => setUploadReceiptTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-end">
                <label
                  htmlFor="receipt-file-input"
                  className={`w-full cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black py-2.5 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2 ${
                    isUploading ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isUploading ? 'Processando...' : 'Selecionar Fotos / Arquivos'}</span>
                </label>
                <input
                  id="receipt-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploading}
                  onChange={handleUploadReceipts}
                  className="hidden"
                />
              </div>
            </div>

            {/* Drag and Drop Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleUploadReceipts}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              onClick={() => document.getElementById('receipt-file-input')?.click()}
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Arraste e solte fotos de bilhetes aqui ou clique para selecionar
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Suporta múltiplas imagens (PNG, JPG, JPEG, WEBP).
                </p>
              </div>
            </div>
          </div>

          {/* Uploaded Receipts Gallery */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Bilhetes Digitalizados ({bolao.digitalReceipts?.length || 0})
                </h3>
                <p className="text-xs text-slate-500">
                  Imagens anexadas e visíveis no portal público do bolão
                </p>
              </div>

              {bolao.digitalReceipts && bolao.digitalReceipts.length > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  ✓ {bolao.digitalReceipts.length} comprovante(s) disponível(is)
                </span>
              )}
            </div>

            {!bolao.digitalReceipts || bolao.digitalReceipts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Nenhum bilhete digitalizado enviado ainda.</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                  Adicione fotos dos bilhetes reais emitidos pela casa lotérica para comprovar a realização das apostas aos participantes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {bolao.digitalReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col"
                  >
                    <div
                      className="relative h-44 bg-slate-900 cursor-pointer overflow-hidden flex items-center justify-center"
                      onClick={() => setLightboxReceipt(receipt)}
                    >
                      <img
                        src={receipt.url}
                        alt={receipt.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          className="bg-white/90 text-slate-900 rounded-full p-2 hover:bg-white shadow transition"
                          title="Ampliar foto"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-slate-900 text-xs truncate" title={receipt.title}>
                            {receipt.title}
                          </h4>
                          {receipt.fileSize && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                              {receipt.fileSize}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Enviado em {new Date(receipt.uploadedAt).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(receipt.uploadedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <button
                          onClick={() => setLightboxReceipt(receipt)}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ampliar</span>
                        </button>

                        <button
                          onClick={() => handleRemoveReceipt(receipt.id)}
                          className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 p-1 hover:bg-rose-50 rounded"
                          title="Excluir imagem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONFERIDOR DE RESULTADOS */}
      {/* ========================================================================= */}
      {activeTab === 'conferidor' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Conferência de Sorteio da Caixa Econômica Federal</span>
              </h3>
              <p className="text-xs text-slate-500">
                Informe as dezenas sorteadas no concurso para verificar automaticamente todas as apostas registradas.
              </p>
            </div>

            {/* Ball Selector for Drawn Numbers */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-inner space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Dezenas Sorteadas ({drawnInputNumbers.length} / {config.standardBetCount})
                </span>
                <button
                  onClick={() => setDrawnInputNumbers([])}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Limpar Dezenas
                </button>
              </div>

              {/* Selected Drawn Ball Visualizer */}
              <div className="flex items-center gap-2 flex-wrap min-h-[44px]">
                {drawnInputNumbers.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    Clique nos números abaixo para marcar o resultado oficial do concurso
                  </span>
                ) : (
                  drawnInputNumbers.map((num) => (
                    <span
                      key={num}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 text-sm font-black flex items-center justify-center shadow-md shadow-amber-500/30"
                    >
                      {String(num).padStart(2, '0')}
                    </span>
                  ))
                )}
              </div>

              {/* Ball Selection Grid */}
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 pt-2 border-t border-slate-800">
                {Array.from({ length: config.totalRange }, (_, i) => i + 1).map((num) => {
                  const isMarked = drawnInputNumbers.includes(num);
                  return (
                    <button
                      key={num}
                      onClick={() => handleAddDrawnBall(num)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-bold transition flex items-center justify-center ${
                        isMarked
                          ? 'bg-amber-400 text-slate-950 font-black scale-105 ring-2 ring-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {String(num).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prize input if won */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Total do Prêmio Conquistado
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={grossPrizeInput}
                    onChange={(e) => setGrossPrizeInput(e.target.value)}
                    onBlur={() => {
                      const p = parseCurrencyBRL(grossPrizeInput);
                      if (p > 0) setGrossPrizeInput(formatCurrencyNumber(p));
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500">
                  Preencha se o bolão tiver sido premiado para calcular o rateio.
                </span>
              </div>

              <div className="flex items-end">
                <button
                  id="run-check-results-btn"
                  onClick={handleCheckResults}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Conferir Todos os Jogos Agora</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Verification List */}
          {bolao.isDrawn && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">
                  Resultado dos Jogos Conferidos
                </h3>
                <button
                  onClick={() => onOpenWhatsAppShare(bolao, 'resultado')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar Resultado no WhatsApp</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bolao.tickets.map((t, idx) => {
                  const match = checkTicketMatches(t.numbers, bolao.drawnNumbers || [], bolao.lotteryType);
                  const isWon = !!match.prizeTier;

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                        isWon
                          ? 'bg-amber-50/70 border-amber-300 shadow-md ring-1 ring-amber-300'
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          {t.name || `Jogo ${idx + 1}`}
                        </span>

                        {isWon ? (
                          <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {match.prizeTier} ({match.hitCount} acertos!)
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium text-xs">
                            {match.hitCount} acertos
                          </span>
                        )}
                      </div>

                      {/* Number Balls */}
                      <div className="flex flex-wrap gap-1.5">
                        {[...t.numbers]
                          .sort((a, b) => a - b)
                          .map((n) => {
                            const isMatch = (bolao.drawnNumbers || []).includes(n);
                            return (
                              <span
                                key={n}
                                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                                  isMatch
                                    ? 'bg-amber-500 text-slate-950 font-black scale-110 shadow-sm ring-2 ring-amber-300'
                                    : 'bg-white text-slate-700 border border-slate-200'
                                }`}
                              >
                                {String(n).padStart(2, '0')}
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RATEIO & PAGAMENTOS */}
      {/* ========================================================================= */}
      {activeTab === 'rateio' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Calculadora de Rateio de Premiação</span>
              </h3>
              <p className="text-xs text-slate-500">
                Distribuição integral e proporcional de 100% do prêmio conquistado por cota com chave Pix de cada participante.
              </p>
            </div>

            {/* Prize Input and Quota Distribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prêmio Total Conquistado
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                    R$
                  </span>
                  <input
                    id="bolao-rateio-gross-prize-input"
                    type="text"
                    inputMode="decimal"
                    value={grossPrizeInput}
                    onChange={(e) => setGrossPrizeInput(e.target.value)}
                    onBlur={() => {
                      const p = parseCurrencyBRL(grossPrizeInput);
                      if (p > 0) setGrossPrizeInput(formatCurrencyNumber(p));
                    }}
                    placeholder="0,00"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Integral por Cota ({bolao.totalQuotas} cotas)
                </label>
                <div className="bg-emerald-100/80 border border-emerald-300 rounded-xl px-3.5 py-2.5 text-base font-black text-emerald-800">
                  {formatCurrency(prizeSplitSummary.netPerQuota)}
                </div>
              </div>
            </div>

            {/* Participants Payout Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Participante</th>
                    <th className="py-3 px-3 text-center">Qtd. Cotas</th>
                    <th className="py-3 px-3 text-center">% Rateio</th>
                    <th className="py-3 px-3 font-bold text-slate-900">Valor a Pagar</th>
                    <th className="py-3 px-3">Chave PIX</th>
                    <th className="py-3 px-4 text-right">Comprovante WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {prizeSplitSummary.payouts.map((p) => {
                    const isCopied = copiedPixId === p.participantId;
                    const bp = bolao.participants.find((b) => b.participantId === p.participantId);
                    const fullPart = participantMap.get(p.participantId);

                    return (
                      <tr key={p.participantId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">{p.participantName}</div>
                          {p.phone && <div className="text-[11px] text-slate-500">{p.phone}</div>}
                        </td>

                        <td className="py-3.5 px-3 text-center font-bold text-slate-900">
                          {p.quotas} cota(s)
                        </td>

                        <td className="py-3.5 px-3 text-center text-slate-600 font-semibold">
                          {p.percentage.toFixed(1)}%
                        </td>

                        <td className="py-3.5 px-3 font-black text-emerald-700 text-sm">
                          {formatCurrency(p.amount)}
                        </td>

                        <td className="py-3.5 px-3">
                          {p.pixKey ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-800 border border-slate-200">
                                {p.pixKey}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(p.pixKey || '');
                                  setCopiedPixId(p.participantId);
                                  setTimeout(() => setCopiedPixId(null), 2000);
                                }}
                                title="Copiar Chave Pix"
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Não informada</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onOpenWhatsAppShare(bolao, 'rateio', fullPart, bp)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Enviar Notificação</span>
                          </button>
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
      {/* TAB 5: RESUMO & REGRAS */}
      {/* ========================================================================= */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visual Bolão Summary Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700/80 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {config.name} • Concurso {bolao.contestNumber || '-'}
                  </span>
                  <h3 className="text-xl font-black mt-1 text-white">{bolao.title}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/40 text-xl">
                  🍀
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Data do Sorteio</span>
                  <span className="font-bold text-white text-sm">{formatDateBR(bolao.drawDate)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Valor por Cota</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatCurrency(bolao.quotaPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Total de Cotas</span>
                  <span className="font-bold text-white text-sm">{bolao.totalQuotas} cotas</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Total de Jogos / Apostas</span>
                  <span className="font-bold text-white text-sm">{bolao.tickets.length} apostas</span>
                </div>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase">Chave PIX do Bolão</span>
                <div className="font-mono text-emerald-300 font-bold break-all">
                  {bolao.pixKeyRecipient || 'organizador@bolao.com.br'}
                </div>
                {bolao.organizerName && (
                  <span className="text-[11px] text-slate-400 block pt-1">
                    Favorecido: {bolao.organizerName}
                  </span>
                )}
              </div>

              <button
                onClick={() => onOpenWhatsAppShare(bolao, 'convite')}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Copiar Mensagem Formatada para WhatsApp</span>
              </button>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
                Detalhamento Financeiro do Bolão
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Arrecadação Esperada (Cotas):</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(financials.totalExpectedRevenue)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Custo Total dos Bilhetes:</span>
                  <span className="font-bold text-slate-900">
                    - {formatCurrency(financials.totalTicketsCost)}
                  </span>
                </div>

                {bolao.adminFeePercent > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Taxa Administrativa ({bolao.adminFeePercent}%):</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(financials.adminFeeAmount)}
                    </span>
                  </div>
                )}

                {bolao.reserveFundAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Fundo de Reserva:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(bolao.reserveFundAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-lg border border-emerald-100 text-sm">
                  <span className="font-bold text-emerald-900">Saldo Previsto / Margem:</span>
                  <span className="font-extrabold text-emerald-700">
                    {formatCurrency(financials.surplusOrBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Full-Screen Receipt Inspection */}
      {lightboxReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6 animate-fadeIn">
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="font-bold text-sm sm:text-base text-white">{lightboxReceipt.title}</h4>
                <p className="text-[11px] text-slate-400">
                  Enviado em {new Date(lightboxReceipt.uploadedAt).toLocaleDateString('pt-BR')} • {lightboxReceipt.fileSize}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={lightboxReceipt.url}
                download={`${lightboxReceipt.title}.png`}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
                title="Baixar imagem original"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Baixar</span>
              </a>

              <button
                onClick={() => setLightboxReceipt(null)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div className="w-full max-w-5xl flex-1 flex items-center justify-center py-4 overflow-auto">
            <img
              src={lightboxReceipt.url}
              alt={lightboxReceipt.title}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="text-center text-xs text-slate-400 pt-2">
            Clique no X ou fora da imagem para fechar. Esta imagem está visível para os participantes via link exclusivo.
          </div>
        </div>
      )}

      {/* OCR Ticket Scanner Modal */}
      <TicketOcrScannerModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onSaveGames={handleSaveOcrGames}
        initialLotteryType={bolao.lotteryType}
        drawnNumbers={bolao.drawnNumbers || []}
        bolaoTitle={bolao.title}
      />
    </div>
  );
};
