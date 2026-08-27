import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import { Bolao, BolaoParticipant, Participant } from '../types';
import { generateWhatsAppMessage } from '../utils/calculator';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  bolao: Bolao | null;
  initialType?: 'convite' | 'comprovante' | 'jogos' | 'resultado' | 'rateio' | 'cobranca' | 'participantes';
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
  const [messageType, setMessageType] = useState<'convite' | 'comprovante' | 'jogos' | 'resultado' | 'rateio' | 'cobranca' | 'participantes'>(initialType);
  const [editedText, setEditedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setMessageType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (bolao) {
      const partMap = new Map<string, Participant>();
      allParticipants.forEach((p) => partMap.set(p.id, p));
      const generated = generateWhatsAppMessage(messageType, bolao, participant, bolaoParticipant, undefined, partMap);
      setEditedText(generated);
    }
  }, [bolao, messageType, participant, bolaoParticipant, allParticipants]);

  if (!isOpen || !bolao) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(editedText);
    let cleanPhone = participant?.phone ? participant.phone.replace(/\D/g, '') : '';
    if (cleanPhone && !cleanPhone.startsWith('55')) {
      cleanPhone = `55${cleanPhone}`;
    }
    const url = cleanPhone.length >= 12
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Mensagem para WhatsApp
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Texto formatado com emojis e dados do bolão
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Type Selector */}
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl text-xs font-black">
          <button
            onClick={() => setMessageType('convite')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'convite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📢 Convite
          </button>
          <button
            onClick={() => setMessageType('comprovante')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'comprovante' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎟️ Comprovante
          </button>
          <button
            onClick={() => setMessageType('jogos')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'jogos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Jogos Oficiais
          </button>
          <button
            onClick={() => setMessageType('resultado')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'resultado' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎯 Resultado
          </button>
          <button
            onClick={() => setMessageType('rateio')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'rateio' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏆 Premiação
          </button>
          <button
            onClick={() => setMessageType('cobranca')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'cobranca' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⏳ Cobrança
          </button>
          <button
            onClick={() => setMessageType('participantes')}
            className={`px-3 py-2 rounded-xl transition ${
              messageType === 'participantes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 Lista de Cotas
          </button>
        </div>

        {/* Text Area Preview */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
            Pré-visualização do Texto (Editável)
          </label>
          <textarea
            rows={10}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-2xl border border-slate-800 focus:ring-2 focus:ring-emerald-500 leading-relaxed shadow-inner"
          ></textarea>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
              isCopied
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? 'Copiado para Área de Transferência!' : 'Copiar Texto'}</span>
          </button>

          <button
            onClick={handleOpenWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-2xl shadow-md shadow-emerald-200 transition flex items-center gap-2 active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Abrir no WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
