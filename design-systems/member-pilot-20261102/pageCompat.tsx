import type {ReactNode} from 'react';
import {Loading} from './ui';
export function AppPageShell({children,className=''}:{children:ReactNode;className?:string;fullWidth?:boolean}){return <div className={`mp-page ${className}`}>{children}</div>;}
export function AppPanelLoading(){return <Loading/>;}
