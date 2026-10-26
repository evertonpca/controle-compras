// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptPhotoDialog } from '../../src/client/components/ReceiptPhotoDialog.js';
import { readReceiptPhoto } from '../../src/client/services/receiptOcr.js';
import { buildReceiptPreview } from '../../src/server/services/receiptPreview.js';

vi.mock('../../src/client/services/receiptOcr.js', () => ({ readReceiptPhoto: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
const text = 'MERCADO\nEmissao: 25/10/2026\n001 LEITE INT 1L 2 UN x 5,00 10,00\nTOTAL 10,00';

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  URL.createObjectURL = vi.fn(() => 'blob:nota');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(readReceiptPhoto).mockResolvedValue(text);
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options: RequestInit) => {
    const result = buildReceiptPreview(JSON.parse(String(options.body)).text);
    return new Response(JSON.stringify(result.preview), { status: 200 });
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function selectPhoto() {
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['image'], 'nota.jpg', { type: 'image/jpeg' })] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('foto e revisao da nota', () => {
  it('abre captura traseira, mostra produtos/precos e importa somente apos confirmar', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(createElement(ReceiptPhotoDialog, { isOpen: true, error: '', onClose: vi.fn(), onImport })));
    expect(container.querySelector('input[capture=environment]')).not.toBeNull();
    expect(container.querySelector('input[type=submit]')).toBeNull();
    await selectPhoto();
    expect(container.querySelector<HTMLInputElement>('input[value="Leite Integral 1l"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[type=number][step="0.01"]')?.value).toBe('5');
    expect(onImport).not.toHaveBeenCalled();
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ nome: 'Leite Integral 1l', preco: 5, estoque: 2, data_compra: '2026-10-25' })]);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ text });
  });

  it('cancela o OCR ao fechar e libera a foto sem aplicar resultados atrasados', async () => {
    let finish: (value: string) => void = () => {};
    vi.mocked(readReceiptPhoto).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const props = { isOpen: true, error: '', onClose: vi.fn(), onImport: vi.fn() };
    await act(async () => root.render(createElement(ReceiptPhotoDialog, props)));
    await selectPhoto();
    const signal = vi.mocked(readReceiptPhoto).mock.calls.at(-1)![1];
    await act(async () => root.render(createElement(ReceiptPhotoDialog, { ...props, isOpen: false })));
    expect(signal.aborted).toBe(true);
    await act(async () => finish(text));
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:nota');
    root = createRoot(container);
  });

  it('exibe erro de leitura e impede importacao', async () => {
    vi.mocked(readReceiptPhoto).mockRejectedValue(new Error('Foto ilegivel.'));
    await act(async () => root.render(createElement(ReceiptPhotoDialog, { isOpen: true, error: '', onClose: vi.fn(), onImport: vi.fn() })));
    await selectPhoto();
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Foto ilegivel.');
    expect(container.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
  });
});
