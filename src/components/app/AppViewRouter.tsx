import { lazy, type Dispatch, type SetStateAction } from "react";
import { ShieldAlert } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Paywall from "../Paywall";
import { hasPlanAccess } from "../../constants/plans";
import {
  financialSubviewFromTab,
  isFinancialNavTab,
} from "../../constants/appNav";

const Dashboard = lazy(() => import("../../views/Dashboard"));
const Children = lazy(() => import("../../views/Children"));
const Calendar = lazy(() => import("../../views/Calendar"));
const Financial = lazy(() => import("../../views/Financial"));
const Inventory = lazy(() => import("../../views/Inventory"));
const Gallery = lazy(() => import("../../views/Gallery"));
const NoticeBoard = lazy(() => import("../../views/NoticeBoard"));
const Settings = lazy(() => import("../../views/Settings"));
const Radar = lazy(() => import("../../views/Radar"));
const ChildProfile = lazy(() => import("../../views/ChildProfile"));
const PerfilFilho = lazy(() => import("../../views/PerfilFilho"));
const ObrigacoesFilho = lazy(() => import("../../views/ObrigacoesFilho"));
const Obligations = lazy(() => import("../../views/Obligations"));
const Library = lazy(() => import("../../views/Library"));
const MensalidadeFilho = lazy(() => import("../../views/MensalidadeFilho"));
const Store = lazy(() => import("../../views/Store"));
const MinhaAssinatura = lazy(() => import("../../views/MinhaAssinatura"));
const Frequencia = lazy(() => import("../../views/Frequencia"));
const ChatInbox = lazy(() => import("../../views/ChatInbox"));
const Support = lazy(() => import("../../views/Support"));
const AdvancedManagement = lazy(() => import("../../views/AdvancedManagement"));
import type { AdvancedSection } from "../../views/AdvancedManagement";

export type AppTenantData = {
  nome: string;
  plan: string;
  tenant_id?: string;
  expires_at?: string;
  status?: string;
  is_trial?: boolean;
  billing_cycle?: string;
  foto_url?: string;
  cargo?: string | null;
  role?: string | null;
  tradicao?: string | null;
  whatsapp_missing?: boolean;
  nome_terreiro?: string;
  zelador?: string | null;
  is_co_admin?: boolean;
};

type Props = {
  activeTab: string;
  isAdminGlobal: boolean;
  isSessionReady: boolean;
  navigateToTab: (tab: string) => void;
  refreshAllData: () => void | Promise<void>;
  selectedChildId: string | null;
  session: Session;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  systemVersion: string;
  tenantData: AppTenantData | null;
  userRole: "admin" | "filho" | null;
};

