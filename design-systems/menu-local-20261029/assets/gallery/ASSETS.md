# Imagens da Galeria — procedência e prompts

Criadas em 30/10/2026 para a prévia local. Modo utilizado: ferramenta de geração de imagens integrada (`image_gen.imagegen`), três gerações independentes. Sem chaves de API, downloads externos ou fotos privadas. São ilustrações fotográficas geradas por IA, não registros reais de um terreiro.

Originais selecionados preservados nesta pasta como `atabaque-v1.png`, `flores-v1.png` e `patio-v1.png`. A geração não recebeu imagens de referência. As imagens foram visualmente inspecionadas. Não há pessoas, texto, marcas, prescrições rituais ou símbolos divinos inventados.

`prepare-gallery-assets.mjs` codifica os mesmos pixels em WebP sem perdas com sharp, sem redimensionar, recortar ou editar. Arquivos usados pela página: `atabaque-v1.webp` (1.652.422 bytes), `flores-v1.webp` (1.693.008 bytes) e `patio-v1.webp` (2.167.126 bytes). O recorte das miniaturas é apenas de apresentação por CSS; no visualizador a imagem aparece inteira. Os tamanhos são adequados à avaliação local, sem alegação de otimização final para produção.

## Prompts enviados

### atabaque

Use case: photorealistic-natural. Asset: an illustrative photograph for a LOCAL AxéCloud gallery prototype, not a factual photograph of a real religious house. One single landscape 3:2 editorial photograph. Quiet preparation corner of a modest Brazilian Afro-Brazilian cultural community house, one well-crafted wooden atabaque with natural rope and skin standing beside folded plain white cotton cloth, soft tropical greenery in background. Warm natural afternoon window light, visible wood grain, quiet respectful composition, natural documentary color, no gold glow, no special effects. No people, no faces, no altar, no divinities, no claims about ritual practice. No lettering, no logo, no collage, no UI, no frame. Focus on the instrument and the cloth; not luxurious or commercial. Photo fills image.

### flores

Use case: photorealistic-natural. Asset: an illustrative photograph for a LOCAL AxéCloud gallery prototype, not a factual photograph of any real religious house. One single landscape 3:2 editorial photograph. Close view of fresh white flowers in a simple ceramic vase on a plain wooden table, folded white cotton cloth and muted green leaves softly in background, calm preparation of a welcoming Brazilian community space. Soft diffused side daylight, natural whites and olive greens, visible petals and handmade ceramic texture, understated documentary photography. No people, no altar, no ritual prescriptions, no divine symbols, no glowing particles. No lettering, logo, collage, UI or frame. Photo fills image.

### patio

Use case: photorealistic-natural. Asset: illustrative photography for a LOCAL AxéCloud gallery prototype, not a factual place. One single landscape 3:2 editorial photograph. Empty modest Brazilian community courtyard in warm morning light, whitewashed walls, a simple old wooden bench, terracotta floor, abundant green tropical potted plants, one open wooden doorway. Human and welcoming, believable everyday textures, quiet composition, natural light and color, no luxury interior, no futuristic building, no fantasy. No people, no religious altar or inscriptions, no divine imagery. No lettering, logo, collage, UI, frame or watermark. Photo fills image.

## Resultado

Cópias finais na pasta `assets/gallery/` desta prévia. Sem saída alternativa descartada, edição com referência, mudança de fundo, transparência ou composição posterior. Os originais da ferramenta permanecem também no diretório de imagens geradas do Codex; esta pasta é a cópia estável usada pelo projeto.

## Reutilização no Radar — 31/10/2026

O estúdio público local reutiliza patio-v1.webp como capa ilustrativa e patio-v1.webp/flores-v1.webp como duas fotos públicas de exemplo. Os registros e legendas da galeria do Radar são próprios, independentes dos registros da Galeria interna; apenas os arquivos de ilustração são compartilhados. Não são fotografias da casa do usuário. O Radar identifica os exemplos como IA e permite substituí-los por imagens escolhidas pelo zelador.

O scanner de procedência desta etapa encontrou metadados ausentes nos seis arquivos existentes. Os prompts exatos preservados acima foram incorporados aos três PNGs e a sidecars dos três WebPs, sem regeneração ou alteração dos pixels. A nova leitura registrou seis rasters e zero metadados ausentes. Arquivos usados nos testes de upload também vieram das ilustrações locais próprias, sem fotografias particulares.

