import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Sparkles,
  Download,
  Search,
  CheckCircle,
  Clock,
  Utensils,
  Ban,
  Printer,
  Eye,
  RefreshCw,
  Camera,
  X,
  Check,
  RotateCcw,
  Sliders,
  Award,
} from 'lucide-react';
import { Language } from '../../../types';
import {
  StaffCard,
  StaffBatch,
  StaffFoodCollection,
  StaffPortalStatistics,
  StaffCardStatus,
  StaffMealType,
} from '../../../types/staffCard';
import { StaffCardService } from '../../../services/staffCardService';
import {
  downloadStaffCardPng,
  downloadIndividualStaffCardPdf,
  downloadStaffBatchPdf,
  downloadStaffBatchZip,
  downloadStaffCardSvg,
} from '../../../utils/staffCardGenerator';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate } from '../../../utils/pagination';
import { QrCameraScanner } from '../../common/QrCameraScanner';

interface StaffCardManagementTabProps {
  language: Language;
  currentAdmin?: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
}

export const StaffCardManagementTab: React.FC<StaffCardManagementTabProps> = ({
  language,
  currentAdmin,
}) => {
  // Data States
  const [cards, setCards] = useState<StaffCard[]>(() => StaffCardService.getStaffCards());
  const [batches, setBatches] = useState<StaffBatch[]>(() => StaffCardService.getStaffBatches());
  const [collections, setCollections] = useState<StaffFoodCollection[]>(() =>
    StaffCardService.getFoodCollections()
  );
  const [stats, setStats] = useState<StaffPortalStatistics>(() =>
    StaffCardService.getStatistics()
  );

  // Card Generation States
  const [generateQuantity, setGenerateQuantity] = useState<number>(10);
  const [generateCategory, setGenerateCategory] = useState<string>('Event Operations');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [batchNote, setBatchNote] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSuccess, setGenerationSuccess] = useState<{
    batch: StaffBatch;
    cardsCount: number;
  } | null>(null);

  // Table Filtering & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StaffCardStatus>('ALL');
  const [mealFilter, setMealFilter] = useState<'ALL' | StaffMealType>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Action States
  const [selectedCardForInspection, setSelectedCardForInspection] = useState<StaffCard | null>(null);
  const [cardToActivate, setCardToActivate] = useState<StaffCard | null>(null);
  const [cardToEditEntitlements, setCardToEditEntitlements] = useState<StaffCard | null>(null);
  const [cardToRevoke, setCardToRevoke] = useState<StaffCard | null>(null);
  const [revocationReason, setRevocationReason] = useState('Administrative Decision');

  // Activation Form Fields
  const [actStaffName, setActStaffName] = useState('');
  const [actDesignation, setActDesignation] = useState('Volunteer');
  const [actMobileNumber, setActMobileNumber] = useState('');
  const [actDepartment, setActDepartment] = useState('Operations');
  const [actNotes, setActNotes] = useState('');
  const [actMealFacilities, setActMealFacilities] = useState<StaffMealType[]>([
    'breakfast',
    'lunch',
    'dinner',
  ]);

  // Edit Entitlements Form Field
  const [editMealFacilities, setEditMealFacilities] = useState<StaffMealType[]>([]);

  // Super Admin Scanner Modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerManualInput, setScannerManualInput] = useState('');
  const [scannerFeedback, setScannerFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Refresh local state from service
  const refreshData = () => {
    setCards(StaffCardService.getStaffCards());
    setBatches(StaffCardService.getStaffBatches());
    setCollections(StaffCardService.getFoodCollections());
    setStats(StaffCardService.getStatistics());
  };

  useEffect(() => {
    StaffCardService.syncWithSupabase().then(refreshData);

    const onUpdate = () => refreshData();
    window.addEventListener('plscf_staff_cards_updated', onUpdate);
    window.addEventListener('plscf_staff_food_sync', onUpdate);

    return () => {
      window.removeEventListener('plscf_staff_cards_updated', onUpdate);
      window.removeEventListener('plscf_staff_food_sync', onUpdate);
    };
  }, []);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = card.id.toLowerCase().includes(q);
        const matchesReg = card.regNumber.toLowerCase().includes(q);
        const matchesToken = card.token.toLowerCase().includes(q);
        const matchesName = card.staffName?.toLowerCase().includes(q);
        const matchesDesig = card.designation?.toLowerCase().includes(q);
        const matchesMobile = card.mobileNumber?.toLowerCase().includes(q);
        const matchesDept = card.department?.toLowerCase().includes(q);
        if (!matchesId && !matchesReg && !matchesToken && !matchesName && !matchesDesig && !matchesMobile && !matchesDept) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL' && card.status !== statusFilter) {
        return false;
      }

      // Meal Filter
      if (mealFilter !== 'ALL' && !card.mealFacilities.includes(mealFilter)) {
        return false;
      }

      // Batch Filter
      if (batchFilter !== 'ALL' && card.batchId !== batchFilter) {
        return false;
      }

      return true;
    });
  }, [cards, searchQuery, statusFilter, mealFilter, batchFilter]);

  // Bulk Generation Handler
  const handleGenerateCards = async () => {
    if (generateQuantity < 1) return;
    setIsGenerating(true);
    setGenerationSuccess(null);

    const effectiveCategory =
      generateCategory === 'OTHER' ? customCategory.trim() || 'Staff' : generateCategory;

    const res = await StaffCardService.generateBatch(
      generateQuantity,
      effectiveCategory,
      currentAdmin?.fullName || 'Super Admin',
      batchNote.trim() || undefined
    );

    setIsGenerating(false);

    if (res.success && res.batch && res.cards) {
      setGenerationSuccess({
        batch: res.batch,
        cardsCount: res.cards.length,
      });
      refreshData();
    }
  };

  // Open Activation Modal for a card
  const openActivationModal = (card: StaffCard) => {
    setCardToActivate(card);
    setActStaffName(card.staffName || '');
    setActDesignation(card.designation || card.category || 'Event Volunteer');
    setActMobileNumber(card.mobileNumber || '');
    setActDepartment(card.department || 'Operations');
    setActNotes(card.notes || '');
    setActMealFacilities(
      card.mealFacilities.length > 0 ? [...card.mealFacilities] : ['breakfast', 'lunch', 'dinner']
    );
  };

  // Submit Activation & Configuration
  const handleConfirmActivation = async () => {
    if (!cardToActivate) return;

    const res = await StaffCardService.activateStaffCard(
      cardToActivate.id,
      cardToActivate.token,
      {
        staffName: actStaffName.trim() || 'Staff Member',
        designation: actDesignation.trim() || 'Event Volunteer',
        mobileNumber: actMobileNumber.trim() || undefined,
        department: actDepartment.trim() || 'Operations',
        notes: actNotes.trim() || undefined,
        mealFacilities: actMealFacilities,
      },
      'Super Admin Desk',
      currentAdmin?.id || 'SUPER_ADMIN',
      currentAdmin?.fullName || 'Super Admin'
    );

    if (res.success) {
      setCardToActivate(null);
      refreshData();
      setScannerFeedback({
        type: 'success',
        message: `Staff Card "${cardToActivate.id}" successfully activated with assigned meals.`,
      });
    }
  };

  // Open Edit Entitlements Modal
  const openEditEntitlementsModal = (card: StaffCard) => {
    setCardToEditEntitlements(card);
    setEditMealFacilities([...card.mealFacilities]);
  };

  // Save Updated Entitlements
  const handleSaveEntitlements = async () => {
    if (!cardToEditEntitlements) return;
    await StaffCardService.updateEntitlements(
      cardToEditEntitlements.id,
      editMealFacilities,
      currentAdmin?.fullName || 'Super Admin'
    );
    setCardToEditEntitlements(null);
    refreshData();
  };

  // Revocation Handler
  const handleConfirmRevocation = async () => {
    if (!cardToRevoke) return;
    await StaffCardService.revokeCard(
      cardToRevoke.id,
      revocationReason,
      currentAdmin?.fullName || 'Super Admin'
    );
    setCardToRevoke(null);
    refreshData();
  };

  // Reactivate Handler
  const handleReactivate = async (cardId: string) => {
    await StaffCardService.reactivateCard(cardId, currentAdmin?.fullName || 'Super Admin');
    refreshData();
  };

  // Handle Scanning in Super Admin modal
  const handleSuperAdminScan = async (scannedCode: string) => {
    const card = await StaffCardService.findStaffCardByCode(scannedCode);
    if (!card) {
      setScannerFeedback({
        type: 'error',
        message: `No staff card found for input: "${scannedCode}". Verify ID or QR token.`,
      });
      return;
    }

    setIsScannerOpen(false);
    openActivationModal(card);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-amber-900 via-amber-800 to-yellow-950 text-white shadow-xl border border-amber-600/30 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-amber-950">
              STAFF SUITE
            </span>
            <span className="text-xs text-amber-200 font-bold">Official Badges & Meal Entitlements</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-yellow-400" />
            <span>Staff Card Generation, Activation & Entitlement System</span>
          </h1>
          <p className="text-xs sm:text-sm text-amber-100/90 max-w-2xl mt-1 leading-relaxed">
            Generate dedicated Yellow Staff ID Badges in bulk, scan cards on-site for immediate activation, assign
            personalized Breakfast, Lunch, or Dinner entitlements, and monitor real-time distribution logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setScannerFeedback(null);
              setScannerManualInput('');
              setIsScannerOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer transform active:scale-95"
          >
            <Camera className="w-4 h-4 text-slate-950" />
            <span>Scan Card to Activate / Configure</span>
          </button>

          <button
            onClick={() => StaffCardService.syncWithSupabase().then(refreshData)}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Sync with Supabase"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Generated</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">{stats.totalGenerated}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Staff badges created</span>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Staff</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <span className="text-2xl font-black text-emerald-700">{stats.totalActive}</span>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Activated & Verified</span>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Inactive</span>
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-2xl font-black text-amber-700">{stats.totalInactive}</span>
          <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Awaiting activation scan</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-xs">
          <div className="flex items-center justify-between text-sky-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Breakfast</span>
            <Utensils className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-sky-700">{stats.totalBreakfastCollected}</span>
            <span className="text-xs text-slate-400 font-bold">/ {stats.totalBreakfastEligible}</span>
          </div>
          <span className="text-[10px] text-sky-600 block mt-0.5 font-medium">Claimed / Assigned</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-orange-200 shadow-xs">
          <div className="flex items-center justify-between text-orange-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lunch</span>
            <Utensils className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-orange-700">{stats.totalLunchCollected}</span>
            <span className="text-xs text-slate-400 font-bold">/ {stats.totalLunchEligible}</span>
          </div>
          <span className="text-[10px] text-orange-600 block mt-0.5 font-medium">Claimed / Assigned</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Dinner</span>
            <Utensils className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-700">{stats.totalDinnerCollected}</span>
            <span className="text-xs text-slate-400 font-bold">/ {stats.totalDinnerEligible}</span>
          </div>
          <span className="text-[10px] text-indigo-600 block mt-0.5 font-medium">Claimed / Assigned</span>
        </div>
      </div>

      {/* 3. Bulk Generator & Batch Control Panel */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Bulk Staff Card Generator</h2>
              <p className="text-xs text-slate-500">
                Generate batches of unique, serialized staff ID cards with secure QR tokens.
              </p>
            </div>
          </div>

          {batches.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadStaffBatchPdf(cards, 'All_Staff_Cards')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-yellow-400" />
                <span>Download All A4 PDF</span>
              </button>
              <button
                onClick={() => downloadStaffBatchZip(cards, 'All_Staff_Cards_PNG')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-950" />
                <span>Export ZIP</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Number of Cards</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 20, 50].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setGenerateQuantity(qty)}
                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    generateQuantity === qty
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Custom Quantity</label>
            <input
              type="number"
              min="1"
              max="500"
              value={generateQuantity}
              onChange={(e) => setGenerateQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              placeholder="e.g. 25"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Department / Category</label>
            <select
              value={generateCategory}
              onChange={(e) => setGenerateCategory(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="Event Operations">Event Operations</option>
              <option value="Security & Discipline">Security & Discipline</option>
              <option value="Food & Catering">Food & Catering</option>
              <option value="Gate Control & Scanner">Gate Control & Scanner</option>
              <option value="Stage & Cultural Program">Stage & Cultural Program</option>
              <option value="General Volunteer">General Volunteer</option>
              <option value="OTHER">Other Custom Role</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Batch Name (Optional)</label>
            <input
              type="text"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              placeholder="e.g. Volunteer Shift A"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        {generateCategory === 'OTHER' && (
          <div className="max-w-md">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Specify Custom Category Name</label>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Medical Response Team"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
          <p className="text-xs text-slate-500">
            All generated cards will initially be <span className="font-bold text-amber-700">INACTIVE</span>. Scan
            any card to activate and assign meal entitlements.
          </p>

          <button
            onClick={handleGenerateCards}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating {generateQuantity} Cards...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate {generateQuantity} Staff Cards</span>
              </>
            )}
          </button>
        </div>

        {generationSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-emerald-900">
                  Successfully generated {generationSuccess.cardsCount} Staff Cards!
                </h4>
                <p className="text-[11px] text-emerald-700">
                  Batch: {generationSuccess.batch.batchName} ({generationSuccess.batch.id})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const bCards = cards.filter((c) => c.batchId === generationSuccess.batch.id);
                  downloadStaffBatchPdf(bCards, generationSuccess.batch.batchName);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
              >
                Print Batch PDF
              </button>
              <button
                onClick={() => setGenerationSuccess(null)}
                className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Directory & Entitlements Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        {/* Table Filter Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Staff ID, Card Number, Name, Department..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Verified)</option>
              <option value="INACTIVE">Inactive (Pending)</option>
              <option value="REVOKED">Revoked</option>
            </select>

            <select
              value={mealFilter}
              onChange={(e) => {
                setMealFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Meals</option>
              <option value="breakfast">With Breakfast</option>
              <option value="lunch">With Lunch</option>
              <option value="dinner">With Dinner</option>
            </select>

            {batches.length > 0 && (
              <select
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 max-w-[180px] truncate"
              >
                <option value="ALL">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Staff Card ID</th>
                <th className="py-3 px-4">Staff Member & Role</th>
                <th className="py-3 px-4">Department & Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Meals</th>
                <th className="py-3 px-4">Activation Audit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold">No staff cards found matching your criteria.</p>
                    <p className="text-[11px] mt-0.5">Generate cards using the bulk generator above.</p>
                  </td>
                </tr>
              ) : (
                paginate(filteredCards, currentPage, pageSize).map((card) => {
                  const hasBreakfast = card.mealFacilities.includes('breakfast');
                  const hasLunch = card.mealFacilities.includes('lunch');
                  const hasDinner = card.mealFacilities.includes('dinner');

                  const isBCollected = collections.some(
                    (c) => c.cardId === card.id && c.mealType === 'breakfast'
                  );
                  const isLCollected = collections.some(
                    (c) => c.cardId === card.id && c.mealType === 'lunch'
                  );
                  const isDCollected = collections.some(
                    (c) => c.cardId === card.id && c.mealType === 'dinner'
                  );

                  return (
                    <tr key={card.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-slate-900">{card.id}</div>
                        <div className="font-mono text-[10px] text-slate-400">{card.token}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {card.staffName || (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </div>
                        <div className="text-[11px] text-amber-700 font-semibold">
                          {card.designation || card.category}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-semibold">{card.department || '—'}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {card.mobileNumber || '—'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {card.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> ACTIVE
                          </span>
                        ) : card.status === 'REVOKED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                            <Ban className="w-3 h-3 text-rose-600" /> REVOKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" /> INACTIVE
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Breakfast Badge */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isBCollected
                                ? 'bg-emerald-600 text-white'
                                : hasBreakfast
                                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                : 'bg-slate-100 text-slate-400 line-through'
                            }`}
                            title={isBCollected ? 'Collected' : hasBreakfast ? 'Authorized' : 'Not Assigned'}
                          >
                            B {isBCollected && '✓'}
                          </span>

                          {/* Lunch Badge */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isLCollected
                                ? 'bg-emerald-600 text-white'
                                : hasLunch
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : 'bg-slate-100 text-slate-400 line-through'
                            }`}
                            title={isLCollected ? 'Collected' : hasLunch ? 'Authorized' : 'Not Assigned'}
                          >
                            L {isLCollected && '✓'}
                          </span>

                          {/* Dinner Badge */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isDCollected
                                ? 'bg-emerald-600 text-white'
                                : hasDinner
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : 'bg-slate-100 text-slate-400 line-through'
                            }`}
                            title={isDCollected ? 'Collected' : hasDinner ? 'Authorized' : 'Not Assigned'}
                          >
                            D {isDCollected && '✓'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {card.isActivated && card.activatedAt ? (
                          <div>
                            <div className="text-[11px] font-bold text-slate-700">
                              {new Date(card.activatedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              at{' '}
                              {new Date(card.activatedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              by {card.activatedByStaffName || 'Admin'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not activated</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {card.status === 'INACTIVE' ? (
                            <button
                              onClick={() => openActivationModal(card)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black shadow-xs cursor-pointer"
                            >
                              Activate & Assign
                            </button>
                          ) : (
                            <button
                              onClick={() => openEditEntitlementsModal(card)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                              title="Edit Meal Entitlements"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedCardForInspection(card)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="Inspect Card & Download Badge"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {card.status === 'ACTIVE' ? (
                            <button
                              onClick={() => setCardToRevoke(card)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                              title="Revoke Card"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          ) : card.status === 'REVOKED' ? (
                            <button
                              onClick={() => handleReactivate(card.id)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 cursor-pointer"
                              title="Reactivate Card"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <GlobalPagination
          currentPage={currentPage}
          totalRecords={filteredCards.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          language={language}
        />
      </div>

      {/* MODAL 1: SCAN CARD TO ACTIVATE / CONFIGURE */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-600" />
                <span>Scan Staff Card to Activate</span>
              </h3>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Hold the physical Yellow Staff Card in front of the camera, or enter the Card ID or Token manually
              to open the configuration interface.
            </p>

            {/* Camera View */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
              <QrCameraScanner
                onScan={handleSuperAdminScan}
                onClose={() => setIsScannerOpen(false)}
                language={language}
                themeColor="amber"
                title={language === 'bn' ? 'স্টাফ কার্ড ক্যামেরা' : 'Staff Card Camera'}
              />
            </div>

            {/* Manual Fallback Input */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">Manual Card Number or Token Input</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scannerManualInput}
                  onChange={(e) => setScannerManualInput(e.target.value)}
                  placeholder="e.g. STF-0001 or STF-9X4M2K"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => handleSuperAdminScan(scannerManualInput)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                >
                  Lookup
                </button>
              </div>
            </div>

            {scannerFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  scannerFeedback.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {scannerFeedback.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: STAFF CARD ACTIVATION & ENTITLEMENT CONFIGURATION */}
      {cardToActivate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                  STAFF ACTIVATION & ENTITLEMENTS
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Configure & Activate Card {cardToActivate.id}
                </h3>
              </div>
              <button
                onClick={() => setCardToActivate(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Staff Member Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={actStaffName}
                  onChange={(e) => setActStaffName(e.target.value)}
                  placeholder="e.g. Arif Hossain"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Designation / Role <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={actDesignation}
                  onChange={(e) => setActDesignation(e.target.value)}
                  placeholder="e.g. Security Lead / Volunteer"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mobile / Phone Number</label>
                <input
                  type="text"
                  value={actMobileNumber}
                  onChange={(e) => setActMobileNumber(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Department</label>
                <input
                  type="text"
                  value={actDepartment}
                  onChange={(e) => setActDepartment(e.target.value)}
                  placeholder="e.g. Gate Operations"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Station / Notes</label>
              <input
                type="text"
                value={actNotes}
                onChange={(e) => setActNotes(e.target.value)}
                placeholder="e.g. Main Gate Entrance - Shift 1"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
              />
            </div>

            {/* Requirement 3: Individual Meal Entitlement Assignment */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-4 h-4 text-amber-700" />
                    <span>Meal Facilities & Entitlement Assignment</span>
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Select which meals this specific staff card is authorized to receive:
                  </p>
                </div>

                <div className="flex gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setActMealFacilities(['breakfast', 'lunch', 'dinner'])}
                    className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold hover:bg-amber-300 cursor-pointer"
                  >
                    All 3
                  </button>
                  <button
                    type="button"
                    onClick={() => setActMealFacilities([])}
                    className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 cursor-pointer"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {(['breakfast', 'lunch', 'dinner'] as StaffMealType[]).map((m) => {
                  const isChecked = actMealFacilities.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setActMealFacilities(actMealFacilities.filter((x) => x !== m));
                        } else {
                          setActMealFacilities([...actMealFacilities, m]);
                        }
                      }}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        isChecked
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 font-semibold hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider">
                        <Check className={`w-3.5 h-3.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                        <span>{m}</span>
                      </div>
                      <span className="text-[10px] opacity-80">
                        {isChecked ? 'Authorized' : 'Excluded'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-amber-700 italic">
                * The global Food Portal schedule governs when each meal scanner is active. When scanning at
                the food desk, this card will only be accepted for authorized meals.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCardToActivate(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmActivation}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Save Configuration & Activate Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT ENTITLEMENTS ONLY */}
      {cardToEditEntitlements && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Update Meal Entitlements
                </h3>
                <p className="text-xs text-slate-500">
                  Card {cardToEditEntitlements.id} ({cardToEditEntitlements.staffName || 'Staff'})
                </p>
              </div>
              <button
                onClick={() => setCardToEditEntitlements(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2">
              {(['breakfast', 'lunch', 'dinner'] as StaffMealType[]).map((m) => {
                const isChecked = editMealFacilities.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (isChecked) {
                        setEditMealFacilities(editMealFacilities.filter((x) => x !== m));
                      } else {
                        setEditMealFacilities([...editMealFacilities, m]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isChecked
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                        : 'bg-slate-50 text-slate-500 border-slate-200 font-semibold'
                    }`}
                  >
                    <span className="text-xs font-black uppercase">{m}</span>
                    <span className="text-[10px]">{isChecked ? 'Active' : 'Off'}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCardToEditEntitlements(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEntitlements}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer"
              >
                Apply Live
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CARD INSPECTION & PRINT/DOWNLOAD */}
      {selectedCardForInspection && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  STAFF ID BADGE INSPECTOR
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedCardForInspection.id} — {selectedCardForInspection.staffName || 'Staff Member'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCardForInspection(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card Summary Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Designation</span>
                <span className="font-bold text-slate-800">
                  {selectedCardForInspection.designation || 'Volunteer'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Department</span>
                <span className="font-bold text-slate-800">
                  {selectedCardForInspection.department || 'Operations'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Mobile</span>
                <span className="font-bold text-slate-800">
                  {selectedCardForInspection.mobileNumber || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className="font-bold text-amber-700">
                  {selectedCardForInspection.status}
                </span>
              </div>
            </div>

            {/* Meal Facilities */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Authorized Meal Entitlements:
              </span>
              <div className="flex gap-2">
                {(['breakfast', 'lunch', 'dinner'] as StaffMealType[]).map((m) => {
                  const hasMeal = selectedCardForInspection.mealFacilities.includes(m);
                  const isClaimed = collections.some(
                    (c) => c.cardId === selectedCardForInspection.id && c.mealType === m
                  );
                  return (
                    <div
                      key={m}
                      className={`flex-1 p-2.5 rounded-xl border text-center ${
                        isClaimed
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-black'
                          : hasMeal
                          ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                      }`}
                    >
                      <div className="uppercase text-[10px]">{m}</div>
                      <div className="text-[9px] mt-0.5">
                        {isClaimed ? 'Claimed' : hasMeal ? 'Available' : 'No'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export & Download Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => downloadStaffCardSvg(selectedCardForInspection)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                SVG
              </button>
              <button
                onClick={() => downloadStaffCardPng(selectedCardForInspection)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                PNG
              </button>
              <button
                onClick={() => downloadIndividualStaffCardPdf(selectedCardForInspection)}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-colors cursor-pointer text-center"
              >
                Print PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REVOKE CARD */}
      {cardToRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              <span>Revoke Staff Card {cardToRevoke.id}</span>
            </h3>

            <p className="text-xs text-slate-600">
              Revoking this card will immediately block all food collections and gate access. Historical records
              will be preserved in audit logs.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Revocation</label>
              <input
                type="text"
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setCardToRevoke(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevocation}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
