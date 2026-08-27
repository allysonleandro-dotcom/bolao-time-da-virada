import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Bolao, BolaoParticipant, LotteryType, Participant, SystemSettings } from './types';
import {
  loadBoloes,
  loadParticipants,
  loadSettings,
  saveBoloes,
  saveParticipants,
  saveSettings,
} from './utils/storage';
import { syncFromGoogleSheets, DEFAULT_SHEET_URL } from './services/googleSheetsSync';
import { Header, AppTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { BoloesView } from './components/BoloesView';
import { BolaoDetailView } from './components/BolaoDetailView';
import { ParticipantesView } from './components/ParticipantesView';
import { CalculadoraView } from './components/CalculadoraView';
import { VerificadorLotofacilView } from './components/VerificadorLotofacilView';
import { HistoricoBoloesView } from './components/HistoricoBoloesView';
import { FinanceiroParticipantesView } from './components/FinanceiroParticipantesView';
import { BolaoFormModal } from './components/BolaoFormModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { CsvImportExportModal } from './components/CsvImportExportModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(loadSettings());

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');
  const [selectedBolaoId, setSelectedBolaoId] = useState<string | null>(null);

  // Modals state
  const [isBolaoModalOpen, setIsBolaoModalOpen] = useState(false);
  const [editingBolao, setEditingBolao] = useState<Bolao | null>(null);
  const [simulationPreset, setSimulationPreset] = useState<any>(null);

  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [whatsAppModal, setWhatsAppModal] = useState<{
    isOpen: boolean;
    bolao: Bolao | null;
    type: 'convite' | 'comprovante' | 'jogos' | 'resultado' | 'rateio' | 'cobranca' | 'participantes';
    participant?: Participant;
    bolaoParticipant?: BolaoParticipant;
  }>({
    isOpen: false,
    bolao: null,
    type: 'convite',
  });

  // Initial load & automatic Google Sheets sync
  useEffect(() => {
    const loadedParticipants = loadParticipants();
    const loadedBoloes = loadBoloes();
    const loadedSet = loadSettings();
    setParticipants(loadedParticipants);
    setBoloes(loadedBoloes);
    setSettings(loadedSet);

    if (loadedSet.autoSyncGoogleSheets !== false) {
      setIsSyncingSheets(true);
      syncFromGoogleSheets(
        loadedSet.googleSheetsUrl || DEFAULT_SHEET_URL,
        loadedBoloes,
        loadedParticipants
      )
        .then((res) => {
          if (res.success) {
            setBoloes(res.boloes);
            setParticipants(res.participants);
            const updated = {
              ...loadedSet,
              lastSyncedAt: res.timestamp,
            };
            setSettings(updated);
            saveSettings(updated);
          }
        })
        .finally(() => {
          setIsSyncingSheets(false);
        });
    }
  }, []);

  // Manual Google Sheets sync handler
  const handleSyncGoogleSheets = async (customUrl?: string) => {
    setIsSyncingSheets(true);
    const targetUrl = customUrl || settings.googleSheetsUrl || DEFAULT_SHEET_URL;
    try {
      const result = await syncFromGoogleSheets(targetUrl, boloes, participants);
      if (result.success) {
        setBoloes(result.boloes);
        setParticipants(result.participants);
        const updatedSettings = {
          ...settings,
          googleSheetsUrl: targetUrl,
          lastSyncedAt: result.timestamp,
        };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
        setSyncToast({ message: result.message, type: 'success' });
      } else {
        setSyncToast({ message: result.message, type: 'error' });
      }
    } catch (err: any) {
      setSyncToast({ message: 'Erro ao conectar com Google Sheets', type: 'error' });
    } finally {
      setIsSyncingSheets(false);
      setTimeout(() => setSyncToast(null), 4000);
    }
  };

  // Sync to local storage
  const handleSaveParticipants = (newParticipants: Participant[]) => {
    setParticipants(newParticipants);
    saveParticipants(newParticipants);
  };

  const handleSaveBoloes = (newBoloes: Bolao[]) => {
    setBoloes(newBoloes);
    saveBoloes(newBoloes);
  };

  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Bolão actions
  const handleCreateOrUpdateBolao = (bolao: Bolao) => {
    const exists = boloes.some((b) => b.id === bolao.id);
    let updated: Bolao[];
    if (exists) {
      updated = boloes.map((b) => (b.id === bolao.id ? bolao : b));
    } else {
      updated = [bolao, ...boloes];
      setSelectedBolaoId(bolao.id);
    }
    handleSaveBoloes(updated);
  };

  const handleDeleteBolao = (bolaoId: string) => {
    const updated = boloes.filter((b) => b.id !== bolaoId);
    handleSaveBoloes(updated);
    if (selectedBolaoId === bolaoId) {
      setSelectedBolaoId(null);
    }
  };

  // Participant actions
  const handleAddParticipant = (participant: Participant) => {
    const updated = [participant, ...participants];
    handleSaveParticipants(updated);
  };

  const handleUpdateParticipant = (participant: Participant) => {
    const updated = participants.map((p) => (p.id === participant.id ? participant : p));
    handleSaveParticipants(updated);
  };

  const handleDeleteParticipant = (participantId: string) => {
    const updated = participants.filter((p) => p.id !== participantId);
    handleSaveParticipants(updated);

    // Also remove from boloes
    const updatedBoloes = boloes.map((b) => ({
      ...b,
      participants: b.participants.filter((bp) => bp.participantId !== participantId),
    }));
    handleSaveBoloes(updatedBoloes);
  };

  const handleImportBatchParticipants = (imported: Participant[]) => {
    const updated = [...imported, ...participants];
    handleSaveParticipants(updated);
  };

  // Simulation transfer
  const handleCreateBolaoFromSimulation = (presetData: any) => {
    setSimulationPreset(presetData);
    setEditingBolao(null);
    setIsBolaoModalOpen(true);
  };

  // WhatsApp open helper
  const handleOpenWhatsAppShare = (
    bolao: Bolao,
    type: 'convite' | 'comprovante' | 'jogos' | 'resultado' | 'rateio' | 'cobranca' | 'participantes',
    participant?: Participant,
    bolaoParticipant?: BolaoParticipant
  ) => {
    setWhatsAppModal({
      isOpen: true,
      bolao,
      type,
      participant,
      bolaoParticipant,
    });
  };

  const selectedBolao = boloes.find((b) => b.id === selectedBolaoId);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
      {/* Toast Notification */}
      {syncToast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-fadeIn max-w-md ${
            syncToast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-750'
              : 'bg-rose-900 text-white border-rose-750'
          }`}
        >
          {syncToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold leading-relaxed">{syncToast.message}</span>
        </div>
      )}

      {/* Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setSelectedBolaoId(null);
        }}
        boloes={boloes}
        participants={participants}
        onOpenNewBolao={() => {
          setEditingBolao(null);
          setSimulationPreset(null);
          setIsBolaoModalOpen(true);
        }}
        onOpenImportExport={() => setIsImportExportModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onSyncGoogleSheets={() => handleSyncGoogleSheets()}
        isSyncing={isSyncingSheets}
        lastSyncedAt={settings.lastSyncedAt}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {selectedBolao ? (
          /* Single Bolão In-Depth Management */
          <BolaoDetailView
            bolao={selectedBolao}
            allParticipants={participants}
            onBack={() => setSelectedBolaoId(null)}
            onUpdateBolao={(updated) => {
              handleCreateOrUpdateBolao(updated);
            }}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onAddNewParticipantGlobal={handleAddParticipant}
          />
        ) : (
          /* Multi-tab Main Workspace */
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                boloes={boloes}
                participants={participants}
                onSelectBolao={(id) => setSelectedBolaoId(id)}
                onOpenNewBolao={() => {
                  setEditingBolao(null);
                  setSimulationPreset(null);
                  setIsBolaoModalOpen(true);
                }}
                onNavigate={(tab) => {
                  setCurrentTab(tab);
                  setSelectedBolaoId(null);
                }}
                onOpenWhatsAppShare={handleOpenWhatsAppShare}
              />
            )}

            {currentTab === 'boloes' && (
              <BoloesView
                boloes={boloes}
                onSelectBolao={(id) => setSelectedBolaoId(id)}
                onOpenNewBolao={() => {
                  setEditingBolao(null);
                  setSimulationPreset(null);
                  setIsBolaoModalOpen(true);
                }}
                onEditBolao={(b) => {
                  setEditingBolao(b);
                  setSimulationPreset(null);
                  setIsBolaoModalOpen(true);
                }}
                onDeleteBolao={handleDeleteBolao}
                onOpenWhatsAppShare={handleOpenWhatsAppShare}
              />
            )}

            {currentTab === 'verificador' && (
              <VerificadorLotofacilView
                boloes={boloes}
                participants={participants}
                onUpdateBolao={handleCreateOrUpdateBolao}
                onOpenWhatsAppShare={handleOpenWhatsAppShare}
                onSelectBolao={(id) => setSelectedBolaoId(id)}
              />
            )}

            {currentTab === 'historico' && (
              <HistoricoBoloesView
                boloes={boloes}
                allParticipants={participants}
                onSelectBolao={(id) => setSelectedBolaoId(id)}
                onOpenNewBolao={() => {
                  setEditingBolao(null);
                  setSimulationPreset(null);
                  setIsBolaoModalOpen(true);
                }}
              />
            )}

            {currentTab === 'financeiro' && (
              <FinanceiroParticipantesView
                participants={participants}
                boloes={boloes}
              />
            )}

            {currentTab === 'participantes' && (
              <ParticipantesView
                participants={participants}
                boloes={boloes}
                onAddParticipant={handleAddParticipant}
                onUpdateParticipant={handleUpdateParticipant}
                onDeleteParticipant={handleDeleteParticipant}
                onOpenImportExport={() => setIsImportExportModalOpen(true)}
              />
            )}

            {currentTab === 'calculadora' && (
              <CalculadoraView
                onCreateBolaoFromSimulation={handleCreateBolaoFromSimulation}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <BolaoFormModal
        isOpen={isBolaoModalOpen}
        onClose={() => {
          setIsBolaoModalOpen(false);
          setEditingBolao(null);
          setSimulationPreset(null);
        }}
        onSave={handleCreateOrUpdateBolao}
        editingBolao={editingBolao}
        settings={settings}
        simulationPreset={simulationPreset}
      />

      <WhatsAppShareModal
        isOpen={whatsAppModal.isOpen}
        onClose={() => setWhatsAppModal({ ...whatsAppModal, isOpen: false })}
        bolao={whatsAppModal.bolao}
        initialType={whatsAppModal.type}
        participant={whatsAppModal.participant}
        bolaoParticipant={whatsAppModal.bolaoParticipant}
        allParticipants={participants}
      />

      <CsvImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        participants={participants}
        boloes={boloes}
        onImportParticipants={handleImportBatchParticipants}
        onRestoreAllData={({ participants: restoredP, boloes: restoredB }) => {
          handleSaveParticipants(restoredP);
          handleSaveBoloes(restoredB);
        }}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onSyncGoogleSheets={() => handleSyncGoogleSheets()}
        isSyncing={isSyncingSheets}
      />
    </div>
  );
}
