import { CircleAlert } from 'lucide-react';
import PageLoading from '../shared/PageLoading';
export type HouseMode = 'ready' | 'empty' | 'loading' | 'error';
export function HouseState({ mode, onReset }: { mode: HouseMode; onReset: () => void }) {
  if(mode==='loading')return <PageLoading/>;
  return <section className="hs-state" role="alert"><CircleAlert size={28}/><h2>Não foi possível carregar esta área.</h2><p>Tente novamente para consultar as informações.</p><button className="wf-button secondary" onClick={onReset}>Tentar novamente</button></section>;
}
export function HouseStateTools(_props: { mode: HouseMode; onChange: (mode: HouseMode) => void }) { return null; }
