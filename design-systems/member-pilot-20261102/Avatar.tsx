import {useEffect,useState} from 'react';
export function Avatar({src,name,alt,className='',shape='circle'}:{src?:string|null;name?:string|null;alt?:string;className?:string;shape?:'circle'|'rounded'|'square';textSize?:string}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
 const initials=String(name||'M').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part.charAt(0).toLocaleUpperCase('pt-BR')).join('');
 const photo=!failed&&typeof src==='string'&&/^(https?:|data:|blob:|\/)/i.test(src);
 return <span className={`mp-avatar-photo ${shape} ${className}`} aria-label={alt||name||'Foto do membro'}>{photo?<img src={src} alt={alt||name||'Foto do membro'} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span aria-hidden>{initials}</span>}</span>;
}
export default Avatar;
