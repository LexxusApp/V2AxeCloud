import type { Session } from '@supabase/supabase-js';
import LegalTermsModal from '../LegalTermsModal';
import { ChatFloatingWidget } from '../chat/ChatFloatingWidget';
import { FilhoCoachTour } from '../filho/FilhoCoachTour';

type AppRuntimeOverlaysProps = {
  showLegalTermsModal: boolean;
  onAcceptLegalTerms: () => void | Promise<void>;
  legalTermsAccepting: boolean;
  userRole?: string | null;
  session: Session | null;
  activeTab: string;
  onNavigate: (tab: string) => void;
  effectiveTenantId?: string | null;
  blockingSpinnerActive: boolean;
  tenantData: any;
};

export function AppRuntimeOverlays({ showLegalTermsModal, onAcceptLegalTerms, legalTermsAccepting, userRole, session, activeTab, onNavigate, effectiveTenantId, blockingSpinnerActive, tenantData }: AppRuntimeOverlaysProps) {
  return (
    <>
      {showLegalTermsModal ? <LegalTermsModal open onAccept={onAcceptLegalTerms} accepting={legalTermsAccepting} /> : null}
      {userRole === 'filho' && session && !showLegalTermsModal ? <FilhoCoachTour activeTab={activeTab} onNavigate={onNavigate} /> : null}
      {session && effectiveTenantId && !blockingSpinnerActive ? <ChatFloatingWidget tenantData={tenantData} userId={session.user.id} userRole={userRole} /> : null}
    </>
  );
}
