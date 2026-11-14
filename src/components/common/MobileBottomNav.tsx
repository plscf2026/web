import React from 'react';
import { Home, UserPlus, Ticket, QrCode, Shield } from 'lucide-react';
import { Language } from '../../types';

interface MobileBottomNavProps {
  language: Language;
  activeView: string;
  onNavigate: (view: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  language,
  activeView,
  onNavigate,
}) => {
  const navItems = [
    {
      id: 'home',
      label: language === 'bn' ? 'হোম' : 'Home',
      icon: Home,
    },
    {
      id: 'register',
      label: language === 'bn' ? 'নিবন্ধন' : 'Register',
      icon: UserPlus,
      highlight: true,
    },
    {
      id: 'find-ticket',
      label: language === 'bn' ? 'টিকিট' : 'Ticket',
      icon: Ticket,
    },
    {
      id: 'scanner',
      label: language === 'bn' ? 'স্ক্যানার' : 'Scanner',
      icon: QrCode,
    },
    {
      id: 'admin',
      label: language === 'bn' ? 'অ্যাডমিন' : 'Admin',
      icon: Shield,
    },
  ];

  return (
    <nav
      aria-label="Mobile Quick Navigation"
      className="sm:hidden fixed-bottom-navigation"
    >
      <div className="max-w-md mx-auto px-3 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            activeView === item.id ||
            (item.id === 'find-ticket' && activeView === 'ticket');
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'text-[#38BDF8] bg-sky-950/60 font-bold shadow-inner'
                  : item.highlight
                  ? 'text-white hover:text-[#38BDF8]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-[#38BDF8]' : ''
                  }`}
                />
                {item.highlight && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none ${
                  isActive ? 'font-black text-[#38BDF8]' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
