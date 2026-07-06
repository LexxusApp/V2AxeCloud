import { useEffect } from 'react';
import { buildLocalBusinessJsonLd, buildBreadcrumbJsonLd } from '../../lib/diretorioSeoShared';
import type { DiretorioTerreiro } from './diretorioPublic';

const JSON_LD_ID = 'axecloud-diretorio-terreiro-jsonld';

export function useDiretorioTerreiroJsonLd(terreiro: DiretorioTerreiro | null) {
  useEffect(() => {
    if (!terreiro) return;

    const cidadePath =
      terreiro.estado && terreiro.cidadeSlug
        ? `/terreiros/${terreiro.estado.toLowerCase()}/${terreiro.cidadeSlug}`
        : '/terreiros';

    const blocks = [
      buildLocalBusinessJsonLd({
        slug: terreiro.slug,
        nome: terreiro.nome,
        endereco: terreiro.endereco,
        telefone: terreiro.telefone,
        fotoUrl: terreiro.fotoUrl,
        linkMaps: terreiro.linkMaps,
        cidade: terreiro.cidade,
        estado: terreiro.estado,
        cidadeSlug: terreiro.cidadeSlug,
        cidadeUrl: terreiro.cidadeUrl,
      }),
      buildBreadcrumbJsonLd([
        { name: 'Diretório', path: '/terreiros' },
        ...(terreiro.cidade ? [{ name: terreiro.cidade, path: cidadePath }] : []),
        { name: terreiro.nome, path: `/terreiro/${terreiro.slug}` },
      ]),
    ];

    let el = document.getElementById(JSON_LD_ID);
    if (!el) {
      el = document.createElement('script');
      el.id = JSON_LD_ID;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);

    return () => {
      document.getElementById(JSON_LD_ID)?.remove();
    };
  }, [terreiro]);
}
