import { useEffect, useState } from 'react';
import {
  Shield,
  LogOut,
  Utensils,
  Shirt,
  ShieldCheck,
  Wallet,
  AlertCircle,
  Layers,
  Lock,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { StaffAccount, Language } from '../types';
import { EventStore } from '../services/eventStore';
import { AppStore } from '../services/store';
import { isDevTestBypassAllowed } from '../services/supabase';
import { isBreakfastCollectionOpen } from '../utils/eventRules';
import { FoodScannerModule } from './FoodScannerModule';
import { DressScannerModule } from './DressScannerModule';
import { GateScannerModule } from './GateScannerModule';
import { StaffFinanceModule } from './StaffFinanceModule';
import { MultiStationDesk } from './MultiStationDesk';

interface ScannerPortalProps {
  language: Language;
}

export const ScannerPortal: React.FC<ScannerPortalProps> = ({ language }) => {
  const [currentStaff, setCurrentStaff] = useState<StaffAccount | null>(null);

  // Login form state - dev bypass enabled only in local development
  const isDevMode = isDevTestBypassAllowed();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active module tab if Super Admin - default to Multi-Station Desk
  const [activeAdminModule, setActiveAdminModule] = useState<string>('multi_station');

  // Cloud sync state
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [totalRegistrationsCount, setTotalRegistrationsCount] = useState<number>(() => AppStore.getRegistrations().length);

  const handleSyncDatabase = async () => {
    setIsSyncingDb(true);
    setSyncStatusMsg(null);
    try {
      const res = await AppStore.syncWithSupabase();
      setTotalRegistrationsCount(res.count);
      setSyncStatusMsg(`Successfully synchronized ${res.count} student tickets from cloud.`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch {
      setSyncStatusMsg('Sync notice: Using local cached registrations.');
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncingDb(false);
    }
  };

  useEffect(() => {
    // Initial background cloud synchronization on scanner mount
    AppStore.syncWithSupabase()
      .then((res) => {
        setTotalRegistrationsCount(res.count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    EventStore.getActiveStaffSession()
      .then((staff) => {
        if (active) setCurrentStaff(staff);
      })
      .catch((error) => {
        console.error('Unable to restore staff session:', error);
        if (active) setLoginError('Unable to verify staff session. Please sign in again.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentStaff?.role !== 'BREAKFAST_STAFF') return;

    const enforceCutoff = () => {
      if (!isBreakfastCollectionOpen()) {
        EventStore.logoutStaff();
        setCurrentStaff(null);
        setLoginError('Breakfast staff access closes at 1:00 PM Bangladesh time.');
      }
    };

    enforceCutoff();
    const timer = window.setInterval(enforceCutoff, 15_000);
    return () => window.clearInterval(timer);
  }, [currentStaff]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await EventStore.authenticateStaff(usernameInput, passwordInput);
      if (res.success && res.staff) {
        setCurrentStaff(res.staff);
        setUsernameInput('');
        setPasswordInput('');
      } else {
        setLoginError(res.error || 'Invalid credentials.');
      }
    } catch (error) {
      console.error('Staff authentication failed:', error);
      setLoginError('Unable to verify staff credentials. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await EventStore.logoutStaff();
    } catch (error) {
      console.error('Staff logout failed:', error);
    }
    setCurrentStaff(null);
  };

  // Determine active view based on role (Part 2 Requirement: Role-based module routing)
  const getRenderedModule = () => {
    if (!currentStaff) return null;

    const isSuperAdmin = currentStaff.role === 'SUPER_ADMIN';

    // If Super Admin, let them toggle or default
    const effectiveModule = isSuperAdmin ? activeAdminModule : null;

    if (isSuperAdmin && activeAdminModule === 'multi_station') {
      return (
        <MultiStationDesk
          language={language}
          staffUser={currentStaff}
          isSuperAdmin={isSuperAdmin}
        />
      );
    }

    if (currentStaff.role === 'BREAKFAST_STAFF' || effectiveModule === 'food_breakfast') {
      return (
        <FoodScannerModule
          language={language}
          staffUser={currentStaff}
          defaultMealType="breakfast"
          isSuperAdmin={isSuperAdmin}
        />
      );
    }

    if (currentStaff.role === 'LUNCH_STAFF' || effectiveModule === 'food_lunch') {
      return (
        <FoodScannerModule
          language={language}
          staffUser={currentStaff}
          defaultMealType="lunch"
          isSuperAdmin={isSuperAdmin}
        />
      );
    }

    if (currentStaff.role === 'DINNER_STAFF' || effectiveModule === 'food_dinner') {
      return (
        <FoodScannerModule
          language={language}
          staffUser={currentStaff}
          defaultMealType="dinner"
          isSuperAdmin={isSuperAdmin}
        />
      );
    }

    if (currentStaff.role === 'DRESS_STAFF' || effectiveModule === 'dress_distribution') {
      return (
        <DressScannerModule
          language={language}
          staffUser={currentStaff}
          isSuperAdmin={isSuperAdmin}
        />
      );
    }

    if (currentStaff.role === 'FINANCE_STAFF' || effectiveModule === 'staff_finance') {
      return (
        <StaffFinanceModule
          language={language}
          staffUser={currentStaff}
        />
      );
    }

    // Default for GATE_STAFF or Super Admin default
    return (
      <GateScannerModule
        language={language}
        staffUser={currentStaff}
        isSuperAdmin={isSuperAdmin}
      />
    );
  };

  // 1. Staff Login Screen (if not logged in)
  if (!currentStaff) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto shadow-md">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Staff Portal Authentication
            </h1>
            <p className="text-xs text-slate-600">
              Authorized Operational Personnel • Police Lines School & College, Faridpur
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Testing Mode Credentials Banner (Development only) */}
          {isDevMode && (
            <div className="p-3 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5 font-medium flex-wrap">
                <span className="font-bold text-sky-950">🧪 Testing Credentials:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">admin@gmail.com</span>
                <span className="text-slate-400">/</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">admin@123</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsernameInput('admin@gmail.com');
                  setPasswordInput('admin@123');
                }}
                className="text-[10px] text-sky-800 bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Auto-fill
              </button>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Staff Username or Email *
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="staff@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Staff Password / PIN *
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{isLoggingIn ? 'Verifying...' : 'Sign In to Assigned Operational Module'}</span>
            </button>
          </form>

          {/* Distinct Staff Login IDs Directory (Development testing helper only) */}
          {isDevMode && (
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  {language === 'bn' ? 'স্টাফদের ভিন্ন ভিন্ন লগইন আইডি ডিরেক্টরি:' : 'Distinct Staff Login IDs Directory:'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {language === 'bn' ? 'ক্লিক করে সিলেক্ট করুন' : 'Click to auto-fill'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    title: 'Gate Entry Staff',
                    id: 'gate@gmail.com',
                    role: 'Gate 01 Scanner Desk',
                    color: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-950',
                  },
                  {
                    title: 'Lunch Pavilion Staff',
                    id: 'food@gmail.com',
                    role: 'Lunch Buffet Pavilion A',
                    color: 'border-orange-200 bg-orange-50/50 hover:bg-orange-100/70 text-orange-950',
                  },
                  {
                    title: 'Breakfast Counter Staff',
                    id: 'breakfast@gmail.com',
                    role: 'Food Pavilion B (Morning)',
                    color: 'border-yellow-200 bg-yellow-50/50 hover:bg-yellow-100/70 text-yellow-950',
                  },
                  {
                    title: 'Dinner Banquet Staff',
                    id: 'dinner@gmail.com',
                    role: 'Gala Dinner Banquet Counter',
                    color: 'border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-purple-950',
                  },
                  {
                    title: 'T-Shirt & Kit Incharge',
                    id: 'dress@gmail.com',
                    role: 'Distribution Booth 03',
                    color: 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-indigo-950',
                  },
                  {
                    title: 'Treasury & Finance',
                    id: 'finance@gmail.com',
                    role: 'Central Accounts Office',
                    color: 'border-cyan-200 bg-cyan-50/50 hover:bg-cyan-100/70 text-cyan-950',
                  },
                  {
                    title: 'Super Administrator',
                    id: 'admin@gmail.com',
                    role: 'Multi-Station Master Desk',
                    color: 'border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-amber-950',
                  },
                ].map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => {
                      setUsernameInput(staff.id);
                      setPasswordInput('admin@123');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${staff.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{staff.title}</span>
                      <span className="text-[10px] font-mono text-slate-500">Test PIN</span>
                    </div>
                    <span className="font-mono text-[11px] font-bold block text-slate-900">{staff.id}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{staff.role}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Authenticated Staff Workspace
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Staff Session Control Strip */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{currentStaff.fullName}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                {currentStaff.role}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Staff ID: <span className="font-mono text-slate-300">{currentStaff.id}</span> • Station: {currentStaff.assignedGate || 'Central'}
            </p>
          </div>
        </div>

        {/* Super Admin Module Switcher */}
        {currentStaff.role === 'SUPER_ADMIN' && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1.5 rounded-2xl border border-slate-700 text-xs">
            {[
              { id: 'multi_station', label: 'Multi-Station Desk', icon: Layers },
              { id: 'gate_scanner', label: 'Gate Entry/Exit', icon: ShieldCheck },
              { id: 'food_breakfast', label: 'Breakfast', icon: Utensils },
              { id: 'food_lunch', label: 'Lunch', icon: Utensils },
              { id: 'food_dinner', label: 'Dinner', icon: Utensils },
              { id: 'dress_distribution', label: 'T-Shirts', icon: Shirt },
              { id: 'staff_finance', label: 'Expense Entry', icon: Wallet },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeAdminModule === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAdminModule(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncDatabase}
            disabled={isSyncingDb}
            title="Synchronize attendee tickets with Supabase cloud database"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncingDb ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncingDb ? 'Syncing...' : 'Sync Database'}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-900 text-emerald-400 text-[10px] font-mono border border-slate-700">
              {totalRegistrationsCount}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-bold border border-rose-700/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Sync Status Toast/Notification */}
      {syncStatusMsg && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 text-xs shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
          <button
            onClick={() => setSyncStatusMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Render the Role-Permitted Module */}
      {getRenderedModule()}
    </div>
  );
};
