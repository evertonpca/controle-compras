import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductInput } from '../shared/product.js';
import { ProductDialog } from './components/ProductDialog.js';
import { createProduct, deleteProduct, listProducts, updateProduct } from './services/productsApi.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');
const primaryButtonClass = 'rounded-lg bg-[#176b45] px-4 py-3 font-bold text-white transition hover:bg-[#0e5033] disabled:cursor-wait disabled:opacity-70';
const actionButtonClass = 'rounded-lg bg-transparent px-2 py-1.5 font-bold text-[#176b45] transition hover:bg-[#e4f4eb]';
const tableHeaderClass = 'border-b border-[#edf1ee] px-5 py-4 text-left text-[11px] uppercase tracking-[1px] text-[#68756e]';
const tableCellClass = 'whitespace-nowrap border-b border-[#edf1ee] px-5 py-4 text-sm';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatPurchaseDate(value: string) {
  const dateValue = value || todayIsoDate();
  const [year, month, day] = dateValue.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  const emptyMessage = useMemo(() => loadError || 'Nenhum produto encontrado.', [loadError]);

  async function loadProducts(currentSearch = search) {
    try {
      setLoadError('');
      setProducts(await listProducts(currentSearch));
    } catch {
      setProducts([]);
      setLoadError('Não foi possível carregar os produtos.');
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }

  function openDialog(product: Product | null = null) {
    setEditingProduct(product);
    setFormError('');
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormError('');
  }

  async function saveProduct(input: ProductInput) {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, input);
        showToast('Produto atualizado.');
      } else {
        await createProduct(input);
        showToast('Produto cadastrado.');
      }

      closeDialog();
      await loadProducts();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o produto.');
    }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Deseja realmente excluir "${product.nome}"?`)) return;
    await deleteProduct(product.id);
    showToast('Produto excluído.');
    await loadProducts();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div className="min-h-screen bg-[#f4f7f5] font-sans text-[#17231d]">
      <main className="mx-auto my-7 w-[min(1120px,calc(100%_-_32px))] md:my-[52px]">
        <header className="mb-7 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-xs font-extrabold tracking-[1.8px] text-[#176b45]">ESTOQUE</span>
            <h1 className="mb-1 mt-1 text-[clamp(28px,4vw,42px)] font-bold leading-tight">Controle de produtos</h1>
            <p className="m-0 text-[#68756e]">Cadastre e acompanhe os produtos da sua operação.</p>
          </div>
          <button className={primaryButtonClass} onClick={() => openDialog()}>+ Novo produto</button>
        </header>

        <section className="mb-4 flex flex-col gap-5 rounded-lg border border-[#dfe6e1] bg-white px-5 py-4 shadow-[0_8px_30px_rgba(25,50,38,.05)] md:flex-row md:items-end md:justify-between">
          <label className="grid w-full max-w-[420px] gap-2 text-[13px] font-bold">
            Buscar
            <input
              className="w-full rounded-lg border border-[#cbd6cf] bg-white px-3 py-3 text-[#17231d] outline-none focus:border-[#176b45] focus:shadow-[0_0_0_3px_rgba(23,107,69,.12)]"
              type="search"
              placeholder="Nome, categoria ou estabelecimento..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="text-sm text-[#68756e] md:pb-3"><strong className="text-[#17231d]">{products.length}</strong> produtos cadastrados</div>
        </section>

        <section className="rounded-lg border border-[#dfe6e1] bg-white shadow-[0_8px_30px_rgba(25,50,38,.05)]">
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={tableHeaderClass}>Produto</th>
                  <th className={`${tableHeaderClass} hidden md:table-cell`}>Estabelecimento</th>
                  <th className={`${tableHeaderClass} hidden md:table-cell`}>Categoria</th>
                  <th className={tableHeaderClass}>Preço</th>
                  <th className={tableHeaderClass}>Estoque</th>
                  <th className={`${tableHeaderClass} hidden md:table-cell`}>Compra</th>
                  <th className={`${tableHeaderClass} hidden md:table-cell`}>Status</th>
                  <th className={`${tableHeaderClass} text-right`} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className={tableCellClass}>
                      <strong className="block">{product.nome}</strong>
                      <small className="block max-w-[300px] overflow-hidden text-ellipsis text-[#68756e]">{product.estabelecimento || 'Sem estabelecimento'}</small>
                    </td>
                    <td className={`${tableCellClass} hidden md:table-cell`}>{product.estabelecimento || '-'}</td>
                    <td className={`${tableCellClass} hidden md:table-cell`}>{product.categoria || '-'}</td>
                    <td className={tableCellClass}>{currency.format(product.preco)}</td>
                    <td className={tableCellClass}>{product.estoque}</td>
                    <td className={`${tableCellClass} hidden md:table-cell`}>{formatPurchaseDate(product.data_compra)}</td>
                    <td className={`${tableCellClass} hidden md:table-cell`}>
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${product.ativo ? 'bg-[#e4f4eb] text-[#176b45]' : 'bg-[#eef0ef] text-[#6b746f]'}`}>
                        {product.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      <button className={actionButtonClass} onClick={() => openDialog(product)}>Editar</button>
                      <button className={`${actionButtonClass} text-[#b13a3a] hover:bg-[#f7e8e8]`} onClick={() => void removeProduct(product)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!products.length && <div className="px-5 py-14 text-center text-[#68756e]">{emptyMessage}</div>}
        </section>
      </main>

      <ProductDialog
        product={editingProduct}
        isOpen={isDialogOpen}
        error={formError}
        onClose={closeDialog}
        onSubmit={saveProduct}
      />
      <div
        className={`pointer-events-none fixed bottom-5 right-5 rounded-lg bg-[#17231d] px-4 py-3 text-white transition duration-200 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        role="status"
      >
        {toast}
      </div>
    </div>
  );
}
