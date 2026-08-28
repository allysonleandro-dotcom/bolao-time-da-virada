import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { DigitalReceipt } from '../types';

interface ReceiptReferenceViewerProps {
  receipts: DigitalReceipt[];
  onAddReceipt?: (receipt: DigitalReceipt) => void;
  onRemoveReceipt?: (receiptId: string) => void;
  bolaoTitle?: string;
}

export const ReceiptReferenceViewer: React.FC<ReceiptReferenceViewerProps> = ({
  receipts = [],
  onAddReceipt,
  onRemoveReceipt,
  bolaoTitle = 'Bolão',
}) => {
  const [selectedReceiptIndex, setSelectedReceiptIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeReceipt = receipts[selectedReceiptIndex] || null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && onAddReceipt) {
        const newReceipt: DigitalReceipt = {
          id: `receipt-manual-${Date.now()}`,
          title: file.name || `Comprovante ${receipts.length + 1}`,
          url: dataUrl,
          uploadedAt: new Date().toISOString(),
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        };
        onAddReceipt(newReceipt);
        setSelectedReceiptIndex(0); // View the new one
        handleResetView();
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all duration-200 ${
        isExpanded
          ? 'fixed inset-4 z-50 shadow-2xl bg-white/95 backdrop-blur-md max-w-none'
          : 'w-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span>Referência Visual do Comprovante</span>
              {receipts.length > 0 && (
                <span className="text-[10px] bg-slate-200 text-slate-700 font-black px-2 py-0.5 rounded-md">
                  {selectedReceiptIndex + 1} de {receipts.length}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500">
              Anexo visual para checagem rápida lado a lado (zoom e rotação)
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={!activeReceipt}
            title="Aproximar Zoom (+25%)"
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={!activeReceipt}
            title="Afastar Zoom (-25%)"
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Rotate */}
          <button
            type="button"
            onClick={handleRotate}
            disabled={!activeReceipt}
            title="Girar 90°"
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Reset View */}
          <button
            type="button"
            onClick={handleResetView}
            disabled={!activeReceipt}
            title="Redefinir visualização"
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 cursor-pointer text-xs font-bold px-2"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Expand / Minimize */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimizar' : 'Tela cheia'}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer ml-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Anexar Foto</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Multiple Receipts selector bar (if more than 1) */}
      {receipts.length > 1 && (
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-500 shrink-0">Comprovantes:</span>
          {receipts.map((rec, idx) => (
            <button
              key={rec.id || idx}
              onClick={() => {
                setSelectedReceiptIndex(idx);
                handleResetView();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                selectedReceiptIndex === idx
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>{rec.title || `Bilhete ${idx + 1}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Image Stage */}
      <div
        className={`relative overflow-hidden bg-slate-900 flex items-center justify-center select-none ${
          isExpanded ? 'flex-1 h-[calc(100vh-140px)]' : 'h-80 sm:h-96'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {activeReceipt ? (
          <div
            className="transition-transform duration-100 ease-out origin-center"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={activeReceipt.url}
              alt={activeReceipt.title || 'Comprovante do Bolão'}
              className="max-h-72 sm:max-h-88 object-contain rounded-lg shadow-2xl pointer-events-none"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-300">Nenhum comprovante anexado</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Tire uma foto ou anexe o bilhete da lotérica para usar como guia visual durante a
                conferência.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Anexar Comprovante do Bilhete</span>
            </button>
          </div>
        )}

        {/* Floating Zoom overlay indicator */}
        {activeReceipt && (
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-2 pointer-events-none">
            <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
            <span>•</span>
            <span>Rotação: {rotation}°</span>
            {zoomLevel > 1 && (
              <>
                <span>•</span>
                <span className="text-emerald-400">Arraste para mover</span>
              </>
            )}
          </div>
        )}

        {/* Remove button if onRemoveReceipt is supported */}
        {activeReceipt && onRemoveReceipt && (
          <button
            type="button"
            onClick={() => onRemoveReceipt(activeReceipt.id)}
            title="Excluir comprovante"
            className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Footer Info */}
      {activeReceipt && (
        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate max-w-xs font-medium">
            {activeReceipt.title} {activeReceipt.fileSize ? `(${activeReceipt.fileSize})` : ''}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0">
            {new Date(activeReceipt.uploadedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      )}
    </div>
  );
};
