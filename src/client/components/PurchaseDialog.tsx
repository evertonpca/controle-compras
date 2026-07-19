import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductInput } from '../../shared/product.js';

interface PurchaseDialogProps {
  isOpen: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (items: ProductInput[]) => Promise<void>;
}

interface PurchaseItemForm {
  nome: string;
  categoria: string;
  quantidade: number;
  preco: number;
}

function todayIsoDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function createEmptyItem(): PurchaseItemForm {
  return {
    nome: '',
    categoria: '',
    quantidade: 1,
    preco: 0
  };
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const labelClass = 'grid gap-2 text-[13px] font-bold';
const inputClass = 'w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none transition placeholder:text-[#8a958e] focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]';
const primaryButtonClass = 'min-h-11 cursor-pointer rounded-lg bg-[#176b45] px-4 py-3 font-bold text-white shadow-[0_10px_22px_rgba(23,107,69,.18)] transition hover:bg-[#0e5033] active:translate-y-px disabled:cursor-wait disabled:opacity-70';
const secondaryButtonClass = 'min-h-11 cursor-pointer rounded-lg border border-[#d3ded8] bg-[#f8faf8] px-4 py-3 font-bold text-[#17231d] transition hover:bg-white active:translate-y-px';
const ghostButtonClass = 'min-h-10 cursor-pointer rounded-lg bg-transparent px-3 py-2 font-bold text-[#176b45] transition hover:bg-[#e4f4eb] active:translate-y-px';

export function PurchaseDialog({ isOpen, error, onClose, onSubmit }: PurchaseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [estabelecimento, setEstabelecimento] = useState('');
  const [dataCompra, setDataCompra] = useState(todayIsoDate());
  const [items, setItems] = useState<PurchaseItemForm[]>(() => [createEmptyItem()]);
  const [localError, setLocalError] = useState('');
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
    if (!isOpen) return;
    setEstabelecimento('');
    setDataCompra(todayIsoDate());
    setItems([createEmptyItem()]);
    setLocalError('');
  }, [isOpen]);

  function updateItem(index: number, nextItem: PurchaseItemForm) {
    setItems((currentItems) => currentItems.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  }

  function removeItem(index: number) {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validItems = items.filter((item) => item.nome.trim());
    if (!validItems.length) {
      setLocalError('Adicione pelo menos um item com nome.');
      return;
    }

    setLocalError('');
    setIsSaving(true);
    try {
      await onSubmit(validItems.map((item) => ({
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
      className="fixed inset-0 m-auto h-fit max-h-[calc(100vh-24px)] w-[min(920px,calc(100%_-_20px))] overflow-auto rounded-lg border-0 bg-[#fffdf8] p-0 text-[#17231d] shadow-[0_30px_90px_rgba(0,0,0,.25)] backdrop:bg-[rgba(10,25,17,.55)] backdrop:backdrop-blur-sm sm:max-h-[calc(100vh-32px)] sm:w-[min(920px,calc(100%_-_28px))]"
      onCancel={onClose}
    >
      <form className="grid gap-5 p-4 sm:p-7" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase text-[#176b45]">Cadastro de compra</span>
            <h2 className="mt-1 text-2xl font-bold">Nova compra</h2>
          </div>
          <button type="button" className="cursor-pointer rounded-lg border-0 bg-transparent px-2 text-3xl leading-none text-[#68756e] transition hover:bg-[#edf2ef]" onClick={onClose} aria-label="Fechar">x</button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px_160px] md:items-end">
          <label className={labelClass}>
            Estabelecimento
            <input
              className={inputClass}
              maxLength={120}
              value={estabelecimento}
              onChange={(event) => setEstabelecimento(event.target.value)}
              placeholder="Mercado, farmacia, feira..."
            />
          </label>
          <label className={labelClass}>
            Data
            <input
              className={inputClass}
              type="date"
              value={dataCompra}
              onChange={(event) => setDataCompra(event.target.value)}
            />
          </label>
          <div className="rounded-lg border border-[#eadfca] bg-[#fff8ea] px-4 py-3">
            <span className="block text-xs font-extrabold uppercase text-[#68756e]">Total</span>
            <strong>{currency.format(total)}</strong>
          </div>
        </div>

        <div className="grid gap-3">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-[#dfe6e1] bg-white p-3 shadow-[0_6px_16px_rgba(25,50,38,.04)] sm:p-4 md:grid-cols-[1fr_160px_110px_130px_86px] md:items-end">
              <label className={labelClass}>
                Item
                <input
                  className={inputClass}
                  required={index === 0}
                  maxLength={120}
                  value={item.nome}
                  onChange={(event) => updateItem(index, { ...item, nome: event.target.value })}
                />
              </label>
              <label className={labelClass}>
                Categoria
                <input
                  className={inputClass}
                  maxLength={80}
                  value={item.categoria}
                  onChange={(event) => updateItem(index, { ...item, categoria: event.target.value })}
                />
              </label>
              <label className={labelClass}>
                Qtde.
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantidade}
                  onChange={(event) => updateItem(index, { ...item, quantidade: Number(event.target.value) })}
                />
              </label>
              <label className={labelClass}>
                Preco un.
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.preco}
                  onChange={(event) => updateItem(index, { ...item, preco: Number(event.target.value) })}
                />
              </label>
              <button
                type="button"
                className={`${ghostButtonClass} text-[#b13a3a] hover:bg-[#f7e8e8] disabled:cursor-not-allowed disabled:opacity-50`}
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <button type="button" className={ghostButtonClass} onClick={() => setItems((currentItems) => [...currentItems, createEmptyItem()])}>
          Adicionar item
        </button>

        <p className="min-h-[18px] text-[13px] text-[#b13a3a]" role="alert">{localError || error}</p>
        <footer className="grid gap-2 pt-1 sm:flex sm:justify-end">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancelar</button>
          <button className={primaryButtonClass} type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar compra'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
