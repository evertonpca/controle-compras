// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentalReceiptDialog } from '../../src/client/components/ExperimentalReceiptDialog.js';
import { receiptAiPrompt } from '../../src/client/services/experimentalReceipt.js';

let container: HTMLDivElement;
let root: Root;
const onCreateItem = vi.fn();
const onImported = vi.fn();
const onClose = vi.fn();
const writeText = vi.fn();

beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(ExperimentalReceiptDialog, {
    isOpen: true, onCreateItem, onImported, onClose
  })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function paste(text = '{"itens":[{"nome":"Leite 2 UN","preco":10},{"nome":"Banana KG","preco":3.47}]}') {
  const textarea = container.querySelector<HTMLTextAreaElement>('textarea:not([readonly])')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('importação experimental de nota com IA', () => {
  it('copia o prompt completo e oferece link para outra aba', async () => {
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent === 'Copiar prompt')!.click(); });
    expect(writeText).toHaveBeenCalledWith(receiptAiPrompt);
    expect(container.textContent).toContain('Prompt copiado!');
    expect(container.querySelector('a')?.target).toBe('_blank');
  });

  it('abre o prompt selecionado para cópia manual se o navegador negar o clipboard', async () => {
    writeText.mockRejectedValue(new Error('Permissão negada'));
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent === 'Copiar prompt')!.click(); });
    expect(container.querySelector('details')?.open).toBe(true);
    const prompt = container.querySelector<HTMLTextAreaElement>('textarea[readonly]')!;
    expect(prompt.selectionEnd - prompt.selectionStart).toBe(receiptAiPrompt.length);
    expect(container.textContent).toContain('Não foi possível copiar automaticamente');
  });

  it('monta a lista ao colar e salva em uma única compra somente ao confirmar', async () => {
    await paste();
    expect(container.textContent).toContain('R$ 13,47');
    expect(onCreateItem).not.toHaveBeenCalled();
    await submit();
    expect(onCreateItem).toHaveBeenCalledTimes(2);
    const first = onCreateItem.mock.calls[0][0];
    expect(first).toMatchObject({ nome: 'Leite 2 UN', preco: 10, estoque: 1, ativo: true });
    expect(onCreateItem.mock.calls[1][0]).toMatchObject({ nome: 'Banana KG', preco: 3.47, estoque: 1, purchase_id: first.purchase_id });
    expect(onImported).toHaveBeenCalledWith(first.purchase_id);
  });

  it('remove a lista anterior quando o JSON colado fica inválido', async () => {
    await paste();
    await paste('{"itens":[{"nome":"Produto","preco":"1,00"}]}');
    expect(container.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    await submit();
    expect(onCreateItem).not.toHaveBeenCalled();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Confira o item 1');
  });

  it('continua após uma falha parcial sem reenviar os itens já salvos', async () => {
    onCreateItem.mockResolvedValueOnce({ id: 1 }).mockRejectedValueOnce(new Error('Falha no servidor'));
    await paste();
    await submit();
    expect(onImported).not.toHaveBeenCalled();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('1 de 2 itens já salvos');
    expect(container.querySelector<HTMLTextAreaElement>('textarea:not([readonly])')?.disabled).toBe(true);
    await submit();
    expect(onCreateItem).toHaveBeenCalledTimes(3);
    expect(onCreateItem.mock.calls[2][0]).toEqual(onCreateItem.mock.calls[1][0]);
    expect(onImported).toHaveBeenCalledTimes(1);
  });
});
