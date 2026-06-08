import { isHomePath } from '../lib/routes';
import Loading from './loading';

/** Na home o HTML estático já preenche a tela — evita spinner em tela cheia. */
export function RouteLoadingFallback({ path }: { path: string }) {
  if (isHomePath(path)) return null;
  return <Loading />;
}
