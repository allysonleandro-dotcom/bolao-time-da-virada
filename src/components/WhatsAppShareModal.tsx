import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MessageSquare,
  Copy,
  Check,
  Share2,
  Edit3,
  RotateCcw,
  Save,
  Bold,
  Italic,
  Code,
  Tag,
  User,
  Phone,
  Ticket,
  ChevronDown,
} from 'lucide-react';
import { Bolao, BolaoParticipant, Participant } from '../types';
import {
  generateWhatsAppMessage,
  formatBolaoBetSummary,
  calculateBolaoFinancials,
  extractNameAndPhone,
  getParticipantQuotaLabel,
  formatCurrency,
} from '../utils/calculator';
import { formatDateBR } from '../utils/pdfGenerator';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  bolao: Bolao | null;
  initialType?:
    | 'convite'
    | 'comprovante'
    | 'jogos'
    | 'resultado'
    | 'rateio'
    | 'cobranca'
    | 'participantes';
  participant?: Participant;
  bolaoParticipant?: BolaoParticipant;
  allParticipants?: Participant[];
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  bolao,
  initialType = 'convite',
  participant,
  bolaoParticipant,
  allParticipants = [],
}) => {
  const [messageType, setMessageType] = useState<
    | 'convite'
    | 'comprovante'
    | 'jogos'
    | 'resultado'
    | 'rateio'
    | 'cobranca'
    | 'participantes'
  >(initialType);

  // Selected participant state (can be switched within the modal)
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    participant?.id || bolaoParticipant?.participantId || ''
  );
  const [customPhone, setCustomPhone] = useState<string>('');

  const [editedText, setEditedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize immediately whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setMessageType(initialType);
      const pId = participant?.id || bolaoParticipant?.participantId || '';
      setSelectedParticipantId(pId);
      setIsEditMode(false);
    }
  }, [isOpen, initialType, participant, bolaoParticipant]);

  // Derive active selected participant ID
  const effectivePartId = selectedParticipantId !== '' 
    ? selectedParticipantId 
    : (participant?.id || bolaoParticipant?.participantId || '');

  // Derive resolved participant object
  const activePart = React.useMemo(() => {
    if (!effectivePartId) return undefined;
    
    if (participant && (participant.id === effectivePartId || participant.name.toLowerCase() === effectivePartId.toLowerCase())) {
      return participant;
    }

    const found = allParticipants.find(
      (p) =>
        p.id === effectivePartId ||
        p.name.toLowerCase() === effectivePartId.toLowerCase() ||
        p.id.toLowerCase().includes(effectivePartId.toLowerCase()) ||
        effectivePartId.toLowerCase().includes(p.id.toLowerCase())
    );
    if (found) return found;

    if (participant) return participant;

    let cleanSlug = effectivePartId.replace(/^part-/, '');
    if (cleanSlug && !cleanSlug.includes(' ') && !/[A-Z]/.test(cleanSlug)) {
      cleanSlug = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
    }
    return {
      id: effectivePartId,
      name: cleanSlug || 'Participante',
      phone: '',
      createdAt: '',
    };
  }, [effectivePartId, allParticipants, participant]);

  // Derive resolved bolao participant (quotas, status, etc.)
  const activeBolaoPart = React.useMemo(() => {
    if (!bolao || !effectivePartId) return bolaoParticipant;
    const found = bolao.participants.find(
      (bp) =>
        bp.participantId === effectivePartId ||
        bp.participantId.toLowerCase() === effectivePartId.toLowerCase()
    );
    return found || bolaoParticipant;
  }, [bolao, effectivePartId, bolaoParticipant]);

  // Extract clean contact info
  const parsedContact = React.useMemo(() => {
    if (!activePart) {
      return { cleanName: '', phone: '', formattedPhone: '', cleanDigitsPhone: '' };
    }
    return extractNameAndPhone(activePart.name, activePart.phone);
  }, [activePart]);

  // Update customPhone whenever active participant changes
  useEffect(() => {
    if (parsedContact.formattedPhone) {
      setCustomPhone(parsedContact.formattedPhone);
    } else {
      setCustomPhone('');
    }
  }, [parsedContact]);

  // Load message dynamically with participant, quota, and status
  useEffect(() => {
    if (bolao && isOpen) {
      const partMap = new Map<string, Participant>();
      allParticipants.forEach((p) => partMap.set(p.id, p));

      // Check if user has saved a custom template override for this type in localStorage
      const customSavedTemplate = localStorage.getItem(`whatsapp_custom_template_${messageType}`);

      if (customSavedTemplate && customSavedTemplate.includes('{')) {
        const fin = calculateBolaoFinancials(bolao);
        const betSummary = formatBolaoBetSummary(bolao, true);
        const quotaLabel = getParticipantQuotaLabel(
          bolao,
          activePart?.id || activeBolaoPart?.participantId,
          activeBolaoPart
        );
        const quotaCount = activeBolaoPart?.quotas || 1;
        const totalQuotaVal = formatCurrency(quotaCount * bolao.quotaPrice);
        const isPaid = activeBolaoPart?.status === 'pago';

        // Substitute variables if any exist
        let rendered = customSavedTemplate
          .replace(/\{NOME\}/gi, parsedContact.cleanName || 'Participante')
          .replace(/\{CONTATO\}/gi, customPhone || parsedContact.formattedPhone || '')
          .replace(/\{BOLAO\}/gi, bolao.title || 'Bolão')
          .replace(/\{CONCURSO\}/gi, bolao.contestNumber || '')
          .replace(/\{DATA_SORTEIO\}/gi, formatDateBR(bolao.drawDate))
          .replace(/\{COTA\}/gi, quotaLabel)
          .replace(/\{QTD_COTAS\}/gi, `${quotaCount} cota(s)`)
          .replace(/\{VALOR_COTA\}/gi, formatCurrency(bolao.quotaPrice))
          .replace(/\{VALOR_TOTAL\}/gi, totalQuotaVal)
          .replace(/\{STATUS\}/gi, isPaid ? 'PAGO E CONFIRMADO' : 'AGUARDANDO PAGAMENTO')
          .replace(/\{CHAVE_PIX\}/gi, bolao.pixKeyRecipient || 'Solicitar ao organizador')
          .replace(/\{TOTAL_COTAS\}/gi, String(bolao.totalQuotas))
          .replace(/\{ORGANIZADOR\}/gi, bolao.organizerName || 'Organizador')
          .replace(/\{APOSTAS\}/gi, betSummary)
          .replace(/\{EQUIVALENCIA\}/gi, `${fin.totalCombinations} jogos simples`);
        setEditedText(rendered);
      } else {
        const generated = generateWhatsAppMessage(
          messageType,
          bolao,
          activePart,
          activeBolaoPart,
          undefined,
          partMap
        );
        setEditedText(generated);
      }
    }
  }, [bolao, messageType, activePart, activeBolaoPart, allParticipants, parsedContact, customPhone, isOpen]);

  if (!isOpen || !bolao) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(editedText);
    const phoneToUse = customPhone || parsedContact.formattedPhone || activePart?.phone || '';
    let cleanDigits = phoneToUse.replace(/\D/g, '');

    if (cleanDigits.length === 10 || cleanDigits.length === 11) {
      cleanDigits = `55${cleanDigits}`;
    } else if (cleanDigits.length === 8 || cleanDigits.length === 9) {
      cleanDigits = `5561${cleanDigits}`;
    }

    const url =
      cleanDigits.length >= 12
        ? `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encoded}`
        : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Reset to system default template
  const handleResetToDefault = () => {
    localStorage.removeItem(`whatsapp_custom_template_${messageType}`);
    const partMap = new Map<string, Participant>();
    allParticipants.forEach((p) => partMap.set(p.id, p));
    const generated = generateWhatsAppMessage(
      messageType,
      bolao,
      activePart,
      activeBolaoPart,
      undefined,
      partMap
    );
    setEditedText(generated);
    setSaveSuccessMsg('✓ Mensagem restaurada para o padrão oficial do sistema!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Save current text as default template for this message type
  const handleSaveAsDefaultTemplate = () => {
    localStorage.setItem(`whatsapp_custom_template_${messageType}`, editedText);
    setSaveSuccessMsg('✓ Modelo personalizado salvo como padrão com sucesso!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Insert tag or formatting at cursor position in textarea
  const insertTextAtCursor = (textToInsert: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = editedText;

    const updated = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
    setEditedText(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  // Wrap selected text or insert formatting
  const applyFormatWrapper = (wrapperChar: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = editedText;
    const selectedText = currentVal.substring(start, end);

    let updated = '';
    if (selectedText.length > 0) {
      updated =
        currentVal.substring(0, start) +
        wrapperChar +
        selectedText +
        wrapperChar +
        currentVal.substring(end);
    } else {
      updated =
        currentVal.substring(0, start) +
        wrapperChar +
        'texto' +
        wrapperChar +
        currentVal.substring(end);
    }
    setEditedText(updated);
  };

  const currentQuotaLabel = getParticipantQuotaLabel(
    bolao,
    activePart?.id || activeBolaoPart?.participantId,
    activeBolaoPart
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-4 my-auto animate-fadeIn">
        {/* Header with Title and Edit Mode Toggle */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  Envio de Mensagens via WhatsApp
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Personalizado
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-md">
                {bolao.title} • Concurso {bolao.contestNumber || 'Especial'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="whatsapp-edit-mode-btn"
              onClick={() => {
                setIsEditMode(!isEditMode);
                if (!isEditMode && textareaRef.current) {
                  textareaRef.current.focus();
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isEditMode
                  ? 'bg-emerald-600 text-white shadow-emerald-200 ring-2 ring-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Personalizar modelo e tags"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'Editando' : 'Editar Modelo'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RECIPIENT & QUOTA SELECTION CARD */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Participant selector */}
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Destinatário / Participante:</span>
              </label>
              <div className="relative">
                <select
                  value={effectivePartId}
                  onChange={(e) => setSelectedParticipantId(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                >
                  <option value="">📢 Todos os Participantes (Grupo Geral)</option>
                  {bolao.participants.map((bp) => {
                    const p = allParticipants.find(
                      (item) =>
                        item.id === bp.participantId ||
                        item.name.toLowerCase() === bp.participantId.toLowerCase()
                    );
                    let rawName = p ? p.name : bp.participantId.replace(/^part-/, '');
                    const cleanName = extractNameAndPhone(rawName, p?.phone).cleanName;
                    const qLabel = getParticipantQuotaLabel(bolao, bp.participantId, bp);
                    const statusStr = bp.status === 'pago' ? '✅ Pago' : '⏳ Pendente';
                    return (
                      <option key={bp.participantId} value={bp.participantId}>
                        👤 {cleanName} — {qLabel} ({bp.quotas} cota{bp.quotas > 1 ? 's' : ''}) • {statusStr}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Phone Number Input */}
            <div className="w-full sm:w-56 space-y-1">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Contato WhatsApp:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="DDD + Telefone (ex: 61 99999-9999)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Quota & Status Details Summary if participant selected */}
          {activePart && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 text-[11px]">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cota:</span>
              </span>
              <span className="font-black text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                {currentQuotaLabel}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-bold text-slate-700">
                {activeBolaoPart?.quotas || 1} cota(s) ({formatCurrency((activeBolaoPart?.quotas || 1) * bolao.quotaPrice)})
              </span>
              <span className="text-slate-400">•</span>
              <span
                className={`font-black px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                  activeBolaoPart?.status === 'pago'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {activeBolaoPart?.status === 'pago' ? '✅ Pago' : '⏳ Aguardando Pagamento'}
              </span>
            </div>
          )}
        </div>

        {/* Message Type Selector Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-100/80 p-1.5 rounded-2xl text-xs font-black">
          {[
            { key: 'convite', label: '📢 Convite' },
            { key: 'comprovante', label: '🎟️ Comprovante' },
            { key: 'cobranca', label: '⏳ Cobrança' },
            { key: 'jogos', label: '📋 Jogos Oficiais' },
            { key: 'resultado', label: '🎯 Resultado' },
            { key: 'rateio', label: '🏆 Premiação' },
            { key: 'participantes', label: '👥 Lista de Cotas' },
          ].map((tab) => {
            const isSelected = messageType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setMessageType(tab.key as any)}
                className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>{tab.label}</span>
                {isSelected && <Edit3 className="w-3 h-3 text-emerald-600 opacity-80 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* TOOLBAR EXPANSION (Quando o Lápis estiver ativado) */}
        {isEditMode && (
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>Barra de Ferramentas de Edição:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetToDefault}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Restaurar para a mensagem padrão do sistema"
                >
                  <RotateCcw className="w-3 h-3 text-amber-500" />
                  <span>Restaurar Padrão</span>
                </button>
                <button
                  onClick={handleSaveAsDefaultTemplate}
                  className="text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Salvar esta mensagem como padrão para esta categoria"
                >
                  <Save className="w-3 h-3 text-emerald-400" />
                  <span>Salvar Modelo Padrão</span>
                </button>
              </div>
            </div>

            {/* Formatting shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-100 text-xs">
              <span className="text-[11px] font-bold text-emerald-800 mr-1">Formatação:</span>
              <button
                type="button"
                onClick={() => applyFormatWrapper('*')}
                className="bg-white border border-emerald-200 text-slate-800 px-2 py-1 rounded-lg font-black hover:bg-emerald-50 transition flex items-center gap-1 cursor-pointer"
                title="Negrito (*texto*)"
              >
                <Bold className="w-3 h-3" />
                <span>Negrito</span>
              </button>
              <button
                type="button"
                onClick={() => applyFormatWrapper('_')}
                className="bg-white border border-emerald-200 text-slate-800 px-2 py-1 rounded-lg italic font-bold hover:bg-emerald-50 transition flex items-center gap-1 cursor-pointer"
                title="Itálico (_texto_)"
              >
                <Italic className="w-3 h-3" />
                <span>Itálico</span>
              </button>
              <button
                type="button"
                onClick={() => applyFormatWrapper('```')}
                className="bg-white border border-emerald-200 text-slate-800 px-2 py-1 rounded-lg font-mono text-[11px] hover:bg-emerald-50 transition flex items-center gap-1 cursor-pointer"
                title="Monoespaçado (```texto```)"
              >
                <Code className="w-3 h-3" />
                <span>Mono</span>
              </button>
            </div>

            {/* Quick Tag Insert Chips */}
            <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-emerald-100 text-xs">
              <span className="text-[11px] font-bold text-emerald-800 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>Tags Rápidas:</span>
              </span>
              {[
                { tag: '{NOME}', label: 'Nome' },
                { tag: '{CONTATO}', label: 'Telefone' },
                { tag: '{COTA}', label: 'Nº Cota' },
                { tag: '{QTD_COTAS}', label: 'Qtd Cotas' },
                { tag: '{VALOR_TOTAL}', label: 'Total R$' },
                { tag: '{STATUS}', label: 'Status' },
                { tag: '{BOLAO}', label: 'Bolão' },
                { tag: '{CONCURSO}', label: 'Concurso' },
                { tag: '{DATA_SORTEIO}', label: 'Data Sorteio' },
                { tag: '{CHAVE_PIX}', label: 'Chave Pix' },
                { tag: '{ORGANIZADOR}', label: 'Organizador' },
                { tag: '{APOSTAS}', label: 'Apostas' },
                { tag: '{EQUIVALENCIA}', label: 'Equivalência' },
              ].map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => insertTextAtCursor(t.tag)}
                  className="bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer"
                  title={`Inserir ${t.tag}`}
                >
                  +{t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {saveSuccessMsg && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Text Area Preview & Direct Edit */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-black text-slate-600 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <span>Texto da Mensagem (Editável Diretamente):</span>
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 lowercase font-bold text-xs"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditMode ? 'fechar ferramentas' : 'abrir ferramentas'}</span>
              </button>
            </div>
            <span className="font-mono text-slate-400 lowercase">
              {editedText.length} caracteres
            </span>
          </div>

          <textarea
            ref={textareaRef}
            rows={11}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full p-4 bg-slate-900 text-slate-100 font-mono text-xs sm:text-[13px] rounded-2xl border border-slate-800 focus:ring-2 focus:ring-emerald-500 leading-relaxed shadow-inner focus:outline-none"
            placeholder="Edite a mensagem como desejar..."
          ></textarea>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>{isCopied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              onClick={handleResetToDefault}
              className="px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-1 cursor-pointer"
              title="Restaurar mensagem inicial"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restaurar</span>
            </button>
          </div>

          <button
            onClick={handleOpenWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>
              {customPhone || parsedContact.formattedPhone
                ? `Enviar para ${parsedContact.cleanName || 'Contato'}`
                : 'Abrir no WhatsApp'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
