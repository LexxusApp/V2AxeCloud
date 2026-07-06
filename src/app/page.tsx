/**
 * Metadata de produção da home (equivalente ao export metadata do Next.js App Router).
 * Roteamento real: src/router/AppRouter.tsx + src/views/Landing.tsx
 */
import { HOME_SEO } from '../constants/seoHome';

export const metadata = {
  title: HOME_SEO.title,
  description: HOME_SEO.description,
} as const;
