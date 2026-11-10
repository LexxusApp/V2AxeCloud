import { authFetch } from '../../src/lib/authenticatedFetch';
import { isRemoteMutation } from "./operations";
declare const __PILOT_BUILD_ID__: string;
import { managerTab } from "./navigation";
import AccountAvatar from "./AccountAvatar";
import SidebarUsage from "./SidebarUsage";
import { planExpiryLabel, type GalleryUsage } from "./shellSummary";
import "./remote/shell";
import "./shell-summary.css";
import NotificationCenter from "./NotificationCenter";
import PageLoading from "../shared/PageLoading";
import FinancialTabs from "./FinancialTabs";
import PilotUpdateBanner from "../shared/PilotUpdateBanner";
import PwaInstallAction from "../shared/PwaInstallAction";
import {initPilotPwa} from "../shared/initPilotPwa";
import "../shared/page-loading.css";
import "./financial-tabs.css";
import { useChatAlerts } from "./remote/chatAlerts";
import { useDispatchPolling } from "./remote/dispatches";
import React, { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Clock3,
  Coffee,
  CreditCard,
  Eye,
  Flame,
  Home,
  Info,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radar,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus, UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  buildZeladorNavEntries,
  flattenZeladorNavEntries,
  type AppNavItem,
} from "../../src/constants/appNav";
import "./style.css";
import "./usability.css";
import { LocalFeedbackProvider, useLocalFeedback } from "./LocalFeedback";
import {
  financialToday,
  seedMonthlyCharges,
  receiveMonthlyCharge,
  type MonthlyCharge,
} from "./billing";

function refreshAfterChunkFailure(scope: string) {
  if (typeof window === "undefined") return false;
  const key = `axe_chunk_refresh_${scope}`;
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last <= 30_000) return false;
  sessionStorage.setItem(key, String(Date.now()));
  const target = new URL(window.location.href);
  target.searchParams.set("__axe_refresh", Date.now().toString(36));
  window.location.replace(`${target.pathname}${target.search}${target.hash}`);
  return true;
}

if (typeof window !== "undefined") {
  const current = new URL(window.location.href);
  if (current.searchParams.has("__axe_refresh")) {
    current.searchParams.delete("__axe_refresh");
    window.history.replaceState(
      window.history.state,
      "",
      `${current.pathname}${current.search}${current.hash}`,
    );
  }
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    refreshAfterChunkFailure("preload");
  });
}

