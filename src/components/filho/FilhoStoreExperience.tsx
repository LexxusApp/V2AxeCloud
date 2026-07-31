import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Gift,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '../../views/Store';

type Props = {
  products: Product[];
  loading: boolean;
  cartQuantity: number;
  cartTotal: number;
  memberName: string;
  onOpenCart: () => void;
  onBuy: (product: Product) => void;
  onReserve: (product: Product) => void;
};

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function FilhoStoreExperience({
  products,
  loading,
  cartQuantity,
  cartTotal,
  memberName,
  onOpenCart,
  onBuy,
  onReserve,
}: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.categoria).filter(Boolean))),
    [products],
  );
  const filtered = useMemo(() => products.filter((product) => {
    const normalized = search.trim().toLowerCase();
    const matchesSearch = !normalized
      || product.nome.toLowerCase().includes(normalized)
      || product.descricao.toLowerCase().includes(normalized);
    return matchesSearch && (!category || product.categoria === category);
  }), [products, search, category]);
  const available = products.filter((product) => product.estoque_atual > 0);
  const featured = available[0] || products[0] || null;

  return (
    <motion.div
      className="filho-store-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="filho-store-hero">
        <div className="filho-store-hero__copy">
          <span><Sparkles /> Loja da sua casa</span>
          <h1>Objetos que acompanham<br /><em>a sua caminhada.</em></h1>
          <p>
            {memberName ? `${memberName.split(' ')[0]}, encontre` : 'Encontre'} artigos preparados pela casa,
            reserve com o zelador ou inclua o pagamento na mensalidade.
          </p>
          <div>
            <button type="button" onClick={() => document.querySelector('.filho-store-catalog')?.scrollIntoView({ behavior: 'smooth' })}>
              Explorar a loja <ArrowRight />
            </button>
            <span><Check /> Retirada combinada com a casa</span>
          </div>
        </div>

        {featured ? (
          <button type="button" className="filho-store-featured" onClick={() => onBuy(featured)}>
            <div className="filho-store-featured__image">
              {featured.imagem_url ? <img src={featured.imagem_url} alt="" /> : <Gift />}
              <span>Escolha da casa</span>
            </div>
            <div className="filho-store-featured__copy">
              <small>{featured.categoria}</small>
              <strong>{featured.nome}</strong>
              <b>{money(featured.preco)}</b>
              <span>Adicionar ao pedido <ChevronRight /></span>
            </div>
          </button>
        ) : (
          <div className="filho-store-featured is-preview" aria-hidden>
            <div className="filho-store-featured__image"><Gift /><span>Em preparação</span></div>
            <div className="filho-store-featured__copy">
              <small>Vitrine da casa</small>
              <strong>Novos artigos aparecerão aqui</strong>
            </div>
          </div>
        )}

        <button type="button" className="filho-store-cart" onClick={onOpenCart}>
          <span><ShoppingBag />{cartQuantity > 0 ? cartQuantity : null}</span>
          <span>
            <small>Seu pedido</small>
            <strong>{cartQuantity ? money(cartTotal) : 'Carrinho vazio'}</strong>
          </span>
          <ChevronRight />
        </button>
      </header>

      <section className="filho-store-benefits">
        <article><span><PackageCheck /></span><div><strong>Compra organizada</strong><small>Estoque atualizado pela casa</small></div></article>
        <article><span><Tag /></span><div><strong>Pagamento flexível</strong><small>Mensalidade, Pix ou reserva</small></div></article>
        <article><span><Gift /></span><div><strong>Seleção do terreiro</strong><small>Itens escolhidos para a corrente</small></div></article>
      </section>

      <section className="filho-store-catalog">
        <header>
          <div>
            <span>Vitrine da casa</span>
            <h2>Escolha o que precisa</h2>
          </div>
          <p>{available.length} {available.length === 1 ? 'item disponível' : 'itens disponíveis'}</p>
        </header>

        <div className="filho-store-tools">
          <label>
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar na loja"
            />
          </label>
          <div>
            <button type="button" className={!category ? 'is-active' : ''} onClick={() => setCategory(null)}>Tudo</button>
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? 'is-active' : ''}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="filho-store-loading"><Loader2 /></div>
        ) : filtered.length ? (
          <div className="filho-store-grid">
            {filtered.map((product, index) => {
              const outOfStock = product.estoque_atual <= 0;
              const lowStock = product.estoque_atual > 0 && product.estoque_atual <= product.estoque_minimo;
              return (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * .04, .24) }}
                  className={outOfStock ? 'is-unavailable' : ''}
                >
                  <div className="filho-store-product__image">
                    {product.imagem_url ? <img src={product.imagem_url} alt={product.nome} /> : <ImageIcon />}
                    <span>{product.categoria}</span>
                    {outOfStock ? <b>Indisponível</b> : lowStock ? <b>Últimas unidades</b> : null}
                  </div>
                  <div className="filho-store-product__content">
                    <div>
                      <h3>{product.nome}</h3>
                      <strong>{money(product.preco)}</strong>
                    </div>
                    <p>{product.descricao || 'Artigo disponibilizado pela sua casa.'}</p>
                    <small>{outOfStock ? 'Avise a casa sobre seu interesse' : `${product.estoque_atual} em estoque`}</small>
                    <div className="filho-store-product__actions">
                      <button type="button" onClick={() => onBuy(product)} disabled={outOfStock}>
                        <ShoppingBag /> {outOfStock ? 'Sem estoque' : 'Comprar'}
                      </button>
                      {!outOfStock ? (
                        <button type="button" onClick={() => onReserve(product)}>Reservar</button>
                      ) : null}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="filho-store-empty">
            <div aria-hidden><span /><ShoppingBag /><span /></div>
            <span>Vitrine em organização</span>
            <h3>{products.length ? 'Nenhum item combina com sua busca.' : 'A loja da casa será preparada aqui.'}</h3>
            <p>
              {products.length
                ? 'Tente outro nome ou volte para todas as categorias.'
                : 'Quando o terreiro publicar velas, guias, roupas e outros artigos, você poderá comprar ou reservar por esta página.'}
            </p>
            {products.length ? <button type="button" onClick={() => { setSearch(''); setCategory(null); }}>Ver toda a loja</button> : null}
          </div>
        )}
      </section>

      <aside className="filho-store-help">
        <span><ShoppingBag /></span>
        <div>
          <small>Como funciona</small>
          <strong>Compre agora ou apenas reserve.</strong>
          <p>Na compra, escolha Pix ou cobrança na mensalidade. Na reserva, a casa combina a retirada com você.</p>
        </div>
      </aside>
    </motion.div>
  );
}
