import type { Session } from '@supabase/supabase-js';
import { FilhoPushPrompt } from '../filho/FilhoPushPrompt';
import { ContextualActionBar } from './ContextualActionBar';
import { SubscriptionDueNotice } from './SubscriptionDueNotice';

type AppContextPromptsProps = {
  userRole?: string | null;
  session: Session | null;
  permission: NotificationPermission | null;
  pushLoading: boolean;
  onSubscribe: () => void;
  activeTab: string;
  tenantData: any;
  onNavigate: (tab: string) => void;
};

export function AppContextPrompts({ userRole, session, permission, pushLoading, onSubscribe, activeTab, tenantData, onNavigate }: AppContextPromptsProps) {
  return (
    <>
      {userRole === 'filho' && session ? (
        <div className="flex w-full justify-center px-4 pt-3 sm:px-6 lg:px-8">
          <FilhoPushPrompt permission={permission} loading={pushLoading} onSubscribe={onSubscribe} />
        </div>
      ) : null}
      {userRole !== 'filho' && activeTab !== 'subscription' ? (
        <SubscriptionDueNotice tenantData={tenantData} onOpen={() => onNavigate('subscription')} />
      ) : null}
      <ContextualActionBar activeTab={activeTab} userRole={userRole} onNavigate={onNavigate} />
    </>
  );
}
