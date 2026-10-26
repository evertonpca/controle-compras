import { useEffect, useRef, useState, type ReactNode } from 'react';
import { InstallAppBanner } from './InstallAppBanner.js';

type Route = 'dashboard' | 'compras';
type IconName = 'overview' | 'bag' | 'plus' | 'menu' | 'close' | 'sparkles';

export function NavigationIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="M20 2v4M18 4h4" /></>
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

interface AppShellProps {
  route: Route;
  onNavigate: (route: Route) => void;
  onNewPurchase: () => void;
  onExperimental: () => void;
  children: ReactNode;
}

export function AppShell({ route, onNavigate, onNewPurchase, onExperimental, children }: AppShellProps) {
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    drawerRef.current?.close();
    setMenuOpen(false);
  }

  function openMenu() {
    drawerRef.current?.showModal();
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', handleResize);
    };
  }, [menuOpen]);

  function followRoute(nextRoute: Route) {
    closeMenu();
    onNavigate(nextRoute);
  }

  function runAction(action: () => void) {
    closeMenu();
    action();
  }

  const brand = <span className="app-brand"><span className="app-brand-mark"><NavigationIcon name="bag" /></span><span>Minhas compras<small>Mais clareza no dia a dia.</small></span></span>;
  const navigation = (label: string) => (
    <nav className="sidebar-navigation" aria-label={label}>
      <p className="navigation-label">Seu controle</p>
      <a href="/" className="sidebar-link" aria-current={route === 'dashboard' ? 'page' : undefined} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); followRoute('dashboard'); }}><NavigationIcon name="overview" />Visão geral</a>
      <a href="/compras" className="sidebar-link" aria-current={route === 'compras' ? 'page' : undefined} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); followRoute('compras'); }}><NavigationIcon name="bag" />Compras</a>
      <div className="navigation-divider" />
      <p className="navigation-label">Ferramentas</p>
      <button type="button" className="sidebar-link" onClick={() => runAction(onExperimental)}><NavigationIcon name="sparkles" /><span>Importar com IA<small>Experimental</small></span><span className="beta-badge">Beta</span></button>
    </nav>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <header className="mobile-header">
        {brand}
        <button type="button" className="icon-button" onClick={openMenu} aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="mobile-menu"><NavigationIcon name="menu" /></button>
      </header>

      <aside className="desktop-sidebar">
        {brand}
        <button type="button" className="new-purchase-button" onClick={onNewPurchase}><NavigationIcon name="plus" />Nova compra</button>
        {navigation('Navegação principal')}
        <div className="sidebar-note"><span className="sidebar-note-icon">✦</span><strong>Pequenos hábitos,<br />mais tranquilidade.</strong><p>Suas compras organizadas em um só lugar.</p></div>
      </aside>

      <dialog ref={drawerRef} id="mobile-menu" className="navigation-drawer" aria-label="Menu de navegação" onClose={() => setMenuOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className="drawer-content">
          <div className="drawer-header">{brand}<button type="button" className="icon-button" onClick={closeMenu} aria-label="Fechar menu"><NavigationIcon name="close" /></button></div>
          <button type="button" className="new-purchase-button" onClick={() => runAction(onNewPurchase)}><NavigationIcon name="plus" />Nova compra</button>
          {navigation('Navegação do menu')}
          <p className="drawer-footer">Seu dia a dia, mais organizado.</p>
        </div>
      </dialog>

      <main id="main-content" className="app-main" tabIndex={-1}><InstallAppBanner />{children}</main>

      <nav className="bottom-navigation" aria-label="Acesso rápido">
        <a href="/" aria-current={route === 'dashboard' ? 'page' : undefined} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); followRoute('dashboard'); }}><NavigationIcon name="overview" /><span>Visão geral</span></a>
        <a href="/compras" aria-current={route === 'compras' ? 'page' : undefined} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); followRoute('compras'); }}><NavigationIcon name="bag" /><span>Compras</span></a>
        <button type="button" onClick={onNewPurchase}><span className="bottom-add-icon"><NavigationIcon name="plus" /></span><span>Nova compra</span></button>
      </nav>
    </div>
  );
}
