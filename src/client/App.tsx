import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductInput } from '../shared/product.js';
import { ProductDialog } from './components/ProductDialog.js';
import { PurchaseDialog } from './components/PurchaseDialog.js';
import { AppShell, NavigationIcon } from './components/AppShell.js';
import { ExperimentalReceiptDialog } from './components/ExperimentalReceiptDialog.js';
import { createProduct, deleteProduct, listProducts, updateProduct } from './services/productsApi.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const secondaryButtonClass = 'min-h-11 cursor-pointer rounded-lg border border-[#d3ded8] bg-[#f8faf8] px-4 py-3 font-bold text-[#17231d] transition hover:border-[#b7c9be] hover:bg-white active:translate-y-px';
const actionButtonClass = 'cursor-pointer rounded-lg bg-transparent px-2 py-1.5 font-bold text-[#176b45] transition hover:bg-[#e4f4eb] active:translate-y-px';
const cardClass = 'rounded-lg border border-[#dfe6e1] bg-[#fffdf8] shadow-[0_10px_28px_rgba(25,50,38,.06)]';
const inputClass = 'w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none transition placeholder:text-[#8a958e] focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]';
const dateInputClass = `${inputClass} cursor-pointer`;
const selectClass = `${inputClass} cursor-pointer`;

interface PurchaseGroup {
  id: string;
  estabelecimento: string;
  data_compra: string;
  items: Product[];
  total: number;
  quantity: number;
  categories: string[];
}

function todayIsoDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatPurchaseDate(value: string) {
  const dateValue = value || todayIsoDate();
  const [year, month, day] = dateValue.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function productTotal(product: Product) {
  return product.preco * Math.max(1, product.estoque);
}

function getProductDate(product: Product) {
  return product.data_compra || product.criado_em.slice(0, 10) || todayIsoDate();
}

function getCurrentRoute() {
  return window.location.pathname === '/compras' ? 'compras' : 'dashboard';
}

function buildBreakdown(products: Product[], field: 'estabelecimento' | 'categoria') {
  const totals = new Map<string, number>();

  for (const product of products) {
    const key = product[field] || (field === 'categoria' ? 'Sem categoria' : 'Sem estabelecimento');
    totals.set(key, (totals.get(key) ?? 0) + productTotal(product));
  }

  return Array.from(totals, ([label, total]) => ({ label, total }))
    .sort((left, right) => right.total - left.total);
}

function groupPurchases(products: Product[]): PurchaseGroup[] {
  const groups = new Map<string, PurchaseGroup>();

  for (const product of products) {
    const date = getProductDate(product);
    const merchant = product.estabelecimento || 'Sem estabelecimento';
    const id = product.purchase_id || `legacy-product-${product.id}`;
    const group = groups.get(id) ?? {
      id,
      estabelecimento: merchant,
      data_compra: date,
      items: [],
      total: 0,
      quantity: 0,
      categories: []
    };

    group.items.push(product);
    group.total += productTotal(product);
    group.quantity += Math.max(1, product.estoque);
    group.categories = Array.from(new Set([...group.categories, product.categoria || 'Sem categoria']));
    groups.set(id, group);
  }

  return Array.from(groups.values()).sort((left, right) => right.data_compra.localeCompare(left.data_compra));
}

function BreakdownList({ title, items }: { title: string; items: Array<{ label: string; total: number }> }) {
  const maxTotal = Math.max(...items.map((item) => item.total), 1);
  const shownItems = items.slice(0, 6);

  return (
    <section className="rounded-lg border border-[#dce4df] bg-[#fffdf8] p-4 shadow-[0_10px_28px_rgba(25,50,38,.06)] sm:p-5">
      <h2 className="text-base font-bold sm:text-lg">{title}</h2>
      <div className="mt-5 grid gap-4">
        {shownItems.map((item) => (
          <div key={item.label} className="grid gap-2 rounded-lg bg-white/70 p-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-bold">{item.label}</span>
              <span className="shrink-0 text-[#68756e]">{currency.format(item.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-[#e4ece7]">
              <div className="h-full rounded-full bg-[#176b45]" style={{ width: `${Math.max(7, (item.total / maxTotal) * 100)}%` }} />
            </div>
          </div>
        ))}
        {!shownItems.length && <p className="py-8 text-center text-sm text-[#68756e]">Sem dados para exibir.</p>}
      </div>
    </section>
  );
}

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [route, setRoute] = useState<'dashboard' | 'compras'>(() => getCurrentRoute());
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isExperimentalReceiptOpen, setIsExperimentalReceiptOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  const emptyMessage = useMemo(() => loadError || 'Nenhuma compra encontrada.', [loadError]);
  const currentMonth = todayIsoDate().slice(0, 7);
  const monthProducts = useMemo(
    () => products.filter((product) => getProductDate(product).slice(0, 7) === currentMonth),
    [products, currentMonth]
  );
  const monthlyTotal = useMemo(() => monthProducts.reduce((total, product) => total + productTotal(product), 0), [monthProducts]);
  const merchantBreakdown = useMemo(() => buildBreakdown(monthProducts, 'estabelecimento'), [monthProducts]);
  const categoryBreakdown = useMemo(() => buildBreakdown(monthProducts, 'categoria'), [monthProducts]);
  const purchases = useMemo(() => groupPurchases(products), [products]);
  const merchantOptions = useMemo(() => (
    Array.from(new Set(purchases.map((purchase) => purchase.estabelecimento))).sort((left, right) => left.localeCompare(right))
  ), [purchases]);
  const categoryOptions = useMemo(() => (
    Array.from(new Set(purchases.flatMap((purchase) => purchase.categories))).sort((left, right) => left.localeCompare(right))
  ), [purchases]);
  const filteredPurchases = useMemo(() => {
    const term = search.trim().toLowerCase();
    const minValue = Number(minTotal);
    const maxValue = Number(maxTotal);
    const min = minTotal === '' || !Number.isFinite(minValue) ? null : minValue;
    const max = maxTotal === '' || !Number.isFinite(maxValue) ? null : maxValue;

    return purchases.filter((purchase) => (
      (!term
        || purchase.estabelecimento.toLowerCase().includes(term)
        || purchase.categories.some((category) => category.toLowerCase().includes(term))
        || purchase.items.some((item) => item.nome.toLowerCase().includes(term)))
      && (!dateStart || purchase.data_compra >= dateStart)
      && (!dateEnd || purchase.data_compra <= dateEnd)
      && (!merchantFilter || purchase.estabelecimento === merchantFilter)
      && (!categoryFilter || purchase.categories.includes(categoryFilter))
      && (min === null || purchase.total >= min)
      && (max === null || purchase.total <= max)
    ));
  }, [purchases, search, dateStart, dateEnd, merchantFilter, categoryFilter, minTotal, maxTotal]);
  const selectedPurchase = useMemo(() => (
    filteredPurchases.find((purchase) => purchase.id === selectedPurchaseId) ?? null
  ), [filteredPurchases, selectedPurchaseId]);
  const currentMonthPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.data_compra.slice(0, 7) === currentMonth),
    [purchases, currentMonth]
  );
  const averageTicket = purchases.length ? purchases.reduce((total, purchase) => total + purchase.total, 0) / purchases.length : 0;
  const topProduct = useMemo(() => {
    const totals = new Map<string, { label: string; total: number }>();
    for (const product of monthProducts) {
      const current = totals.get(product.nome) ?? { label: product.nome, total: 0 };
      current.total += productTotal(product);
      totals.set(product.nome, current);
    }
    return Array.from(totals.values()).sort((left, right) => right.total - left.total)[0];
  }, [monthProducts]);

  async function loadProducts(): Promise<Product[]> {
    try {
      setLoadError('');
      const loadedProducts = await listProducts();
      setProducts(loadedProducts);
      return loadedProducts;
    } catch {
      setProducts([]);
      setLoadError('Nao foi possivel carregar as compras.');
      return [];
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }

  function navigate(nextRoute: 'dashboard' | 'compras') {
    const nextPath = nextRoute === 'compras' ? '/compras' : '/';
    window.history.pushState(null, '', nextPath);
    setRoute(nextRoute);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
  }

  function clearPurchaseFilters() {
    setSearch('');
    setDateStart('');
    setDateEnd('');
    setMerchantFilter('');
    setCategoryFilter('');
    setMinTotal('');
    setMaxTotal('');
  }

  function openProductDialog(product: Product | null = null) {
    setEditingProduct(product);
    setFormError('');
    setIsProductDialogOpen(true);
  }

  function closeProductDialog() {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setFormError('');
  }

  function openPurchaseDialog() {
    setFormError('');
    setIsPurchaseDialogOpen(true);
  }

  function closePurchaseDialog() {
    setIsPurchaseDialogOpen(false);
    setFormError('');
  }

  async function saveProduct(input: ProductInput) {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, input);
        showToast('Item atualizado.');
      } else {
        await createProduct(input);
        showToast('Item cadastrado.');
      }

      closeProductDialog();
      await loadProducts();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Nao foi possivel salvar o item.');
    }
  }

  async function savePurchase(items: ProductInput[]) {
    try {
      const purchaseId = crypto.randomUUID();
      for (const item of items) {
        await createProduct({ ...item, purchase_id: purchaseId });
      }

      closePurchaseDialog();
      showToast('Compra cadastrada.');
      await loadProducts();
      setSelectedPurchaseId(purchaseId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Nao foi possivel salvar a compra.');
    }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Deseja realmente excluir "${product.nome}" desta compra?`)) return;
    await deleteProduct(product.id);
    showToast('Item excluido.');
    await loadProducts();
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!filteredPurchases.length) {
      setSelectedPurchaseId(null);
      return;
    }

    if (!selectedPurchaseId || !filteredPurchases.some((purchase) => purchase.id === selectedPurchaseId)) {
      setSelectedPurchaseId(filteredPurchases[0].id);
    }
  }, [filteredPurchases, selectedPurchaseId]);

  return (
    <div className="min-h-screen bg-[#f4f7f5] font-sans text-[#17231d]">
      <AppShell route={route} onNavigate={navigate} onNewPurchase={openPurchaseDialog} onExperimental={() => setIsExperimentalReceiptOpen(true)}>
        <header className="page-header">
          <div>
            <span className="page-eyebrow">Seu dia a dia em ordem</span>
            <h1>{route === 'dashboard' ? 'Um olhar nas suas compras' : 'Suas compras, organizadas'}</h1>
            <p>{route === 'dashboard' ? 'Entenda seus gastos e acompanhe o que faz parte da sua rotina.' : 'Encontre cada compra e confira os detalhes no seu ritmo.'}</p>
          </div>
          <button className="new-purchase-button page-new-purchase" onClick={openPurchaseDialog}><NavigationIcon name="plus" />Nova compra</button>
        </header>

        {route === 'dashboard' ? (
          <div className="grid gap-5">
            <section className="summary-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <div className="rounded-lg border border-[#cfded5] bg-[#173426] p-5 text-white shadow-[0_16px_38px_rgba(23,52,38,.18)] col-span-2">
                <span className="text-xs font-extrabold uppercase text-[#f3c567]">{monthFormatter.format(new Date(`${currentMonth}-02T00:00:00`))}</span>
                <p className="mt-3 text-4xl font-bold">{currency.format(monthlyTotal)}</p>
                <p className="mt-2 text-sm text-[#c7d9ce]">Total gasto neste mês.</p>
              </div>
              <div className="rounded-lg border border-[#d8e0ed] bg-[#f6f9ff] p-5 shadow-[0_10px_28px_rgba(30,64,120,.07)]">
                <span className="text-xs font-extrabold uppercase text-[#68756e]">Compras</span>
                <p className="mt-3 text-3xl font-bold">{currentMonthPurchases.length}</p>
                <p className="mt-2 text-sm text-[#68756e]">Compras neste mês.</p>
              </div>
              <div className="rounded-lg border border-[#eadfca] bg-[#fff8ea] p-5 shadow-[0_10px_28px_rgba(120,80,30,.07)]">
                <span className="text-xs font-extrabold uppercase text-[#68756e]">Ticket médio</span>
                <p className="mt-3 text-[clamp(1.2rem,4vw,1.875rem)] font-bold tracking-tight">{currency.format(averageTicket)}</p>
                <p className="mt-2 text-sm text-[#68756e]">Média de todo o histórico.</p>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <BreakdownList title="Gasto por estabelecimento" items={merchantBreakdown} />
              <BreakdownList title="Gasto por categoria" items={categoryBreakdown} />
            </section>

            <section className="grid gap-5 lg:grid-cols-3">
              <div className={`${cardClass} p-5`}>
                <h2 className="text-lg font-bold">Maior gasto por produto</h2>
                <p className="mt-4 text-2xl font-bold">{topProduct?.label ?? '-'}</p>
                <p className="mt-2 text-sm text-[#68756e]">{topProduct ? currency.format(topProduct.total) : 'Sem compras no mês.'}</p>
              </div>
              <div className="rounded-lg border border-[#d8e0ed] bg-[#f6f9ff] p-5 shadow-[0_10px_28px_rgba(30,64,120,.07)]">
                <h2 className="text-lg font-bold">Categorias diferentes</h2>
                <p className="mt-4 text-3xl font-bold">{categoryBreakdown.length}</p>
                <p className="mt-2 text-sm text-[#68756e]">Variedade dos seus gastos no mês.</p>
              </div>
              <div className="rounded-lg border border-[#eadfca] bg-[#fff8ea] p-5 shadow-[0_10px_28px_rgba(120,80,30,.07)]">
                <h2 className="text-lg font-bold">Última compra</h2>
                <p className="mt-4 text-2xl font-bold">{purchases[0]?.estabelecimento ?? '-'}</p>
                <p className="mt-2 text-sm text-[#68756e]">{purchases[0] ? `${formatPurchaseDate(purchases[0].data_compra)} - ${currency.format(purchases[0].total)}` : 'Nenhuma compra registrada.'}</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4">
            <section className="rounded-lg border border-[#dfe6e1] bg-[#fffdf8] px-4 py-4 shadow-[0_10px_28px_rgba(25,50,38,.06)] sm:px-5">
              <div className="grid gap-4">
                <div className="grid gap-4">
                  <label className="grid gap-2 text-[13px] font-bold">
                    Buscar
                    <input
                      className={inputClass}
                      type="search"
                      placeholder="Produto, categoria ou estabelecimento..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                <details className="purchase-filters">
                  <summary>Filtrar compras<span>{[dateStart, dateEnd, merchantFilter, categoryFilter, minTotal, maxTotal].filter(Boolean).length || 'Todos os registros'}</span></summary>
                  <div className="grid gap-4 pt-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-[13px] font-bold">
                      Estabelecimento
                      <select className={selectClass} value={merchantFilter} onChange={(event) => setMerchantFilter(event.target.value)}>
                        <option value="">Todos</option>
                        {merchantOptions.map((merchant) => (
                          <option key={merchant} value={merchant}>{merchant}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-[13px] font-bold">
                      Categoria
                      <select className={selectClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        <option value="">Todas</option>
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 pt-4 sm:grid-cols-2 2xl:grid-cols-[repeat(4,minmax(120px,1fr))_auto] 2xl:items-end">
                    <label className="grid gap-2 text-[13px] font-bold">
                      Data inicial
                      <input
                        className={dateInputClass}
                        type="date"
                        value={dateStart}
                        onChange={(event) => setDateStart(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-[13px] font-bold">
                      Data final
                      <input
                        className={dateInputClass}
                        type="date"
                        value={dateEnd}
                        onChange={(event) => setDateEnd(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-[13px] font-bold">
                      Valor mínimo
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="R$ 0,00"
                        value={minTotal}
                        onChange={(event) => setMinTotal(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-[13px] font-bold">
                      Valor máximo
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Sem limite"
                        value={maxTotal}
                        onChange={(event) => setMaxTotal(event.target.value)}
                      />
                    </label>
                    <button className={`${secondaryButtonClass} sm:col-span-2 2xl:col-span-1`} type="button" onClick={clearPurchaseFilters}>
                      Limpar filtros
                    </button>
                  </div>

                </details>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-lg bg-[#edf2ef] px-3 py-2 text-sm text-[#68756e]"><strong className="text-[#17231d]">{filteredPurchases.length}</strong> compras encontradas</div>
                  <div className="rounded-lg bg-[#fff8ea] px-3 py-2 text-sm text-[#68756e]"><strong className="text-[#17231d]">{currency.format(filteredPurchases.reduce((total, purchase) => total + purchase.total, 0))}</strong> no filtro</div>
                </div>
              </div>
            </section>

            {filteredPurchases.length ? (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-5">
                <div className="grid content-start gap-3">
                  {filteredPurchases.map((purchase) => (
                    <div key={purchase.id} className="grid gap-3">
                      <button
                        type="button"
                        className={`group relative w-full cursor-pointer overflow-hidden rounded-lg border p-4 text-left shadow-[0_10px_26px_rgba(25,50,38,.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(25,50,38,.12)] active:translate-y-px sm:p-5 ${selectedPurchase?.id === purchase.id ? 'border-[#176b45] bg-[#173426] text-white' : 'border-[#dbe3de] bg-[#fffdf8] text-[#17231d]'}`}
                        onClick={() => setSelectedPurchaseId(purchase.id)}
                      >
                        <div className={`absolute inset-y-0 left-0 w-1.5 ${selectedPurchase?.id === purchase.id ? 'bg-[#f3c567]' : 'bg-[#176b45]'}`} />
                        <div className="flex items-start justify-between gap-3 pl-1">
                          <div className="min-w-0">
                            <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-lg">{purchase.estabelecimento}</strong>
                            <span className={`mt-1 block text-sm ${selectedPurchase?.id === purchase.id ? 'text-[#c7d9ce]' : 'text-[#68756e]'}`}>{formatPurchaseDate(purchase.data_compra)}</span>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${selectedPurchase?.id === purchase.id ? 'bg-[rgba(255,255,255,.12)] text-white' : 'bg-[#e4f4eb] text-[#176b45]'}`}>{purchase.items.length} itens</span>
                        </div>
                        <div className="mt-5 grid gap-3 pl-1 sm:flex sm:items-end sm:justify-between">
                          <span className="text-2xl font-bold">{currency.format(purchase.total)}</span>
                          <span className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${selectedPurchase?.id === purchase.id ? 'text-[#c7d9ce]' : 'text-[#68756e]'}`}>{purchase.categories.slice(0, 2).join(', ')}</span>
                        </div>
                      </button>

                      {selectedPurchase?.id === purchase.id && (
                        <section className="rounded-lg border border-[#d8e0ed] bg-[#f6f9ff] p-4 shadow-[0_12px_32px_rgba(30,64,120,.08)] lg:hidden">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <span className="text-xs font-extrabold uppercase text-[#176b45]">Produtos</span>
                              <h2 className="mt-1 text-xl font-bold">{purchase.estabelecimento}</h2>
                            </div>
                            <strong className="text-lg">{currency.format(purchase.total)}</strong>
                          </div>
                          <div className="grid gap-3">
                            {purchase.items.map((item) => (
                              <article key={item.id} className="grid gap-3 rounded-lg border border-[#dbe3de] bg-white p-4">
                                <div className="min-w-0">
                                  <strong className="block overflow-hidden text-ellipsis whitespace-nowrap">{item.nome}</strong>
                                  <span className="mt-1 block text-sm text-[#68756e]">{item.categoria || 'Sem categoria'} - Qtde. {Math.max(1, item.estoque)}</span>
                                </div>
                                <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
                                  <span className="font-bold">{currency.format(productTotal(item))}</span>
                                  <div className="flex flex-wrap gap-1">
                                    <button className={actionButtonClass} onClick={() => openProductDialog(item)}>Editar</button>
                                    <button className={`${actionButtonClass} text-[#b13a3a] hover:bg-[#f7e8e8]`} onClick={() => void removeProduct(item)}>Excluir</button>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  ))}
                </div>

                <section className="hidden rounded-lg border border-[#d8e0ed] bg-[#f6f9ff] p-4 shadow-[0_12px_32px_rgba(30,64,120,.08)] sm:p-5 lg:block lg:min-h-[360px]">
                  {selectedPurchase ? (
                    <div className="grid gap-5">
                      <header className="flex flex-col gap-3 border-b border-[#edf1ee] pb-5 md:flex-row md:items-start md:justify-between">
                        <div>
                          <span className="text-xs font-extrabold uppercase text-[#176b45]">Detalhe da compra</span>
                          <h2 className="mt-1 text-2xl font-bold">{selectedPurchase.estabelecimento}</h2>
                          <p className="mt-1 text-sm text-[#68756e]">{formatPurchaseDate(selectedPurchase.data_compra)}</p>
                        </div>
                        <div className="text-left md:text-right">
                          <span className="block text-xs font-extrabold uppercase text-[#68756e]">Total</span>
                          <strong className="text-2xl">{currency.format(selectedPurchase.total)}</strong>
                        </div>
                      </header>

                      <div className="grid gap-3">
                        {selectedPurchase.items.map((item) => (
                          <article key={item.id} className="grid gap-3 rounded-lg border border-[#dbe3de] bg-white p-4 shadow-[0_6px_16px_rgba(25,50,38,.04)] 2xl:grid-cols-[minmax(0,1fr)_80px_110px_140px] 2xl:items-center">
                            <div className="min-w-0">
                              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap">{item.nome}</strong>
                              <span className="mt-1 block text-sm text-[#68756e]">{item.categoria || 'Sem categoria'}</span>
                            </div>
                            <span className="text-sm text-[#68756e]">Qtde. {Math.max(1, item.estoque)}</span>
                            <span className="font-bold">{currency.format(productTotal(item))}</span>
                            <div className="flex gap-1 md:justify-end">
                              <button className={actionButtonClass} onClick={() => openProductDialog(item)}>Editar</button>
                              <button className={`${actionButtonClass} text-[#b13a3a] hover:bg-[#f7e8e8]`} onClick={() => void removeProduct(item)}>Excluir</button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full place-items-center py-14 text-center text-[#68756e]">Selecione uma compra para ver os produtos.</div>
                  )}
                </section>
              </section>
            ) : (
              <section className={`${cardClass} px-5 py-14 text-center text-[#68756e]`}>{emptyMessage}</section>
            )}
          </div>
        )}
      </AppShell>

      <ProductDialog
        product={editingProduct}
        isOpen={isProductDialogOpen}
        error={formError}
        onClose={closeProductDialog}
        onSubmit={saveProduct}
      />
      <PurchaseDialog
        isOpen={isPurchaseDialogOpen}
        error={formError}
        onClose={closePurchaseDialog}
        onSubmit={savePurchase}
      />
      <ExperimentalReceiptDialog
        isOpen={isExperimentalReceiptOpen}
        onClose={() => setIsExperimentalReceiptOpen(false)}
        onCreateItem={createProduct}
        onImported={async (purchaseId) => {
          setIsExperimentalReceiptOpen(false);
          clearPurchaseFilters();
          navigate('compras');
          await loadProducts();
          setSelectedPurchaseId(purchaseId);
          showToast('Compra importada pela seção experimental.');
        }}
      />
      <div
        className={`app-toast pointer-events-none fixed rounded-lg bg-[#17231d] px-4 py-3 text-white transition duration-200 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        role="status"
      >
        {toast}
      </div>
    </div>
  );
}
