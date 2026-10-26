import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppBanner() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      setDismissed(false);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onDisplayMode = () => setInstalled(isStandalone());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayMode);
    };
  }, []);

  async function install() {
    if (!prompt || installing) return;
    setInstalling(true);
    setError('');
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
    } catch {
      setError('Para instalar, use a opção de instalar aplicativo no menu do navegador.');
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  }

  if (installed || dismissed || (!prompt && !isIOS && !error)) return null;

  return (
    <section className="install-app-banner" aria-label="Instalar aplicativo">
      <img src="/icons/icon-192.png" width="48" height="48" alt="" />
      <div className="install-app-content">
        <strong>Tenha suas compras sempre à mão</strong>
        <p>{error || (isIOS && !prompt
          ? 'No Safari, toque em Compartilhar e em “Adicionar à Tela de Início”. Se aparecer, ative “Abrir como App” e confirme em Adicionar.'
          : 'Instale Minhas compras na tela inicial do seu celular.')}</p>
        {prompt && <button type="button" className="install-app-button" disabled={installing} onClick={() => void install()}>{installing ? 'Abrindo instalação…' : 'Instalar aplicativo'}</button>}
      </div>
      <button type="button" className="icon-button" aria-label="Fechar aviso de instalação" onClick={() => setDismissed(true)}>×</button>
    </section>
  );
}
