import {
  Users,
  CreditCard,
  Utensils,
  ShieldCheck,
  Shirt,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';
import {
  RegistrationRecord,
  Language,
} from '../../types';
import { AppStore } from '../../services/store';
import { EventStore } from '../../services/eventStore';
import {
  aggregateRegistrationAnalytics,
  aggregatePaymentAnalytics,
  calculateCentralBudgetOverview,
} from '../../utils/eventRules';

interface MasterEventOverviewProps {
  language?: Language;
  registrations?: RegistrationRecord[];
  onNavigateTab: (tabId: string) => void;
}

export const MasterEventOverview: React.FC<MasterEventOverviewProps> = ({
  language: _language = 'en',
  registrations: passedRegistrations,
  onNavigateTab,
}) => {
  const registrations = passedRegistrations || AppStore.getRegistrations();
  const foodDistributions = EventStore.getFoodDistributions();
  const gateEvents = EventStore.getGateEvents();
  const dressDistributions = EventStore.getDressDistributions();
  const centralBudget = EventStore.getCentralBudget();
  const staffAllocations = EventStore.getStaffAllocations();
  const staffExpenses = EventStore.getStaffExpenses();
  const financialLedger = EventStore.getFinancialLedger();

  // Registration & Payment Analytics in Asia/Dhaka Timezone
  const regAnalytics = aggregateRegistrationAnalytics(registrations);
  const payAnalytics = aggregatePaymentAnalytics(registrations);

  // Food Metrics
  const breakfastCount = foodDistributions.filter(
    (d) => d.mealType === 'breakfast' && d.status === 'COLLECTED'
  ).length;
  const lunchCount = foodDistributions.filter(
    (d) => d.mealType === 'lunch' && d.status === 'COLLECTED'
  ).length;
  const dinnerCount = foodDistributions.filter(
    (d) => d.mealType === 'dinner' && d.status === 'COLLECTED'
  ).length;

  // Gate Metrics
  const totalEntries = gateEvents.filter((e) => e.eventType === 'ENTRY' && e.status === 'APPROVED').length;
  const totalExits = gateEvents.filter((e) => e.eventType === 'EXIT' && e.status === 'APPROVED').length;
  const uniqueStudents = Array.from(new Set(gateEvents.map((e) => e.registrationId)));
  const currentlyInsideCount = uniqueStudents.filter((id) =>
    EventStore.isStudentCurrentlyInside(id)
  ).length;

  // Dress Metrics
  const dressTotalReceived = dressDistributions.filter((d) => d.status === 'RECEIVED').length;
  const targetTshirtInventory = 10000;
  const remainingDressInventory = Math.max(0, targetTshirtInventory - dressTotalReceived);

  const sizeBreakdownMap: Record<string, number> = {
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
    XXXL: 0,
  };
  registrations.forEach((r) => {
    if (r.tShirtSize && sizeBreakdownMap[r.tShirtSize] !== undefined) {
      sizeBreakdownMap[r.tShirtSize]++;
    }
  });

  // Finance Metrics
  const budgetOverview = calculateCentralBudgetOverview(
    centralBudget.totalBudget,
    staffAllocations,
    staffExpenses,
    financialLedger
  );

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Highlights - Solid Navy Blue */}
      <div className="bg-[#172554] text-white rounded-3xl p-6 sm:p-8 shadow-md border border-blue-900">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950">
                Master Command Dashboard
              </span>
              <span className="text-xs text-slate-400 font-mono">Grand Reunion 2026</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight mt-1">
              Police Lines School & College, Faridpur
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1">
              Authoritative centralized operations hub: real-time monitoring across Registration, Payments, Food distribution, Gate security, Dress kits, and Digital cash ledger.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
            <div className="px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Capacity Target</span>
              <span className="text-base font-black text-amber-300 font-mono">10,000+</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Modules</span>
              <span className="text-base font-black text-emerald-300 font-mono">6 Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 SECTION OPERATIONAL KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. REGISTRATION SECTION */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Student Registration</h3>
                <span className="text-[10px] text-slate-400">Section 1 Overview</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('dailyRegAnalytics')}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-600">Total Registered Students</span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {regAnalytics.totalCount.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold">Today (Dhaka)</span>
                <span className="text-sm font-black text-emerald-700 font-mono">{regAnalytics.todayCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold">Yesterday</span>
                <span className="text-sm font-black text-slate-700 font-mono">{regAnalytics.yesterdayCount}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                Top Graduation Batches:
              </span>
              <div className="space-y-1">
                {regAnalytics.yearBreakdown.slice(0, 3).map((y) => (
                  <div key={y.year} className="flex justify-between text-xs text-slate-600">
                    <span className="truncate">{y.year}</span>
                    <strong className="font-mono text-slate-900">{y.count} registered</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. PAYMENTS SECTION */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Payment Management</h3>
                <span className="text-[10px] text-slate-400">Section 2 Overview</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('dailyPayAnalytics')}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-600">Total Revenue Collected</span>
              <span className="text-2xl font-black text-teal-700 font-mono">
                BDT {payAnalytics.totalAmountCollected.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-100">
                <span className="text-[10px] text-teal-800 block font-bold">Successful Paid</span>
                <span className="text-sm font-black text-teal-950 font-mono">{payAnalytics.totalSuccessfulPayments}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[10px] text-amber-800 block font-bold">Pending Payments</span>
                <span className="text-sm font-black text-amber-950 font-mono">{payAnalytics.pendingCount}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
              <span>Today's Revenue:</span>
              <strong className="font-mono text-slate-900">
                {payAnalytics.todayPaymentsCount} payments verified
              </strong>
            </div>
          </div>
        </div>

        {/* 3. FOOD DISTRIBUTION SECTION */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Food Distribution</h3>
                <span className="text-[10px] text-slate-400">Independent Meals</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('foodManagement')}
              className="text-xs text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Breakfast Served</span>
              <span className="font-mono font-black text-amber-900">{breakfastCount} students</span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Lunch Served</span>
              <span className="font-mono font-black text-amber-900">{lunchCount} students</span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Dinner Served</span>
              <span className="font-mono font-black text-amber-900">{dinnerCount} students</span>
            </div>
          </div>
        </div>

        {/* 4. GATE ENTRY & EXIT SECTION */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-slate-400 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Gate Entry & Exit</h3>
                <span className="text-[10px] text-slate-400">Venue Perimeter</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('gateManagement')}
              className="text-xs text-slate-700 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Logs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  Students Currently Inside
                </span>
                <span className="text-xs text-emerald-600">Active campus presence</span>
              </div>
              <span className="text-2xl font-black text-emerald-950 font-mono">
                {currentlyInsideCount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold">Total Entries</span>
                <span className="text-sm font-black text-slate-900 font-mono">{totalEntries}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold">Total Exits</span>
                <span className="text-sm font-black text-slate-900 font-mono">{totalExits}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. DRESS DISTRIBUTION SECTION */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                <Shirt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Dress Distribution</h3>
                <span className="text-[10px] text-slate-400">Merchandise Desk</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('dressManagement')}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Details</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-600">Total Kits Distributed</span>
              <span className="text-2xl font-black text-indigo-700 font-mono">
                {dressTotalReceived}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>Remaining Warehouse Inventory:</span>
              <strong className="font-mono text-slate-800">{remainingDressInventory.toLocaleString()} pcs</strong>
            </div>

            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                Registered Sizes Demand:
              </span>
              <div className="flex flex-wrap gap-1 text-[10px] font-mono font-bold">
                {Object.entries(sizeBreakdownMap).map(([sz, qty]) => (
                  <span key={sz} className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900">
                    {sz}: {qty}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 6. CENTRAL BUDGET & EXPENSE SECTION */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Event Budget & Ledger</h3>
                <span className="text-[10px] text-slate-400">Digital Cash System</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('budgetManagement')}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-600">Central Event Budget</span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                BDT {budgetOverview.totalCentralBudget.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Allocated to Staff:</span>
                <strong className="font-mono text-slate-900">
                  BDT {budgetOverview.totalAllocatedToStaff.toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Expenses Approved:</span>
                <strong className="font-mono text-emerald-700">
                  BDT {budgetOverview.totalApprovedExpenses.toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-slate-100">
                <span>Unallocated Reserve Balance:</span>
                <span className="font-mono">
                  BDT {budgetOverview.remainingUnallocatedBudget.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
