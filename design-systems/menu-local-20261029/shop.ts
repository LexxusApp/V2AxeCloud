import colar from './assets/store/colar-v1.webp';
import camiseta from './assets/store/camiseta-v1.webp';
import vela from './assets/store/vela-v1.webp';
import type { LocalShop } from './shopLogic';
export const shopPhotos = [{ id: 'colar', title: 'Colar de contas brancas', source: colar }, { id: 'camiseta', title: 'Camiseta branca lisa', source: camiseta }, { id: 'vela', title: 'Vela branca em copo', source: vela }];
export const demoShop: LocalShop = { cart: {}, cartId: 'local-cart-initial', orders: [], products: [
  { id: 'colar', name: 'Colar de contas brancas', description: 'Peça de exemplo com contas brancas, sem atribuição ritual. Imagem gerada para o catálogo local.', category: 'Guias', cents: 4500, stock: 8, minimum: 3, photo: { source: colar, kind: 'generated' }, archived: false },
  { id: 'camiseta', name: 'Camiseta branca lisa', description: 'Modelo sem estampa, apenas para demonstrar o catálogo. A imagem não representa um produto real da casa.', category: 'Roupas', cents: 5990, stock: 0, minimum: 2, photo: { source: camiseta, kind: 'generated' }, archived: false },
  { id: 'vela', name: 'Vela branca em copo', description: 'Vela em recipiente transparente. Produto e valores ilustrativos, sem promessa de duração ou efeito ritual.', category: 'Velas', cents: 1200, stock: 5, minimum: 2, photo: { source: vela, kind: 'generated' }, archived: false },
] };
