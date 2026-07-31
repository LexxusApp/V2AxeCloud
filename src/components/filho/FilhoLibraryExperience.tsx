import { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  ChevronRight,
  Download,
  FileText,
  Flame,
  LibraryBig,
  Loader2,
  LockKeyhole,
  Search,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import CommentSection from '../CommentSection';
import type { Material } from '../../views/Library';

type Props = {
  materials: Material[];
  loading: boolean;
  searchQuery: string;
  selectedCategory: string | null;
  selectedMaterial: Material | null;
  categories: string[];
  user: any;
  tenantId: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onSelectMaterial: (material: Material | null) => void;
  onOpenFundamentos: () => void;
};

const coverTones = [
  'is-forest',
  'is-clay',
  'is-indigo',
  'is-gold',
  'is-wine',
];

function categoryDescription(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('cantiga')) return 'Voz, memória e fundamento';
  if (normalized.includes('hist')) return 'Caminhos e ancestralidade';
  if (normalized.includes('erva')) return 'Folhas, cuidado e saber';
  if (normalized.includes('orix')) return 'Conhecimento da tradição';
  return 'Conteúdos orientados pela casa';
}

function MaterialCover({
  material,
  index,
  compact = false,
}: {
  material: Material;
  index: number;
  compact?: boolean;
}) {
  return (
    <div className={`filho-library-cover ${coverTones[index % coverTones.length]} ${compact ? 'is-compact' : ''}`}>
      <span className="filho-library-cover__eyebrow">{material.categoria}</span>
      <BookOpen aria-hidden />
      <strong>{material.titulo}</strong>
      <span className="filho-library-cover__house">Acervo da casa</span>
    </div>
  );
}

