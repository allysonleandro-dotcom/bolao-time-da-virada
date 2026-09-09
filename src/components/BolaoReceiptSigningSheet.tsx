import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  Copy,
  Check,
  Edit3,
  RotateCcw,
  FileSignature,
  FileText,
  Users,
  Info,
} from 'lucide-react';
import { Bolao, Participant } from '../types';
import {
  formatCurrency,
  formatDateLongBR,
  generateDefaultDeclarationText,
  generateDefaultStructureText,
  getLotteryDisplayName,
  extractNameAndPhone,
  getParticipantQuotaLabel,
} from '../utils/calculator';
import { exportBolaoQuotaReceiptsPDF } from '../utils/pdfGenerator';

interface BolaoReceiptSigningSheetProps {
  bolao: Bolao;
  allParticipants: Participant[];
  onBackToBolao?: () => void;
}

export const BolaoReceiptSigningSheet: React.FC<BolaoReceiptSigningSheetProps> = ({
  bolao,
  allParticipants,
  onBackToBolao,
}) => {
  const defaultLotteryName = getLotteryDisplayName(bolao);
  const defaultContestNumber = bolao.contestNumber || '';
  const defaultDrawDateFormatted = formatDateLongBR(bolao.drawDate);

  const defaultEstimatedPrize =
    typeof bolao.estimatedPrize === 'string' && bolao.estimatedPrize
      ? bolao.estimatedPrize
      : typeof bolao.estimatedPrize === 'number' && bolao.estimatedPrize > 0
      ? formatCurrency(bolao.estimatedPrize)
      : bolao.title.toLowerCase().includes('independência') || bolao.title.toLowerCase().includes('independencia')
      ? 'R$ 300 milhões'
      : bolao.title.toLowerCase().includes('virada')
      ? 'R$ 600 milhões'
      : 'R$ 300 milhões';

  const defaultStructure = generateDefaultStructureText(bolao);

  const [lotteryName, setLotteryName] = useState(defaultLotteryName);
  const [contestNumber, setContestNumber] = useState(defaultContestNumber);
  const [drawDateFormatted, setDrawDateFormatted] = useState(defaultDrawDateFormatted);
  const [estimatedPrize, setEstimatedPrize] = useState(defaultEstimatedPrize);
  const [structureText, setStructureText] = useState(defaultStructure);

  const [declarationText, setDeclarationText] = useState(() =>
    generateDefaultDeclarationText({
      lotteryName: defaultLotteryName,
      contestNumber: defaultContestNumber,
      estimatedPrize: defaultEstimatedPrize,
      drawDateFormatted: defaultDrawDateFormatted,
    })
  );

  const [groupByQuota, setGroupByQuota] = useState(true);
  const [includeAvailableQuotas, setIncludeAvailableQuotas] = useState(true);
  const [showSignatureLine, setShowSignatureLine] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Recalculate auto declaration text
  const handleResetDeclaration = () => {
    const autoLottery = getLotteryDisplayName(bolao);
    const autoContest = bolao.contestNumber || '';
    const autoDate = formatDateLongBR(bolao.drawDate);
    const autoPrize = defaultEstimatedPrize;
    const autoStruct = generateDefaultStructureText(bolao);

    setLotteryName(autoLottery);
    setContestNumber(autoContest);
    setDrawDateFormatted(autoDate);
    setEstimatedPrize(autoPrize);
    setStructureText(autoStruct);

    setDeclarationText(
      generateDefaultDeclarationText({
        lotteryName: autoLottery,
        contestNumber: autoContest,
        estimatedPrize: autoPrize,
        drawDateFormatted: autoDate,
      })
    );
  };

  const handleUpdateFieldAndDeclaration = (
    field: 'lottery' | 'contest' | 'prize' | 'date' | 'structure',
    val: string
  ) => {
    let nextLottery = lotteryName;
    let nextContest = contestNumber;
    let nextPrize = estimatedPrize;
    let nextDate = drawDateFormatted;

    if (field === 'lottery') {
      setLotteryName(val);
      nextLottery = val;
    } else if (field === 'contest') {
      setContestNumber(val);
      nextContest = val;
    } else if (field === 'prize') {
      setEstimatedPrize(val);
      nextPrize = val;
    } else if (field === 'date') {
      setDrawDateFormatted(val);
      nextDate = val;
    } else if (field === 'structure') {
      setStructureText(val);
      return;
    }

    setDeclarationText(
      generateDefaultDeclarationText({
        lotteryName: nextLottery,
        contestNumber: nextContest,
        estimatedPrize: nextPrize,
        drawDateFormatted: nextDate,
      })
    );
  };

  const handleCopyDeclaration = () => {
    const fullText = `RECEBIMENTO DE COTA DE LOTERIA\n\nEstrutura de Aposta: ${structureText}\n\n${declarationText}\n\nBolão: ${bolao.title}\nTotal de Cotas: ${bolao.totalQuotas} | Valor por Cota: ${formatCurrency(bolao.quotaPrice)}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPDF = () => {
    exportBolaoQuotaReceiptsPDF({
      bolao,
      allParticipants,
      structureText,
      declarationText,
      estimatedPrize,
      lotteryName,
      contestNumber,
      drawDateFormatted,
      organizerName: bolao.organizerName || 'Organizador do Bolão',
      groupByQuota,
      includeAvailableQuotas,
      showSignatureLine,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Build rows for preview
  const partMap = new Map<string, Participant>(allParticipants.map((p) => [p.id, p]));
  const totalQuotasNum = Number(bolao.totalQuotas) || 0;
  const currentYear = new Date().getFullYear();
  const datePlaceholder = `___/___/${currentYear}`;

  type PreviewRow = {
    cotaLabel: string;
    name: string;
    datePlaceholder: string;
    isAvailable?: boolean;
  };

  const rows: PreviewRow[] = [];

  if (groupByQuota && totalQuotasNum > 0) {
    const quotaToParticipant = new Map<number, { name: string }>();

    bolao.participants.forEach((bp) => {
      const p = partMap.get(bp.participantId);
      let rawName = p?.name || '';
      if (!rawName && bp.participantId) {
        rawName = bp.participantId.replace(/^part-/, '');
      }
      const contact = extractNameAndPhone(rawName, p?.phone);
      const cleanName = (contact.cleanName || 'COTA NÃO IDENTIFICADA').toUpperCase();

      if (bp.quotaNumbers && bp.quotaNumbers.length > 0) {
        bp.quotaNumbers.forEach((qn) => {
          const num = Number(qn);
          if (!isNaN(num)) {
            quotaToParticipant.set(num, { name: cleanName });
          }
        });
      }
    });

    for (let q = 1; q <= totalQuotasNum; q++) {
      const assigned = quotaToParticipant.get(q);
      const cotaLabel = `Cota ${String(q).padStart(2, '0')}`;
      if (assigned) {
        rows.push({
          cotaLabel,
          name: assigned.name,
          datePlaceholder,
        });
      } else if (includeAvailableQuotas) {
        rows.push({
          cotaLabel,
          name: 'COTA DISPONÍVEL (EM ABERTO)',
          datePlaceholder,
          isAvailable: true,
        });
      }
    }
  } else {
    const sortedParticipants = [...bolao.participants].sort((a, b) => {
      const aFirst = Number(a.quotaNumbers?.[0] ?? 999);
      const bFirst = Number(b.quotaNumbers?.[0] ?? 999);
      return aFirst - bFirst;
    });

    sortedParticipants.forEach((bp) => {
      const p = partMap.get(bp.participantId);
      let rawName = p?.name || '';
      if (!rawName && bp.participantId) {
        rawName = bp.participantId.replace(/^part-/, '');
      }
      const contact = extractNameAndPhone(rawName, p?.phone);
      const cleanName = (contact.cleanName || 'COTA NÃO IDENTIFICADA').toUpperCase();
      const quotaLabel = getParticipantQuotaLabel(bolao, bp.participantId, bp);

      rows.push({
        cotaLabel: quotaLabel,
        name: cleanName,
        datePlaceholder,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Print styles to ensure only the document prints cleanly */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-quota-receipt-sheet,
          #printable-quota-receipt-sheet * {
            visibility: visible;
          }
          #printable-quota-receipt-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Control / Toolbar Card (Hidden in Print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                <FileSignature className="w-3.5 h-3.5" />
                Documento de Assinatura
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {rows.length} {groupByQuota ? 'cotas listadas' : 'participantes listados'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Recebimento de cota de loteria
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Folha oficial com declaração e espaço para assinatura física/rubrica dos participantes ao entregarem ou receberem suas cotas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-edit-receipt-decl"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-slate-500" />
              <span>{isConfigOpen ? 'Fechar Ajustes' : 'Ajustar Declaração'}</span>
            </button>

            <button
              id="btn-copy-receipt-decl"
              onClick={handleCopyDeclaration}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>

            <button
              id="btn-print-receipt-sheet"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>Imprimir</span>
            </button>

            <button
              id="btn-download-pdf-receipt-sheet"
              onClick={handleDownloadPDF}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95"
            >
              <FileDown className="w-4 h-4 text-white" />
              <span>Baixar PDF (A4)</span>
            </button>
          </div>
        </div>

        {/* Toggle Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
              <input
                type="radio"
                name="groupingMode"
                checked={groupByQuota}
                onChange={() => setGroupByQuota(true)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span>1 linha por cota (Cota 01, Cota 02...)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
              <input
                type="radio"
                name="groupingMode"
                checked={!groupByQuota}
                onChange={() => setGroupByQuota(false)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span>1 linha por participante (Agrupar cotas)</span>
            </label>

            {groupByQuota && (
              <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-slate-600 ml-2 border-l border-slate-200 pl-3">
                <input
                  type="checkbox"
                  checked={includeAvailableQuotas}
                  onChange={(e) => setIncludeAvailableQuotas(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Incluir cotas disponíveis</span>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-slate-600 ml-2 border-l border-slate-200 pl-3">
              <input
                type="checkbox"
                checked={showSignatureLine}
                onChange={(e) => setShowSignatureLine(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Linha pontilhada na assinatura</span>
            </label>
          </div>

          <div className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Documento no formato padrão A4 com espaço amplo para assinatura física.</span>
          </div>
        </div>

        {/* Customization Drawer / Accordion */}
        {isConfigOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-5 sm:p-6 rounded-b-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Personalizar Informações da Declaração</span>
              </h4>
              <button
                onClick={handleResetDeclaration}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Valores Automáticos</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Modalidade / Loteria
                </label>
                <input
                  type="text"
                  value={lotteryName}
                  onChange={(e) => handleUpdateFieldAndDeclaration('lottery', e.target.value)}
                  placeholder="Ex: Lotofácil da Independência"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Concurso
                </label>
                <input
                  type="text"
                  value={contestNumber}
                  onChange={(e) => handleUpdateFieldAndDeclaration('contest', e.target.value)}
                  placeholder="Ex: 3780"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Prêmio Estimado
                </label>
                <input
                  type="text"
                  value={estimatedPrize}
                  onChange={(e) => handleUpdateFieldAndDeclaration('prize', e.target.value)}
                  placeholder="Ex: R$ 300 milhões"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Data do Sorteio por Extenso
                </label>
                <input
                  type="text"
                  value={drawDateFormatted}
                  onChange={(e) => handleUpdateFieldAndDeclaration('date', e.target.value)}
                  placeholder="Ex: 15 de setembro de 2026"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Estrutura de Aposta (Aparece em destaque logo abaixo do título)
              </label>
              <input
                type="text"
                value={structureText}
                onChange={(e) => handleUpdateFieldAndDeclaration('structure', e.target.value)}
                placeholder="Ex: 1 aposta de 18 dezenas (equivalente a 816 apostas simples)"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Texto Completo da Declaração
              </label>
              <textarea
                rows={2}
                value={declarationText}
                onChange={(e) => setDeclarationText(e.target.value)}
                placeholder="Texto da declaração de recebimento..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DOCUMENT PREVIEW & PRINTABLE CONTAINER (Simulates A4 Paper Layout) */}
      {/* ========================================================================= */}
      <div className="flex justify-center">
        <div
          id="printable-quota-receipt-sheet"
          className="w-full max-w-[840px] bg-white rounded-2xl sm:rounded-3xl border border-slate-300/80 shadow-md p-6 sm:p-10 space-y-6 text-slate-800 transition-all font-sans"
        >
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4 text-center relative">
            <span className="text-[10px] tracking-widest font-black uppercase text-slate-500 block mb-1">
              BOLÃO TIME DA VIRADA • COMPROVANTE DE ENTREGA E CIÊNCIA
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
              Recebimento de cota de loteria
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              {bolao.title}
            </p>
            <div className="absolute right-0 top-0 text-[10px] text-slate-400 hidden sm:block">
              Emissão: {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>

          {/* Official Declaration Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
            {/* Estrutura de Aposta */}
            <div className="text-xs sm:text-sm text-slate-900">
              <span className="font-bold text-slate-950">Estrutura de Aposta: </span>
              <span className="font-semibold text-slate-800">{structureText}</span>
            </div>

            {/* Declaração Principal */}
            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
              {declarationText}
            </div>

            {/* Secondary Metadata Info Strip */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-600 gap-2">
              <div>
                <span className="text-slate-500 font-normal">Total de Cotas: </span>
                <span className="font-bold text-slate-900">{bolao.totalQuotas}</span>
              </div>
              <div>
                <span className="text-slate-500 font-normal">Valor por Cota: </span>
                <span className="font-bold text-slate-900">{formatCurrency(bolao.quotaPrice)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-normal">Data do Sorteio: </span>
                <span className="font-bold text-slate-900">{drawDateFormatted}</span>
              </div>
              <div>
                <span className="text-slate-500 font-normal">Organizador: </span>
                <span className="font-bold text-slate-900">{bolao.organizerName || 'Bolão Oficial'}</span>
              </div>
            </div>
          </div>

          {/* Table of Participants with Signature Space */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-[11px]">
                  <th className="py-2.5 px-3 border border-slate-700 text-center w-20">
                    Cota
                  </th>
                  <th className="py-2.5 px-3 border border-slate-700 w-56 sm:w-64">
                    Nome do Participante
                  </th>
                  <th className="py-2.5 px-3 border border-slate-700 text-center w-28 sm:w-32 whitespace-nowrap">
                    Data
                  </th>
                  <th className="py-2.5 px-3 border border-slate-700 text-center">
                    Assinatura do Participante
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`h-11 ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap align-middle">
                      {row.cotaLabel}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 font-bold text-slate-900 align-middle">
                      {row.isAvailable ? (
                        <span className="text-slate-400 italic font-normal">
                          {row.name}
                        </span>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 text-center font-semibold text-xs text-slate-700 whitespace-nowrap align-middle">
                      {row.datePlaceholder}
                    </td>
                    <td className="py-2.5 px-4 border border-slate-200 align-middle bg-white">
                      {showSignatureLine ? (
                        <div className="border-b border-dashed border-slate-300 w-full"></div>
                      ) : (
                        <div className="h-6"></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Terms & Closing Signature Block */}
          <div className="pt-6 border-t border-slate-200 space-y-8">
            <p className="text-[10px] text-slate-500 leading-relaxed text-center">
              Declaração de Recebimento: O participante signatário acima atesta ter recebido a respectiva cota e/ou cópia dos bilhetes oficiais deste bolão, concordando expressamente com as regras de rateio e premiação descritas no regulamento do Bolão Time da Virada.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
              <div className="text-center">
                <div className="border-b border-slate-400 mx-auto w-48 sm:w-64 mb-1.5"></div>
                <p className="text-[11px] font-bold text-slate-800">
                  Data de Emissão: _____/_____/2026
                </p>
                <p className="text-[10px] text-slate-500">
                  Assinatura do Recebedor / Responsável
                </p>
              </div>

              <div className="text-center">
                <div className="border-b border-slate-400 mx-auto w-48 sm:w-64 mb-1.5"></div>
                <p className="text-[11px] font-bold text-slate-800">
                  {bolao.organizerName || 'Organizador do Bolão'}
                </p>
                <p className="text-[10px] text-slate-500">
                  Coordenação & Administração do Bolão
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
