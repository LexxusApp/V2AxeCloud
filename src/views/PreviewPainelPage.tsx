import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { DemoToastBar, type DemoToast } from '../components/landing/demo/demoUi';
import { PainelPreviewShell, type PainelPreviewTab } from '../components/preview/PainelPreviewShell';

const PainelPreviewDashboard = lazy(() => import('../components/preview/PainelPreviewDashboard'));
const DemoFilhosPanel = lazy(() =>
  import('../components/landing/demo/DemoFilhosPanel').then((m) => ({ default: m.DemoFilhosPanel })),
);
const DemoFinanceiroPanel = lazy(() =>
  import('../components/landing/demo/DemoFinanceiroPanel').then((m) => ({ default: m.DemoFinanceiroPanel })),
);
const DemoGirasPanel = lazy(() =>
  import('../components/landing/demo/DemoGirasPanel').then((m) => ({ default: m.DemoGirasPanel })),
);
const DemoMuralPanel = lazy(() =>
  import('../components/landing/demo/DemoMuralPanel').then((m) => ({ default: m.DemoMuralPanel })),
);
const DemoRezaPanel = lazy(() =>
  import('../components/landing/demo/DemoRezaPanel').then((m) => ({ default: m.DemoRezaPanel })),
);

function TabFallback() {
  return (
    <div className="flex min-h-[16rem] items-center justify-center text-[#1b1813]/45">
      <Loader2 className="h-6 w-6 animate-spin text-[#FFC107]" aria-hidden />
      <span className="sr-only">Carregando módulo…</span>
    </div>
  );
}

export default function PreviewPainelPage() {
  const [activeTab, setActiveTab] = useState<PainelPreviewTab>('dashboard');
  const [toast, setToast] = useState<DemoToast>(null);

  const notify = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <>
      <PainelPreviewShell activeTab={activeTab} onTabChange={setActiveTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            role="tabpanel"
          >
            <Suspense fallback={<TabFallback />}>
              {activeTab === 'dashboard' ? <PainelPreviewDashboard /> : null}
              {activeTab === 'filhos' ? <DemoFilhosPanel onNotify={notify} /> : null}
              {activeTab === 'financeiro' ? <DemoFinanceiroPanel onNotify={notify} /> : null}
              {activeTab === 'giras' ? <DemoGirasPanel onNotify={notify} /> : null}
              {activeTab === 'mural' ? <DemoMuralPanel onNotify={notify} /> : null}
              {activeTab === 'reza' ? <DemoRezaPanel notify={notify} /> : null}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </PainelPreviewShell>
      <DemoToastBar toast={toast} />
    </>
  );
}
