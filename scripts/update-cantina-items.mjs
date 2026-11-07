import fs from 'fs';

const filePath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/financial/CantinaView.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Pencil to lucide-react imports if not present
if (!code.includes('Pencil,')) {
  code = code.replace("Flame,\n  Leaf\n} from 'lucide-react';", "Flame,\n  Leaf,\n  Pencil\n} from 'lucide-react';");
}

// 2. Add CantinaMenuItem interface
const itemInterface = `export interface CantinaMenuItem {
  id: string;
  nome: string;
  preco: number;
  icon: string;
  cat: 'bebidas' | 'comidas' | 'liturgia' | string;
  badge: string | null;
}

const QUICK_MENU_ITEMS: CantinaMenuItem[] = [`;

code = code.replace('const QUICK_MENU_ITEMS = [', itemInterface);

// 3. Add state inside CantinaView component
const stateHookTarget = `  const [selectedCategory, setSelectedCategory] = useState<string>('todos');`;
const stateHookReplacement = `  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Gerenciamento dinâmico de itens fixos do cardápio
  const storageKey = \`axecloud_cantina_menu_\${tenantId || 'default'}\`;
  const [menuItems, setMenuItems] = useState<CantinaMenuItem[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(\`axecloud_cantina_menu_\${tenantId || 'default'}\`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return QUICK_MENU_ITEMS;
  });

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CantinaMenuItem | null>(null);
  const [itemForm, setItemForm] = useState<{
    nome: string;
    preco: string;
    icon: string;
    cat: string;
    badge: string;
  }>({
    nome: '',
    preco: '',
    icon: '☕',
    cat: 'comidas',
    badge: '',
  });

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      nome: '',
      preco: '',
      icon: '🥟',
      cat: 'comidas',
      badge: '',
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: CantinaMenuItem) => {
    setEditingItem(item);
    setItemForm({
      nome: item.nome,
      preco: item.preco.toString().replace('.', ','),
      icon: item.icon || '☕',
      cat: item.cat || 'comidas',
      badge: item.badge || '',
    });
    setIsItemModalOpen(true);
  };

  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.nome.trim()) {
      showHouseToast({ title: 'Nome obrigatório', message: 'Digite o nome do produto.', type: 'alert' });
      return;
    }
    const cleanPrice = parseFloat(itemForm.preco.replace(',', '.'));
    if (isNaN(cleanPrice) || cleanPrice < 0) {
      showHouseToast({ title: 'Preço inválido', message: 'Digite um valor numérico válido (ex: 7,50).', type: 'alert' });
      return;
    }

    let updated: CantinaMenuItem[];
    if (editingItem) {
      updated = menuItems.map((m) =>
        m.id === editingItem.id
          ? {
              ...m,
              nome: itemForm.nome.trim(),
              preco: cleanPrice,
              icon: itemForm.icon || '☕',
              cat: itemForm.cat,
              badge: itemForm.badge.trim() || null,
            }
          : m
      );
      showHouseToast({ title: 'Item atualizado!', message: \`"\${itemForm.nome}" atualizado no cardápio fixo.\`, type: 'success' });
    } else {
      const newItem: CantinaMenuItem = {
        id: \`item-\${Date.now()}\`,
        nome: itemForm.nome.trim(),
        preco: cleanPrice,
        icon: itemForm.icon || '☕',
        cat: itemForm.cat,
        badge: itemForm.badge.trim() || null,
      };
      updated = [...menuItems, newItem];
      showHouseToast({ title: 'Item adicionado!', message: \`"\${itemForm.nome}" cadastrado com sucesso.\`, type: 'success' });
    }

    setMenuItems(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    setIsItemModalOpen(false);
  };

  const handleDeleteMenuItem = (id: string) => {
    const confirmed = confirmAction('Deseja realmente remover este item fixo do cardápio?');
    if (!confirmed) return;
    const updated = menuItems.filter((m) => m.id !== id);
    setMenuItems(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    showHouseToast({ title: 'Item removido', message: 'O item foi excluído do cardápio fixo.', type: 'info' });
    setIsItemModalOpen(false);
  };

  const handleResetDefaultMenu = () => {
    const confirmed = confirmAction('Deseja restaurar o cardápio para os 12 itens originais?');
    if (!confirmed) return;
    setMenuItems(QUICK_MENU_ITEMS);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    showHouseToast({ title: 'Cardápio restaurado', message: 'Itens restaurados para o padrão original.', type: 'success' });
  };`;

