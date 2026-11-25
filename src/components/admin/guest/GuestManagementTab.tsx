import React, { useState, useEffect, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  QrCode,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DoorOpen,
  Utensils,
  Ban,
  ShieldAlert,
  FileArchive,
  Printer,
  Eye,
  RefreshCw,
  Camera,
  X,
} from 'lucide-react';
import { Language } from '../../../types';
import {
  GuestCard,
  GuestBatch,
  GuestGateActivation,
  GuestFoodCollection,
  GuestPortalStatistics,
  GuestCardStatus,
} from '../../../types/guest';
import { GuestService } from '../../../services/guestService';
import {
  downloadGuestCardPng,
  downloadIndividualGuestCardPdf,
  downloadGuestBatchPdf,
  downloadGuestBatchZip,
} from '../../../utils/guestCardGenerator';
import { parseScannedInput, getCleanPassDisplayLabel } from '../../../utils/tokenGenerator';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate } from '../../../utils/pagination';
import { QrCameraScanner } from '../../common/QrCameraScanner';

interface GuestManagementTabProps {
  language: Language;
  currentAdmin?: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
}

export const GuestManagementTab: React.FC<GuestManagementTabProps> = ({
  language,
  currentAdmin,
}) => {
  // Data States
  const [cards, setCards] = useState<GuestCard[]>(() => GuestService.getGuestCards());
  const [batches, setBatches] = useState<GuestBatch[]>(() => GuestService.getGuestBatches());
  const [activations, setActivations] = useState<GuestGateActivation[]>(() =>
    GuestService.getGateActivations()
  );
  const [collections, setCollections] = useState<GuestFoodCollection[]>(() =>
    GuestService.getFoodCollections()
  );
  const [stats, setStats] = useState<GuestPortalStatistics>(() =>
    GuestService.getStatistics()
  );

  // Card Generation States
  const [generateQuantity, setGenerateQuantity] = useState<number>(20);
  const [generateCategory, setGenerateCategory] = useState<string>('Honorary Guest');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [batchNote, setBatchNote] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSuccess, setGenerationSuccess] = useState<{
    batch: GuestBatch;
    cardsCount: number;
  } | null>(null);

  // Table Filtering & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | GuestCardStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Action States
  const [selectedCardForInspection, setSelectedCardForInspection] = useState<GuestCard | null>(null);
  const [cardToRevoke, setCardToRevoke] = useState<GuestCard | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Admin Guest Scanner Modal States (Requirement 5)
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerCameraActive, setScannerCameraActive] = useState(false);
  const [adminScanQuery, setAdminScanQuery] = useState('');
  const [adminScannedGuest, setAdminScannedGuest] = useState<GuestCard | null>(null);
  const [adminScannedFacilities, setAdminScannedFacilities] = useState<any | null>(null);
  const [adminScanError, setAdminScanError] = useState<string | null>(null);

  // Refresh all state from local cache and trigger background Supabase sync
  const refreshData = () => {
    setCards(GuestService.getGuestCards());
    setBatches(GuestService.getGuestBatches());
    setActivations(GuestService.getGateActivations());
    setCollections(GuestService.getFoodCollections());
    setStats(GuestService.getStatistics());
  };

  useEffect(() => {
    GuestService.syncWithSupabase().then(refreshData);

    const onGuestSync = () => refreshData();
    window.addEventListener('plscf_guest_sync', onGuestSync);
    window.addEventListener('plscf_all_stations_synced', onGuestSync);
    return () => {
      window.removeEventListener('plscf_guest_sync', onGuestSync);
      window.removeEventListener('plscf_all_stations_synced', onGuestSync);
    };
  }, []);

  // Filtered Cards List
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Search by ID, Registration Number, or Token
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = card.id.toLowerCase().includes(q);
        const matchesReg = card.regNumber.toLowerCase().includes(q);
        const matchesToken = card.token.toLowerCase().includes(q);
        const matchesCat = card.category.toLowerCase().includes(q);
        if (!matchesId && !matchesReg && !matchesToken && !matchesCat) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL' && card.status !== statusFilter) {
        return false;
      }

      // Category Filter
      if (categoryFilter !== 'ALL' && card.category !== categoryFilter) {
        return false;
      }

      // Batch Filter
      if (batchFilter !== 'ALL' && card.batchId !== batchFilter) {
        return false;
      }

      return true;
    });
  }, [cards, searchQuery, statusFilter, categoryFilter, batchFilter]);

  // Unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => set.add(c.category));
    return Array.from(set);
  }, [cards]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, batchFilter]);

  // Handle Generate Guest Cards (Requirement 1 & 7)
  const handleGenerateCards = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const qty = Number(generateQuantity);
    if (!qty || qty <= 0 || qty > 1000) {
      setFeedbackNotice({
        type: 'error',
        message: 'Invalid quantity: Please enter between 1 and 1000 cards.',
      });
      return;
    }

    const cat = generateCategory === 'CUSTOM' ? customCategory.trim() : generateCategory;
    if (!cat) {
      setFeedbackNotice({
        type: 'error',
        message: 'Please specify a guest category.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await GuestService.generateBatch(
        qty,
        cat,
        currentAdmin?.fullName || currentAdmin?.username || 'Super Admin',
        batchNote.trim() || undefined
      );

      if (res.success && res.batch && res.cards) {
        refreshData();
        setGenerationSuccess({
          batch: res.batch,
          cardsCount: res.cards.length,
        });
        setFeedbackNotice({
          type: 'success',
          message: `Successfully generated ${res.cards.length} unique guest cards for Batch ${res.batch.id}!`,
        });
        setBatchNote('');
      } else {
        setFeedbackNotice({
          type: 'error',
          message: res.error || 'Failed to generate guest cards.',
        });
      }
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: err?.message || 'Error occurred during guest card generation.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Revoke Card (Requirement 7)
  const handleConfirmRevoke = async () => {
    if (!cardToRevoke) return;
    if (!revocationReason.trim()) {
      setFeedbackNotice({
        type: 'error',
        message: 'A mandatory audit reason is required to revoke a guest card.',
      });
      return;
    }

    setIsRevoking(true);
    try {
      const res = await GuestService.revokeCard(
        cardToRevoke.id,
        revocationReason.trim(),
        currentAdmin?.id || 'SUPER_ADMIN',
        currentAdmin?.fullName || currentAdmin?.username || 'Super Admin'
      );

      if (res.success) {
        refreshData();
        setFeedbackNotice({
          type: 'success',
          message: `Guest card ${cardToRevoke.id} has been REVOKED. Historical logs preserved.`,
        });
        setCardToRevoke(null);
        setRevocationReason('');
        if (selectedCardForInspection?.id === cardToRevoke.id) {
          const updated = GuestService.getGuestCards().find((c) => c.id === cardToRevoke.id);
          setSelectedCardForInspection(updated || null);
        }
      } else {
        setFeedbackNotice({
          type: 'error',
          message: res.error || 'Failed to revoke guest card.',
        });
      }
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: err?.message || 'Error during card revocation.',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  // Handle Batch A4 PDF Download
  const handleDownloadBatchPdf = async (batch: GuestBatch) => {
    setDownloadingBatchId(batch.id);
    try {
      const batchCards = cards.filter((c) => c.batchId === batch.id);
      await downloadGuestBatchPdf(batchCards, batch.batchName || batch.id);
      setFeedbackNotice({
        type: 'success',
        message: `Printable A4 PDF sheet downloaded for Batch ${batch.id}.`,
      });
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: `Failed to generate PDF: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setDownloadingBatchId(null);
    }
  };

  // Handle Batch ZIP Download
  const handleDownloadBatchZip = async (batch: GuestBatch) => {
    setDownloadingBatchId(batch.id);
    try {
      const batchCards = cards.filter((c) => c.batchId === batch.id);
      await downloadGuestBatchZip(batch, batchCards);
      setFeedbackNotice({
        type: 'success',
        message: `ZIP bundle (individual PNGs + A4 PDF + manifest) downloaded for Batch ${batch.id}.`,
      });
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: `Failed to generate ZIP: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setDownloadingBatchId(null);
    }
  };

  // Admin QR Scanner Inspection (Requirement 5)
  const handleAdminScanLookup = async (code: string) => {
    if (!code.trim()) return;
    const clean = code.trim();
    const parsed = parseScannedInput(clean);
    const cleanLabel = getCleanPassDisplayLabel(clean, parsed);
    const lookupKey = parsed.id || parsed.regNumber || (clean.startsWith('{') ? '' : clean);
    const expectedToken = parsed.token;

    setAdminScanError(null);
    const guest = await GuestService.findGuestByCode(lookupKey || clean, expectedToken);
    if (!guest) {
      setAdminScannedGuest(null);
      setAdminScannedFacilities(null);
      setAdminScanError(`No guest card found matching "${cleanLabel}".`);
      return;
    }

    const facilities = GuestService.getMealFacilities(guest.id);
    setAdminScannedGuest(guest);
    setAdminScannedFacilities(facilities);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* ── TOP HEADER BAR ── */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-amber-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" />
              <span>Super Admin Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {language === 'bn'
                ? 'গেস্ট পাস ও খাবার বিতরণ ব্যবস্থাপনা'
                : 'Dynamic Guest Pass & Food Management System'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              {language === 'bn'
                ? 'স্বয়ংক্রিয় গেস্ট কার্ড জেনারেটর, প্রিন্ট-রেডি ব্যাচ ডাউনলোড (ZIP & A4 PDF), মেইন গেইট অ্যাক্টিভেশন ও স্বাধীন ৩-বেলা খাবার ট্র্যাকিং।'
                : 'Generate cryptographic guest passes, download high-res PNG & A4 print sheets, gate activation control, and independent 3-meal tracking.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsScannerModalOpen(true);
                setAdminScannedGuest(null);
                setAdminScanError(null);
              }}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Admin Guest Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => {
                refreshData();
                GuestService.syncWithSupabase().then(refreshData);
                setFeedbackNotice({
                  type: 'info',
                  message: 'Synchronized with cloud database.',
                });
                setTimeout(() => setFeedbackNotice(null), 3000);
              }}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 border border-white/10"
              title="Sync Cloud"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Sync Cloud</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── NOTIFICATION ALERT BANNER ── */}
      {feedbackNotice && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-sm ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : feedbackNotice.type === 'error'
              ? 'bg-rose-50 border border-rose-300 text-rose-900'
              : 'bg-blue-50 border border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : feedbackNotice.type === 'error' ? (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span>{feedbackNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── SECTION 1: 8 KEY METRIC STATISTIC TILES (Requirement 6) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total Generated */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Cards</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono">{stats.totalGenerated}</p>
          <span className="text-[9px] text-slate-400 block font-medium">All Batches</span>
        </div>

        {/* Total Active */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Active</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-emerald-700 font-mono">{stats.totalActive}</p>
          <span className="text-[9px] text-emerald-600 block font-medium">
            {stats.totalGenerated > 0
              ? `${Math.round((stats.totalActive / stats.totalGenerated) * 100)}% of total`
              : '0%'}
          </span>
        </div>

        {/* Total Inactive */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Inactive</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-amber-700 font-mono">{stats.totalInactive}</p>
          <span className="text-[9px] text-amber-600 block font-medium">Pending Gate Scan</span>
        </div>

        {/* Gate Entered */}
        <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Gate Entered</span>
            <DoorOpen className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-blue-700 font-mono">{stats.totalGateEntered}</p>
          <span className="text-[9px] text-blue-600 block font-medium">
            {activations.length} Scans Logged
          </span>
        </div>

        {/* Breakfast Collections */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Breakfast</span>
            <Utensils className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono">{stats.totalBreakfast}</p>
          <span className="text-[9px] text-slate-400 block font-medium">
            {stats.totalActive > 0
              ? `${Math.round((stats.totalBreakfast / stats.totalActive) * 100)}% collected`
              : '0%'}
          </span>
        </div>

        {/* Lunch Collections */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Lunch</span>
            <Utensils className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono">{stats.totalLunch}</p>
          <span className="text-[9px] text-slate-400 block font-medium">
            {stats.totalActive > 0
              ? `${Math.round((stats.totalLunch / stats.totalActive) * 100)}% collected`
              : '0%'}
          </span>
        </div>

        {/* Dinner Collections */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Dinner</span>
            <Utensils className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono">{stats.totalDinner}</p>
          <span className="text-[9px] text-slate-400 block font-medium">
            {stats.totalActive > 0
              ? `${Math.round((stats.totalDinner / stats.totalActive) * 100)}% collected`
              : '0%'}
          </span>
        </div>

        {/* Revoked Passes */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[10px] font-black uppercase tracking-wider">Revoked</span>
            <Ban className="w-4 h-4" />
          </div>
          <p className="text-xl font-black text-rose-700 font-mono">{stats.totalRevoked}</p>
          <span className="text-[9px] text-rose-600 block font-medium">Security Revoked</span>
        </div>
      </div>

      {/* ── VISUAL PROGRESS & CHARTS (Requirement 6) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card Activation Progress */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">Generated vs Activated</span>
            <span className="font-mono font-black text-slate-900">
              {stats.totalActive} / {stats.totalGenerated}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  stats.totalGenerated > 0
                    ? Math.min(100, (stats.totalActive / stats.totalGenerated) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Inactive: {stats.totalInactive}</span>
            <span>
              {stats.totalGenerated > 0
                ? `${Math.round((stats.totalActive / stats.totalGenerated) * 100)}% Activated`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Breakfast Collection Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">Breakfast Progress</span>
            <span className="font-mono font-black text-amber-700">
              {stats.totalBreakfast} / {stats.totalActive}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  stats.totalActive > 0
                    ? Math.min(100, (stats.totalBreakfast / stats.totalActive) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Remaining: {Math.max(0, stats.totalActive - stats.totalBreakfast)}</span>
            <span>
              {stats.totalActive > 0
                ? `${Math.round((stats.totalBreakfast / stats.totalActive) * 100)}% Collected`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Lunch Collection Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">Lunch Progress</span>
            <span className="font-mono font-black text-amber-700">
              {stats.totalLunch} / {stats.totalActive}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-amber-600 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  stats.totalActive > 0
                    ? Math.min(100, (stats.totalLunch / stats.totalActive) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Remaining: {Math.max(0, stats.totalActive - stats.totalLunch)}</span>
            <span>
              {stats.totalActive > 0
                ? `${Math.round((stats.totalLunch / stats.totalActive) * 100)}% Collected`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Dinner Collection Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-600">Dinner Progress</span>
            <span className="font-mono font-black text-amber-700">
              {stats.totalDinner} / {stats.totalActive}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-amber-700 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  stats.totalActive > 0
                    ? Math.min(100, (stats.totalDinner / stats.totalActive) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Remaining: {Math.max(0, stats.totalActive - stats.totalDinner)}</span>
            <span>
              {stats.totalActive > 0
                ? `${Math.round((stats.totalDinner / stats.totalActive) * 100)}% Collected`
                : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: DYNAMIC GUEST CARD GENERATOR (Requirement 1 & 2) ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {language === 'bn' ? 'গেস্ট কার্ড জেনারেটর' : 'Dynamic Guest Card Generator'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'প্রয়োজনীয় সংখ্যক নতুন কার্ড তৈরি করুন। প্রতিটি কার্ডে ইউনিক আইডি, সিকিউর টোকেন ও কিউআর থাকবে।'
                  : 'Generate dynamic guest batches with sequential IDs and unguessable cryptographic tokens.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            Total Batches: {batches.length}
          </span>
        </div>

        <form onSubmit={handleGenerateCards} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card Quantity Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Number of Cards to Generate *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[20, 50, 100, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGenerateQuantity(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      generateQuantity === preset
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset} Cards
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={1000}
                value={generateQuantity}
                onChange={(e) => setGenerateQuantity(Number(e.target.value))}
                placeholder="Custom Quantity (e.g. 75)"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Guest Category Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Guest Category *
              </label>
              <select
                value={generateCategory}
                onChange={(e) => setGenerateCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden bg-white"
              >
                <option value="Honorary Guest">Honorary Guest (সম্মানিত অতিথি)</option>
                <option value="VIP Guest">VIP Guest (ভিআইপি অতিথি)</option>
                <option value="Special Invite">Special Invite (বিশেষ আমন্ত্রিত)</option>
                <option value="Patron Guest">Patron Guest (পৃষ্ঠপোষক অতিথি)</option>
                <option value="Dignitary">Dignitary (বিশিষ্ট ব্যক্তিত্ব)</option>
                <option value="CUSTOM">Custom Category... (অন্যান্য)</option>
              </select>

              {generateCategory === 'CUSTOM' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category label"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-300 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden mt-1"
                />
              )}
            </div>

            {/* Optional Batch Title / Note */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Batch Description / Event Note
              </label>
              <input
                type="text"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="e.g. Grand Opening Session Special Guests"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 block">
                Saved in batch metadata for reporting and audit logs.
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                New cards will start at{' '}
                <strong className="text-slate-900 font-mono">
                  GUEST-{String(cards.length + 1).padStart(4, '0')}
                </strong>
                . Previously generated {cards.length} cards remain unchanged.
              </span>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating {generateQuantity} Cards...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  <span>Generate {generateQuantity} Guest Cards</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Post-generation Instant Action Alert */}
        {generationSuccess && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-black text-amber-900">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Batch {generationSuccess.batch.id} Ready!</span>
              </div>
              <p className="text-xs text-amber-800">
                Generated {generationSuccess.cardsCount} unique cards ({generationSuccess.batch.category}). Download the complete package below:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadBatchZip(generationSuccess.batch)}
                disabled={downloadingBatchId === generationSuccess.batch.id}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <FileArchive className="w-4 h-4 text-amber-400" />
                <span>Download ZIP Bundle</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadBatchPdf(generationSuccess.batch)}
                disabled={downloadingBatchId === generationSuccess.batch.id}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print A4 PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3: GENERATED BATCHES ARCHIVE (Requirement 2 & 7) ── */}
      {batches.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <FileArchive className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Generated Batches Archive ({batches.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              One-click batch downloads (A4 Gang-Run & ZIP with individual PNGs)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Batch ID</th>
                  <th className="py-3 px-3">Batch Name / Note</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Quantity</th>
                  <th className="py-3 px-3">Generation Date</th>
                  <th className="py-3 px-3">Created By</th>
                  <th className="py-3 px-3 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => {
                  const isCurrentDownloading = downloadingBatchId === batch.id;
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {batch.id}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {batch.batchName}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900">
                          {batch.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {batch.totalCards} Cards
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(batch.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{batch.createdBy}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadBatchPdf(batch)}
                            disabled={isCurrentDownloading}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                            title="Download Printable Gang-run A4 PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>A4 PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadBatchZip(batch)}
                            disabled={isCurrentDownloading}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                            title="Download ZIP with all PNGs & Manifest"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-400" />
                            <span>ZIP Bundle</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION 4: GUEST ACTIVITY TABLE (Requirement 6 & 7) ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <span>Guest Pass Activity & Entitlements Directory</span>
            </h3>
            <p className="text-xs text-slate-500">
              Showing {filteredCards.length} of {cards.length} total generated guest records
            </p>
          </div>

          {/* Search Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Guest ID, Reg #, Token..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:border-amber-500 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Gate Verified)</option>
              <option value="INACTIVE">Inactive (Pending Gate)</option>
              <option value="REVOKED">Revoked (Security)</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:border-amber-500 focus:outline-hidden"
            >
              <option value="ALL">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Batch Filter */}
            {batches.length > 1 && (
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:border-amber-500 focus:outline-hidden"
              >
                <option value="ALL">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} ({b.totalCards})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Table Content */}
        {filteredCards.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Ban className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold">No guest cards found matching the criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Guest ID</th>
                  <th className="py-3 px-3">Registration Number</th>
                  <th className="py-3 px-3">QR Token</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Activation Status</th>
                  <th className="py-3 px-3">Gate Entry Details</th>
                  <th className="py-3 px-3 text-center">Breakfast</th>
                  <th className="py-3 px-3 text-center">Lunch</th>
                  <th className="py-3 px-3 text-center">Dinner</th>
                  <th className="py-3 px-3 text-center">Dress / Gift</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(filteredCards, currentPage, pageSize).map((card) => {
                  // Find meal collections for this card
                  const cardMeals = collections.filter((c) => c.guestId === card.id);
                  const hasBreakfast = cardMeals.some((c) => c.mealType === 'breakfast');
                  const hasLunch = cardMeals.some((c) => c.mealType === 'lunch');
                  const hasDinner = cardMeals.some((c) => c.mealType === 'dinner');

                  return (
                    <tr
                      key={card.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        card.status === 'REVOKED' ? 'bg-rose-50/30 opacity-70' : ''
                      }`}
                    >
                      {/* Guest ID */}
                      <td className="py-3 px-3 font-mono font-black text-slate-900">
                        {card.id}
                      </td>

                      {/* Registration Number */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {card.regNumber}
                      </td>

                      {/* QR Token */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded text-[11px] border border-amber-300">
                          {card.token}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{card.category}</span>
                      </td>

                      {/* Activation Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            card.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : card.status === 'INACTIVE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {card.status === 'ACTIVE' && <CheckCircle className="w-3 h-3" />}
                          {card.status === 'INACTIVE' && <Clock className="w-3 h-3" />}
                          {card.status === 'REVOKED' && <Ban className="w-3 h-3" />}
                          <span>{card.status}</span>
                        </span>
                      </td>

                      {/* Gate Entry Details */}
                      <td className="py-3 px-3 text-[11px] text-slate-600">
                        {card.isActivated && card.activatedAt ? (
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {card.activatedGate || 'Main Gate'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(card.activatedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {card.activatedByStaffName && ` • by ${card.activatedByStaffName}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">— Not Entered —</span>
                        )}
                      </td>

                      {/* Breakfast Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            hasBreakfast
                              ? 'bg-emerald-100 text-emerald-800'
                              : card.status === 'ACTIVE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {hasBreakfast ? 'Collected' : card.status === 'ACTIVE' ? 'Available' : 'Pending'}
                        </span>
                      </td>

                      {/* Lunch Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            hasLunch
                              ? 'bg-emerald-100 text-emerald-800'
                              : card.status === 'ACTIVE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {hasLunch ? 'Collected' : card.status === 'ACTIVE' ? 'Available' : 'Pending'}
                        </span>
                      </td>

                      {/* Dinner Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            hasDinner
                              ? 'bg-emerald-100 text-emerald-800'
                              : card.status === 'ACTIVE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {hasDinner ? 'Collected' : card.status === 'ACTIVE' ? 'Available' : 'Pending'}
                        </span>
                      </td>

                      {/* Dress Status (Strictly Not Eligible) */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                          <Ban className="w-2.5 h-2.5" />
                          <span>Not Eligible</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Modal Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedCardForInspection(card)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Download Individual PNG */}
                          <button
                            type="button"
                            onClick={() => downloadGuestCardPng(card)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 transition-colors cursor-pointer"
                            title="Download High-Res Card PNG"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Download Individual PDF */}
                          <button
                            type="button"
                            onClick={() => downloadIndividualGuestCardPdf(card)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 transition-colors cursor-pointer"
                            title="Download Single Card PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Revoke Button (Requirement 7) */}
                          {card.status !== 'REVOKED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCardToRevoke(card);
                                setRevocationReason('');
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Revoke Lost/Compromised Pass"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Global Pagination Bar */}
        {filteredCards.length > 0 && (
          <div className="pt-2">
            <GlobalPagination
              totalRecords={filteredCards.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* ── MODAL 1: CARD DETAILS INSPECTION MODAL ── */}
      {selectedCardForInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-pop-in my-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-amber-950 text-white">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-black tracking-wide">
                  Guest Card Credentials #{selectedCardForInspection.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardForInspection(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Card Meta Box */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Registration Number</span>
                  <span className="font-mono font-black text-slate-900">
                    {selectedCardForInspection.regNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">QR Token (Unguessable)</span>
                  <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    {selectedCardForInspection.token}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Category</span>
                  <span className="font-bold text-slate-800">
                    {selectedCardForInspection.category}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      selectedCardForInspection.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedCardForInspection.status === 'INACTIVE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedCardForInspection.status}
                  </span>
                </div>
              </div>

              {/* Gate Activation Timeline */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Gate Activation History
                </span>
                {selectedCardForInspection.isActivated && selectedCardForInspection.activatedAt ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gate Location:</span>
                      <span className="font-bold text-slate-800">
                        {selectedCardForInspection.activatedGate || 'Main Gate 01'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Operator Incharge:</span>
                      <span className="font-semibold text-slate-700">
                        {selectedCardForInspection.activatedByStaffName || 'Gate Operator'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Activation Time:</span>
                      <span className="font-mono text-slate-800">
                        {new Date(selectedCardForInspection.activatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
                    Card has not entered through the gate yet. It remains INACTIVE until the first authorized Gate QR scan.
                  </p>
                )}
              </div>

              {/* Meal Collection History */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Meal Collection Transactions
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {['breakfast', 'lunch', 'dinner'].map((meal) => {
                    const col = collections.find(
                      (c) => c.guestId === selectedCardForInspection.id && c.mealType === meal
                    );
                    return (
                      <div
                        key={meal}
                        className={`p-2.5 rounded-xl border ${
                          col
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="font-bold block capitalize text-xs">{meal}</span>
                        <span
                          className={`text-[9px] font-black uppercase block mt-1 ${
                            col ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {col ? 'Collected' : 'Available'}
                        </span>
                        {col && (
                          <span className="text-[9px] text-emerald-600 font-mono block mt-0.5">
                            {new Date(col.collectedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => downloadGuestCardPng(selectedCardForInspection)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Download PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadIndividualGuestCardPdf(selectedCardForInspection)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CARD REVOCATION AUDIT MODAL (Requirement 7) ── */}
      {cardToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden animate-pop-in">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h4 className="text-base font-black text-slate-900">
                  Revoke Guest Pass #{cardToRevoke.id}
                </h4>
                <p className="text-xs text-slate-500">
                  Are you sure you want to revoke registration{' '}
                  <strong className="text-slate-800 font-mono">{cardToRevoke.regNumber}</strong>?
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <p className="font-bold">Security Enforcement Rule:</p>
                <p className="text-[11px] text-rose-700">
                  Revoking this card immediately prevents Gate entry and food collection across all stations. All past collection logs remain archived for audit.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Mandatory Revocation Reason *
                </label>
                <textarea
                  rows={3}
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="e.g. Card physical badge reported lost; pass compromised; replacement issued."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCardToRevoke(null)}
                  disabled={isRevoking}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={isRevoking || !revocationReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isRevoking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Revoking...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Confirm Revocation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ADMIN GUEST SCANNER & TIMELINE (Requirement 5) ── */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-pop-in my-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-amber-950 text-white">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-black tracking-wide">
                  Admin Guest Scanner & Activity Timeline
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScannerModalOpen(false);
                  setScannerCameraActive(false);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scanner Controls */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScannerCameraActive(!scannerCameraActive)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    scannerCameraActive
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{scannerCameraActive ? 'Close Camera' : 'Scan With Camera'}</span>
                </button>
              </div>

              {scannerCameraActive && (
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <QrCameraScanner
                    onScan={(scanned) => {
                      setScannerCameraActive(false);
                      setAdminScanQuery(scanned);
                      handleAdminScanLookup(scanned);
                    }}
                    onClose={() => setScannerCameraActive(false)}
                    language={language}
                    themeColor="amber"
                    title="Scan Guest Pass QR"
                  />
                </div>
              )}

              {/* Manual Lookup Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdminScanLookup(adminScanQuery);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={adminScanQuery}
                  onChange={(e) => setAdminScanQuery(e.target.value)}
                  placeholder="Enter Guest ID, Reg #, or Token..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:border-amber-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Verify
                </button>
              </form>

              {/* Error Notice */}
              {adminScanError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{adminScanError}</span>
                </div>
              )}

              {/* Scanned Result Profile */}
              {adminScannedGuest && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                    <div className="w-12 h-14 rounded-xl bg-amber-600 text-white flex flex-col items-center justify-center shrink-0">
                      <Crown className="w-5 h-5 text-amber-200" />
                      <span className="text-[8px] font-black uppercase">Guest</span>
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500 text-slate-950">
                          {adminScannedGuest.category}
                        </span>
                        <span className="font-mono text-xs font-black text-amber-800">
                          {adminScannedGuest.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            adminScannedGuest.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : adminScannedGuest.status === 'INACTIVE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {adminScannedGuest.status}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">{adminScannedGuest.regNumber}</p>
                      <p className="text-xs font-mono text-slate-500">Token: {adminScannedGuest.token}</p>
                    </div>
                  </div>

                  {/* Gate Check-in Details */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gate Status:</span>
                      <span className="font-bold text-slate-800">
                        {adminScannedGuest.isActivated ? 'ENTERED & ACTIVE' : 'INACTIVE (Not Entered)'}
                      </span>
                    </div>
                    {adminScannedGuest.activatedAt && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Entry Time:</span>
                        <span className="font-mono text-slate-800">
                          {new Date(adminScannedGuest.activatedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {adminScannedGuest.activatedGate && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gate Station:</span>
                        <span className="font-semibold text-slate-700">
                          {adminScannedGuest.activatedGate}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meal Status Matrix */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200">
                      <span className="font-bold block text-xs">Breakfast</span>
                      <span
                        className={`text-[9px] font-black uppercase mt-1 block ${
                          adminScannedFacilities?.breakfast === 'Collected'
                            ? 'text-emerald-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {adminScannedFacilities?.breakfast || 'Pending'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200">
                      <span className="font-bold block text-xs">Lunch</span>
                      <span
                        className={`text-[9px] font-black uppercase mt-1 block ${
                          adminScannedFacilities?.lunch === 'Collected'
                            ? 'text-emerald-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {adminScannedFacilities?.lunch || 'Pending'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200">
                      <span className="font-bold block text-xs">Dinner</span>
                      <span
                        className={`text-[9px] font-black uppercase mt-1 block ${
                          adminScannedFacilities?.dinner === 'Collected'
                            ? 'text-emerald-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {adminScannedFacilities?.dinner || 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
