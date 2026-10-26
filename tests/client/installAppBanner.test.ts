// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallAppBanner } from '../../src/client/components/InstallAppBanner.js';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
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

async function render() {
  await act(async () => root.render(createElement(InstallAppBanner)));
}

async function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted', fail = false) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = fail ? vi.fn().mockRejectedValue(new Error('unavailable')) : vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  await act(async () => { window.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
  return prompt;
}

describe('instalação do aplicativo', () => {
  it('espera o navegador permitir a instalação e abre o prompt ao tocar', async () => {
    await render();
    expect(container.textContent).toBe('');
    const prompt = await offerInstall();
    expect(prompt).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Instalar aplicativo');
    await act(async () => container.querySelector<HTMLButtonElement>('.install-app-button')!.click());
    expect(prompt).toHaveBeenCalledOnce();
    expect(container.textContent).toBe('');
  });

  it('não reutiliza o evento quando o usuário cancela a instalação', async () => {
    await render();
    const prompt = await offerInstall('dismissed');
    await act(async () => container.querySelector<HTMLButtonElement>('.install-app-button')!.click());
    expect(prompt).toHaveBeenCalledOnce();
    expect(container.textContent).toBe('');
    await offerInstall();
    expect(container.textContent).toContain('Instalar aplicativo');
  });

  it('permite fechar o aviso e o oculta após a instalação pelo navegador', async () => {
    await render();
    await offerInstall();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Fechar aviso de instalação"]')!.click());
    expect(container.textContent).toBe('');
    await offerInstall();
    await act(async () => { window.dispatchEvent(new Event('appinstalled')); });
    expect(container.textContent).toBe('');
  });

  it('mostra instruções de instalação no iPhone sem botão de prompt nativo', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone)');
    await render();
    expect(container.textContent).toContain('Adicionar à Tela de Início');
    expect(container.querySelector('.install-app-button')).toBeNull();
  });

  it('não mostra o aviso dentro do aplicativo instalado', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone)');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    await render();
    expect(container.textContent).toBe('');
  });

  it('oferece uma alternativa se o prompt falhar', async () => {
    await render();
    await offerInstall('accepted', true);
    await act(async () => container.querySelector<HTMLButtonElement>('.install-app-button')!.click());
    expect(container.textContent).toContain('menu do navegador');
    expect(container.querySelector('.install-app-button')).toBeNull();
  });
});
