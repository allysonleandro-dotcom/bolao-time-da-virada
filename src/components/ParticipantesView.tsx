import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Copy,
  Check,
  FileSpreadsheet,
  MessageSquare,
  DollarSign,
  Ticket,
  Clock,
  FileDown,
  TrendingUp,
} from 'lucide-react';
import { Bolao, Participant } from '../types';
import { formatCurrency, formatDateBR } from '../utils/calculator';
import {
  exportParticipantsSpendingReportPDF,
  exportSingleParticipantStatementPDF,
} from '../utils/pdfGenerator';

interface ParticipantesViewProps {
  participants: Participant[];
  boloes: Bolao[];
  onAddParticipant: (participant: Participant) => void;
  onUpdateParticipant: (participant: Participant) => void;
  onDeleteParticipant: (participantId: string) => void;
  onOpenImportExport: () => void;
}

export const ParticipantesView: React.FC<ParticipantesViewProps> = ({
  participants,
  boloes,
  onAddParticipant,
  onUpdateParticipant,
  onDeleteParticipant,
  onOpenImportExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<any>('cpf');
  const [notes, setNotes] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredParticipants = participants.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.phone || '').toLowerCase().includes(term) ||
      (p.pixKey || '').toLowerCase().includes(term) ||
      (p.notes || '').toLowerCase().includes(term)
    );
  });

  const handleOpenAdd = () => {
    setEditingParticipant(null);
    setName('');
    setPhone('');
    setPixKey('');
    setPixKeyType('cpf');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Participant) => {
    setEditingParticipant(p);
    setName(p.name);
    setPhone(p.phone || '');
    setPixKey(p.pixKey || '');
    setPixKeyType(p.pixKeyType || 'cpf');
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do participante.');
      return;
    }

    if (editingParticipant) {
      onUpdateParticipant({
        ...editingParticipant,
        name: name.trim(),
        phone: phone.trim(),
        pixKey: pixKey.trim(),
        pixKeyType,
        notes: notes.trim(),
      });
    } else {
      onAddParticipant({
        id: `part-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        pixKey: pixKey.trim(),
        pixKeyType,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    setIsModalOpen(false);
  };

  const handleCopyPix = (pId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(pId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to compute stats for each participant
  const getParticipantStats = (participantId: string) => {
    let totalBoloes = 0;
    let totalQuotas = 0;
    let totalPaid = 0;
    let totalPending = 0;

    boloes.forEach((b) => {
      const match = b.participants.find((bp) => bp.participantId === participantId);
      if (match) {
        totalBoloes++;
        totalQuotas += match.quotas || 0;
        const due = (match.quotas || 0) * b.quotaPrice;
        if (match.status === 'pago') {
          totalPaid += match.amountPaid || due;
        } else if (match.status === 'pendente') {
          totalPending += due - (match.amountPaid || 0);
          totalPaid += match.amountPaid || 0;
        }
      }
    });

    return { totalBoloes, totalQuotas, totalPaid, totalPending };
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            <span>Registro de <span className="text-emerald-600 underline decoration-4 underline-offset-4">Participantes</span></span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Base cadastral de amigos e participantes dos bolões com controle de chaves Pix e histórico de cotas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportParticipantsSpendingReportPDF(participants, boloes)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-black shadow-2xs transition flex items-center gap-2 cursor-pointer"
            title="Baixar Relatório Financeiro e Gastos em PDF"
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            <span>Relatório Geral (PDF)</span>
          </button>

          <button
            onClick={onOpenImportExport}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold shadow-2xs transition flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Planilha CSV</span>
          </button>

          <button
            id="btn-add-participant-page"
            onClick={handleOpenAdd}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl shadow-md shadow-emerald-200 transition flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Participante</span>
          </button>
        </div>
      </div>

      {/* Bento Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, chave Pix ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Table of Participants Bento Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredParticipants.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm font-medium">
            Nenhum participante encontrado. Clique em "Novo Participante" ou importe uma planilha CSV.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-4 px-5">Nome & Contato</th>
                  <th className="py-4 px-4">Chave PIX</th>
                  <th className="py-4 px-4 text-center">Bolões</th>
                  <th className="py-4 px-4 text-center">Qtd. Cotas</th>
                  <th className="py-4 px-4">Total Investido</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredParticipants.map((p) => {
                  const stats = getParticipantStats(p.id);
                  const isCopied = copiedId === p.id;
                  const cleanPhone = (p.phone || '').replace(/\D/g, '');
                  const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-5">
                        <div className="font-black text-slate-900 text-sm tracking-tight">{p.name}</div>
                        {p.phone && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {p.phone}
                            </span>
                            {cleanPhone.length >= 10 && (
                              <a
                                href={`https://wa.me/${waNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-[10px] font-black bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        )}
                        {p.notes && <div className="text-[10px] text-slate-400 mt-0.5">{p.notes}</div>}
                      </td>

                      <td className="py-4 px-4">
                        {p.pixKey ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-slate-50 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-800 border border-slate-200">
                              {p.pixKey}
                            </span>
                            <button
                              onClick={() => handleCopyPix(p.id, p.pixKey || '')}
                              title="Copiar Chave PIX"
                              className="p-1.5 hover:bg-slate-200/70 rounded-lg text-slate-500 transition"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Não informada</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center font-black text-slate-800 text-sm">
                        {stats.totalBoloes}
                      </td>

                      <td className="py-4 px-4 text-center font-black text-slate-800 text-sm">
                        {stats.totalQuotas}
                      </td>

                      <td className="py-4 px-4 font-black text-slate-900 text-sm">
                        {formatCurrency(stats.totalPaid)}
                      </td>

                      <td className="py-4 px-4">
                        {stats.totalPending > 0 ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            {formatCurrency(stats.totalPending)} pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3 text-emerald-600" /> Em dia
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => exportSingleParticipantStatementPDF(p, boloes)}
                            title="Baixar Extrato do Participante em PDF"
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            id={`edit-part-${p.id}`}
                            onClick={() => handleOpenEdit(p)}
                            title="Editar Participante"
                            className="p-2 text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`delete-part-${p.id}`}
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir ${p.name}?`)) {
                                onDeleteParticipant(p.id);
                              }
                            }}
                            title="Excluir Participante"
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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

      {/* Add / Edit Participant Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {editingParticipant ? 'Editar Participante' : 'Cadastrar Novo Participante'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Tipo PIX</label>
                  <select
                    value={pixKeyType}
                    onChange={(e) => setPixKeyType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900"
                  >
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Aleatória</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Chave PIX</label>
                  <input
                    type="text"
                    placeholder="Chave para recebimento de prêmios"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Anotações internas..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md shadow-emerald-200 transition active:scale-95"
                >
                  Salvar Participante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