function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isChunkError =
        msg.includes("dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch");
      if (
        isChunkError &&
        refreshAfterChunkFailure(window.location.hash || "root")
      ) {
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    const msg = error?.message || String(error);
    const isChunk =
      msg.includes("dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch");
    if (isChunk) refreshAfterChunkFailure("boundary");
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "60px 24px",
            textAlign: "center",
            background: "#fff",
            borderRadius: 16,
            margin: "24px auto",
            maxWidth: 600,
          }}
        >
          <p
            style={{
              color: "#18382b",
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Atualização disponível
          </p>
          <p style={{ color: "#556b60", fontSize: 14, marginBottom: 20 }}>
            Uma nova versão do sistema foi disponibilizada. Clique abaixo para
            atualizar seu painel.
          </p>
          <button
            className="wf-button"
            onClick={() => window.location.reload()}
            style={{
              cursor: "pointer",
              padding: "10px 20px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Atualizar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MemberFinance = safeLazy(() => import("./MemberFinance"));
import DashboardPage from "./DashboardPage";
import DelegatedDashboard from './DelegatedDashboard';
const FinancialOverview = safeLazy(() => import("./FinancialOverview"));
const MonthlyPage = safeLazy(() => import("./MonthlyPage"));
const CantinaPage = safeLazy(() => import("./CantinaPage"));
import { initialCantina, consumptionTotal, type CantinaState } from "./cantina";
import type { DemoPix } from "./PixSettingsPage";
const PixSettingsPage = safeLazy(() => import("./PixSettingsPage"));
import { buildLocalLedger, ledgerTotals, type CashEntry } from "./finance";
const GirasPage = safeLazy(() => import("./GirasPage"));
import { demoGiras, nextGira, formatGiraDate } from "./giras";
import type { createDemoMembers } from "./MembersPage";
const MembersPage = safeLazy(() => import("./MembersPage"));
const ObligationsPage = safeLazy(() => import("./ObligationsPage"));
const AttendancePage = safeLazy(() => import("./AttendancePage"));
const NoticesPage = safeLazy(() => import("./NoticesPage"));
const MessagesPage = safeLazy(() => import("./MessagesPage"));
const GalleryPage = safeLazy(() => import("./GalleryPage"));
const InventoryPage = safeLazy(() => import("./InventoryPage"));
import type { LocalInventory } from "./inventory";
import type { LocalLibrary } from "./library";
import {
  shopReceipts,
  shopPending,
  shopTotal,
  type LocalShop,
} from "./shopLogic";
import {
  radarProfileDraft,
  type AccountSetup,
  type LocalRadar,
  type LocalSupport,
} from "./completion";
import { radarDraftEqual } from "./radarLogic";
const RadarPage = safeLazy(() => import("./RadarPage"));
const SettingsPage = safeLazy(() => import("./SettingsPage"));
const SubscriptionPage = safeLazy(() => import("./SubscriptionPage"));
const SupportPage = safeLazy(() => import("./SupportPage"));
const StorePage = safeLazy(() => import("./StorePage"));
const LibraryPage = safeLazy(() => import("./LibraryPage"));
import type { LocalGallery } from "./gallery";
import { unreadConversations, type LocalInbox } from "./messages";
import type { HouseAttendance, HouseNotice, HouseObligation } from "./house";
import { previewSession, request, disconnectPreview } from "./remote/session";
import {
  sendMonthlyReminder,
  sendCantinaReminder,
  sendMemberAccess,
} from "./remote/reminders";
import { initialAccount, initialRadar } from "./remote/initial";
import {
  useRemoteState,
  RemotePageGate,
  loadResource,
  readValue,
  refreshResource,
  useResourceStatus,
} from "./remote/runtime";
import { checkSubscriptionPix } from "./remote/subscription";
import type { LiveSubscription } from "./subscription";
import "./remote/writers";
import { dashboardLive } from "./remote/home";
import "./remote/cantina";
import "./remote/account";
import "./remote/house";
import "./remote/media";
import "./remote/radar";
import "./remote/commerce";
import "./remote/communication";

const sessionProfile = previewSession().profile;
const isUserCoAdmin = sessionProfile?.is_co_admin === true;
const delegatedPermissions = isUserCoAdmin ? (sessionProfile?.permissoes || {}) as Record<string,string> : {};
const delegatedTabModules:Record<string,string>={
  children:'members',obligations:'giras',calendar:'giras',frequencia:'giras',
  financial:'finance','financial-mensalidades':'finance','financial-cantina':'cantina',
  inventory:'inventory',mural:'communications',chat:'communications',
  gallery:'gallery',library:'library',store:'store',radar:'radar',
};
const allowedNav=(tabId:string)=>!isUserCoAdmin ||
  tabId==='dashboard' ||
  (Boolean(delegatedTabModules[tabId]) &&
   ['visualizar','gerenciar'].includes(delegatedPermissions[delegatedTabModules[tabId]]));
const rawEntries = buildZeladorNavEntries(
  sessionProfile.tradicao,previewSession().tenantId,previewSession().email,
);
const entries = rawEntries
  .map(e=>e.type==='item'?e:{...e,items:e.items.filter(i=>allowedNav(i.id))})
  .filter(e=>e.type==='item'?allowedNav(e.item.id):e.items.length>0);
const items = flattenZeladorNavEntries(entries);
const accountIds = new Set(isUserCoAdmin ? ["settings", "suporte"] : ["subscription", "settings", "suporte"]);
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const originalNotifications = [
  {
    id: "pix",
    title: "Comprovante aguardando revisão",
    description: "Mariana enviou um comprovante de mensalidade.",
    time: "29 out, 09:12",
    tab: "financial-mensalidades",
    read: false,
  },
  {
    id: "gira",
    title: "Presença confirmada",
    description: "Joana confirmou presença na Gira de Caboclo.",
    time: "29 out, 08:40",
    tab: "calendar",
    read: false,
  },
  {
    id: "member",
    title: "Cadastro atualizado",
    description: "Rafael completou os dados do perfil.",
    time: "28 out, 17:35",
    tab: "children",
    read: true,
  },
];
function getTab() {
  const candidate=managerTab(location,items.map(item=>item.id));
  return allowedNav(candidate)?candidate:'dashboard';
}

function Button({
  children,
  icon: Icon,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "gold" | "ghost";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {Icon && <Icon size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}
function IconButton({
  icon: Icon,
  label,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Avatar({
  initials,
  color = "sage",
  small = false,
}: {
  initials: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${color} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone = "green",
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button className={`metric ${tone}`} onClick={onClick}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={19} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="metric-bottom">
        <span>{note}</span>
        <ArrowUpRight size={16} />
      </div>
    </button>
  );
}
function Prototype() {
  useDispatchPolling();
  const { change } = useLocalFeedback();
  useEffect(() => {
    void loadResource("notifications");
    void loadResource("account");
    void loadResource("galleryUsage");
    const update = () => {
      void Promise.all(
        ["finance", "home", "notifications"].map((key) =>
          loadResource(key, true),
        ),
      );
    };
    window.addEventListener("axecloud:finance-updated", update);
    return () => window.removeEventListener("axecloud:finance-updated", update);
  }, []);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsRequest, setSettingsRequest] = useState({
    id: 0,
    section: "house",
  });
  const profileBox = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState(getTab);
  const chatAlerts = useChatAlerts(tab === "chat",allowedNav('chat'));
  const [chatRequest, setChatRequest] = useState({ id: "", version: 0 });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("axecloud-local-menu-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileGroups, setMobileGroups] = useState<string[]>([]);
  const openMobileMenu = () => {
    setMobileGroups([]);
    setMobileMenu(true);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [notifications, setNotifications] = useRemoteState<
    typeof originalNotifications
  >("notifications", []);
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [exiting, setExiting] = useState(false);
  async function logout() {
    if (exiting) return;
    setExiting(true);
    try {
      await disconnectPreview();
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Não foi possível sair. Tente novamente.",
      );
      setExiting(false);
    }
  }
  const [giras, setGiras] = useRemoteState<typeof demoGiras>("giras", []);
  const [createGiraRequest, setCreateGiraRequest] = useState(0);
  const [preceitoId, setPreceitoId] = useRemoteState<string | null>(
    "preceitoId",
    null,
  );
  const [home] = useRemoteState<
    import("./DashboardPage").LiveDashboard | undefined
  >("home", undefined);
  const dashboardStatus = useResourceStatus([
    "members",
    "finance",
    "giras",
    "account",
    "pix",
    "home",
    "preceito",
    "dashboardRadar",
    "dashboardWhatsApp",
  ]);
  const [radarSummary] = useRemoteState<any>("radarSummary", null);
  const [dispatches] = useRemoteState<
    readonly import("./whatsappDispatches").WhatsAppDispatch[]
  >("dispatches", []);
  const [preceitoTarget, setPreceitoTarget] = useState("caboclo");
  const [preceitoOpen, setPreceitoOpen] = useState(false);
  const [memberRecords, setMembers] = useRemoteState<
    ReturnType<typeof createDemoMembers>
  >("members", []);
  const [createMemberRequest, setCreateMemberRequest] = useState(0);
  const [obligations, setObligations] = useRemoteState<HouseObligation[]>(
    "obligations",
    [],
  );
  const [attendance, setAttendance] = useRemoteState<HouseAttendance>(
    "attendance",
    {},
  );
  const [notices, setNotices] = useRemoteState<HouseNotice[]>("notices", []);
  const [createObligationRequest, setCreateObligationRequest] = useState(0);
  const [createNoticeRequest, setCreateNoticeRequest] = useState(0);
  const [inbox, setInbox] = useRemoteState<LocalInbox>("inbox", {
    conversations: [],
    drafts: {},
  });
  const [createMessageRequest, setCreateMessageRequest] = useState(0);
  const messageUnread = chatAlerts.alerts.length;
  const [gallery, setGallery] = useRemoteState<LocalGallery>("gallery", {
    albums: [],
    media: [],
  });
  const [createAlbumRequest, setCreateAlbumRequest] = useState(0);
  const [inventory, setInventory] = useRemoteState<LocalInventory>(
    "inventory",
    { items: [], movements: [] },
  );
  const [createStockRequest, setCreateStockRequest] = useState(0);
  const [account, setAccount] = useRemoteState<AccountSetup>(
    "account",
    initialAccount(),
  );
  const [radar, setRadar] = useRemoteState<LocalRadar>("radar", initialRadar());
  const radarDraftDirty = useRef(false);
  const [radarDraft, setRadarDraft] = useState(() =>
    radarProfileDraft(readValue<LocalRadar>("radar") || initialRadar()),
  );
  const previousRadar = useRef(radar);
  useEffect(() => {
    setRadarDraft((current) => {
      const initialBlank = radarProfileDraft(initialRadar());
      const isBlank = radarDraftEqual(current, initialBlank);
      const matchesPrev = radarDraftEqual(
        current,
        radarProfileDraft(previousRadar.current),
      );
      if (!radarDraftDirty.current || isBlank || matchesPrev) {
        return radarProfileDraft(radar);
      }
      return current;
    });
    previousRadar.current = radar;
  }, [radar]);
  const [subscription] = useRemoteState<LiveSubscription | null>(
    "subscription",
    null,
  );
  const [galleryUsage] = useRemoteState<GalleryUsage | undefined>(
    "galleryUsage",
    undefined,
  );
  const usageStatus = useResourceStatus(["galleryUsage"]).galleryUsage;
  const planHint = planExpiryLabel(
    previewSession().profile,
    previewSession().tenantId,
    subscription,
  );
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        void loadResource("galleryUsage", true);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const [support, setSupport] = useRemoteState<LocalSupport>("support", {
    draft: { category: "Uso do sistema", subject: "", text: "" },
    tickets: [],
  });
  const [shop, setShop] = useRemoteState<LocalShop>("shop", {
    cart: {},
    cartId: crypto.randomUUID(),
    orders: [],
    products: [],
  });
  const [createProductRequest, setCreateProductRequest] = useState(0);
  const [library, setLibrary] = useRemoteState<LocalLibrary>("library", {
    materials: [],
  });
  const [createMaterialRequest, setCreateMaterialRequest] = useState(0);
  const [libraryMemberId, setLibraryMemberId] = useState<string | null>(null);
  const [charges, setCharges] = useRemoteState<MonthlyCharge[]>("charges", []);
  const members = memberRecords.map((member) => ({
    ...member,
    hasInvoice: charges.some((charge) => charge.memberId === member.id),
    paid: !charges.some(
      (charge) => charge.memberId === member.id && charge.status === "pending",
    ),
  }));
  const paid = members
    .filter((member) => member.hasInvoice && member.paid)
    .map((member) => member.name);
  const saveCharge = (charge: MonthlyCharge) =>
    change("Salvando mensalidade e atualizando os vínculos", () =>
      setCharges((previous) =>
        previous.some((item) => item.id === charge.id)
          ? previous.map((item) => (item.id === charge.id ? charge : item))
          : [...previous, charge],
      ),
    );
  const receiveCharge = (id: string, date: string) => {
    const next = receiveMonthlyCharge(charges, id, date);
    return change("Registrando baixa e atualizando o caixa", () =>
      setCharges(next),
    );
  };
  const reopenCharge = (id: string) =>
    change("Reabrindo cobrança e atualizando o caixa", () =>
      setCharges((previous) =>
        previous.map((charge) =>
          charge.id === id
            ? {
                ...charge,
                status: "pending",
                receivedDate: undefined,
                paidAt: undefined,
              }
            : charge,
        ),
      ),
    );
  const pendingCharges = charges.filter(
    (charge) => charge.status === "pending",
  );
  const [cantina, setCantina] = useRemoteState<CantinaState>("cantina", {
    products: [],
    cart: {},
    memberId: "",
    sales: [],
    receipts: [],
  });
  const [pixSettings, setPixSettings] = useRemoteState<DemoPix | null>(
    "pixSettings",
    null,
  );
  const debts = (readValue<any[]>("financeRows") || [])
    .filter((row) => row.categoria === "Cantina" && row.status === "pendente")
    .map((row) => ({
      name:
        members.find((member) => member.id === row.filho_id)?.name || "Membro",
      value: Number(row.valor),
    }));
  const received =
    cantina.sales
      .filter((sale) => sale.settled)
      .reduce((total, sale) => total + consumptionTotal(sale), 0) / 100;
  const [manualCash, setManualCash] = useRemoteState<CashEntry[]>(
    "manualCash",
    [],
  );
  const [financialEntryOpen, setFinancialEntryOpen] = useState(false);
  const [financeRows] = useRemoteState<any[]>("financeRows", []);
  const [cashLedger] = useRemoteState<ReturnType<typeof buildLocalLedger>>(
    "cashLedger",
    [],
  );
  const storeDebtByMember = Object.fromEntries(
    members.map((member) => [
      member.id,
      financeRows
        .filter(
          (row) =>
            row.filho_id === member.id &&
            row.categoria === "Loja" &&
            row.status === "pendente",
        )
        .reduce((sum, row) => sum + Math.round(Number(row.valor) * 100), 0),
    ]),
  );
  const creditFor = (memberId: string) => readValue<any>('storeCredits')?.[memberId] || ({
    ...(cantina.preferences?.[memberId] || {
      limitCents: 10000,
      blocked: false,
    }),
    outstandingCents:
      cantina.sales
        .filter((sale) => sale.memberId === memberId && !sale.settled)
        .reduce((sum, sale) => sum + consumptionTotal(sale), 0) +
      (storeDebtByMember[memberId] || 0),
  });
  const cashSummary = ledgerTotals(cashLedger, financialToday().slice(0, 7));
  const upcomingGira = nextGira(giras);
  const [cycles] = useRemoteState<any[]>("preceitoCycles", []);
  const activeCycle = cycles.find((cycle) => cycle.id === preceitoId);
  const preceito = preceitoId !== null;
  const modalGira = giras.find((g) => g.id === preceitoTarget) || upcomingGira;
  const heading = useRef<HTMLHeadingElement>(null);
  const previousTab = useRef(tab);
  const dialogOpeners = useRef<Record<string, HTMLElement | null>>({});
  const dialogFocus = (id: string) => ({
    onOpenAutoFocus: () => {
      const focused = document.activeElement;
      dialogOpeners.current[id] =
        focused instanceof HTMLElement && focused !== document.body
          ? focused
          : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const opener = dialogOpeners.current[id];
      if (opener?.isConnected && opener.getClientRects().length)
        opener.focus({ preventScroll: true });
      else heading.current?.focus({ preventScroll: true });
    },
  });
  const active = items.find((i) => i.id === tab)!;
  const financial = tab === "financial" || tab.startsWith("financial-");
  const unread =
    notifications.filter((n) => !n.read).length + chatAlerts.alerts.length;
  const ping = (text: string) => setToast(text);
  const navigate = (id: string) => {
    if(!allowedNav(id)){
      setToast('O zelador não liberou esta área para sua conta.');
      return;
    }
    setProfileOpen(false);
    setMobileMenu(false);
    setSearchOpen(false);
    setSearch("");
    if (id === tab) return;
    location.hash = id;
  };

  useEffect(() => {
    const listener = () => setTab(getTab());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const group = entries.find(
      (e) => e.type !== "item" && e.items.some((i) => i.id === tab),
    );
    if (group && group.type !== "item")
      setOpenGroups((previous) =>
        previous.includes(group.type) ? previous : [...previous, group.type],
      );
    if (tab !== "financial") setFinancialEntryOpen(false);
    document.title = `${active.label} | AxéCloud · ${location.hostname === "localhost" ? "Prévia local" : "Piloto exclusivo"}`;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (previousTab.current !== tab)
      heading.current?.focus({ preventScroll: true });
    previousTab.current = tab;
  }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const openSettings = (section: string) => {
    setSettingsRequest((previous) => ({ id: previous.id + 1, section }));
    navigate("settings");
  };
  useEffect(() => {
    const open = () => openSettings("whats");
    window.addEventListener("axecloud-open-whatsapp-history", open);
    return () =>
      window.removeEventListener("axecloud-open-whatsapp-history", open);
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const focus = requestAnimationFrame(() =>
      profileBox.current
        ?.querySelector<HTMLButtonElement>(".profile-popover button")
        ?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.axe-pwa-dialog,.axe-pwa-overlay')) return;
      if (
        event.target instanceof Node &&
        !profileBox.current?.contains(event.target)
      )
        setProfileOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector('.axe-pwa-dialog')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setProfileOpen(false);
        profileButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      cancelAnimationFrame(focus);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [profileOpen]);
  const openPreceito = (id?: string) => {
    const target = preceitoId || id || upcomingGira?.id;
    if (!target) {
      navigate("calendar");
      ping("Agende uma gira para preparar o próximo ciclo.");
      return;
    }
    setPreceitoTarget(target);
    setPreceitoOpen(true);
  };
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("axecloud-local-menu-collapsed", String(!collapsed));
    } catch {}
  };
  const openGroup = (id: string) => {
    if (collapsed) {
      setCollapsed(false);
      try {
        localStorage.setItem("axecloud-local-menu-collapsed", "false");
      } catch {}
      setOpenGroups((previous) => [...new Set([...previous, id])]);
    } else
      setOpenGroups((previous) =>
        previous.includes(id)
          ? previous.filter((x) => x !== id)
          : [...previous, id],
      );
  };
  const navItem = (item: AppNavItem, child = false) => (
    <button
      key={item.id}
      className={`nav-item ${child ? "nav-child" : ""} ${tab === item.id ? "is-active" : ""}`}
      onClick={() => navigate(item.id)}
      aria-current={tab === item.id ? "page" : undefined}
      title={collapsed ? item.label : undefined}
    >
      <item.icon size={20} aria-hidden="true" />
      <span className="nav-label">{item.label}</span>
      {item.id === "chat" && messageUnread > 0 && (
        <span className="nav-count">{messageUnread}</span>
      )}
    </button>
  );
  const navBody = (mobile = false) => {
    const groups = mobile ? mobileGroups : openGroups;
    const toggleGroup = (id: string) =>
      mobile
        ? setMobileGroups((previous) =>
            previous.includes(id)
              ? previous.filter((value) => value !== id)
              : [...previous, id],
          )
        : openGroup(id);
    return (
      <>
        <nav aria-label="Menu principal" className="nav-scroll">
          <p className="nav-section">Gestão da casa</p>
          {entries
            .filter((e) => e.type !== "item" || !accountIds.has(e.item.id))
            .map((entry) =>
              entry.type === "item" ? (
                navItem(entry.item)
              ) : (
                <div
                  className={`nav-group ${groups.includes(entry.type) ? "is-open" : ""}`}
                  key={entry.type}
                >
                  <button
                    className={`nav-item group-trigger ${entry.items.some((i) => i.id === tab) ? "group-active" : ""}`}
                    onClick={() => toggleGroup(entry.type)}
                    aria-expanded={
                      groups.includes(entry.type) && (mobile || !collapsed)
                    }
                    aria-controls={`${mobile ? "mobile" : "desktop"}-group-${entry.type}`}
                    title={collapsed ? entry.label : undefined}
                  >
                    <entry.icon size={20} aria-hidden="true" />
                    <span className="nav-label">{entry.label}</span>
                    <ChevronDown size={16} className="nav-chevron" />
                  </button>
                  {groups.includes(entry.type) && (
                    <div
                      className="nav-submenu"
                      id={`${mobile ? "mobile" : "desktop"}-group-${entry.type}`}
                    >
                      {entry.items.map((item) => navItem(item, true))}
                    </div>
                  )}
                </div>
              ),
            )}
          <div className="account-nav">
            <p className="nav-section">Conta e suporte</p>
            {items
              .filter((i) => accountIds.has(i.id))
              .map((item) => navItem(item))}
          </div>
        </nav>
        <div className="sidebar-footer">
          <SidebarUsage
            onSignOut={() => void logout()}
            exiting={exiting}
            usage={galleryUsage}
            error={!!usageStatus.error}
            compact={!mobile && collapsed}
            plan={planHint}
            onGallery={() => navigate("gallery")}
            onSubscription={() => navigate("subscription")}
            onRetry={() => void loadResource("galleryUsage", true)}
          />
        </div>
      </>
    );
  };
  const pageTitle =
    tab === "dashboard"
      ? "Visão geral"
      : financial
        ? "Financeiro"
        : active.label;
  const area = financial
    ? "finance"
    : ["children", "frequencia"].includes(tab)
      ? "people"
      : ["calendar", "obligations"].includes(tab)
        ? "agenda"
        : ["chat", "mural"].includes(tab)
          ? "communication"
          : tab === "library"
            ? "library"
            : tab === "store" || tab === "inventory"
              ? "commerce"
              : tab === "radar"
                ? "radar"
                : "home";
  const liveDashboard = React.useMemo(
    () => dashboardLive(),
    [
      memberRecords,
      giras,
      account,
      pixSettings,
      financeRows,
      radarSummary,
      home,
      dashboardStatus.dashboardRadar.ready,
      dashboardStatus.dashboardWhatsApp.ready,
    ],
  );
  return (
    <div
      data-area={area}
      className={`prototype ${collapsed ? "is-collapsed" : ""}`}
    >
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          heading.current?.focus();
        }}
      >
        Ir para o conteúdo
      </a>
      <aside className="desktop-sidebar">
        <div className="brand">
          <img src="/trident-cropped.png" alt="" />
          <span>
            Axé<span>Cloud</span>
          </span>
        </div>
        {navBody()}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <IconButton
              className="desktop-toggle"
              icon={collapsed ? PanelLeftOpen : PanelLeftClose}
              label={collapsed ? "Expandir menu" : "Recolher menu"}
              onClick={toggleCollapsed}
            />
            <button
              className="mobile-brand"
              onClick={() => navigate("dashboard")}
              aria-label="AxéCloud, início"
            >
              <img src="/trident-cropped.png" alt="" />
            </button>
            <IconButton
              className="mobile-menu-trigger"
              icon={Menu}
              label="Abrir menu"
              aria-expanded={mobileMenu}
              aria-controls="mobile-navigation"
              onClick={openMobileMenu}
            />
            <div className="desktop-context">
              <span className="context-label">Gestão da casa</span>
              <div className="breadcrumbs">
                Painel <ChevronRight size={13} />
                <strong>{pageTitle}</strong>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar no sistema"
            >
              <Search size={18} />
              <span>Buscar no sistema</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-separator" />
            <button
              className="icon-button notification-trigger"
              aria-label={`Notificações, ${unread} não lidas`}
              onClick={() => setNoticeOpen(true)}
            >
              <Bell size={20} />
              {unread > 0 && <span className="notification-dot" />}
            </button>
            <div
              ref={profileBox}
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  !(event.relatedTarget instanceof Element && event.relatedTarget.closest('.axe-pwa-dialog')) &&
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setProfileOpen(false);
              }}
            >
              <button
                ref={profileButton}
                className="topbar-avatar"
                aria-label="Abrir opções da conta"
                aria-expanded={profileOpen}
                aria-controls="profile-options"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <AccountAvatar
                  src={account.profile.photoUrl}
                  name={account.profile.responsible || "Zelador(a)"}
                />
              </button>
              {profileOpen && (
                <section
                  id="profile-options"
                  className="profile-popover"
                  aria-label="Opções da conta"
                >
                  <header>
                    <strong>{account.profile.responsible}</strong>
                    <small>{account.profile.email}</small>
                    <span className="profile-plan-hint">{isUserCoAdmin ? "👑 Co-Administrador" : planHint}</span>
                  </header>
                  {isUserCoAdmin && (
                    <a
                      href="/dashboard?space=member"
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          const response = await authFetch('/api/pilot/interface-access?space=member', { method: 'POST', cache: 'no-store' });
                          const access = await response.json();
                          if (!response.ok || access.enabled !== true || access.interface !== 'member') {
                            throw new Error(access.error || 'Seu vínculo de membro não foi confirmado.');
                          }
                          window.location.assign('/dashboard?space=member');
                        } catch (error) {
                          window.alert(error instanceof Error ? error.message : 'Não foi possível abrir seu espaço de filho.');
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 16px",
                        fontSize: 14,
                        color: "#166534",
                        fontWeight: 600,
                        textDecoration: "none",
                        borderBottom: "1px solid #e2e8f0",
                        background: "#f0fdf4",
                        cursor: "pointer"
                      }}
                    >
                      <UserRound size={17} />
                      Ver meu espaço de filho
                      <ArrowRight size={15} style={{ marginLeft: "auto" }} />
                    </a>
                  )}
                  {!isUserCoAdmin && <><button onClick={() => openSettings("house")}>
                    <Users size={17} />
                    Minha conta e casa
                    <ArrowRight size={15} />
                  </button>
                  <button onClick={() => openSettings("whats")}>
                    <MessageCircle size={17} />
                    WhatsApp e automações
                    <ArrowRight size={15} />
                  </button></>}
                  {!isUserCoAdmin && (
                  <button onClick={() => navigate("subscription")}>
                    <CreditCard size={17} />
                    Minha assinatura
                    <ArrowRight size={15} />
                  </button>
                )}
                  <PwaInstallAction iconSize={17} />
                  <button onClick={() => navigate("suporte")}>
                    <CircleHelp size={17} />
                    Suporte
                    <ArrowRight size={15} />
                  </button>
                  <button disabled={exiting} onClick={() => void logout()}>
                    <LogOut size={17} />
                    {exiting ? "Saindo…" : "Sair da conta"}
                  </button>
                </section>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {tab === "dashboard" ? (
            <h1 className="sr-only" ref={heading} tabIndex={-1}>
              Início da casa
            </h1>
          ) : (
            <div className="page-heading">
              <div>
                <h1 ref={heading} tabIndex={-1}>
                  {pageTitle}
                </h1>
                <p>
                  {financial
                    ? "Acompanhe o caixa, as mensalidades e o consumo da casa."
                    : tab === "children"
                      ? "Pessoas, vínculos e a história de cada filho da casa."
                      : tab === "calendar"
                        ? "Organize os próximos encontros e acompanhe as confirmações."
                        : tab === "obligations"
                          ? "Compromissos, prazos e cuidados de cada membro."
                          : tab === "frequencia"
                            ? "Presenças registradas e o ritmo da corrente em cada encontro."
                            : tab === "mural"
                              ? "A voz da casa e os avisos para a corrente."
                              : tab === "chat"
                                ? "Conversas, orientações e o cuidado com cada pessoa da corrente."
                                : tab === "gallery"
                                  ? "Os encontros, os detalhes e a memória da casa, guardados com cuidado."
                                  : tab === "inventory"
                                    ? "O que a casa tem, o que foi usado e o que precisa chegar."
                                    : tab === "store"
                                      ? "O catálogo da casa, do primeiro olhar à entrega."
                                      : tab === "radar"
                                        ? "Apresente sua casa e acompanhe o interesse de quem chega."
                                        : tab === "subscription"
                                          ? "Seu plano, os próximos períodos e cada registro em um só lugar."
                                          : tab === "settings"
                                            ? "A identidade da casa e os canais que aproximam a corrente."
                                            : tab === "suporte"
                                              ? "Orientações e pedidos de ajuda, com espaço para explicar o que aconteceu."
                                              : tab === "library"
                                                ? "Leituras da corrente e estudos reservados para cada caminho."
                                                : "Uma navegação mais clara para cada rotina da casa."}
                </p>
              </div>
              <fieldset className="page-actions" style={{border:0,padding:0,margin:0,minWidth:0}} disabled={isUserCoAdmin&&delegatedPermissions[delegatedTabModules[tab]]!=='gerenciar'&&libraryMemberId===null}>
                {tab === "children" ? (
                  <Button
                    icon={UserPlus}
                    onClick={() => setCreateMemberRequest((n) => n + 1)}
                  >
                    Novo membro
                  </Button>
                ) : tab === "calendar" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateGiraRequest((n) => n + 1)}
                  >
                    Criar gira
                  </Button>
                ) : tab === "obligations" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateObligationRequest((n) => n + 1)}
                  >
                    Novo compromisso
                  </Button>
                ) : tab === "mural" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateNoticeRequest((n) => n + 1)}
                  >
                    Novo comunicado
                  </Button>
                ) : tab === "chat" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateMessageRequest((n) => n + 1)}
                  >
                    Nova conversa
                  </Button>
                ) : tab === "gallery" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateAlbumRequest((n) => n + 1)}
                  >
                    Criar álbum
                  </Button>
                ) : tab === "inventory" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateStockRequest((n) => n + 1)}
                  >
                    Novo item
                  </Button>
                ) : tab === "store" ? (
                  <Button
                    icon={Plus}
                    onClick={() => setCreateProductRequest((n) => n + 1)}
                  >
                    Novo produto
                  </Button>
                ) : tab === "library" ? (
                  libraryMemberId !== null ? (
                    <Button
                      variant="secondary"
                      onClick={() => setLibraryMemberId(null)}
                    >
                      Voltar à zeladoria
                    </Button>
                  ) : (
                    <Button
                      icon={Plus}
                      onClick={() => setCreateMaterialRequest((n) => n + 1)}
                    >
                      Adicionar material
                    </Button>
                  )
                ) : financial ? (
                  <Button
                    icon={Plus}
                    onClick={() => {
                      setFinancialEntryOpen(true);
                      if (tab !== "financial") navigate("financial");
                    }}
                  >
                    Novo lançamento
                  </Button>
                ) : null}
              </fieldset>
            </div>
          )}

          {financial && (
            <FinancialTabs
              items={entries
                .filter((e) => e.type === "financial")
                .flatMap((e) => (e.type === "financial" ? e.items : []))}
              selected={tab}
              onSelect={navigate}
            />
          )}
          <React.Suspense fallback={<PageLoading route={tab} />}>
            <TabErrorBoundary>
              <RemotePageGate tab={tab}>
                {tab === 'dashboard' && isUserCoAdmin && <DelegatedDashboard permissions={delegatedPermissions} house={sessionProfile.nome_terreiro||'Minha casa'} onNavigate={navigate}/>}
                {tab === "dashboard" && !isUserCoAdmin && (
                  <DashboardPage
                    resources={dashboardStatus}
                    onReload={(keys) =>
                      void Promise.all(
                        keys.map((key) => loadResource(key, true)),
                      )
                    }
                    pendingCount={pendingCharges.length}
                    pendingCents={pendingCharges.reduce(
                      (sum, charge) => sum + charge.totalCents,
                      0,
                    )}
                    houseName={account.profile.house}
                    whatsappConnected={account.whatsapp.connected}
                    live={liveDashboard}
                    radarPublished={
                      radarSummary?.profile?.publicacaoStatus === "publicado"
                    }
                    members={members}
                    paid={paid}
                    preceito={preceito}
                    giras={giras}
                    onNavigate={navigate}
                    onPreceito={() => openPreceito()}
                    onNewMovement={() => setNewOpen(true)}
                  />
                )}

                {financial && (
                  <>
                    {tab === "financial" && (
                      <FinancialOverview
                        storePendingCents={financeRows
                          .filter(
                            (row) =>
                              row.categoria === "Loja" &&
                              row.status === "pendente",
                          )
                          .reduce(
                            (sum, row) =>
                              sum + Math.round(Number(row.valor) * 100),
                            0,
                          )}
                        ledger={cashLedger}
                        members={members}
                        charges={charges}
                        pix={pixSettings}
                        onSaveCharge={saveCharge}
                        debts={debts}
                        entryOpen={financialEntryOpen}
                        onEntryOpenChange={setFinancialEntryOpen}
                        onNavigate={navigate}
                        onSave={(entry) =>
                          change("Salvando lançamento no caixa", () =>
                            setManualCash((previous) =>
                              previous.some((item) => item.id === entry.id)
                                ? previous.map((item) =>
                                    item.id === entry.id ? entry : item,
                                  )
                                : [...previous, entry],
                            ),
                          )
                        }
                        onRemove={(id) =>
                          change("Removendo lançamento do caixa", () =>
                            setManualCash((previous) =>
                              previous.filter((item) => item.id !== id),
                            ),
                          )
                        }
                      />
                    )}
                    {tab === "financial-mensalidades" && (
                      <MonthlyPage
                        receiptScope={{
                          userId: previewSession().userId,
                          tenantId: previewSession().tenantId,
                        }}
                        onSync={() =>
                          change("Sincronizando mensalidades", async () => {
                            const result = await request(
                              "/api/v1/financial/mensalidades/sync-pendentes",
                              "POST",
                              { tenant_id: previewSession().tenantId },
                            );
                            if (result.success !== true)
                              throw Error(
                                "O servidor não confirmou a sincronização.",
                              );
                            await refreshResource("finance");
                          })
                        }
                        members={members}
                        charges={charges}
                        pix={pixSettings}
                        onSaveCharge={saveCharge}
                        onReceive={receiveCharge}
                        onReopen={reopenCharge}
                        onSendReminder={(id) =>
                          change("Enviando cobrança pelo WhatsApp", () =>
                            sendMonthlyReminder(id),
                          )
                        }
                        onNavigate={navigate}
                      />
                    )}
                    {tab === "financial-cantina" && (
                      <CantinaPage
                        storeDebtByMember={storeDebtByMember}
                        state={cantina}
                        members={members}
                        onChange={(next) => {
                          if (isRemoteMutation("cantina", next, cantina))
                            return change(
                              "Atualizando cantina, caderneta e caixa",
                              () => setCantina(next),
                            );
                          else return setCantina(next);
                        }}
                        onSendReminder={(id) =>
                          change(
                            "Enviando cobrança da cantina pelo WhatsApp",
                            () => sendCantinaReminder(id),
                          )
                        }
                        onNavigate={navigate}
                      />
                    )}
                    {tab === "financial-configs" && (
                      <PixSettingsPage
                        saved={pixSettings}
                        onSave={(config) =>
                          change(
                            "Salvando configuração de mensalidade e Pix",
                            () => setPixSettings(config),
                          )
                        }
                      />
                    )}
                  </>
                )}

                {tab === "children" && (
                  <MembersPage
                    onSendAccess={(id) =>
                      change("Enviando dados de acesso do membro", () =>
                        sendMemberAccess(id),
                      )
                    }
                    obligations={obligations}
                    members={members}
                    nextMeeting={upcomingGira}
                    paid={paid}
                    charges={charges}
                    renderFinance={(member) => (
                      <RemotePageGate tab="member-finance">
                        <MemberFinance
                          memberId={member.id}
                          name={member.name}
                          charges={charges}
                          ledger={cashLedger}
                          cantina={cantina}
                          shop={shop}
                          pix={pixSettings}
                        />
                      </RemotePageGate>
                    )}
                    createRequest={createMemberRequest}
                    onCreateHandled={() => setCreateMemberRequest(0)}
                    onNavigate={navigate}
                    onChange={(next) =>
                      change(
                        "Salvando perfil e atualizando vínculos do membro",
                        () => setMembers(next),
                      )
                    }
                  />
                )}

                {tab === "calendar" && (
                  <GirasPage
                    giras={giras}
                    members={members}
                    createRequest={createGiraRequest}
                    onCreateHandled={() => setCreateGiraRequest(0)}
                    preceitoId={preceitoId}
                    onChange={(next) =>
                      change("Salvando organização da gira", () =>
                        setGiras(next),
                      )
                    }
                    onPreceito={openPreceito}
                    onNavigate={navigate}
                  />
                )}

                {tab === "obligations" && (
                  <ObligationsPage
                    members={members}
                    items={obligations}
                    onChange={(next) =>
                      change("Salvando compromisso", () => setObligations(next))
                    }
                    createRequest={createObligationRequest}
                    onCreateHandled={() => setCreateObligationRequest(0)}
                  />
                )}
                {tab === "frequencia" && (
                  <AttendancePage
                    giras={giras}
                    members={members}
                    attendance={attendance}
                    onChange={(next) =>
                      change("Salvando frequência", () => setAttendance(next))
                    }
                    onNavigate={navigate}
                  />
                )}
                {tab === "mural" && (
                  <NoticesPage
                    members={members}
                    giras={giras}
                    notices={notices}
                    onChange={(next) =>
                      change("Salvando comunicado", () => setNotices(next))
                    }
                    createRequest={createNoticeRequest}
                    onCreateHandled={() => setCreateNoticeRequest(0)}
                  />
                )}

                {tab === "chat" && (
                  <MessagesPage
                    openRequest={chatRequest}
                    members={members}
                    state={inbox}
                    onChange={(next) => {
                      if (
                        next.conversations.some((conversation) => {
                          const before = inbox.conversations.find(
                            (item) => item.id === conversation.id,
                          );
                          return (
                            !before ||
                            before.messages !== conversation.messages ||
                            before.archived !== conversation.archived
                          );
                        })
                      )
                        return change("Atualizando conversa", () =>
                          setInbox(next),
                        );
                      else return setInbox(next);
                    }}
                    createRequest={createMessageRequest}
                    onCreateHandled={() => setCreateMessageRequest(0)}
                  />
                )}

                {tab === "gallery" && (
                  <GalleryPage
                    scopeKey={`${previewSession().userId}:${previewSession().tenantId}`}
                    state={gallery}
                    onChange={(next) =>
                      change("Salvando galeria", () => setGallery(next))
                    }
                    createRequest={createAlbumRequest}
                    onCreateHandled={() => setCreateAlbumRequest(0)}
                  />
                )}
                {tab === "inventory" && (
                  <InventoryPage
                    state={inventory}
                    onChange={(next) =>
                      change("Atualizando estoque e histórico", () =>
                        setInventory(next),
                      )
                    }
                    createRequest={createStockRequest}
                    onCreateHandled={() => setCreateStockRequest(0)}
                  />
                )}
                {tab === "store" && (
                  <React.Suspense fallback={<PageLoading route={tab} />}>
                    <StorePage
                      creditFor={creditFor}
                      state={shop}
                      onChange={(next) => {
                        if (
                          next.orders !== shop.orders ||
                          next.products !== shop.products
                        )
                          return change(
                            "Atualizando pedido, estoque e caixa",
                            () => setShop(next),
                          );
                        else return setShop(next);
                      }}
                      members={members}
                      createRequest={createProductRequest}
                      onCreateHandled={() => setCreateProductRequest(0)}
                      onNavigate={navigate}
                    />
                  </React.Suspense>
                )}
                {tab === "library" && (
                  <React.Suspense fallback={<PageLoading route={tab} />}>
                    <LibraryPage
                      state={library}
                      onChange={(next) =>
                        change("Atualizando acervo e permissões", () =>
                          setLibrary(next),
                        )
                      }
                      members={members}
                      createRequest={createMaterialRequest}
                      onCreateHandled={() => setCreateMaterialRequest(0)}
                      previewMemberId={libraryMemberId}
                      onPreviewChange={setLibraryMemberId}
                    />
                  </React.Suspense>
                )}

                {["radar", "subscription", "settings", "suporte"].includes(
                  tab,
                ) && (
                  <React.Suspense fallback={<PageLoading route={tab} />}>
                    {tab === "radar" && (
                      <RadarPage
                        draft={radarDraft}
                        onDraftChange={(next) => {
                          if (radarDraftEqual(next, radarProfileDraft(radar))) {
                            radarDraftDirty.current = false;
                          } else {
                            radarDraftDirty.current = true;
                          }
                          setRadarDraft(next);
                        }}
                        state={radar}
                        metrics={radarSummary?.metrics}
                        onChange={async (next) => {
                          await change("Salvando perfil público do Radar", () =>
                            setRadar(next),
                          );
                          radarDraftDirty.current = false;
                          setRadarDraft(
                            radarProfileDraft(readValue("radar") || next),
                          );
                        }}
                        profile={account.profile}
                        onNavigate={navigate}
                      />
                    )}
                    {tab === "subscription" && isUserCoAdmin && (
                      <div style={{ padding: "48px 24px", textAlign: "center", maxWidth: 520, margin: "40px auto", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Acesso Restrito ao Titular</h3>
                        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                          A gestão da assinatura e cobrança é exclusiva do Zelador titular da casa. Como Co-Administrador, você tem permissão para gerenciar as rotinas da casa (giras, presenças, cantina e membros).
                        </p>
                        <button className="btn-primary" style={{ marginTop: 24, padding: "10px 20px" }} onClick={() => navigate("home")}>
                          Voltar ao início
                        </button>
                      </div>
                    )}
                    {tab === "subscription" && !isUserCoAdmin && subscription && (
                      <SubscriptionPage
                        state={subscription}
                        userEmail={account?.profile?.email}
                        onRefresh={() => refreshResource("subscription")}
                        onCheckPix={checkSubscriptionPix}
                        onNavigate={navigate}
                        memberCount={members.length}
                      />
                    )}
                    {tab === "settings" && (
                      <SettingsPage
                        requestedSection={settingsRequest}
                        dispatches={dispatches}
                        state={account}
                        onChange={(next) => {
                          if (
                            next.profile !== account.profile ||
                            next.whatsapp !== account.whatsapp
                          )
                            return change(
                              "Salvando configurações da conta",
                              () => setAccount(next),
                            );
                          else return setAccount(next);
                        }}
                        onNavigate={navigate}
                      />
                    )}
                    {tab === "suporte" && (
                      <SupportPage
                        profile={account.profile}
                        state={support}
                        onChange={(next) => {
                          if (next.tickets !== support.tickets)
                            return change("Atualizando pedido de suporte", () =>
                              setSupport(next),
                            );
                          else return setSupport(next);
                        }}
                        onNavigate={navigate}
                      />
                    )}
                  </React.Suspense>
                )}
              </RemotePageGate>
            </TabErrorBoundary>
          </React.Suspense>
          <footer className="page-footer">
            <span>
              <img src="/trident-cropped.png" alt="" />
              AxéCloud
            </span>
            <span>Um novo cuidado com a sua rotina.</span>
          </footer>
        </main>
      </div>

      <nav className="mobile-dock" aria-label="Navegação principal no celular">
        {[
          { id: "dashboard", name: "Início", icon: Home },
          { id: "children", name: "Corrente", icon: Users },
          { id: "calendar", name: "Giras", icon: CalendarDays },
          { id: "financial", name: "Financeiro", icon: Wallet },
        ].map((i) => (
          <button
            key={i.id}
            className={
              (i.id === "financial" ? financial : tab === i.id) && !mobileMenu
                ? "selected"
                : ""
            }
            aria-current={
              (i.id === "financial" ? financial : tab === i.id)
                ? "page"
                : undefined
            }
            onClick={() => navigate(i.id)}
          >
            <i.icon size={20} />
            <span>{i.name}</span>
          </button>
        ))}
        <button
          className={mobileMenu ? "selected" : ""}
          onClick={openMobileMenu}
          aria-expanded={mobileMenu}
          aria-controls="mobile-navigation"
        >
          <MoreHorizontal size={22} />
          <span>Mais</span>
        </button>
      </nav>

      <Dialog.Root
        open={mobileMenu}
        onOpenChange={(open) => {
          if (open) openMobileMenu();
          else setMobileMenu(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay menu-overlay" />
          <Dialog.Content
            {...dialogFocus("menu")}
            id="mobile-navigation"
            className="mobile-drawer"
          >
            <div className="drawer-heading">
              <Dialog.Title>Menu da casa</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Fechar menu" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              Todas as áreas da casa e opções de conta e suporte.
            </Dialog.Description>
            {navBody(true)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            {...dialogFocus("search")}
            className="dialog search-dialog"
          >
            <Dialog.Title className="sr-only">Buscar no sistema</Dialog.Title>
            <Dialog.Description className="sr-only">
              Encontre uma área do AxéCloud pelo nome.
            </Dialog.Description>
            <div className="dialog-search">
              <Search size={21} />
              <input
                aria-label="Buscar área do sistema"
                placeholder="O que você precisa encontrar?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Dialog.Close asChild>
                <IconButton icon={X} label="Fechar busca" />
              </Dialog.Close>
            </div>
            <div className="search-results">
              {items
                .filter((i) => normalize(i.label).includes(normalize(search)))
                .map((i) => (
                  <button key={i.id} onClick={() => navigate(i.id)}>
                    <i.icon size={19} />
                    <span>{i.label}</span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              {!items.some((i) =>
                normalize(i.label).includes(normalize(search)),
              ) && (
                <div className="empty-state">
                  <h3>Nenhuma área encontrada.</h3>
                  <p>Tente buscar por Giras, Cantina ou Mensalidades.</p>
                </div>
              )}
            </div>
            <div className="search-hint">
              Busque por uma área e selecione para abrir.
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <NotificationCenter
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        notifications={notifications}
        chatAlerts={chatAlerts.alerts}
        chatError={chatAlerts.error}
        onRefreshChat={chatAlerts.refresh}
        focus={dialogFocus("notifications")}
        onRead={(ids) =>
          setNotifications((list) =>
            list.map((row) =>
              ids.includes(row.id) ? { ...row, read: true } : row,
            ),
          )
        }
        onNavigate={navigate}
        onOpenConversation={(id) => {
          setChatRequest((previous) => ({ id, version: previous.version + 1 }));
          navigate("chat");
        }}
      />
      <Dialog.Root open={newOpen} onOpenChange={setNewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content {...dialogFocus("dialog")} className="dialog">
            <div className="dialog-heading">
              <Dialog.Title>Novo movimento</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Fechar novo movimento" />
              </Dialog.Close>
            </div>
            <Dialog.Description>
              Escolha a rotina que deseja organizar.
            </Dialog.Description>
            <div className="new-movement">
              {[
                {
                  title: "Registrar no financeiro",
                  desc: "Entradas, saídas e mensalidades.",
                  icon: Wallet,
                  id: "financial",
                },
                {
                  title: "Organizar uma gira",
                  desc: "Agenda e presença da corrente.",
                  icon: CalendarDays,
                  id: "calendar",
                },
                {
                  title: "Abrir a cantina",
                  desc: "Consumo e caderneta dos membros.",
                  icon: Coffee,
                  id: "financial-cantina",
                },
              ].map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setNewOpen(false);
                    navigate(a.id);
                    if (a.id === "financial") setFinancialEntryOpen(true);
                    if (a.id === "calendar")
                      setCreateGiraRequest((value) => value + 1);
                  }}
                >
                  <span className="row-icon green">
                    <a.icon size={21} />
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.desc}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={preceitoOpen} onOpenChange={setPreceitoOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content {...dialogFocus("dialog")} className="dialog">
            <div className="dialog-heading">
              <Dialog.Title>
                {preceito ? "Preceito ativo" : "Iniciar um novo ciclo"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Fechar preceito" />
              </Dialog.Close>
            </div>
            <Dialog.Description>
              {preceito
                ? "O encerramento finaliza o ciclo ativo registrado para a corrente."
                : "A ativação inicia o ciclo agora e encerra no início da gira indicada abaixo, usando as orientações que você cadastrou na agenda. A corrente será avisada pelo sistema."}
            </Dialog.Description>
            <div className="preceito-summary">
              <Flame size={28} />
              <div>
                <strong>
                  {activeCycle?.titulo ||
                    modalGira?.title ||
                    "Próximo encontro"}
                </strong>
                <span>
                  {activeCycle?.fim_em
                    ? "Até " +
                      new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "long",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(activeCycle.fim_em))
                    : modalGira
                      ? `${formatGiraDate(modalGira, { dateStyle: "long" })}, às ${modalGira.time}`
                      : "Agende uma gira para continuar."}
                </span>
              </div>
            </div>
            <Button
              className="full-width"
              icon={preceito ? Check : Flame}
              onClick={async () => {
                try {
                  await change("Atualizando ciclo de preceito", () =>
                    setPreceitoId(preceito ? null : modalGira?.id || null),
                  );
                  setPreceitoOpen(false);
                } catch {}
              }}
            >
              {preceito ? "Encerrar ciclo" : "Ativar ciclo"}
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {toast && (
        <div role="status" className="toast">
          <Check size={19} />
          <span>{toast}</span>
          <IconButton
            icon={X}
            label="Fechar mensagem"
            onClick={() => setToast("")}
          />
        </div>
      )}
    </div>
  );
}

// Keep one React root when this standalone entry is refreshed during local design edits.
initPilotPwa();
const root =
  (import.meta.hot?.data.reactRoot as Root | undefined) ??
  createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.reactRoot = root;
root.render(
  <React.StrictMode>
    <LocalFeedbackProvider>
      <PilotUpdateBanner buildId={__PILOT_BUILD_ID__} versionUrl="/api/pilot/version" />
      <Prototype />
    </LocalFeedbackProvider>
  </React.StrictMode>,
);
