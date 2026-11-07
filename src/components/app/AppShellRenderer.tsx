import {
  lazy,
  Suspense,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import AppFooter from "../AppFooter";
import AppTopNav from "./AppTopNav";
import { AppContextPrompts } from "./AppContextPrompts";
import { AppRuntimeOverlays } from "./AppRuntimeOverlays";
import { HouseToastHost } from "./HouseToastHost";
import { isBerryDashboardBeta } from "../../lib/featureFlags";
import { modernInterfaceEnabled } from "../../lib/modernInterface";
import { performFastLogout } from "../../lib/logout";
import type { AppTenantData } from "./AppViewRouter";

const ModernAppShell = lazy(() => import("./ModernAppShell"));
const BerryAppShell = lazy(() => import("../dashboard-berry/BerryAppShell"));
const DashboardBerry = lazy(() => import("../dashboard-berry/DashboardBerry"));

type Props = {
  activeTab: string;
  blockingSpinnerActive: boolean;
  filhoFotoUrl: string | null;
  isAdminGlobal: boolean;
  legalTermsAccepting: boolean;
  navigateToTab: (tab: string) => void;
  onAcceptLegalTerms: () => void | Promise<void>;
  permission: NotificationPermission;
  pushLoading: boolean;
  selectedChildId: string | null;
  session: Session;
  setFilhoFotoUrl: Dispatch<SetStateAction<string | null>>;
  showLegalTermsModal: boolean;
  subscribe: () => void | Promise<void>;
  tenantData: AppTenantData | null;
  userRole: "admin" | "filho" | null;
  view: ReactNode;
};

export default function AppShellRenderer(props: Props) {
  const {
    activeTab,
    blockingSpinnerActive,
    filhoFotoUrl,
    isAdminGlobal,
    legalTermsAccepting,
    navigateToTab,
    onAcceptLegalTerms,
    permission,
    pushLoading,
    selectedChildId,
    session,
    setFilhoFotoUrl,
    showLegalTermsModal,
    subscribe,
    tenantData,
    userRole,
    view,
  } = props;
  const useModernInterface = modernInterfaceEnabled({
    development: import.meta.env.DEV,
    released: import.meta.env.VITE_MODERN_DASHBOARD,
    search: typeof window === "undefined" ? "" : window.location.search,
  });
  const effectiveTenantId = String(tenantData?.tenant_id || "").trim() || null;
  const prompts = (
    <AppContextPrompts
      userRole={userRole}
      session={session}
      permission={permission}
      pushLoading={pushLoading}
      onSubscribe={() => void subscribe()}
      activeTab={activeTab}
      tenantData={tenantData}
      onNavigate={navigateToTab}
    />
  );
  const overlays = (
    <AppRuntimeOverlays
      showLegalTermsModal={showLegalTermsModal}
      onAcceptLegalTerms={onAcceptLegalTerms}
      legalTermsAccepting={legalTermsAccepting}
      userRole={userRole}
      session={session}
      activeTab={activeTab}
      onNavigate={navigateToTab}
      effectiveTenantId={effectiveTenantId}
      blockingSpinnerActive={blockingSpinnerActive}
      tenantData={tenantData}
    />
  );
  const keyedView = (
    <div
      key={`${activeTab}:${selectedChildId || ""}`}
      className="app-view-transition"
    >
      {view}
    </div>
  );

  if (useModernInterface) {
    return (
      <>
        <HouseToastHost />
        <Suspense
          fallback={
            <div className="flex min-h-dvh items-center justify-center bg-[#f4f6f3]">
              <Loader2
                className="h-8 w-8 animate-spin text-[#204135]"
                aria-label="Abrindo sua casa"
              />
            </div>
          }
        >
          <ModernAppShell
            activeTab={activeTab}
            setActiveTab={navigateToTab}
            userRole={userRole || "admin"}
            isAdmin={isAdminGlobal}
            tenantData={tenantData}
            userDisplayName={session.user.user_metadata?.nome}
            userId={session.user.id}
            userEmail={session.user.email}
            filhoFotoUrl={filhoFotoUrl}
            onFilhoFotoUpdated={setFilhoFotoUrl}
          >
            {prompts}
            <Suspense
              fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                  <Loader2
                    className="h-8 w-8 animate-spin text-[#204135]"
                    aria-label="Carregando página"
                  />
                </div>
              }
            >
              {keyedView}
            </Suspense>
            <AppFooter />
          </ModernAppShell>
        </Suspense>
        {overlays}
      </>
    );
  }

  if (isBerryDashboardBeta(session.user.email, effectiveTenantId)) {
    return (
      <>
        <HouseToastHost />
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-[#0f1411]">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          }
        >
          <BerryAppShell
            activeTab={activeTab}
            setActiveTab={navigateToTab}
            userRole={userRole || "Zelador"}
            isAdmin={isAdminGlobal}
            terreiroNome={
              tenantData?.nome_terreiro || tenantData?.nome || "Sua casa"
            }
            zeladorNome={
              tenantData?.zelador || tenantData?.cargo || "Zeladoria"
            }
            userEmail={session.user.email}
            tenantId={effectiveTenantId}
            fotoUrl={
              userRole === "filho"
                ? filhoFotoUrl
                : tenantData?.foto_url || undefined
            }
            expiresAt={tenantData?.expires_at}
            planName={tenantData?.plan}
            onLogout={() => performFastLogout()}
          >
            <Suspense
              fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              }
            >
              {activeTab === "dashboard" ? (
                <DashboardBerry
                  onNavigate={navigateToTab}
                  terreiroNome={
                    tenantData?.nome_terreiro || tenantData?.nome || "Sua casa"
                  }
                  zeladorNome={
                    tenantData?.zelador || tenantData?.cargo || "Zeladoria"
                  }
                  tenantId={effectiveTenantId}
                  userId={session.user.id}
                  userRole={userRole || "admin"}
                />
              ) : (
                <div
                  key={`${activeTab}:${selectedChildId || ""}`}
                  className="app-v3 app-v4-experiment app-v5-identity app-v5-canvas flex-1 min-h-full w-full bg-[#F7F3EA] text-[#211D17]"
                >
                  <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
                    {view}
                  </div>
                </div>
              )}
            </Suspense>
          </BerryAppShell>
        </Suspense>
        {overlays}
      </>
    );
  }

  return (
    <>
      <HouseToastHost />
      <div className="app-v3 app-v4-experiment app-v5-identity flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F7F3EA] text-[#211D17] font-sans selection:bg-primary selection:text-[#080A0D]">
        <AppTopNav
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          userRole={userRole}
          isAdmin={isAdminGlobal}
          tenantData={tenantData}
          userDisplayName={session.user.user_metadata?.nome}
          userId={session.user.id}
          userEmail={session.user.email}
          filhoFotoUrl={filhoFotoUrl}
          onFilhoFotoUpdated={setFilhoFotoUrl}
        />
        <div className="app-v3-scroll app-v5-canvas relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F7F3EA] pb-[env(safe-area-inset-bottom,0px)] min-[880px]:pl-[var(--app-sidebar-width,15rem)]">
          <main
            className="app-page-shell flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden"
            data-role={userRole ?? undefined}
            data-tab={activeTab}
          >
            {prompts}
            <div className="flex-1">
              <Suspense
                fallback={
                  <div className="flex min-h-[60vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                }
              >
                {keyedView}
              </Suspense>
            </div>
            <AppFooter />
          </main>
        </div>
      </div>
      {overlays}
    </>
  );
}
