import { useEffect, useState, type ChangeEvent } from 'react';
import { Camera, FileText, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { confirmAction } from '../../lib/confirmAction';

type Publicacao = {
  id: string; titulo: string; conteudo: string; imagem_url: string | null;
  status: 'rascunho' | 'publicado'; publicado_em: string; created_at: string; updated_at: string;
};
type Draft = { titulo: string; conteudo: string; imagemUrl: string | null; status: 'rascunho' | 'publicado' };
const EMPTY: Draft = { titulo: '', conteudo: '', imagemUrl: null, status: 'publicado' };
const labelClass = 'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const inputClass = 'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

async function uploadPublicationImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result || '').split(',')[1]; value ? resolve(value) : reject(new Error('Erro ao ler imagem.')); };
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'));
    reader.readAsDataURL(file);
  });
  const response = await authFetch('/api/v1/settings/directory-profile/upload-photo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileData, fileName: file.name, contentType: file.type, kind: 'publication' }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.publicUrl) throw new Error(json.error || 'Erro ao enviar imagem.');
  return String(json.publicUrl);
}

export function TerreiroPublicacoesSettings() {
  const [claimed, setClaimed] = useState(false);
  const [items, setItems] = useState<Publicacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void authFetch('/api/v1/settings/directory-publicacoes').then(async (response) => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar publicações.');
      setClaimed(Boolean(json.claimed)); setItems(json.publicacoes || []);
    }).catch((error: unknown) => setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar.' }))
      .finally(() => setLoading(false));
  }, []);

  function beginEdit(item?: Publicacao) {
    setEditingId(item?.id || null);
    setDraft(item ? { titulo: item.titulo, conteudo: item.conteudo, imagemUrl: item.imagem_url, status: item.status } : { ...EMPTY });
    setMessage(null);
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !draft) return;
    setUploading(true); setMessage(null);
    try { setDraft({ ...draft, imagemUrl: await uploadPublicationImage(file) }); }
    catch (error: unknown) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao enviar imagem.' }); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!draft) return;
    if (draft.titulo.trim().length < 3 || draft.conteudo.trim().length < 3) {
      setMessage({ kind: 'error', text: 'Preencha título e conteúdo da publicação.' }); return;
    }
    setBusy(true); setMessage(null);
    try {
      const response = await authFetch(editingId ? `/api/v1/settings/directory-publicacoes/${editingId}` : '/api/v1/settings/directory-publicacoes', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar publicação.');
      const saved = json.publicacao as Publicacao;
      setItems((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
      setDraft(null); setEditingId(null); setMessage({ kind: 'success', text: saved.status === 'publicado' ? 'Publicação visível no perfil público.' : 'Rascunho salvo.' });
    } catch (error: unknown) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao salvar.' }); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!(await confirmAction({ title: 'Excluir publicação?', description: 'Ela deixará de aparecer no perfil público e não poderá ser recuperada.', confirmLabel: 'Excluir publicação', tone: 'danger' }))) return;
    setBusy(true); setMessage(null);
    try {
      const response = await authFetch(`/api/v1/settings/directory-publicacoes/${id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Erro ao excluir.');
      setItems((current) => current.filter((item) => item.id !== id)); setMessage({ kind: 'success', text: 'Publicação excluída.' });
    } catch (error: unknown) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Erro ao excluir.' }); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="app-v5-panel grid min-h-40 place-items-center rounded-2xl"><Loader2 className="h-6 w-6 animate-spin text-[#526A55]" /></div>;
  if (!claimed) return null;

  return <section className="app-v5-panel overflow-hidden rounded-2xl">
    <div className="flex flex-col gap-4 border-b border-[#DED6C8] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B08A22]">Publicações</p><h3 className="mt-1 font-display text-xl font-black text-[#211D17]">Novidades da casa</h3><p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#70695F]">Publique avisos, festas, projetos e registros autorizados diretamente no perfil público.</p></div>
      {!draft ? <button type="button" disabled={items.length >= 30} onClick={() => beginEdit()} className="app-v5-primary-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50"><Plus className="h-4 w-4" />Nova publicação</button> : null}
    </div>
    <div className="space-y-5 p-5 sm:p-6">
      {draft ? <div className="rounded-2xl border border-[#D8D2C4] bg-[#FFFDF8] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelClass}>Título</label><input maxLength={140} value={draft.titulo} onChange={(event) => setDraft({ ...draft, titulo: event.target.value })} className={inputClass} placeholder="Ex: Festa de Erê neste domingo" /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Conteúdo</label><textarea rows={5} maxLength={3000} value={draft.conteudo} onChange={(event) => setDraft({ ...draft, conteudo: event.target.value })} className={`${inputClass} resize-y`} placeholder="Conte a novidade com todas as informações importantes."/><p className="mt-1 text-right text-[10px] font-semibold text-[#8A8174]">{draft.conteudo.length}/3000</p></div>
          <div><label className={labelClass}>Estado</label><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })} className={inputClass}><option value="publicado">Publicar no perfil</option><option value="rascunho">Salvar como rascunho</option></select></div>
          <div className="flex items-end"><label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#C6AF78] bg-[#F8F1DF] px-4 text-xs font-black text-[#8A6200]">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{draft.imagemUrl ? 'Trocar imagem' : 'Adicionar imagem'}<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void handleImage(event)} /></label></div>
        </div>
        {draft.imagemUrl ? <div className="relative mt-4 max-w-xl overflow-hidden rounded-xl border border-[#D8D2C4]"><img src={draft.imagemUrl} alt="Prévia da publicação" className="max-h-72 w-full object-cover"/><button type="button" onClick={() => setDraft({ ...draft, imagemUrl: null })} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white"><Trash2 className="h-4 w-4" /></button></div> : null}
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy || uploading} onClick={() => void save()} className="app-v5-primary-button inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-black">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{editingId ? 'Salvar alterações' : draft.status === 'publicado' ? 'Publicar agora' : 'Salvar rascunho'}</button><button type="button" disabled={busy} onClick={() => { setDraft(null); setEditingId(null); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D8D2C4] bg-white px-4 text-sm font-black text-[#70695F]"><X className="h-4 w-4" />Cancelar</button></div>
      </div> : null}

      {message ? <p role="status" className={`rounded-xl border px-4 py-3 text-xs font-bold ${message.kind === 'success' ? 'border-[#526A55]/25 bg-[#E7EFE6] text-[#3F5A42]' : 'border-[#B96545]/30 bg-[#B96545]/10 text-[#B96545]'}`}>{message.text}</p> : null}
      {items.length ? <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#DED6C8] bg-white">{item.imagem_url ? <img src={item.imagem_url} alt="" className="h-40 w-full object-cover"/> : null}<div className="p-4"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.status === 'publicado' ? 'bg-[#E7EFE6] text-[#3F5A42]' : 'bg-[#EEE7DC] text-[#70695F]'}`}>{item.status === 'publicado' ? 'Publicado' : 'Rascunho'}</span><h4 className="mt-2 font-black text-[#211D17]">{item.titulo}</h4></div><div className="flex gap-1"><button type="button" aria-label="Editar publicação" onClick={() => beginEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#DED6C8] bg-[#F7F1E7] text-[#526A55]"><Pencil className="h-4 w-4" /></button><button type="button" aria-label="Excluir publicação" onClick={() => void remove(item.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#B96545]/25 bg-[#B96545]/10 text-[#B96545]"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-3 line-clamp-3 whitespace-pre-line text-xs font-semibold leading-relaxed text-[#70695F]">{item.conteudo}</p></div></article>)}</div> : !draft ? <div className="rounded-xl border border-dashed border-[#D8D2C4] bg-[#FFFDF8] px-6 py-9 text-center"><FileText className="mx-auto h-7 w-7 text-[#C6AF78]"/><p className="mt-3 text-sm font-black text-[#211D17]">Nenhuma publicação criada</p><p className="mt-1 text-xs font-semibold text-[#70695F]">A biografia continuará na seção Sobre; novidades aparecerão aqui.</p></div> : null}
    </div>
  </section>;
}
