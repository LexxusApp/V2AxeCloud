import React from 'react';
import { 
  Calendar, 
  ShoppingBag, 
  BookOpen, 
  LogOut,
  User as UserIcon,
  CreditCard,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { performFastLogout } from '../lib/logout';
import Avatar from './Avatar';

const MOBILE_DRAWER_TRANSITION =
  'will-change-transform [transition:transform_250ms_cubic-bezier(0.4,0,0.2,1)] lg:will-change-auto';

interface FilhoSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tenantData?: any;
  user?: any;
  filhoFotoUrl?: string | null;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

export default function FilhoSidebar({
  activeTab,
  setActiveTab,
  tenantData,
  user,
  filhoFotoUrl,
  isMobileOpen = false,
  setIsMobileOpen,
}: FilhoSidebarProps) {
  const menuItems = [
    { id: 'profile', label: 'Meu Perfil', icon: UserIcon },
    { id: 'financial', label: 'Mensalidade', icon: CreditCard },
    { id: 'calendar', label: 'Giras', icon: Calendar },
    { id: 'library', label: 'Biblioteca', icon: BookOpen },
    { id: 'store', label: 'Loja Axé', icon: ShoppingBag },
  ];

  const handleLogout = () => {
    performFastLogout();
  };

  const handleNav = (id: string) => {
    setActiveTab(id);
    setIsMobileOpen?.(false);
  };

  const displayName = user?.user_metadata?.nome || 'Filho de Santo';
  const fotoUrl = filhoFotoUrl || user?.user_metadata?.foto_url;

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-10">
        <div className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-full border-4 border-primary/25 p-1 bg-[#12161A] shadow-lg shadow-primary/5 overflow-hidden ring-2 ring-[#0B0D11]">
              <Avatar
                src={fotoUrl}
                name={displayName}
                alt="Foto do filho de santo"
                shape="circle"
                textSize="text-xl"
                className="w-full h-full"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full border-4 border-[#0B0D11] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em] opacity-90">
              {tenantData?.nome || 'TERREIRO'}
            </p>
            <h2 className="text-sm font-bold text-[#F1F5F9] uppercase tracking-tight truncate w-full px-2">
              {displayName}
            </h2>
          </div>
        </div>

        <div className="space-y-1.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors duration-200 group font-bold',
                activeTab === item.id
                  ? 'bg-primary text-[#080A0D]'
                  : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]',
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 transition-transform duration-200 group-hover:scale-105',
                activeTab === item.id ? 'text-[#080A0D]' : 'text-[#94A3B8] group-hover:text-[#F1F5F9]',
              )} />
              <span className="text-[11px] uppercase font-black tracking-[0.15em]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-[#1E242B]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-6 py-4 text-gray-500 hover:text-red-500 transition-colors duration-200 group rounded-2xl hover:bg-red-500/5"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-[11px] uppercase font-black tracking-[0.2em]">Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:flex w-64 h-screen flex-col fixed left-0 top-0 z-[100] border-r border-[#1E242B] bg-[#0B0D11] p-8">
        <SidebarContent />
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/65 transition-opacity duration-200 ease-out lg:hidden"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[120] flex w-72 flex-col border-r border-[#1E242B] bg-[#0B0D11] p-8 lg:hidden',
          isMobileOpen ? 'flex' : 'hidden',
        )}
        aria-hidden={!isMobileOpen}
      >
        <button
          type="button"
          onClick={() => setIsMobileOpen?.(false)}
          className="absolute top-5 right-5 z-10 p-2 text-gray-500 hover:text-white transition-colors duration-200 rounded-xl hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>
    </>
  );
}