export default function FilhoLibraryExperience({
  materials,
  loading,
  searchQuery,
  selectedCategory,
  selectedMaterial,
  categories,
  user,
  tenantId,
  onSearchChange,
  onCategoryChange,
  onSelectMaterial,
  onOpenFundamentos,
}: Props) {
  const filtered = useMemo(() => materials.filter((material) => {
    const matchesSearch = material.titulo.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesCategory = selectedCategory ? material.categoria === selectedCategory : true;
    return matchesSearch && matchesCategory;
  }), [materials, searchQuery, selectedCategory]);

  const categoryCounts = useMemo(() => new Map(
    categories.map((category) => [
      category,
      materials.filter((material) => material.categoria === category).length,
    ]),
  ), [categories, materials]);

  const featured = materials[0] || null;

  if (selectedMaterial) {
    return (
      <motion.div
        className="filho-reading-page"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <header className="filho-reading-header">
          <button type="button" onClick={() => onSelectMaterial(null)}>
            <ArrowLeft />
            Voltar ao acervo
          </button>
          <div>
            <span>Sala de leitura</span>
            <strong>{selectedMaterial.categoria}</strong>
          </div>
          <button type="button" onClick={() => window.open(selectedMaterial.arquivo_url, '_blank', 'noopener,noreferrer')}>
            <Download />
            Baixar
          </button>
        </header>

        <section className="filho-reading-title">
          <div className="filho-reading-title__mark"><BookMarked /></div>
          <div>
            <span>Material orientado pela casa</span>
            <h1>{selectedMaterial.titulo}</h1>
            <p>Leia com calma. Seus estudos e dúvidas também fazem parte da caminhada.</p>
          </div>
        </section>

        <section className="filho-reading-viewer">
          <iframe
            src={`${selectedMaterial.arquivo_url}#toolbar=0`}
            title={selectedMaterial.titulo}
          />
        </section>

        <section className="filho-reading-notes">
          <div className="filho-reading-notes__intro">
            <Sparkles />
            <div>
              <span>Roda de estudo</span>
              <h2>Converse sobre este material</h2>
              <p>Registre uma dúvida ou compartilhe o que chamou sua atenção.</p>
            </div>
          </div>
          <CommentSection
            materialId={selectedMaterial.id}
            user={user}
            userRole="filho"
            tenantId={tenantId}
          />
        </section>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="filho-library-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="filho-library-hero">
        <div className="filho-library-hero__copy">
          <span><Sparkles /> Biblioteca da corrente</span>
          <h1>Conhecimento<br /><em>também é axé.</em></h1>
          <p>Um lugar para estudar os ensinamentos compartilhados pela sua casa e guardar referências para a caminhada.</p>
          <div className="filho-library-hero__actions">
            {featured ? (
              <button type="button" onClick={() => onSelectMaterial(featured)}>
                <BookOpen />
                Começar uma leitura
              </button>
            ) : null}
            <button type="button" onClick={onOpenFundamentos}>
              <LockKeyhole />
              Acervo de fundamentos
            </button>
          </div>
        </div>

        <div className="filho-library-hero__composition" aria-hidden>
          <div className="filho-library-book is-back"><span>MEMÓRIA</span></div>
          <div className="filho-library-book is-middle"><span>TRADIÇÃO</span></div>
          <div className="filho-library-book is-front">
            <Flame />
            <span>CADERNO<br />DA CASA</span>
            <small>AXÉCLOUD</small>
          </div>
        </div>

        <div className="filho-library-hero__seal">
          <strong>{materials.length}</strong>
          <span>{materials.length === 1 ? 'estudo disponível' : 'estudos disponíveis'}</span>
        </div>
      </header>

      <section className="filho-library-explore">
        <div className="filho-library-explore__heading">
          <div>
            <span>Escolha um caminho</span>
            <h2>Estantes da casa</h2>
          </div>
          <p>Explore por tema ou encontre um material específico.</p>
        </div>

        <div className="filho-library-search">
          <Search />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="O que você quer estudar hoje?"
            aria-label="Buscar no acervo"
          />
          {searchQuery ? (
            <button type="button" onClick={() => onSearchChange('')}>Limpar</button>
          ) : null}
        </div>

        <div className="filho-library-shelves">
          <button
            type="button"
            className={!selectedCategory ? 'is-active' : ''}
            onClick={() => onCategoryChange(null)}
          >
            <span><LibraryBig /></span>
            <strong>Todo o acervo</strong>
            <small>{materials.length} materiais</small>
            <ChevronRight />
          </button>
          {categories.map((category, index) => (
            <button
              type="button"
              key={category}
              className={selectedCategory === category ? 'is-active' : ''}
              onClick={() => onCategoryChange(category)}
            >
              <span data-tone={index % 4}><BookMarked /></span>
              <strong>{category}</strong>
              <small>{categoryDescription(category)}</small>
              <b>{categoryCounts.get(category) || 0}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="filho-library-catalog">
        <header>
          <div>
            <span>{selectedCategory || (searchQuery ? 'Resultado da busca' : 'Leituras disponíveis')}</span>
            <h2>{selectedCategory ? `Estante de ${selectedCategory}` : 'Acervo da corrente'}</h2>
          </div>
          <p>{filtered.length} {filtered.length === 1 ? 'material encontrado' : 'materiais encontrados'}</p>
        </header>

        {loading && materials.length === 0 ? (
          <div className="filho-library-loading"><Loader2 /></div>
        ) : filtered.length ? (
          <div className="filho-library-grid">
            {filtered.map((material, index) => (
              <motion.button
                type="button"
                key={material.id}
                onClick={() => onSelectMaterial(material)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.24) }}
              >
                <MaterialCover material={material} index={index} />
                <span className="filho-library-grid__copy">
                  <small>{material.categoria}</small>
                  <strong>{material.titulo}</strong>
                  <em>Publicado em {new Date(material.created_at).toLocaleDateString('pt-BR')}</em>
                </span>
                <span className="filho-library-grid__open">Abrir estudo <ArrowRight /></span>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="filho-library-empty">
            <div className="filho-library-empty__scene" aria-hidden>
              <span />
              <BookOpen />
              <span />
            </div>
            <span>Esta estante está sendo preparada</span>
            <h3>{searchQuery ? 'Nenhum estudo combina com sua busca.' : 'Os materiais aparecerão aqui.'}</h3>
            <p>A casa poderá publicar apostilas, cantigas e orientações para você consultar sempre que precisar.</p>
            {(searchQuery || selectedCategory) ? (
              <button type="button" onClick={() => { onSearchChange(''); onCategoryChange(null); }}>
                Ver todo o acervo
              </button>
            ) : null}
          </div>
        )}
      </section>

      <aside className="filho-library-foundation" onClick={onOpenFundamentos}>
        <div><LockKeyhole /></div>
        <span>
          <small>Acesso orientado</small>
          <strong>Acervo de fundamentos</strong>
          <p>Banhos, ervas e rituais liberados conforme sua função e a tradição da casa.</p>
        </span>
        <button type="button">Entrar no acervo <ArrowRight /></button>
      </aside>
    </motion.div>
  );
}
