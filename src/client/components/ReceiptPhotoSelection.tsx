import { fullReceipt, type ReceiptCrop } from '../services/receiptImage.js';

interface Props {
  photoUrl: string;
  crop: ReceiptCrop;
  disabled: boolean;
  onChange: (crop: ReceiptCrop) => void;
}

export function ReceiptPhotoSelection({ photoUrl, crop, disabled, onChange }: Props) {
  return <div className="grid gap-3">
    <p className="text-sm font-bold">Selecione a lista de produtos</p>
    <p className="text-sm text-[#68756e]">Ajuste o inicio e o fim para deixar na area clara somente os produtos, quantidades e precos. Inclua a linha de desconto, se houver.</p>
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-[#d8e0ed]">
      <img src={photoUrl} alt="Selecao da tabela de produtos da nota" className="block max-h-[440px] w-auto max-w-full" />
      <div aria-hidden="true" className="pointer-events-none absolute border-2 border-[#22c55e] shadow-[0_0_0_9999px_rgba(0,0,0,.6)]" style={{ left: `${crop.left}%`, top: `${crop.top}%`, width: `${crop.right - crop.left}%`, height: `${crop.bottom - crop.top}%` }} />
    </div>
    <label className="grid gap-1 text-sm font-bold">Inicio da lista
      <input type="range" min={0} max={99} value={crop.top} disabled={disabled} onChange={(event) => onChange({ ...crop, top: Math.min(Number(event.target.value), crop.bottom - 1) })} />
    </label>
    <label className="grid gap-1 text-sm font-bold">Fim da lista
      <input type="range" min={1} max={100} value={crop.bottom} disabled={disabled} onChange={(event) => onChange({ ...crop, bottom: Math.max(Number(event.target.value), crop.top + 1) })} />
    </label>
    <details>
      <summary className="cursor-pointer text-sm font-bold">Ajustar laterais</summary>
      <label className="mt-2 grid gap-1 text-sm">Margem esquerda
        <input type="range" min={0} max={99} value={crop.left} disabled={disabled} onChange={(event) => onChange({ ...crop, left: Math.min(Number(event.target.value), crop.right - 1) })} />
      </label>
      <label className="mt-2 grid gap-1 text-sm">Margem direita
        <input type="range" min={1} max={100} value={crop.right} disabled={disabled} onChange={(event) => onChange({ ...crop, right: Math.max(Number(event.target.value), crop.left + 1) })} />
      </label>
    </details>
    <button type="button" disabled={disabled} className="justify-self-start text-sm font-bold text-[#176b45]" onClick={() => onChange({ ...fullReceipt })}>Usar foto inteira</button>
  </div>;
}
