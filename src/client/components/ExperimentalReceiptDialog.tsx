import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ProductInput } from '../../shared/product.js';
import { parseExperimentalReceipt, receiptAiPrompt, type ExperimentalReceiptItem } from '../services/experimentalReceipt.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateItem: (item: ProductInput) => Promise<unknown>;
  onImported: (purchaseId: string) => Promise<void>;
}

const inputClass = 'w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]';
const primaryClass = 'min-h-11 cursor-pointer rounded-lg bg-[#176b45] px-4 py-3 font-bold text-white hover:bg-[#0e5033] disabled:cursor-not-allowed disabled:opacity-60';
const secondaryClass = 'min-h-11 cursor-pointer rounded-lg border border-[#d3ded8] bg-[#f8faf8] px-4 py-3 font-bold hover:bg-white disabled:cursor-not-allowed disabled:opacity-60';
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function todayIsoDate() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function ExperimentalReceiptDialog({ isOpen, onClose, onCreateItem, onImported }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const [text, setText] = useState('');
  const [items, setItems] = useState<ExperimentalReceiptItem[]>([]);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(todayIsoDate);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [purchaseId, setPurchaseId] = useState('');
  const locked = isSaving || savedCount > 0;
  const totalCents = items.reduce((sum, item) => sum + Math.round(item.preco * 100), 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog?.open) dialog?.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(receiptAiPrompt);
      setCopyStatus('Prompt copiado! Cole junto com a foto na IA.');
    } catch {
      const details = promptRef.current?.closest('details');
      if (details) details.open = true;
      promptRef.current?.focus();
      promptRef.current?.select();
      setCopyStatus('Não foi possível copiar automaticamente. Selecione e copie o prompt abaixo.');
    }
  }

  function updateText(value: string) {
    setText(value);
    setError('');
    setItems([]);
    if (!value.trim()) return;
    try {
      setItems(parseExperimentalReceipt(value));
    } catch (error) {
      setError((error as Error).message);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || !items.length) return;
    if (items.some((item) => !item.nome.trim() || !Number.isFinite(item.preco) || item.preco < 0)
      || !Number.isSafeInteger(totalCents)) {
      setError('Confira os nomes e preços dos produtos antes de registrar.');
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError('');
    let completed = savedCount;
    try {
      const id = purchaseId || crypto.randomUUID();
      setPurchaseId(id);
      for (let index = savedCount; index < items.length; index++) {
        await onCreateItem({
          nome: items[index].nome.trim(), preco: items[index].preco,
          estoque: 1, categoria: 'Nota fiscal', estabelecimento: merchant.trim(),
          data_compra: date, ativo: true, purchase_id: id
        });
        completed = index + 1;
        setSavedCount(completed);
      }
      await onImported(id);
      setItems([]);
      setText('');
      setMerchant('');
      setDate(todayIsoDate());
      setSavedCount(0);
      setPurchaseId('');
    } catch (error) {
      setError(`${error instanceof Error ? error.message : 'Não foi possível registrar a compra.'}${completed ? ` ${completed} de ${items.length} itens já salvos. Tente novamente para continuar sem reenviar esses itens.` : ''}`);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="experimental-receipt-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[min(880px,calc(100%_-_20px))] overflow-auto rounded-lg border-0 bg-[#fffdf8] p-0 text-[#17231d] shadow-[0_30px_90px_rgba(0,0,0,.25)] backdrop:bg-[rgba(10,25,17,.55)]"
      onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
      <form className="grid gap-5 p-4 sm:p-7" onSubmit={save}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase text-[#176b45]">Experimental</span>
            <h2 id="experimental-receipt-title" className="mt-1 text-2xl font-bold">Importar nota com IA</h2>
          </div>
          <button type="button" className={secondaryClass} disabled={isSaving} onClick={onClose} aria-label="Fechar seção experimental">×</button>
        </header>

        <section className="grid gap-3" aria-labelledby="experimental-prompt-title">
          <h3 id="experimental-prompt-title" className="text-lg font-bold">1. Copie o prompt e envie com a foto</h3>
          <p className="text-sm text-[#68756e]">Abra o ChatGPT ou outra IA em uma nova aba, fotografe a nota e envie a foto junto com o prompt. Depois, copie a resposta e volte aqui.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryClass} onClick={() => void copyPrompt()}>Copiar prompt</button>
            <a className={secondaryClass} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT ↗</a>
          </div>
          <p role="status" className="text-sm text-[#68756e]">{copyStatus}</p>
          <details><summary className="cursor-pointer font-bold">Ver prompt / copiar manualmente</summary>
            <textarea ref={promptRef} aria-label="Prompt para analisar a nota fiscal" className={`${inputClass} mt-2 min-h-48 text-sm`} readOnly value={receiptAiPrompt} />
          </details>
        </section>

        <section className="grid gap-3" aria-labelledby="experimental-output-title">
          <h3 id="experimental-output-title" className="text-lg font-bold">2. Cole a resposta da IA</h3>
          <label className="grid gap-2 text-sm font-bold">Resposta em JSON
            <textarea className={`${inputClass} min-h-36 font-mono text-sm`} placeholder={'{"itens":[{"nome":"Arroz","preco":25.90}]}'} value={text} disabled={locked} onChange={(event) => updateText(event.target.value)} />
          </label>
          <p className="text-sm text-[#68756e]">A lista aparece automaticamente ao colar. Cada linha será registrada com quantidade 1 e o valor total pago pelo produto. Confira com a nota antes de salvar.</p>
        </section>

        {items.length > 0 && <section className="grid gap-4" aria-labelledby="experimental-review-title">
          <h3 id="experimental-review-title" className="text-lg font-bold">3. Confira e registre a compra</h3>
          <fieldset disabled={locked} className="grid min-w-0 gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold">Estabelecimento<input className={inputClass} maxLength={120} value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-bold">Data da compra<input className={inputClass} type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
            </div>
            {items.map((item, index) => <div key={index} className="grid gap-3 rounded-lg border border-[#dfe6e1] bg-white p-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <label className="grid gap-2 text-sm font-bold">Item {index + 1}<input className={inputClass} required maxLength={120} value={item.nome} onChange={(event) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, nome: event.target.value } : entry))} /></label>
              <label className="grid gap-2 text-sm font-bold">Valor pago (R$)<input className={inputClass} type="number" min={0} step="0.01" required value={Number.isNaN(item.preco) ? '' : item.preco} onChange={(event) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, preco: event.target.value === '' ? NaN : Number(event.target.value) } : entry))} /></label>
              <button type="button" className={secondaryClass} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>Remover</button>
            </div>)}
          </fieldset>
          <p className="text-lg font-bold">{items.length} itens · Total: {currency.format(totalCents / 100)}</p>
        </section>}

        <p role="alert" className="text-sm text-[#b13a3a]">{error}</p>
        {savedCount > 0 && <p role="status" className="text-sm">{savedCount} de {items.length} itens registrados. Os dados ficam bloqueados para permitir continuar a importação.</p>}
        <footer className="flex flex-wrap justify-end gap-2">
          <button type="button" className={secondaryClass} disabled={isSaving} onClick={onClose}>Fechar</button>
          <button type="submit" className={primaryClass} disabled={isSaving || !items.length}>{isSaving ? 'Registrando...' : savedCount > 0 ? 'Continuar registro' : 'Registrar compra'}</button>
        </footer>
      </form>
    </dialog>
  );
}
