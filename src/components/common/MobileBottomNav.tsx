import React, { useState, useEffect } from 'react';
import { Home, UserPlus, HeartHandshake, Ticket, QrCode, Shield } from 'lucide-react';
import { Language, FeeSettings, GovernanceLoadStatus } from '../../types';
import { AppStore } from '../../services/store';
import { SupabaseService } from '../../services/supabase';
import { isGlobalRegistrationOpen } from '../../utils/rules';

interface MobileBottomNavProps {
  language: Language;
  activeView: string;
  onNavigate: (view: string) => void;
  feeSettings?: FeeSettings;
  governanceStatus?: GovernanceLoadStatus;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  language,
  activeView,
  onNavigate,
  feeSettings: initialFeeSettings,
  governanceStatus = 'ready',
}) => {
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(
    () => initialFeeSettings || AppStore.getFeeSettings()
  );

  useEffect(() => {
    if (initialFeeSettings) {
      setFeeSettings(initialFeeSettings);
    }
  }, [initialFeeSettings]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setFeeSettings(e.detail);
      }
    };
    window.addEventListener('plscf_fee_settings_updated', handleSync);
    return () => window.removeEventListener('plscf_fee_settings_updated', handleSync);
  }, []);

  const isGovernanceReady = governanceStatus === 'ready';

  const navItems = [
    {
      id: 'home',
      label: language === 'bn' ? 'হোম' : 'Home',
      icon: Home,
    },
    ...(isGovernanceReady && isGlobalRegistrationOpen(feeSettings)
      ? [
          {
            id: 'register',
            label: language === 'bn' ? 'নিবন্ধন' : 'Register',
            icon: UserPlus,
            highlight: true,
          },
        ]
      : []),
    ...(isGovernanceReady
      ? [
          {
            id: 'donate',
            label: language === 'bn' ? 'অনুদান' : 'Donate',
            icon: HeartHandshake,
          },
        ]
      : []),
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
      <div className="max-w-md mx-auto px-1.5 flex items-center justify-between gap-0.5">
        {navItems.map((item) => {
          const isActive =
            activeView === item.id ||
            (item.id === 'find-ticket' && activeView === 'ticket');
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const isLeavingPriv =
                  activeView === 'admin' || activeView === 'dashboard' || activeView === 'scanner';
                if (isLeavingPriv && item.id === 'home') {
                  SupabaseService.terminateAdministrativeSession({ forceLocal: true }).catch(() => {});
                }
                onNavigate(item.id);
              }}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] py-1 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
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
