with open('api/lib/diretorioPublicRoutes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """        const ownerId = String((data as Record<string, unknown>).claimed_by_tenant_id || "").trim();
        if (ownerId) {
          const { data: ownerProfile, error: ownerProfileError } = await sb
            .from("perfil_lider")
            .select("tradicao, descricao_publica")
            .eq("id", ownerId)
            .is("deleted_at", null)
            .maybeSingle();
          if (ownerProfileError) {
            console.warn("[public/diretorio/terreiro] perfil vinculado:", ownerProfileError.message);
          } else if (ownerProfile) {
            if (!tradicao && ownerProfile.tradicao) {
              tradicao = String(ownerProfile.tradicao);
            }
            if (!publicItem.descricao && ownerProfile.descricao_publica) {
              publicItem.descricao = String(ownerProfile.descricao_publica).trim();
            }
          }
        }"""

new_block = """        const ownerId = String((data as Record<string, unknown>).claimed_by_tenant_id || "").trim();
        if (ownerId) {
          const { data: ownerProfile, error: ownerProfileError } = await sb
            .from("perfil_lider")
            .select("tradicao, descricao_publica, whatsapp, whatsapp_publico")
            .eq("id", ownerId)
            .is("deleted_at", null)
            .maybeSingle();
          if (ownerProfileError) {
            console.warn("[public/diretorio/terreiro] perfil vinculado:", ownerProfileError.message);
          } else if (ownerProfile) {
            if (!tradicao && ownerProfile.tradicao) {
              tradicao = String(ownerProfile.tradicao);
            }
            if (!publicItem.descricao && ownerProfile.descricao_publica) {
              publicItem.descricao = String(ownerProfile.descricao_publica).trim();
            }
            const leaderWa = ownerProfile.whatsapp_publico || ownerProfile.whatsapp;
            if (leaderWa && !publicItem.whatsapp) {
              const normalized = resolveDiretorioWhatsapp(leaderWa, null);
              if (normalized) {
                publicItem.whatsapp = normalized;
                publicItem.hasWhatsapp = true;
              }
            }
            if (leaderWa && !publicItem.telefone) {
              publicItem.telefone = String(leaderWa);
            }
          }
        }"""

content_norm = content.replace('\r\n', '\n')
old_norm = old_block.replace('\r\n', '\n')
new_norm = new_block.replace('\r\n', '\n')

if old_norm in content_norm:
    content_norm = content_norm.replace(old_norm, new_norm)
    with open('api/lib/diretorioPublicRoutes.ts', 'w', encoding='utf-8') as f:
        f.write(content_norm)
    print('diretorioPublicRoutes.ts atualizado com sucesso!')
else:
    print('Bloco não encontrado.')
