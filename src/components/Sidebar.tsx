import React from 'react';
import {
  Home,
  User,
  UserCircle,
  CalendarDays,
  Newspaper,
  Images,
  Package,
  PieChart,
  Settings as SettingsIcon,
  LogOut,
  Flame,
  BookOpen,
  ShoppingBag,
  Lock,
  Wallet,
  Flower2,
  HandHeart,
} from 'lucide-react';
import { showAtendimentosModule, showCamarinhaModule } from '../lib/tradicaoModules';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { performFastLogout } from '../lib/logout';
import { hasPlanAccess } from '../constants/plans';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isAdmin?: boolean;
  userRole?: 'admin' | 'filho';
  tenantData?: { 
    nome: string; 
    plan: string;
    tenant_id?: string | null;
    foto_url?: string | null;
    cargo?: string | null;
    role?: string | null;
    tradicao?: string | null;
  } | null;
  pendingDonationsCount?: number;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, filledWhenActive: true },
  { id: 'children', label: 'Membros', icon: User },
  { id: 'calendar', label: 'Giras / Eventos', icon: CalendarDays },
  { id: 'mural', label: 'Comunicados', icon: Newspaper },
  { id: 'gallery', label: 'Galeria', icon: Images },
  { id: 'inventory', label: 'Almoxarifado', icon: Package },
  { id: 'financial', label: 'Financeiro', icon: PieChart },
] as const;

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen, isAdmin, userRole = 'admin', tenantData }: SidebarProps) {
  const [pendingDonations, setPendingDonations] = React.useState(0);

  React.useEffect(() => {
    if (userRole !== 'admin') return;
    const tenantId = tenantData?.tenant_id;
    if (!tenantId) return;

    const fetchPending = async () => {
      try {
        const res = await authFetch(
          `/api/v1/financial/caixinha?tenantId=${encodeURIComponent(tenantId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const count = Array.isArray(data.pendingDonations) ? data.pendingDonations.length : 0;
        setPendingDonations(count);
      } catch {
        /* badge opcional — falha silenciosa */
      }
    };

    fetchPending();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribeTimer = window.setTimeout(() => {
      channel = supabase
        .channel('pending_donations')
        .on('postgres_changes', { event: '*', table: 'caixinha_doacoes', schema: 'public' }, () => {
          fetchPending();
        })
        .subscribe();
    }, 0);

    return () => {
      window.clearTimeout(subscribeTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userRole, tenantData?.tenant_id]);

  const handleLogout = () => {
    performFastLogout();
  };

  const traditionNavItems =
    userRole === 'admin'
      ? [
          ...(showCamarinhaModule(tenantData?.tradicao)
            ? [{ id: 'camarinha' as const, label: 'Camarinha', icon: Flower2 }]
            : []),
          ...(showAtendimentosModule(tenantData?.tradicao)
            ? [{ id: 'atendimentos' as const, label: 'Atendimentos', icon: HandHeart }]
            : []),
        ]
      : [];

  const currentNavItems = userRole === 'filho'
    ? [
        { id: 'profile', label: 'Meu Perfil', icon: UserCircle },
        { id: 'financial', label: 'Mensalidade', icon: Wallet },
        { id: 'calendar', label: 'Giras / Eventos', icon: CalendarDays },
        { id: 'library', label: 'Biblioteca de Estudo', icon: BookOpen },
        { id: 'store', label: 'Loja do Axé', icon: ShoppingBag },
        { id: 'settings', label: 'Configurações', icon: SettingsIcon },
      ]
    : [
        ...navItems.slice(0, 4),
        ...traditionNavItems,
        ...navItems.slice(4),
        { id: 'library', label: 'Biblioteca de Estudo', icon: BookOpen },
        { id: 'store', label: 'Loja do Axé', icon: ShoppingBag },
        { id: 'settings', label: 'Configurações', icon: SettingsIcon },
      ];
  
  const getPlanBadge = (plan: string) => {
    const p = plan.toLowerCase();
    const config = {
      premium: { label: 'PREMIUM', color: 'text-[#FBBC00]', bg: 'bg-[#FBBC00]/10' },
      oro: { label: 'ORO', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
      axe: { label: 'AXÉ', color: 'text-blue-500', bg: 'bg-blue-500/10' },
      free: { label: 'AXÉ', color: 'text-blue-500', bg: 'bg-blue-500/10' },
      cortesia: { label: 'CORTESIA', color: 'text-purple-500', bg: 'bg-purple-500/10' },
      vita: { label: 'PLANO VITA', color: 'text-purple-400', bg: 'bg-purple-400/10' },
      'plano vita': { label: 'PLANO VITA', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    };
    
    const item = config[p as keyof typeof config] || config.axe;

    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-full font-black text-[9px] tracking-[0.15em] transition-all",
        item.bg, item.color
      )}>
        <span className="w-1 h-1 rounded-full bg-current opacity-50" />
        {item.label}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay — sem backdrop-blur (pesado em GPU no celular) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/65 transition-opacity duration-200 ease-out lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile: hidden quando fechada (translate-x deixa camada fantasma no Android) */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 z-[70] flex w-[248px] flex-col border-r border-[#1E242B] bg-[#0B0D11]",
        isMobileOpen ? "max-lg:flex" : "max-lg:hidden",
        "lg:flex",
      )}>
        <div className="flex flex-col h-full p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-[#1f252d] scrollbar-track-transparent">
          <div className="mb-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-500">
                <Flame className="h-4 w-4 text-[#13171D]" aria-hidden />
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="whitespace-nowrap font-display text-lg font-bold leading-none tracking-tight text-[#F1F5F9]">
                  AxéCloud
                </div>
                <p className="mt-0.5 whitespace-nowrap text-[10px] font-bold tracking-[0.14em] text-primary">
                  GESTÃO SAGRADA
                </p>
              </div>
            </div>
          </div>

          <div className="-mx-4 mb-5 h-px shrink-0 bg-[#1E242B]" />

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pb-4">
            {currentNavItems.map((item) => {
              const isActive = activeTab === item.id;
              const isLocked = !hasPlanAccess(tenantData?.plan, item.id, isAdmin);
              const Icon = item.icon;
              
              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => {
                      if (isLocked) {
                        alert(`Este recurso é exclusivo e não está disponível no plano ${tenantData?.plan?.toUpperCase() || 'AXÉ'}. Atualize seu plano para acessar.`);
                        return;
                      }
                      setActiveTab(item.id);
                      setIsMobileOpen(false);
                    }}
                    className={cn(
                      'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200',
                      isActive
                        ? 'bg-primary text-[#080A0D] shadow-sm'
                        : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
                      isLocked && 'opacity-50',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[20px] w-[20px] shrink-0 transition-transform duration-200 group-hover:scale-105',
                        isActive ? 'text-[#080A0D]' : 'text-[#94A3B8] group-hover:text-[#F1F5F9]',
                      )}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      fill={
                        isActive && 'filledWhenActive' in item && item.filledWhenActive
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                    <span className="min-w-0 flex-1 whitespace-nowrap text-left text-[14px] leading-tight tracking-tight">
                      {item.label}
                    </span>
                    
                    {item.id === 'financial' && pendingDonations > 0 && (
                      <span className="absolute right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    )}

                    {isLocked && <Lock className="w-4 h-4 text-primary" />}
                  </button>

                  {isLocked && (
                    <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-card border border-primary/20 rounded-lg text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                      DISPONÍVEL NO PLANO PREMIUM
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer: Logout */}
          <div className="pt-4 mt-auto border-t border-[#1E242B] shrink-0">
            <button
              onClick={handleLogout}
              className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-bold text-red-500 transition-all hover:bg-red-500/10"
            >
              <LogOut className="h-[22px] w-[22px] shrink-0 transition-transform group-hover:-translate-x-1" />
              <span className="whitespace-nowrap">Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
