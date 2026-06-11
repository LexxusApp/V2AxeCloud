import { MarketingSubpageTopNav } from '../components/marketing/MarketingTopNav';
import { EspacoFielV3Portal } from '../components/espaco-fiel/EspacoFielV3Portal';

export default function EspacoDoFielPage() {
  return (
    <div className="landing-v3 relative min-h-screen overflow-x-hidden bg-[#080A0D] font-sans text-[#F1F5F9] antialiased selection:bg-[#1E293B] selection:text-[#FFFFFF]">
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 -z-10 h-[650px] bg-gradient-to-b from-[#0D0F12] to-[#080A0D]"
        aria-hidden
      />

      <MarketingSubpageTopNav active="fiel" />
      <EspacoFielV3Portal />
    </div>
  );
}
