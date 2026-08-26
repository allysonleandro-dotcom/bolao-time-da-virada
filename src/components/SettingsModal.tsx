import React, { useState } from 'react';
import { X, Settings, Check, User, DollarSign } from 'lucide-react';
import { SystemSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [organizerName, setOrganizerName] = useState(settings.defaultOrganizerName || '');
  const [pixKey, setPixKey] = useState(settings.defaultPixKey || '');
  const [pixKeyType, setPixKeyType] = useState(settings.defaultPixKeyType || 'email');
  const [adminFeePercent, setAdminFeePercent] = useState(settings.defaultAdminFeePercent || 0);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      defaultOrganizerName: organizerName.trim(),
      defaultPixKey: pixKey.trim(),
      defaultPixKeyType: pixKeyType,
      defaultAdminFeePercent: adminFeePercent,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Configurações Padrão
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Dados automáticos para novos bolões
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nome Padrão do Organizador
            </label>
            <input
              type="text"
              placeholder="Ex: Allyson Leandro"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipo PIX</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900"
              >
                <option value="email">E-mail</option>
                <option value="cpf">CPF</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Aleatória</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Chave PIX Padrão</label>
              <input
                type="text"
                placeholder="sua-chave-pix@email.com"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Taxa Padrão do Organizador (%)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={adminFeePercent}
              onChange={(e) => setAdminFeePercent(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:bg-white transition"
            />
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">
              Pode ser ajustada individualmente em cada bolão.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition active:scale-95"
            >
              Fechar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-2xl shadow-md shadow-emerald-200 transition flex items-center gap-1.5 active:scale-95"
            >
              {isSaved ? <Check className="w-4 h-4" /> : null}
              <span>{isSaved ? 'Salvo!' : 'Salvar Preferências'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
