import {useEffect,useState} from 'react';
import {authFetch} from '../../src/lib/authenticatedFetch';
import {resolveChatMediaAccess} from '../../src/lib/chatMediaUrl';
import type {LocalMessage} from './messages';

export default function ChatAttachment({media}:{media:NonNullable<LocalMessage['media']>}){
  const [src,setSrc]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true,objectUrl='';const controller=new AbortController();
    setSrc('');setError('');
    const access=resolveChatMediaAccess(media.url);
    void (async()=>{try{
      if(access.fetchUrl){
        const response=await authFetch(access.fetchUrl,{signal:controller.signal});
        if(!response.ok)throw Error('Não foi possível carregar o anexo.');
        const blob=await response.blob();if(!active)return;
        objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);
      }else if(access.directSrc&&/^(https?:|blob:)/.test(access.directSrc))setSrc(access.directSrc);
      else throw Error('Endereço do anexo inválido.');
    }catch(reason){if(active)setError(reason instanceof Error?reason.message:'Anexo indisponível.');}})();
    return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[media.url,retry]);
  return <div className="ms-attachment">{error?<p role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></p>:!src?<p role="status">Carregando anexo…</p>:<>
    {media.type==='image'?<div className="ms-image-slot"><img src={src} alt="Imagem da conversa" onError={()=>setError('Não foi possível abrir a imagem.')}/></div>:media.type==='audio'?<audio src={src} controls preload="metadata" aria-label="Áudio da conversa"/>:media.type==='video'?<video src={src} controls playsInline preload="metadata" aria-label="Vídeo da conversa" style={{maxWidth:'100%'}}/>:null}
    <a href={src} target="_blank" rel="noopener noreferrer">Abrir anexo</a>
  </>}</div>;
}
