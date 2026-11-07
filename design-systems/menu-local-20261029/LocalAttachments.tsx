import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
export function LocalImage({ source, alt }: { source: string | File; alt: string }) {
  const [url, setUrl] = useState(typeof source === 'string' ? source : '');
  useEffect(() => { if (typeof source === 'string') { setUrl(source); return; } const next = URL.createObjectURL(source); setUrl(next); return () => URL.revokeObjectURL(next); }, [source]);
  return url ? <img src={url} alt={alt} loading="lazy" /> : null;
}
export function LocalPdfLink({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return url ? <a className="wf-button secondary" href={url} target="_blank" rel="noreferrer"><FileText size={16} />Abrir {file.name}</a> : null;
}
export function LocalFileField({ kind, file, onChange, onBusy }: { kind: 'image' | 'pdf'; file?: File | null; onChange: (file: File | null) => void; onBusy?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), token = useRef(0), latest = useRef({ onChange, onBusy }); latest.current = { onChange, onBusy };
  useEffect(() => () => { token.current++; latest.current.onBusy?.(false); }, []);
  const read = async (value?: File) => {
    if (!value) return;
    const sequence = ++token.current; setError(''); setBusy(true); latest.current.onBusy?.(true);
    try {
      if (kind === 'image') {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type) || value.size > 8 * 1024 * 1024) throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 8 MB.');
        let width=0,height=0;try{if(typeof createImageBitmap!=='function')throw Error('decoder unavailable');const bitmap=await createImageBitmap(value);width=bitmap.width;height=bitmap.height;bitmap.close();}catch{const url=URL.createObjectURL(value);try{const dimensions=await new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(Error('Não foi possível abrir esta imagem. Escolha outro arquivo JPG, PNG ou WebP.'));image.src=url;});width=dimensions.width;height=dimensions.height;}finally{URL.revokeObjectURL(url);}}const valid=width>=64&&height>=64&&width*height<=24000000;
        if (!valid) throw new Error('A imagem precisa ter pelo menos 64 × 64 pixels e no máximo 24 megapixels.');
      } else {
        if (!value.name.toLowerCase().endsWith('.pdf') || value.size > 20 * 1024 * 1024 || value.size < 5) throw new Error('Escolha um PDF de até 20 MB.');
        const header = new TextDecoder().decode(await value.slice(0, 5).arrayBuffer());
        if (header !== '%PDF-') throw new Error('Este arquivo não foi reconhecido como PDF. Selecione outro.');
      }
      if (sequence === token.current) latest.current.onChange(value);
    } catch (reason) { if (sequence === token.current) setError(reason instanceof Error ? reason.message : 'Não foi possível ler o arquivo. Escolha outro.'); }
    finally { if (sequence === token.current) { setBusy(false); latest.current.onBusy?.(false); } }
  };
  return <div className="local-file-field" aria-busy={busy}><label className="wf-field">{kind === 'pdf' ? 'Documento PDF (opcional)' : 'Foto do produto'}<input type="file" disabled={busy} accept={kind === 'pdf' ? 'application/pdf,.pdf' : 'image/jpeg,image/png,image/webp'} onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} /><small>{busy ? 'Lendo e verificando arquivo…' : file ? file.name : kind === 'pdf' ? 'PDF · até 20 MB' : 'JPG, PNG ou WebP · até 8 MB'}</small></label>{file && <button type="button" className="wf-button secondary" disabled={busy} onClick={() => { token.current++; onChange(null); }}>Remover arquivo</button>}{error && <p className="wf-error" role="alert">{error}</p>}</div>;
}
