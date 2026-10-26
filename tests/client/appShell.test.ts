// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../src/client/components/AppShell.js';

let container: HTMLDivElement;
let root: Root;
let mediaChange: (() => void) | undefined;
const onNavigate = vi.fn();
const onNewPurchase = vi.fn();
const onExperimental = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: true,
    addEventListener: (_: string, listener: () => void) => { mediaChange = listener; },
    removeEventListener: () => { mediaChange = undefined; }
  })));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await render();
});

async function render(route: 'dashboard' | 'compras' = 'dashboard') {
  await act(async () => root.render(createElement(AppShell, {
    route, onNavigate, onNewPurchase, onExperimental, children: 'Conteúdo da página'
  })));
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function menu() { return container.querySelector('dialog')!; }
async function openMenu() {
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Abrir menu"]')!.click());
}

describe('navegação responsiva', () => {
  it('fecha o menu ao navegar e restaura a rolagem da página', async () => {
    document.body.style.overflow = 'auto';
    await openMenu();
    expect(menu().open).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => menu().querySelector<HTMLAnchorElement>('a[href="/compras"]')!.click());
    expect(onNavigate).toHaveBeenCalledWith('compras');
    expect(menu().open).toBe(false);
    expect(document.body.style.overflow).toBe('auto');
    expect(container.querySelector('[aria-label="Abrir menu"]')?.getAttribute('aria-expanded')).toBe('false');
    await render('compras');
    expect(container.querySelector('.bottom-navigation [aria-current="page"]')?.textContent).toBe('Compras');
  });

  it('fecha o menu antes de abrir a importação por IA', async () => {
    await openMenu();
    const action = [...menu().querySelectorAll('button')].find((button) => button.textContent?.includes('Importar com IA'))!;
    onExperimental.mockImplementationOnce(() => expect(menu().open).toBe(false));
    await act(async () => action.click());
    expect(onExperimental).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('libera a rolagem ao fechar nativamente e ao mudar para uma tela maior', async () => {
    await openMenu();
    await act(async () => menu().close());
    expect(document.body.style.overflow).not.toBe('hidden');
    await openMenu();
    await act(async () => mediaChange?.());
    expect(menu().open).toBe(false);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('oferece cadastro no acesso rápido e preserva links para abrir em outra aba', async () => {
    await act(async () => container.querySelector<HTMLButtonElement>('.bottom-navigation button')!.click());
    expect(onNewPurchase).toHaveBeenCalledOnce();
    const link = container.querySelector<HTMLAnchorElement>('.bottom-navigation a[href="/compras"]')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    // Check after React handles the click, then suppress jsdom's unsupported navigation.
    const browserNavigation = vi.fn((click: MouseEvent) => {
      expect(click.defaultPrevented).toBe(false);
      click.preventDefault();
    });
    document.addEventListener('click', browserNavigation, { once: true });
    await act(async () => { link.dispatchEvent(event); });
    expect(browserNavigation).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
