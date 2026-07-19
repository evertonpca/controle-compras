import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Product, ProductInput } from '../../shared/product.js';

interface ProductDialogProps {
  product: Product | null;
  isOpen: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (product: ProductInput) => Promise<void>;
}

const emptyForm: ProductInput = {
  nome: '',
  estabelecimento: '',
  categoria: '',
  preco: 0,
  estoque: 0,
  ativo: true,
  data_compra: ''
};

const labelClass = 'grid gap-2 text-[13px] font-bold';
const inputClass = 'w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]';
const primaryButtonClass = 'rounded-lg bg-[#176b45] px-4 py-3 font-bold text-white transition hover:bg-[#0e5033] disabled:cursor-wait disabled:opacity-70';
const secondaryButtonClass = 'rounded-lg bg-[#edf2ef] px-4 py-3 font-bold text-[#17231d] transition hover:bg-[#dfe6e1]';

export function ProductDialog({ product, isOpen, error, onClose, onSubmit }: ProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    setForm(product ? {
      nome: product.nome,
      estabelecimento: product.estabelecimento,
      categoria: product.categoria,
      preco: product.preco,
      estoque: product.estoque,
      ativo: Boolean(product.ativo),
      data_compra: product.data_compra
    } : emptyForm);
  }, [product, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(620px,calc(100%_-_28px))] rounded-lg border-0 p-0 text-[#17231d] shadow-[0_30px_90px_rgba(0,0,0,.25)] backdrop:bg-[rgba(10,25,17,.55)] backdrop:backdrop-blur-sm"
      onCancel={onClose}
    >
      <form className="grid gap-5 p-7" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-extrabold tracking-[1.8px] text-[#176b45]">CADASTRO</span>
            <h2 className="mt-1 text-2xl font-bold">{product ? 'Editar produto' : 'Novo produto'}</h2>
          </div>
          <button type="button" className="border-0 bg-transparent text-3xl leading-none text-[#68756e]" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <label className={labelClass}>
          Nome do produto
          <input
            className={inputClass}
            required
            maxLength={120}
            value={form.nome}
            onChange={(event) => setForm({ ...form, nome: event.target.value })}
          />
        </label>

        <label className={labelClass}>
          Estabelecimento
          <input
            className={inputClass}
            maxLength={120}
            value={form.estabelecimento}
            onChange={(event) => setForm({ ...form, estabelecimento: event.target.value })}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Categoria
            <input
              className={inputClass}
              maxLength={80}
              value={form.categoria}
              onChange={(event) => setForm({ ...form, categoria: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            Data de compra
            <input
              className={inputClass}
              type="date"
              value={form.data_compra}
              onChange={(event) => setForm({ ...form, data_compra: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            Preço (R$)
            <input
              className={inputClass}
              type="number"
              min={0}
              step="0.01"
              required
              value={form.preco}
              onChange={(event) => setForm({ ...form, preco: Number(event.target.value) })}
            />
          </label>
          <label className={labelClass}>
            Estoque
            <input
              className={inputClass}
              type="number"
              min={0}
              step={1}
              required
              value={form.estoque}
              onChange={(event) => setForm({ ...form, estoque: Number(event.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 self-end py-3 text-[13px] font-bold">
            <input
              className="h-4 w-4"
              type="checkbox"
              checked={Boolean(form.ativo)}
              onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
            />
            Produto ativo
          </label>
        </div>

        <p className="min-h-[18px] text-[13px] text-[#b13a3a]" role="alert">{error}</p>
        <footer className="flex justify-end gap-2 pt-1">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancelar</button>
          <button className={primaryButtonClass} type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar produto'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