code = code.replace(stateHookTarget, stateHookReplacement);

// 4. Update filteredMenuItems to use menuItems
const filterTarget = `  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === 'todos') return QUICK_MENU_ITEMS;
    return QUICK_MENU_ITEMS.filter((i) => i.cat === selectedCategory);
  }, [selectedCategory]);`;

const filterReplacement = `  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === 'todos') return menuItems;
    return menuItems.filter((i) => i.cat === selectedCategory);
  }, [selectedCategory, menuItems]);`;

code = code.replace(filterTarget, filterReplacement);

// 5. Update categories bar with "+ Novo Item Fixo" button
const categoriesBarTarget = `            {/* Categorias do Cardápio */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: 'todos', label: 'Tudo', icon: null },
                { id: 'bebidas', label: 'Bebidas & Café', icon: '☕' },
                { id: 'comidas', label: 'Salgados & Doces', icon: '🥟' },
                { id: 'liturgia', label: 'Itens Litúrgicos', icon: '🌿' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition-all",
                    selectedCategory === c.id
                      ? "bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] shadow-sm"
                      : "bg-white border border-[#E5DECF] text-[#4A4235] hover:bg-[#FAF8F5]"
                  )}
                >
                  {c.icon && <span>{c.icon}</span>}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>`;

const categoriesBarReplacement = `            {/* Categorias do Cardápio e Ação de Adicionar Item */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1 min-w-0">
                {[
                  { id: 'todos', label: 'Tudo', icon: null },
                  { id: 'bebidas', label: 'Bebidas & Café', icon: '☕' },
                  { id: 'comidas', label: 'Salgados & Doces', icon: '🥟' },
                  { id: 'liturgia', label: 'Itens Litúrgicos', icon: '🌿' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer",
                      selectedCategory === c.id
                        ? "bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] shadow-sm"
                        : "bg-white border border-[#E5DECF] text-[#4A4235] hover:bg-[#FAF8F5]"
                    )}
                  >
                    {c.icon && <span>{c.icon}</span>}
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateItem}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0f1411] px-3.5 py-2 text-xs font-black text-[#f6c94c] hover:bg-[#1a261c] border border-amber-500/40 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Cadastrar novo item fixo no cardápio"
                >
                  <Plus className="h-3.5 w-3.5 text-[#f6c94c]" />
                  <span>+ Novo Item Fixo</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaultMenu}
                  className="text-[10px] text-[#7A7265] hover:text-[#171A16] underline decoration-dotted px-1 cursor-pointer"
                  title="Restaurar os 12 itens originais padrão"
                >
                  Restaurar padrão
                </button>
              </div>
            </div>`;

code = code.replace(categoriesBarTarget, categoriesBarReplacement);

// 6. Update card in grid to include Edit button
const cardInGridTarget = `                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    {item.badge && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-800 border border-amber-200">
                        {item.badge}
                      </span>
                    )}
                  </div>`;

const cardInGridReplacement = `                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-800 border border-amber-200">
                          {item.badge}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditItem(item);
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-amber-800 hover:bg-amber-100/70 transition-all cursor-pointer"
                        title="Editar nome, preço, ícone ou selo deste item"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>`;

code = code.replace(cardInGridTarget, cardInGridReplacement);

