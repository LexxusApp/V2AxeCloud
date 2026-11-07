import {useState} from 'react';
import {accountInitials} from './shellSummary';
function SavedPhoto({src,name}:{src:string;name:string}){
 const [failed,setFailed]=useState(false);
 return failed?<>{accountInitials(name)}</>:<img src={src} alt="" decoding="async" onError={()=>setFailed(true)}/>;
}
export default function AccountAvatar({src,name}:{src?:string;name:string}){
 const photo=src?.trim();
 return <span className="avatar sage small account-avatar" aria-hidden="true">{photo?<SavedPhoto key={photo} src={photo} name={name}/>:accountInitials(name)}</span>;
}