export default function AppViewRouter({
  activeTab,
  isAdminGlobal,
  isSessionReady,
  navigateToTab,
  refreshAllData,
  selectedChildId,
  session,
  setSelectedChildId,
  systemVersion,
  tenantData,
  userRole,
}: Props) {
  const filhoTenantData = tenantData
    ? { ...tenantData, is_admin_global: true }
    : null;

  if (userRole === "filho") {
    switch (activeTab) {
      case "profile":
      case "perfil":
        return (
          <PerfilFilho
            user={session.user}
            tenantData={filhoTenantData}
            setActiveTab={navigateToTab}
          />
        );
      case "obrigacoes":
        return (
          <ObrigacoesFilho
            user={session.user}
            tenantData={filhoTenantData}
            setActiveTab={navigateToTab}
          />
        );
      case "financial":
      case "financial-mensalidades":
      case "financial-cantina":
      case "financial-configs":
        return (
          <MensalidadeFilho
            user={session.user}
            tenantData={filhoTenantData}
            setActiveTab={navigateToTab}
          />
        );
      case "calendar":
        return (
          <Calendar
            user={session.user}
            tenantData={filhoTenantData}
            setActiveTab={navigateToTab}
            userRole={userRole}
          />
        );
      case "library":
        return (
          <Library
            user={session.user}
            userRole={userRole}
            tenantData={filhoTenantData}
            isAdminGlobal={false}
            setActiveTab={navigateToTab}
          />
        );
      case "store":
        return (
          <Store
            userRole={userRole}
            tenantData={filhoTenantData}
            userId={session.user.id}
            isAdminGlobal={false}
            setActiveTab={navigateToTab}
          />
        );
      case "mural":
        return (
          <NoticeBoard
            isAdmin={false}
            tenantData={filhoTenantData}
            setActiveTab={navigateToTab}
          />
        );
      case "chat":
        return (
          <ChatInbox
            tenantData={filhoTenantData}
            userId={session.user.id}
            userRole={userRole}
            setActiveTab={navigateToTab}
          />
        );
      default:
        return (
          <PerfilFilho
            user={session.user}
            tenantData={filhoTenantData}
            setActiveTab={navigateToTab}
          />
        );
    }
  }

  if (
    [
      "reports",
      "patrimony",
      "documents",
      "consulentes",
      "atendimento-agenda",
      "journey",
      "liturgical",
      "development",
      "camarinha",
    ].includes(activeTab)
  ) {
    return (
      <AdvancedManagement
        section={activeTab as AdvancedSection}
        tenantData={tenantData}
        setActiveTab={navigateToTab}
      />
    );
  }

  const featureAccess = {
    dashboard: true,
    children: true,
    obligations: true,
    calendar: true,
    frequencia: hasPlanAccess(
      tenantData?.plan,
      "gestao_eventos",
      isAdminGlobal,
    ),
    mural: true,
    chat: true,
    settings: true,
    radar: true,
    suporte: true,
    profile: true,
    inventory: hasPlanAccess(tenantData?.plan, "inventory", isAdminGlobal),
    atendimentos: hasPlanAccess(
      tenantData?.plan,
      "atendimentos",
      isAdminGlobal,
    ),
    gallery: hasPlanAccess(tenantData?.plan, "gallery", isAdminGlobal),
    library: hasPlanAccess(tenantData?.plan, "library", isAdminGlobal),
    financial: hasPlanAccess(tenantData?.plan, "financial", isAdminGlobal),
    store: hasPlanAccess(tenantData?.plan, "store", isAdminGlobal),
    subscription: true,
  };
  const featureKey = isFinancialNavTab(activeTab) ? "financial" : activeTab;
  if (!featureAccess[featureKey as keyof typeof featureAccess]) {
    const requiredPlan =
      isFinancialNavTab(activeTab) || activeTab === "store"
        ? "Fundamento"
        : "Orô";
    return (
      <Paywall
        featureName={
          isFinancialNavTab(activeTab)
            ? "Financeiro"
            : activeTab === "store"
              ? "Loja do Axé"
              : activeTab === "gallery"
                ? "Galeria"
                : activeTab === "inventory"
                  ? "Almoxarifado"
                  : "Biblioteca"
        }
        requiredPlan={requiredPlan}
        onUpgrade={() => navigateToTab("subscription")}
      />
    );
  }

  const dashboard = (withTenant = true) => (
    <Dashboard
      setActiveTab={navigateToTab}
      user={session.user}
      userRole={userRole}
      tenantData={withTenant ? tenantData : undefined}
      isAdminGlobal={isAdminGlobal}
      setSelectedChildId={setSelectedChildId}
      systemVersion={systemVersion}
      isSessionReady={isSessionReady}
    />
  );

  switch (activeTab) {
    case "dashboard":
      return dashboard();
    case "children":
      return (
        <Children
          setActiveTab={navigateToTab}
          user={session.user}
          setSelectedChildId={setSelectedChildId}
          tenantData={tenantData}
        />
      );
    case "obligations":
      return (
        <Obligations
          user={session.user}
          tenantData={tenantData}
          setActiveTab={navigateToTab}
          setSelectedChildId={setSelectedChildId}
        />
      );
    case "inventory":
      return (
        <Inventory
          tenantData={tenantData}
          userRole={userRole}
          isAdminGlobal={isAdminGlobal}
          setActiveTab={navigateToTab}
        />
      );
    case "gallery":
      return (
        <Gallery
          tenantData={tenantData}
          userRole={userRole}
          isAdminGlobal={isAdminGlobal}
          setActiveTab={navigateToTab}
        />
      );
    case "calendar":
      return (
        <Calendar
          user={session.user}
          userRole={userRole}
          tenantData={tenantData}
          setActiveTab={navigateToTab}
        />
      );
    case "frequencia":
      return (
        <Frequencia tenantData={tenantData} setActiveTab={navigateToTab} />
      );
    case "mural":
      return (
        <NoticeBoard
          isAdmin
          tenantData={tenantData}
          setActiveTab={navigateToTab}
        />
      );
    case "chat":
      return (
        <ChatInbox
          tenantData={tenantData}
          userId={session.user.id}
          userRole={userRole}
          setActiveTab={navigateToTab}
        />
      );
    case "financial":
    case "financial-mensalidades":
    case "financial-cantina":
    case "financial-configs":
      return (
        <Financial
          userRole={userRole}
          userId={session.user.id}
          tenantData={tenantData}
          isAdminGlobal={isAdminGlobal}
          setActiveTab={navigateToTab}
          isSessionReady={isSessionReady}
          initialView={financialSubviewFromTab(activeTab)}
        />
      );
    case "settings":
      return (
        <Settings
          user={session.user}
          session={session}
          onRefresh={refreshAllData}
          tenantData={tenantData}
          setActiveTab={navigateToTab}
        />
      );
    case "radar":
      return <Radar />;
    case "suporte":
      return (
        <Support
          user={session.user}
          tenantData={tenantData}
          setActiveTab={navigateToTab}
        />
      );
    case "library":
      return (
        <Library
          user={session.user}
          userRole={userRole}
          tenantData={tenantData}
          isAdminGlobal={isAdminGlobal}
          setActiveTab={navigateToTab}
        />
      );
    case "store":
      return (
        <Store
          userRole={userRole}
          tenantData={tenantData}
          userId={session.user.id}
          isAdminGlobal={isAdminGlobal}
          setActiveTab={navigateToTab}
        />
      );
    case "admin":
      return dashboard();
    case "profile":
    case "perfil":
      return selectedChildId ? (
        <ChildProfile
          childId={selectedChildId}
          setActiveTab={navigateToTab}
          user={session.user}
          tenantData={tenantData}
          isSelfView={false}
        />
      ) : (
        dashboard()
      );
    case "subscription":
      if (tenantData?.is_co_admin) {
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Acesso Reservado à Zeladoria Titular</h2>
            <p className="mt-2 text-sm text-zinc-400 max-w-md">
              A gestão da assinatura, faturas e planos do AxéCloud só pode ser realizada pelo Zelador(a) titular da casa.
            </p>
          </div>
        );
      }
      return (
        <MinhaAssinatura
          session={session}
          tenantData={tenantData}
          onRefresh={refreshAllData}
        />
      );
    default:
      return dashboard(false);
  }
}