// 7. Add Modal for Create/Edit Menu Item before closing </BodyPortal>
const modalMarkup = `      {/* Modal Cadastrar / Editar Item Fixo da Cantina */}
      <BodyPortal>
        <AnimatePresence>
          {isItemModalOpen && (
            <motion.div
              className={MODAL_TW.BACKDROP}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={MODAL_TW.CONTAINER}>
                <motion.div
                  className={cn(MODAL_TW.PANEL, "max-w-md bg-white border border-[#E5DECF] p-6 rounded-lg shadow-2xl")}
                  initial={MODAL_PANEL_IN}
                  animate={MODAL_PANEL_DONE}
                  exit={MODAL_PANEL_OUT}
                >
                  <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{itemForm.icon || '☕'}</span>
                      <h3 className="text-base font-black text-[#171A16]">
                        {editingItem ? 'Editar Item do Cardápio' : 'Novo Item Fixo da Cantina'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsItemModalOpen(false)}
                      className="text-[#9B9184] hover:text-[#171A16] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveMenuItem} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                        Nome do Produto *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Pastel de Queijo, Chá de Ervas..."
                        value={itemForm.nome}
                        onChange={(e) => setItemForm({ ...itemForm, nome: e.target.value })}
                        className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                          Preço de Venda (R$) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 7,50"
                          value={itemForm.preco}
                          onChange={(e) => setItemForm({ ...itemForm, preco: e.target.value })}
                          className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                          Categoria
                        </label>
                        <select
                          value={itemForm.cat}
                          onChange={(e) => setItemForm({ ...itemForm, cat: e.target.value })}
                          className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3 py-2.5 text-xs font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                        >
                          <option value="bebidas">☕ Bebidas & Café</option>
                          <option value="comidas">🥟 Salgados & Doces</option>
                          <option value="liturgia">🌿 Itens Litúrgicos</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1.5">
                        Ícone / Emoji
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={itemForm.icon}
                          onChange={(e) => setItemForm({ ...itemForm, icon: e.target.value })}
                          className="w-14 text-center rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] py-2 text-xl font-bold focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                          maxLength={4}
                        />
                        <span className="text-[11px] text-[#7A7265]">
                          Toque em um ícone abaixo ou digite qualquer emoji
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#FAF8F5] border border-[#E5DECF] max-h-24 overflow-y-auto">
                        {[
                          '☕', '🥟', '💧', '🥤', '🧃', '🕯️', '🌿', '💨', '🍰', '🍬', 
                          '🍯', '🍪', '🥪', '🍞', '🫔', '🥥', '🍵', '🍛', '🍎', '🍫', 
                          '📿', '✨', '⚡', '🥧', '🧇', '🥞', '🥐', '🍶', '📦'
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setItemForm({ ...itemForm, icon: emoji })}
                            className={cn(
                              "h-8 w-8 text-base rounded-lg flex items-center justify-center transition-all cursor-pointer",
                              itemForm.icon === emoji
                                ? "bg-[#D4AF37] text-white shadow-xs scale-110"
                                : "hover:bg-white bg-transparent"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1.5">
                        Selo / Badge (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Quente, Fresco, Sagrado, Caseiro, Gelada..."
                        value={itemForm.badge}
                        onChange={(e) => setItemForm({ ...itemForm, badge: e.target.value })}
                        className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2 text-xs font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {['Quente', 'Fresco', 'Gelada', 'Sagrado', 'Caseiro', 'Cosme', 'Puro', 'Erveiro'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setItemForm({ ...itemForm, badge: itemForm.badge === b ? '' : b })}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md font-bold transition-all border cursor-pointer",
                              itemForm.badge === b
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                            )}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#F0EAE0]">
                      {editingItem ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(editingItem.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Excluir</span>
                        </button>
                      ) : <div />}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsItemModalOpen(false)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B6355] hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] text-xs font-black hover:brightness-105 shadow-sm cursor-pointer active:scale-95"
                        >
                          {editingItem ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BodyPortal>
`;

code = code.replace('{/* Modal Ajuste de Limite */}', modalMarkup + '\n      {/* Modal Ajuste de Limite */}');

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated CantinaView.tsx with dynamic item management!');
