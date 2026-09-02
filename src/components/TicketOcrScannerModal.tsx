import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Eye,
  Plus,
  Trash2,
  FileText,
  Scan,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { LotteryType } from '../types';
import { LOTTERY_CONFIGS } from '../data/lotteries';
import { formatCurrency, getOfficialGameCost } from '../utils/calculator';
import { scanTicketWithAI, ScannedGame, OcrTicketResult } from '../services/ticketOcrService';

interface TicketOcrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveGames: (
    games: ScannedGame[],
    lotteryType: LotteryType,
    contestNumber?: string,
    receiptImage?: string
  ) => void;
  initialLotteryType?: LotteryType;
  drawnNumbers?: number[];
  bolaoTitle?: string;
}

export const TicketOcrScannerModal: React.FC<TicketOcrScannerModalProps> = ({
  isOpen,
  onClose,
  onSaveGames,
  initialLotteryType = 'mega-sena',
  drawnNumbers = [],
  bolaoTitle,
}) => {
  const [lotteryType, setLotteryType] = useState<LotteryType>(initialLotteryType);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  // Extracted data state
  const [ocrResult, setOcrResult] = useState<OcrTicketResult | null>(null);
  const [editableGames, setEditableGames] = useState<ScannedGame[]>([]);
  const [contestNumber, setContestNumber] = useState<string>('');
  const [drawDate, setDrawDate] = useState<string>('');

  // Image viewer controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Quick manual ball editor state
  const [editingGameIndex, setEditingGameIndex] = useState<number | null>(0);
  const [manualBallInput, setManualBallInput] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentConfig = LOTTERY_CONFIGS[lotteryType] || LOTTERY_CONFIGS['mega-sena'];

  // Handle file select (from upload or camera)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setZoomLevel(1);
      setRotation(0);
      // Auto trigger AI scan
      processOcr(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  // Perform AI Multimodal OCR
  const processOcr = async (imageBase64: string, mime: string) => {
    setIsScanning(true);
    setScanError(null);
    setScanWarning(null);

    try {
      const response = await scanTicketWithAI(imageBase64, mime, lotteryType);

      if (response.success && response.data) {
        setOcrResult(response.data);
        if (response.data.lotteryType && LOTTERY_CONFIGS[response.data.lotteryType]) {
          setLotteryType(response.data.lotteryType);
        }
        setContestNumber(response.data.contestNumber || '');
        setDrawDate(response.data.drawDate || '');
        setEditableGames(response.data.games || []);
        if (response.warning) {
          setScanWarning(response.warning);
        }
        setEditingGameIndex(0);
      } else {
        setScanError(response.error || 'Não foi possível ler as dezenas automaticamente. Tente outra foto mais nítida.');
      }
    } catch (err: any) {
      setScanError(err?.message || 'Falha na comunicação com o serviço de visão.');
    } finally {
      setIsScanning(false);
    }
  };

  // Re-scan current image
  const handleRescan = () => {
    if (selectedImage) {
      processOcr(selectedImage, imageMime);
    }
  };

  // Load a demo synthetic ticket for testing
  const handleLoadDemoTicket = (demoType: LotteryType) => {
    setLotteryType(demoType);

    // Create a demo canvas graphic simulating a Caixa ticket
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('LOTERIAS CAIXA', 40, 50);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = LOTTERY_CONFIGS[demoType]?.color || '#059669';
      ctx.fillText(`COMPROVANTE OFICIAL: ${LOTTERY_CONFIGS[demoType]?.name.toUpperCase()}`, 40, 90);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`CONCURSO: 2850     DATA: ${new Date().toLocaleDateString('pt-BR')}`, 40, 125);
      ctx.fillText('------------------------------------------------', 40, 145);

      if (demoType === 'mega-sena') {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('[JOGO A]  04  12  28  35  44  59  (06 DEZENAS)', 40, 185);
        ctx.fillText('[JOGO B]  02  15  23  37  41  58  (06 DEZENAS)', 40, 230);
        ctx.fillText('[JOGO C]  07  19  22  30  49  60  (06 DEZENAS)', 40, 275);
      } else if (demoType === 'lotofacil') {
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('[JOGO A] 01 02 03 05 07 09 11 13 15 17 19 20 21 23 25', 40, 185);
        ctx.fillText('[JOGO B] 01 04 06 08 10 12 14 15 16 18 20 22 23 24 25', 40, 230);
      } else {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('[JOGO A]  08  17  34  49  65  (05 DEZENAS)', 40, 185);
        ctx.fillText('[JOGO B]  05  22  38  51  70  (05 DEZENAS)', 40, 230);
      }

      ctx.font = '14px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('------------------------------------------------', 40, 330);
      ctx.fillText('VALOR TOTAL: R$ 15,00', 40, 360);
      ctx.fillText('AUTENTICACAO DIGITAL: 9812.4431.0029.8821.5541', 40, 390);

      // Barcode simulation
      ctx.fillStyle = '#0f172a';
      for (let x = 40; x < 540; x += 6) {
        if (Math.random() > 0.3) {
          ctx.fillRect(x, 430, Math.random() > 0.5 ? 4 : 2, 60);
        }
      }
    }

    const demoDataUrl = canvas.toDataURL('image/jpeg');
    setSelectedImage(demoDataUrl);
    setImageMime('image/jpeg');
    setZoomLevel(1);
    setRotation(0);
    processOcr(demoDataUrl, 'image/jpeg');
  };

  // Toggle or add number to specific game
  const handleToggleNumberInGame = (gameIdx: number, num: number) => {
    setEditableGames((prev) => {
      const updated = [...prev];
      const game = { ...updated[gameIdx] };
      const nums = game.numbers || [];

      if (nums.includes(num)) {
        game.numbers = nums.filter((n) => n !== num).sort((a, b) => a - b);
      } else {
        game.numbers = [...nums, num].sort((a, b) => a - b);
      }
      game.numbersCount = game.numbers.length;
      game.cost = getOfficialGameCost(lotteryType, game.numbersCount);
      updated[gameIdx] = game;
      return updated;
    });
  };

  // Add a new empty game slot
  const handleAddNewGameSlot = () => {
    const newIdx = editableGames.length + 1;
    const newGame: ScannedGame = {
      label: `Jogo ${newIdx}`,
      numbersCount: currentConfig.standardBetCount,
      numbers: [],
      cost: getOfficialGameCost(lotteryType, currentConfig.standardBetCount),
    };
    setEditableGames((prev) => [...prev, newGame]);
    setEditingGameIndex(editableGames.length);
  };

  // Remove a game slot
  const handleRemoveGame = (index: number) => {
    setEditableGames((prev) => prev.filter((_, idx) => idx !== index));
    if (editingGameIndex === index) {
      setEditingGameIndex(0);
    }
  };

  // Save validated games to bolão
  const handleConfirmAndSave = () => {
    const validGames = editableGames.filter((g) => g.numbers && g.numbers.length > 0);
    if (validGames.length === 0) {
      alert('Nenhum jogo com dezenas válidas para salvar.');
      return;
    }

    onSaveGames(validGames, lotteryType, contestNumber, selectedImage || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Leitura Automática de Bilhetes por Foto (IA OCR)
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-600" />
                  Visão Caixa
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Tire uma foto ou envie a imagem do comprovante oficial para extração e conferência em tempo real.
                {bolaoTitle && <span className="font-bold text-slate-700"> • {bolaoTitle}</span>}
              </p>
            </div>
          </div>

          <button
            id="ocr-modal-close-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1">
          {/* LEFT SIDE: Image Upload / Camera & Live Document Viewer (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Comprovante Escaneado
              </span>

              {selectedImage && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                    className="p-1 text-slate-500 hover:bg-slate-100 rounded-md"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-slate-500 font-bold px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                    className="p-1 text-slate-500 hover:bg-slate-100 rounded-md"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1 text-slate-500 hover:bg-slate-100 rounded-md ml-1"
                    title="Girar Imagem"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Image Preview Container */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[260px] max-h-[360px] flex items-center justify-center p-2 shadow-inner">
              {selectedImage ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto">
                  <img
                    src={selectedImage}
                    alt="Comprovante de Loteria"
                    referrerPolicy="no-referrer"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out',
                    }}
                    className="max-h-[340px] max-w-full object-contain rounded-lg shadow-md"
                  />
                </div>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center border border-slate-700">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-200 font-bold">Nenhum bilhete carregado</p>
                    <p className="text-[11px] text-slate-400">
                      Tire uma foto nítida do bilhete da Caixa ou envie um arquivo do seu dispositivo.
                    </p>
                  </div>
                </div>
              )}

              {/* Scanning Overlay Indicator */}
              {isScanning && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-3 z-10">
                  <div className="relative">
                    <RefreshCw className="w-9 h-9 text-emerald-400 animate-spin" />
                    <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">IA Analisando Comprovante...</h4>
                    <p className="text-[11px] text-emerald-300 font-medium mt-0.5">
                      Identificando loteria, concurso, jogos e dezenas apostadas
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons: Camera & Upload & Test Demos */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tirar Foto (Câmera)</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Carregar Arquivo</span>
                </button>
              </div>

              {/* Demo quick tests */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Testar Exemplo:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLoadDemoTicket('mega-sena')}
                    className="text-[10px] font-extrabold bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded-lg transition"
                  >
                    Mega-Sena
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadDemoTicket('lotofacil')}
                    className="text-[10px] font-extrabold bg-white border border-purple-200 text-purple-800 hover:bg-purple-50 px-2 py-1 rounded-lg transition"
                  >
                    Lotofácil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadDemoTicket('quina')}
                    className="text-[10px] font-extrabold bg-white border border-blue-200 text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition"
                  >
                    Quina
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Extracted Numbers, Real-time Validation & Live Conference (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Dezenas Reconhecidas para Validação
              </span>

              {selectedImage && !isScanning && (
                <button
                  type="button"
                  onClick={handleRescan}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reescanear Imagem</span>
                </button>
              )}
            </div>

            {/* Error or Warning Banner */}
            {scanError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="block font-bold">Erro no reconhecimento</strong>
                  <span>{scanError}</span>
                </div>
              </div>
            )}

            {scanWarning && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{scanWarning}</span>
              </div>
            )}

            {/* Ticket Info Headers (Lottery, Contest, Draw Date) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Modalidade
                </label>
                <select
                  value={lotteryType}
                  onChange={(e) => setLotteryType(e.target.value as LotteryType)}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.values(LOTTERY_CONFIGS).map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Nº Concurso
                </label>
                <input
                  type="text"
                  placeholder="Ex: 2850"
                  value={contestNumber}
                  onChange={(e) => setContestNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Data Sorteio
                </label>
                <input
                  type="text"
                  placeholder="AAAA-MM-DD"
                  value={drawDate}
                  onChange={(e) => setDrawDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Games Recognized / Verified Cards */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[340px] pr-1">
              {editableGames.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <p>Envie uma imagem do comprovante ou use um dos botões de exemplo para ver as dezenas aqui.</p>
                  <button
                    type="button"
                    onClick={handleAddNewGameSlot}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar jogo manualmente</span>
                  </button>
                </div>
              ) : (
                editableGames.map((game, gIdx) => {
                  const numbers = game.numbers || [];
                  const hitsWithDrawn = numbers.filter((n) => drawnNumbers.includes(n));
                  const isSelectedForEdit = editingGameIndex === gIdx;

                  return (
                    <div
                      key={gIdx}
                      className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                        isSelectedForEdit
                          ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                            {gIdx + 1}
                          </span>
                          <span className="font-extrabold text-slate-900 text-xs">
                            {game.label || `Jogo ${gIdx + 1}`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ({numbers.length} dezenas)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {drawnNumbers.length > 0 && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                hitsWithDrawn.length >= 4
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {hitsWithDrawn.length} acerto(s)
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingGameIndex(isSelectedForEdit ? null : gIdx)}
                            className="text-[11px] font-bold text-emerald-700 hover:underline px-1.5 py-0.5"
                          >
                            {isSelectedForEdit ? 'Fechar Edição' : 'Ajustar Dezenas'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveGame(gIdx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition"
                            title="Remover este jogo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Number Badges */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {numbers.map((n) => {
                          const isDrawn = drawnNumbers.includes(n);
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => handleToggleNumberInGame(gIdx, n)}
                              title="Clique para remover dezena"
                              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                                isDrawn
                                  ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300 shadow-sm'
                                  : 'bg-white text-slate-800 border border-slate-200 shadow-2xs hover:border-rose-400 hover:text-rose-600'
                              }`}
                            >
                              {String(n).padStart(2, '0')}
                            </button>
                          );
                        })}

                        {numbers.length === 0 && (
                          <span className="text-xs text-slate-400 italic">
                            Nenhuma dezena selecionada neste jogo.
                          </span>
                        )}
                      </div>

                      {/* Interactive Ball Picker when Editing this specific game */}
                      {isSelectedForEdit && (
                        <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                          <span className="text-[10px] font-bold text-emerald-950 block">
                            Clique nos números abaixo para marcar / desmarcar dezenas no {game.label || `Jogo ${gIdx + 1}`}:
                          </span>
                          <div className="grid grid-cols-10 gap-1 bg-white p-2.5 rounded-xl border border-emerald-200 max-h-[140px] overflow-y-auto">
                            {Array.from({ length: currentConfig.totalRange }, (_, i) => i + 1).map((num) => {
                              const isChecked = numbers.includes(num);
                              const isDrawn = drawnNumbers.includes(num);
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => handleToggleNumberInGame(gIdx, num)}
                                  className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition cursor-pointer ${
                                    isChecked
                                      ? isDrawn
                                        ? 'bg-amber-400 text-slate-950 font-black'
                                        : 'bg-emerald-600 text-white'
                                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {String(num).padStart(2, '0')}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <button
                type="button"
                onClick={handleAddNewGameSlot}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Adicionar Outro Jogo / Bilhete Extra</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Total de {editableGames.length} jogo(s) validados para inclusão.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="ocr-confirm-save-btn"
              type="button"
              onClick={handleConfirmAndSave}
              disabled={editableGames.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs px-5 py-2.5 rounded-2xl shadow-md shadow-emerald-200 transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Validar e Salvar no Bolão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
