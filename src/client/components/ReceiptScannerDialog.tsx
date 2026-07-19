import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductInput } from '../../shared/product.js';
import type { ReceiptPreview } from '../../shared/receipt.js';
import { previewReceipt } from '../services/receiptsApi.js';

interface ReceiptScannerDialogProps {
  isOpen: boolean;
  error: string;
  onClose: () => void;
  onImport: (items: ProductInput[]) => Promise<void>;
}

interface ReceiptItemForm {
  nome: string;
  categoria: string;
  quantidade: number;
  preco: number;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const labelClass = 'grid gap-2 text-[13px] font-bold';
const inputClass = 'w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none transition placeholder:text-[#8a958e] focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]';
const primaryButtonClass = 'min-h-11 cursor-pointer rounded-lg bg-[#176b45] px-4 py-3 font-bold text-white shadow-[0_10px_22px_rgba(23,107,69,.18)] transition hover:bg-[#0e5033] active:translate-y-px disabled:cursor-wait disabled:opacity-70';
const secondaryButtonClass = 'min-h-11 cursor-pointer rounded-lg border border-[#d3ded8] bg-[#f8faf8] px-4 py-3 font-bold text-[#17231d] transition hover:bg-white active:translate-y-px';
const ghostButtonClass = 'min-h-10 cursor-pointer rounded-lg bg-transparent px-3 py-2 font-bold text-[#176b45] transition hover:bg-[#e4f4eb] active:translate-y-px';

function receiptItemsToForm(items: ProductInput[]): ReceiptItemForm[] {
  return items.map((item) => ({
    nome: item.nome,
    categoria: item.categoria,
    quantidade: Number(item.estoque) || 1,
    preco: Number(item.preco) || 0
  }));
}

function createEmptyItem(): ReceiptItemForm {
  return { nome: '', categoria: 'Nota fiscal', quantidade: 1, preco: 0 };
}

export function ReceiptScannerDialog({ isOpen, error, onClose, onImport }: ReceiptScannerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerHintTimeoutRef = useRef<number | null>(null);
  const [qrCodeText, setQrCodeText] = useState('');
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [estabelecimento, setEstabelecimento] = useState('');
  const [dataCompra, setDataCompra] = useState('');
  const [items, setItems] = useState<ReceiptItemForm[]>(() => [createEmptyItem()]);
  const [localError, setLocalError] = useState('');
  const [cameraStatus, setCameraStatus] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.preco * Math.max(1, item.quantidade), 0),
    [items]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setQrCodeText('');
    setPreview(null);
    setEstabelecimento('');
    setDataCompra('');
    setItems([createEmptyItem()]);
    setLocalError('');
    setCameraStatus('');
  }, [isOpen]);

  function stopCamera() {
    if (scannerHintTimeoutRef.current) window.clearTimeout(scannerHintTimeoutRef.current);
    scannerHintTimeoutRef.current = null;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setIsScanning(false);
  }

  function getCodeReader() {
    if (codeReaderRef.current) return codeReaderRef.current;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    codeReaderRef.current = new BrowserQRCodeReader(hints, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 300,
      tryPlayVideoTimeout: 8000
    });
    return codeReaderRef.current;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Este navegador nao permite acesso a camera neste endereco. Abra em HTTPS ou cole o conteudo do QR Code abaixo.');
      return;
    }

    try {
      stopCamera();
      setLocalError('');
      setCameraStatus('Aponte a camera traseira para o QR Code e mantenha ele dentro do quadro.');
      const controls = await getCodeReader().decodeFromConstraints({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      }, videoRef.current ?? undefined, (result) => {
        const rawValue = result?.getText();
        if (!rawValue) return;

        stopCamera();
        setQrCodeText(rawValue);
        void loadPreview(rawValue);
      });
      scannerControlsRef.current = controls;
      setIsScanning(true);
      scannerHintTimeoutRef.current = window.setTimeout(() => {
        setCameraStatus('Ainda procurando o QR Code. Aproxime devagar, toque na tela para focar e evite reflexo.');
      }, 4500);
    } catch {
      stopCamera();
      setCameraStatus('Nao foi possivel acessar a camera. Verifique a permissao do navegador ou use HTTPS.');
    }
  }

  async function scanImageFile(file: File | null) {
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setLocalError('');
    setCameraStatus('Lendo a imagem selecionada...');
    try {
      const result = await getCodeReader().decodeFromImageUrl(imageUrl);
      const rawValue = result.getText();
      setQrCodeText(rawValue);
      setCameraStatus('QR Code detectado na imagem.');
      await loadPreview(rawValue);
    } catch {
      setCameraStatus('Nao consegui detectar QR Code nessa imagem. Tente uma foto mais proxima e bem iluminada.');
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  async function loadPreview(value = qrCodeText) {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      setLocalError('Escaneie ou cole o conteudo do QR Code.');
      return;
    }

    setIsLoadingPreview(true);
    setLocalError('');
    try {
      const receiptPreview = await previewReceipt(normalizedValue);
      setPreview(receiptPreview);
      setEstabelecimento(receiptPreview.estabelecimento);
      setDataCompra(receiptPreview.data_compra);
      setItems(receiptItemsToForm(receiptPreview.items));
    } catch (previewError) {
      setLocalError(previewError instanceof Error ? previewError.message : 'Nao foi possivel criar a previa da nota fiscal.');
    } finally {
      setIsLoadingPreview(false);
    }
  }

  function updateItem(index: number, nextItem: ReceiptItemForm) {
    setItems((currentItems) => currentItems.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  }

  function removeItem(index: number) {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validItems = items.filter((item) => item.nome.trim());
    if (!preview) {
      setLocalError('Leia o QR Code antes de importar.');
      return;
    }
    if (!validItems.length) {
      setLocalError('Mantenha pelo menos um item na compra.');
      return;
    }

    setIsSaving(true);
    setLocalError('');
    try {
      await onImport(validItems.map((item) => ({
        nome: item.nome,
        estabelecimento,
        categoria: item.categoria,
        preco: item.preco,
        estoque: item.quantidade,
        ativo: true,
        data_compra: dataCompra
      })));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto h-fit max-h-[calc(100vh-24px)] w-[min(980px,calc(100%_-_20px))] overflow-auto rounded-lg border-0 bg-[#fffdf8] p-0 text-[#17231d] shadow-[0_30px_90px_rgba(0,0,0,.25)] backdrop:bg-[rgba(10,25,17,.55)] backdrop:backdrop-blur-sm sm:max-h-[calc(100vh-32px)]"
      onCancel={onClose}
    >
      <form className="grid gap-5 p-4 sm:p-7" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase text-[#176b45]">QR Code NFC-e</span>
            <h2 className="mt-1 text-2xl font-bold">Escanear nota</h2>
          </div>
          <button type="button" className="cursor-pointer rounded-lg border-0 bg-transparent px-2 text-3xl leading-none text-[#68756e] transition hover:bg-[#edf2ef]" onClick={onClose} aria-label="Fechar">x</button>
        </div>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="grid gap-3">
            <div className="overflow-hidden rounded-lg border border-[#d8e0ed] bg-[#17231d]">
              <video ref={videoRef} className="aspect-video w-full bg-[#17231d] object-cover sm:min-h-64" muted playsInline />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={primaryButtonClass} onClick={() => void startCamera()} disabled={isScanning}>
                {isScanning ? 'Escaneando...' : 'Usar camera'}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={stopCamera} disabled={!isScanning}>
                Parar camera
              </button>
            </div>
            <p className="min-h-[18px] text-sm text-[#68756e]">{cameraStatus}</p>
            <label className={`${secondaryButtonClass} grid place-items-center text-center`}>
              Tirar/enviar foto do QR
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void scanImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className={labelClass}>
              Conteudo do QR Code
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                value={qrCodeText}
                onChange={(event) => setQrCodeText(event.target.value)}
                placeholder="Cole aqui o link/texto lido do QR Code..."
              />
            </label>
            <button type="button" className={secondaryButtonClass} onClick={() => void loadPreview()} disabled={isLoadingPreview}>
              {isLoadingPreview ? 'Lendo...' : 'Gerar previa'}
            </button>
          </div>

          <div className="grid content-start gap-4">
            <div className="grid gap-4 md:grid-cols-[1fr_180px_150px] md:items-end">
              <label className={labelClass}>
                Estabelecimento
                <input className={inputClass} maxLength={120} value={estabelecimento} onChange={(event) => setEstabelecimento(event.target.value)} />
              </label>
              <label className={labelClass}>
                Data
                <input className={inputClass} type="date" value={dataCompra} onChange={(event) => setDataCompra(event.target.value)} />
              </label>
              <div className="rounded-lg border border-[#eadfca] bg-[#fff8ea] px-4 py-3">
                <span className="block text-xs font-extrabold uppercase text-[#68756e]">Total</span>
                <strong>{currency.format(total)}</strong>
              </div>
            </div>

            {preview?.warnings.map((warning) => (
              <p key={warning} className="rounded-lg border border-[#eadfca] bg-[#fff8ea] px-3 py-2 text-sm text-[#68756e]">{warning}</p>
            ))}

            <div className="grid gap-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-[#dfe6e1] bg-white p-3 shadow-[0_6px_16px_rgba(25,50,38,.04)] md:grid-cols-[1fr_140px_90px_120px_80px] md:items-end">
                  <label className={labelClass}>
                    Item
                    <input className={inputClass} maxLength={120} value={item.nome} onChange={(event) => updateItem(index, { ...item, nome: event.target.value })} />
                  </label>
                  <label className={labelClass}>
                    Categoria
                    <input className={inputClass} maxLength={80} value={item.categoria} onChange={(event) => updateItem(index, { ...item, categoria: event.target.value })} />
                  </label>
                  <label className={labelClass}>
                    Qtde.
                    <input className={inputClass} type="number" min={1} step={1} value={item.quantidade} onChange={(event) => updateItem(index, { ...item, quantidade: Number(event.target.value) })} />
                  </label>
                  <label className={labelClass}>
                    Preco
                    <input className={inputClass} type="number" min={0} step="0.01" value={item.preco} onChange={(event) => updateItem(index, { ...item, preco: Number(event.target.value) })} />
                  </label>
                  <button type="button" className={`${ghostButtonClass} text-[#b13a3a] hover:bg-[#f7e8e8] disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => removeItem(index)} disabled={items.length === 1}>
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className={ghostButtonClass} onClick={() => setItems((currentItems) => [...currentItems, createEmptyItem()])}>
              Adicionar item
            </button>
          </div>
        </section>

        <p className="min-h-[18px] text-[13px] text-[#b13a3a]" role="alert">{localError || error}</p>
        <footer className="grid gap-2 pt-1 sm:flex sm:justify-end">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancelar</button>
          <button className={primaryButtonClass} type="submit" disabled={isSaving || !preview}>
            {isSaving ? 'Importando...' : 'Importar como compra'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
