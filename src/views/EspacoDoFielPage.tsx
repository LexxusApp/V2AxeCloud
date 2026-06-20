import { MarketingSubpageTopNav } from '../components/marketing/MarketingTopNav';
import { EspacoFielV3Portal } from '../components/espaco-fiel/EspacoFielV3Portal';

export default function EspacoDoFielPage() {
  return (
    <div className="landing-v3 relative min-h-screen overflow-x-hidden font-sans antialiased">
      <div
        className="pointer-events-none absolute -right-24 top-0 -z-10 h-[420px] w-[420px] rounded-full bg-amber-300/15 blur-3xl"
        aria-hidden
      />

      <MarketingSubpageTopNav active="fiel" />
      <EspacoFielV3Portal />
    </div>
  );
}
