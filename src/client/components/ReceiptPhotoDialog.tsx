import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductInput } from '../../shared/product.js';
import type { ReceiptItem, ReceiptPreview } from '../../shared/receipt.js';
import { previewReceipt } from '../services/receiptsApi.js';
import { readReceiptPhoto } from '../services/receiptOcr.js';

interface ReceiptPhotoDialogProps {
  isOpen: boolean;
  error: string;
  onClose: () => void;
  onImport: (items: ProductInput[]) => Promise<void>;
}

interface ReceiptItemForm {
  nome: string;
  categoria: string;
  quantidade: number;
  preco: number | '';
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const labelClass = 'grid gap-2 text-[13px] font-bold';
const inputClass = 'w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none transition placeholder:text-[#8a958e] focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]';
const primaryButtonClass = 'min-h-11 cursor-pointer rounded-lg bg-[#176b45] px-4 py-3 font-bold text-white shadow-[0_10px_22px_rgba(23,107,69,.18)] transition hover:bg-[#0e5033] active:translate-y-px disabled:cursor-wait disabled:opacity-70';
const secondaryButtonClass = 'min-h-11 cursor-pointer rounded-lg border border-[#d3ded8] bg-[#f8faf8] px-4 py-3 font-bold text-[#17231d] transition hover:bg-white active:translate-y-px';
const ghostButtonClass = 'min-h-10 cursor-pointer rounded-lg bg-transparent px-3 py-2 font-bold text-[#176b45] transition hover:bg-[#e4f4eb] active:translate-y-px';

function receiptItemsToForm(items: ReceiptItem[]): ReceiptItemForm[] {
  return items.map((item) => ({
    nome: item.nome,
    categoria: item.categoria,
    quantidade: Number(item.estoque) || 1,
    preco: item.preco ?? ''
  }));
}

function createEmptyItem(): ReceiptItemForm {
  return { nome: '', categoria: 'Nota fiscal', quantidade: 1, preco: '' };
}

export function ReceiptPhotoDialog({ isOpen, error, onClose, onImport }: ReceiptPhotoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [estabelecimento, setEstabelecimento] = useState('');
  const [dataCompra, setDataCompra] = useState('');
  const [items, setItems] = useState<ReceiptItemForm[]>([]);
  const [localError, setLocalError] = useState('');
  const [status, setStatus] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [recognizedText, setRecognizedText] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.preco) * item.quantidade, 0), [items]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog?.open) dialog?.showModal();
    if (!isOpen && dialog?.open) dialog.close();
    if (!isOpen) return;
    setPreview(null);
    setItems([]);
    setPhotoUrl('');
    setRecognizedText('');
    setEstabelecimento('');
    setDataCompra('');
    setLocalError('');
    setStatus('');
    setIsLoadingPreview(false);
    return () => { requestRef.current?.abort(); };
  }, [isOpen]);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  async function loadPreview(text: string, signal?: AbortSignal) {
    const result = await previewReceipt(text, signal);
    if (signal?.aborted) return;
    setPreview(result);
    setEstabelecimento(result.estabelecimento);
    setDataCompra(result.data_compra);
    setItems(receiptItemsToForm(result.items));
  }

  async function scanPhoto(file: File | null) {
    if (!file) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPreview(null);
    setItems([]);
    setRecognizedText('');
    setLocalError('');
    setPhotoUrl(URL.createObjectURL(file));
    setIsLoadingPreview(true);
    try {
      const text = await readReceiptPhoto(file, controller.signal, setStatus);
      if (controller.signal.aborted) return;
      setRecognizedText(text);
      setStatus('Organizando produtos e precos...');
      await loadPreview(text, controller.signal);
      if (!controller.signal.aborted) setStatus('Leitura concluida. Revise os itens abaixo.');
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus('');
        setLocalError(error instanceof Error ? error.message : 'Nao foi possivel ler a foto. Tente novamente.');
      }
    } finally {
      if (!controller.signal.aborted) setIsLoadingPreview(false);
    }
  }

  async function reprocessText() {
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoadingPreview(true);
    setLocalError('');
    setPreview(null);
    try {
      await loadPreview(recognizedText, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setLocalError(error instanceof Error ? error.message : 'Nao foi possivel organizar os itens.');
    } finally {
      if (!controller.signal.aborted) setIsLoadingPreview(false);
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
      setLocalError('Fotografe a nota antes de importar.');
      return;
    }
    if (!validItems.length || validItems.some((item) => item.preco === '' || !Number.isFinite(item.preco) || Number(item.preco) < 0 || !Number.isInteger(item.quantidade) || item.quantidade < 1)) {
      setLocalError('Confira os precos e quantidades e mantenha pelo menos um item na compra.');
      return;
    }

    setIsSaving(true);
    setLocalError('');
    try {
      await onImport(validItems.map((item) => ({
        nome: item.nome,
        estabelecimento,
        categoria: item.categoria,
        preco: Number(item.preco),
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
            <span className="text-xs font-extrabold uppercase text-[#176b45]">Foto da nota fiscal</span>
            <h2 className="mt-1 text-2xl font-bold">Fotografar nota</h2>
          </div>
          <button type="button" className="cursor-pointer rounded-lg border-0 bg-transparent px-2 text-3xl leading-none text-[#68756e] transition hover:bg-[#edf2ef]" onClick={onClose} aria-label="Fechar">x</button>
        </div>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="grid gap-3">
            <p className="text-sm text-[#68756e]">Fotografe a nota inteira, em uma superficie plana e bem iluminada. Mantenha os nomes e precos legiveis.</p>
            {photoUrl && <img src={photoUrl} alt="Foto da nota fiscal para conferencia" className="max-h-96 w-full rounded-lg border border-[#d8e0ed] object-contain" />}
            <label className={`${primaryButtonClass} grid place-items-center text-center`}>
              Tirar foto da nota
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={isLoadingPreview || isSaving} onChange={(event) => { void scanPhoto(event.target.files?.[0] ?? null); event.target.value = ''; }} />
            </label>
            <label className={`${secondaryButtonClass} grid place-items-center text-center`}>
              Escolher foto da galeria
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={isLoadingPreview || isSaving} onChange={(event) => { void scanPhoto(event.target.files?.[0] ?? null); event.target.value = ''; }} />
            </label>
            <p className="min-h-[18px] text-sm text-[#68756e]" role="status" aria-live="polite">{status}</p>
            <p className="text-xs text-[#68756e]">Leitura gratuita no seu dispositivo. A foto nao e enviada nem armazenada no servidor.</p>
            {recognizedText && <details className="grid gap-2">
              <summary className="cursor-pointer font-bold">Corrigir texto reconhecido</summary>
              <label className={labelClass}>Texto da nota
                <textarea className={`${inputClass} mt-2 min-h-48`} value={recognizedText} disabled={isLoadingPreview || isSaving} onChange={(event) => { setRecognizedText(event.target.value); setPreview(null); }} />
              </label>
              <button type="button" className={`${secondaryButtonClass} mt-2`} disabled={isLoadingPreview || isSaving} onClick={() => void reprocessText()}>Atualizar itens pelo texto</button>
            </details>}
          </div>

          <div className="grid content-start gap-4">
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <label className={`${labelClass} sm:col-span-2`}>
                Estabelecimento
                <input className={inputClass} maxLength={120} value={estabelecimento} onChange={(event) => setEstabelecimento(event.target.value)} />
              </label>
              <label className={labelClass}>
                Data
                <input className={inputClass} type="date" required value={dataCompra} onChange={(event) => setDataCompra(event.target.value)} />
              </label>
              <div className="rounded-lg border border-[#eadfca] bg-[#fff8ea] px-4 py-3">
                <span className="block text-xs font-extrabold uppercase text-[#68756e]">Total</span>
                <strong>{currency.format(total)}</strong>{preview?.total_nota != null && <span className="block text-xs">Na nota: {currency.format(preview.total_nota)}</span>}
              </div>
            </div>

            {preview?.warnings.map((warning) => (
              <p key={warning} className="rounded-lg border border-[#eadfca] bg-[#fff8ea] px-3 py-2 text-sm text-[#68756e]">{warning}</p>
            ))}

            <div className="grid gap-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-[#dfe6e1] bg-white p-3 shadow-[0_6px_16px_rgba(25,50,38,.04)] sm:grid-cols-[1fr_90px_120px] sm:items-end">
                  <label className={`${labelClass} sm:col-span-3`}>
                    Item
                    <input className={inputClass} maxLength={120} required value={item.nome} onChange={(event) => updateItem(index, { ...item, nome: event.target.value })} />
                  </label>
                  <label className={labelClass}>
                    Categoria
                    <input className={inputClass} maxLength={80} value={item.categoria} onChange={(event) => updateItem(index, { ...item, categoria: event.target.value })} />
                  </label>
                  <label className={labelClass}>
                    Qtde.
                    <input className={inputClass} type="number" min={1} step={1} required value={item.quantidade} onChange={(event) => updateItem(index, { ...item, quantidade: Number(event.target.value) })} />
                  </label>
                  <label className={labelClass}>
                    Preco unit. (R$)
                    <input className={inputClass} type="number" min={0} step="0.01" required value={item.preco} onChange={(event) => updateItem(index, { ...item, preco: event.target.value === '' ? '' : Number(event.target.value) })} />
                  </label>
                  <button type="button" className={`${ghostButtonClass} text-[#b13a3a] hover:bg-[#f7e8e8] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-3 sm:justify-self-end`} onClick={() => removeItem(index)} disabled={items.length === 1 || isSaving}>
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
          <button className={primaryButtonClass} type="submit" disabled={isSaving || isLoadingPreview || !preview}>
            {isSaving ? 'Importando...' : 'Importar como compra'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
