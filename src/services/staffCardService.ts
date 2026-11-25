/**
 * Staff Card Generation, Activation & Meal Entitlement Management Service
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 */

import { supabase } from './supabase';
import {
  StaffCard,
  StaffBatch,
  StaffGateActivation,
  StaffFoodCollection,
  StaffMealFacilitiesStatus,
  StaffPortalStatistics,
  StaffMealType,
} from '../types/staffCard';
import { parseScannedInput } from '../utils/tokenGenerator';
import { MealControlService } from './mealControlService';

const KEY_STAFF_CARDS = 'plscf_staff_cards_v1';
const KEY_STAFF_BATCHES = 'plscf_staff_batches_v1';
const KEY_STAFF_COLLECTIONS = 'plscf_staff_collections_v1';
const KEY_STAFF_ACTIVATIONS = 'plscf_staff_activations_v1';

export class StaffCardService {
  /**
   * Synchronous Local Getters
   */
  static getStaffCards(): StaffCard[] {
    try {
      const raw = localStorage.getItem(KEY_STAFF_CARDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getStaffBatches(): StaffBatch[] {
    try {
      const raw = localStorage.getItem(KEY_STAFF_BATCHES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getFoodCollections(): StaffFoodCollection[] {
    try {
      const raw = localStorage.getItem(KEY_STAFF_COLLECTIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getGateActivations(): StaffGateActivation[] {
    try {
      const raw = localStorage.getItem(KEY_STAFF_ACTIVATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Synchronous Local Setters
   */
  static saveStaffCards(cards: StaffCard[]): void {
    try {
      localStorage.setItem(KEY_STAFF_CARDS, JSON.stringify(cards));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plscf_staff_cards_updated', { detail: cards }));
      }
    } catch (e) {
      console.warn('[StaffCardService] Error saving staff cards:', e);
    }
  }

  static saveStaffBatches(batches: StaffBatch[]): void {
    try {
      localStorage.setItem(KEY_STAFF_BATCHES, JSON.stringify(batches));
    } catch (e) {
      console.warn('[StaffCardService] Error saving staff batches:', e);
    }
  }

  static saveFoodCollections(collections: StaffFoodCollection[]): void {
    try {
      localStorage.setItem(KEY_STAFF_COLLECTIONS, JSON.stringify(collections));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plscf_staff_food_sync', { detail: collections }));
      }
    } catch (e) {
      console.warn('[StaffCardService] Error saving staff food collections:', e);
    }
  }

  static saveGateActivations(activations: StaffGateActivation[]): void {
    try {
      localStorage.setItem(KEY_STAFF_ACTIVATIONS, JSON.stringify(activations));
    } catch (e) {
      console.warn('[StaffCardService] Error saving staff gate activations:', e);
    }
  }

  /**
   * Bidirectional Supabase Sync
   */
  static async syncWithSupabase(): Promise<{ success: boolean; cardsCount: number }> {
    try {
      const [cardsRes, batchesRes, collectionsRes, activationsRes] = await Promise.all([
        supabase.from('staff_cards').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_card_batches').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_food_collections').select('*').order('collected_at', { ascending: false }),
        supabase.from('staff_card_activations').select('*').order('activation_time', { ascending: false }),
      ]);

      if (batchesRes.data && batchesRes.data.length > 0) {
        const mappedBatches: StaffBatch[] = batchesRes.data.map((b: any) => ({
          id: b.id,
          batchName: b.batch_name,
          batchNumber: b.batch_number,
          totalCards: b.total_cards,
          category: b.category,
          createdBy: b.created_by,
          createdAt: b.created_at,
        }));
        this.saveStaffBatches(mappedBatches);
      }

      if (cardsRes.data && cardsRes.data.length > 0) {
        const mappedCards: StaffCard[] = cardsRes.data.map((c: any) => ({
          id: c.id,
          batchId: c.batch_id,
          regNumber: c.reg_number,
          token: c.token,
          qrPayload: c.qr_payload,
          category: c.category,
          status: c.status,
          isActivated: Boolean(c.is_activated),
          staffName: c.staff_name,
          designation: c.designation,
          mobileNumber: c.mobile_number,
          department: c.department,
          notes: c.notes,
          mealFacilities: Array.isArray(c.meal_facilities) ? c.meal_facilities : [],
          activatedAt: c.activated_at,
          activatedGate: c.activated_gate,
          activatedByStaffId: c.activated_by_staff_id,
          activatedByStaffName: c.activated_by_staff_name,
          revocationReason: c.revocation_reason,
          revokedAt: c.revoked_at,
          revokedBy: c.revoked_by,
          generationDate: c.generation_date || c.created_at,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        this.saveStaffCards(mappedCards);
      }

      if (collectionsRes.data && collectionsRes.data.length > 0) {
        const mappedCols: StaffFoodCollection[] = collectionsRes.data.map((col: any) => ({
          id: col.id,
          cardId: col.card_id,
          token: col.token,
          mealType: col.meal_type,
          status: 'COLLECTED',
          collectedAt: col.collected_at,
          staffId: col.staff_id,
          staffName: col.staff_name,
          counterId: col.counter_id,
          staffMemberName: col.staff_member_name,
        }));
        this.saveFoodCollections(mappedCols);
      }

      if (activationsRes.data && activationsRes.data.length > 0) {
        const mappedActs: StaffGateActivation[] = activationsRes.data.map((act: any) => ({
          id: act.id,
          cardId: act.card_id,
          token: act.token,
          gateId: act.gate_id || 'Main Gate',
          operatorId: act.operator_id,
          operatorName: act.operator_name,
          activationTime: act.activation_time,
          status: act.status || 'ACTIVE',
        }));
        this.saveGateActivations(mappedActs);
      }

      return { success: true, cardsCount: this.getStaffCards().length };
    } catch (e) {
      console.warn('[StaffCardService] Supabase sync notice, using local offline cache:', e);
      return { success: false, cardsCount: this.getStaffCards().length };
    }
  }

  /**
   * 1. Bulk Staff Card Generation
   */
  static async generateBatch(
    count: number,
    category: string = 'Event Staff',
    adminName: string = 'Super Admin',
    batchName?: string
  ): Promise<{
    success: boolean;
    batch?: StaffBatch;
    cards?: StaffCard[];
    error?: string;
  }> {
    if (count < 1 || count > 500) {
      return { success: false, error: 'Please specify a quantity between 1 and 500.' };
    }

    // Try Supabase RPC first
    try {
      const { data, error } = await supabase.rpc('rpc_generate_staff_card_batch', {
        p_count: count,
        p_category: category,
        p_created_by: adminName,
        p_batch_name: batchName || null,
      });

      if (!error && data?.success) {
        await this.syncWithSupabase();
        const allBatches = this.getStaffBatches();
        const allCards = this.getStaffCards();
        const createdBatch = allBatches.find((b) => b.id === data.batchId);
        const createdCards = allCards.filter((c) => c.batchId === data.batchId);
        return { success: true, batch: createdBatch, cards: createdCards };
      }
    } catch (e) {
      console.warn('[StaffCardService] RPC generate notice, running local generator:', e);
    }

    // Resilient Local Generator Fallback
    const existingBatches = this.getStaffBatches();
    const existingCards = this.getStaffCards();

    const batchNumber = existingBatches.length + 1;
    const batchId = `STF-BATCH-2027-${String(batchNumber).padStart(3, '0')}`;
    const finalBatchName =
      batchName?.trim() || `Staff Batch ${batchNumber} (${category})`;

    const newBatch: StaffBatch = {
      id: batchId,
      batchName: finalBatchName,
      batchNumber,
      totalCards: count,
      category,
      createdBy: adminName,
      createdAt: new Date().toISOString(),
    };

    let maxNum = 0;
    existingCards.forEach((c) => {
      const m = c.id.match(/STF-([0-9]+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });

    const newCards: StaffCard[] = [];
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    for (let i = 1; i <= count; i++) {
      const seq = maxNum + i;
      const cardId = `STF-${String(seq).padStart(4, '0')}`;
      const regNumber = `PLSCF-STF-2027-${String(seq).padStart(4, '0')}`;

      let tokenBody = '';
      for (let j = 0; j < 6; j++) {
        tokenBody += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const token = `STF-${tokenBody}`;

      const qrPayload = JSON.stringify({
        type: 'STAFF',
        id: cardId,
        regNumber,
        token,
        category,
        event: 'PLSCF_REUNION_2027',
      });

      newCards.push({
        id: cardId,
        batchId,
        regNumber,
        token,
        qrPayload,
        category,
        status: 'INACTIVE',
        isActivated: false,
        staffName: null,
        designation: null,
        mobileNumber: null,
        department: null,
        notes: null,
        mealFacilities: [],
        generationDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedBatches = [newBatch, ...existingBatches];
    const updatedCards = [...newCards, ...existingCards];

    this.saveStaffBatches(updatedBatches);
    this.saveStaffCards(updatedCards);

    // Background push to Supabase
    supabase.from('staff_card_batches').insert([
      {
        id: newBatch.id,
        batch_name: newBatch.batchName,
        batch_number: newBatch.batchNumber,
        total_cards: newBatch.totalCards,
        category: newBatch.category,
        created_by: newBatch.createdBy,
        created_at: newBatch.createdAt,
      },
    ]).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Local batch created, cloud push notice:', error);
    });

    supabase.from('staff_cards').insert(
      newCards.map((c) => ({
        id: c.id,
        batch_id: c.batchId,
        reg_number: c.regNumber,
        token: c.token,
        qr_payload: c.qrPayload,
        category: c.category,
        status: c.status,
        is_activated: c.isActivated,
        staff_name: c.staffName,
        designation: c.designation,
        mobile_number: c.mobileNumber,
        department: c.department,
        notes: c.notes,
        meal_facilities: c.mealFacilities,
        generation_date: c.generationDate,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      }))
    ).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Local cards created, cloud push notice:', error);
    });

    return {
      success: true,
      batch: newBatch,
      cards: newCards,
    };
  }

  /**
   * 2. Staff Card Activation & Configuration Interface
   */
  static async activateStaffCard(
    codeOrToken: string,
    tokenParam?: string | any,
    details?: {
      staffName?: string;
      designation?: string;
      mobileNumber?: string;
      department?: string;
      notes?: string;
      mealFacilities?: StaffMealType[];
    },
    gateId: string = 'Main Gate / Admin Desk',
    operatorId: string = 'SUPER_ADMIN',
    operatorName: string = 'Super Admin'
  ): Promise<{
    success: boolean;
    card?: StaffCard;
    message?: string;
    error?: string;
    errorType?: string;
  }> {
    let effectiveToken: string | undefined = typeof tokenParam === 'string' ? tokenParam : undefined;
    let effectiveDetails = details;
    let effectiveGate = gateId;
    let effectiveOpId = operatorId;
    let effectiveOpName = operatorName;

    if (tokenParam && typeof tokenParam === 'object') {
      effectiveDetails = tokenParam as any;
      effectiveToken = undefined;
      if (typeof details === 'string') effectiveGate = details;
      if (typeof gateId === 'string' && gateId !== 'Main Gate / Admin Desk') effectiveOpId = gateId;
      if (typeof operatorId === 'string' && operatorId !== 'SUPER_ADMIN') effectiveOpName = operatorId;
    }

    const clean = codeOrToken.trim();
    const parsed = parseScannedInput(clean);
    const lookupId = parsed.id || parsed.regNumber || (clean.startsWith('{') ? '' : clean);
    const lookupToken = effectiveToken || parsed.token || null;

    // Try Supabase RPC
    try {
      const { data, error } = await supabase.rpc('rpc_activate_staff_card', {
        p_identifier: lookupId || clean,
        p_token: lookupToken,
        p_staff_name: effectiveDetails?.staffName || null,
        p_designation: effectiveDetails?.designation || null,
        p_mobile_number: effectiveDetails?.mobileNumber || null,
        p_department: effectiveDetails?.department || null,
        p_meal_facilities: effectiveDetails?.mealFacilities || [],
        p_notes: effectiveDetails?.notes || null,
        p_activated_by: effectiveOpName,
        p_gate_id: effectiveGate,
      });

      if (!error && data?.success) {
        await this.syncWithSupabase();
        const found = this.getStaffCards().find((c) => c.id === data.cardId);
        return {
          success: true,
          card: found,
          message: data.message || 'Staff card activated successfully.',
        };
      } else if (data && !data.success) {
        return {
          success: false,
          errorType: data.errorType,
          error: data.error,
        };
      }
    } catch (e) {
      console.warn('[StaffCardService] RPC activation notice, using fallback logic:', e);
    }

    // Local Resilient Activation Engine
    const target = await this.findStaffCardByCode(clean, effectiveToken);
    if (!target) {
      return {
        success: false,
        errorType: 'CARD_NOT_FOUND',
        error: `Staff Card "${clean}" not found. Verify the ID or QR code.`,
      };
    }

    if (target.status === 'REVOKED') {
      return {
        success: false,
        errorType: 'CARD_REVOKED',
        error: `Staff Card "${target.id}" is REVOKED. Contact Super Admin to restore.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatedCard: StaffCard = {
      ...target,
      status: 'ACTIVE',
      isActivated: true,
      staffName: effectiveDetails?.staffName?.trim() || target.staffName || 'Staff Member',
      designation: effectiveDetails?.designation?.trim() || target.designation || 'Event Volunteer',
      mobileNumber: effectiveDetails?.mobileNumber?.trim() || target.mobileNumber || null,
      department: effectiveDetails?.department?.trim() || target.department || 'Operations',
      notes: effectiveDetails?.notes?.trim() || target.notes || null,
      mealFacilities: effectiveDetails?.mealFacilities || target.mealFacilities || [],
      activatedAt: target.activatedAt || nowIso,
      activatedGate: effectiveGate,
      activatedByStaffId: effectiveOpId,
      activatedByStaffName: effectiveOpName,
      updatedAt: nowIso,
    };

    const cards = this.getStaffCards().map((c) => (c.id === target.id ? updatedCard : c));
    this.saveStaffCards(cards);

    const newActivation: StaffGateActivation = {
      id: `ACT-STF-${target.id}-${Date.now()}`,
      cardId: target.id,
      token: target.token,
      gateId: effectiveGate,
      operatorId: effectiveOpId,
      operatorName: effectiveOpName,
      activationTime: nowIso,
      status: 'ACTIVE',
    };
    const activations = [newActivation, ...this.getGateActivations()];
    this.saveGateActivations(activations);

    // Cloud push
    supabase.from('staff_cards').update({
      status: 'ACTIVE',
      is_activated: true,
      staff_name: updatedCard.staffName,
      designation: updatedCard.designation,
      mobile_number: updatedCard.mobileNumber,
      department: updatedCard.department,
      notes: updatedCard.notes,
      meal_facilities: updatedCard.mealFacilities,
      activated_at: updatedCard.activatedAt,
      activated_gate: updatedCard.activatedGate,
      activated_by_staff_name: updatedCard.activatedByStaffName,
      updated_at: nowIso,
    }).eq('id', target.id).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Local activation saved, cloud update notice:', error);
    });

    return {
      success: true,
      card: updatedCard,
      message: `Staff Card ${target.id} activated successfully.`,
    };
  }

  /**
   * 3. Individual Meal Entitlement Assignment (Update at any time)
   */
  static async updateEntitlements(
    cardId: string,
    mealFacilities: StaffMealType[],
    _adminName: string = 'Super Admin'
  ): Promise<{ success: boolean; card?: StaffCard; error?: string }> {
    const cards = this.getStaffCards();
    const target = cards.find((c) => c.id === cardId);
    if (!target) {
      return { success: false, error: `Staff card "${cardId}" not found.` };
    }

    const nowIso = new Date().toISOString();
    const updatedCard: StaffCard = {
      ...target,
      mealFacilities,
      updatedAt: nowIso,
    };

    const updatedList = cards.map((c) => (c.id === cardId ? updatedCard : c));
    this.saveStaffCards(updatedList);

    supabase.from('staff_cards').update({
      meal_facilities: mealFacilities,
      updated_at: nowIso,
    }).eq('id', cardId).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Entitlements updated locally, cloud notice:', error);
    });

    return { success: true, card: updatedCard };
  }

  /**
   * Update Staff Member Details
   */
  static async updateStaffDetails(
    cardId: string,
    details: {
      staffName?: string;
      designation?: string;
      mobileNumber?: string;
      department?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; card?: StaffCard; error?: string }> {
    const cards = this.getStaffCards();
    const target = cards.find((c) => c.id === cardId);
    if (!target) return { success: false, error: 'Card not found.' };

    const nowIso = new Date().toISOString();
    const updatedCard: StaffCard = {
      ...target,
      staffName: details.staffName !== undefined ? details.staffName : target.staffName,
      designation: details.designation !== undefined ? details.designation : target.designation,
      mobileNumber: details.mobileNumber !== undefined ? details.mobileNumber : target.mobileNumber,
      department: details.department !== undefined ? details.department : target.department,
      notes: details.notes !== undefined ? details.notes : target.notes,
      updatedAt: nowIso,
    };

    const updatedList = cards.map((c) => (c.id === cardId ? updatedCard : c));
    this.saveStaffCards(updatedList);

    supabase.from('staff_cards').update({
      staff_name: updatedCard.staffName,
      designation: updatedCard.designation,
      mobile_number: updatedCard.mobileNumber,
      department: updatedCard.department,
      notes: updatedCard.notes,
      updated_at: nowIso,
    }).eq('id', cardId).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Details updated locally, cloud notice:', error);
    });

    return { success: true, card: updatedCard };
  }

  /**
   * Revoke & Reactivate Staff Cards
   */
  static async revokeCard(
    cardId: string,
    reason: string = 'Revoked by Super Admin',
    adminName: string = 'Super Admin'
  ): Promise<{ success: boolean; card?: StaffCard; error?: string }> {
    const cards = this.getStaffCards();
    const target = cards.find((c) => c.id === cardId);
    if (!target) return { success: false, error: 'Card not found.' };

    const nowIso = new Date().toISOString();
    const updatedCard: StaffCard = {
      ...target,
      status: 'REVOKED',
      revocationReason: reason,
      revokedAt: nowIso,
      revokedBy: adminName,
      updatedAt: nowIso,
    };

    const updatedList = cards.map((c) => (c.id === cardId ? updatedCard : c));
    this.saveStaffCards(updatedList);

    supabase.from('staff_cards').update({
      status: 'REVOKED',
      revocation_reason: reason,
      revoked_at: nowIso,
      revoked_by: adminName,
      updated_at: nowIso,
    }).eq('id', cardId).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Revocation saved locally, cloud notice:', error);
    });

    return { success: true, card: updatedCard };
  }

  static async reactivateCard(
    cardId: string,
    _adminName: string = 'Super Admin'
  ): Promise<{ success: boolean; card?: StaffCard; error?: string }> {
    const cards = this.getStaffCards();
    const target = cards.find((c) => c.id === cardId);
    if (!target) return { success: false, error: 'Card not found.' };

    const nowIso = new Date().toISOString();
    const updatedCard: StaffCard = {
      ...target,
      status: 'ACTIVE',
      isActivated: true,
      revocationReason: null,
      revokedAt: null,
      revokedBy: null,
      updatedAt: nowIso,
    };

    const updatedList = cards.map((c) => (c.id === cardId ? updatedCard : c));
    this.saveStaffCards(updatedList);

    supabase.from('staff_cards').update({
      status: 'ACTIVE',
      is_activated: true,
      revocation_reason: null,
      revoked_at: null,
      revoked_by: null,
      updated_at: nowIso,
    }).eq('id', cardId).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Reactivated locally, cloud notice:', error);
    });

    return { success: true, card: updatedCard };
  }

  /**
   * Resilient Input Resolver (Supports 6-Char Token, JSON QR Payload, URL, ID, or Reg Number)
   */
  static async findStaffCardByCode(
    codeOrToken: string,
    tokenParam?: string
  ): Promise<StaffCard | null> {
    const clean = codeOrToken.trim();
    if (!clean) return null;

    const cards = this.getStaffCards();
    const parsed = parseScannedInput(clean);

    // 1. Direct ID match
    const byId = cards.find(
      (c) =>
        c.id.toUpperCase() === clean.toUpperCase() ||
        c.regNumber.toUpperCase() === clean.toUpperCase() ||
        c.token.toUpperCase() === clean.toUpperCase()
    );
    if (byId) return byId;

    // 2. Token param match
    if (tokenParam) {
      const byToken = cards.find(
        (c) =>
          c.token.toUpperCase() === tokenParam.toUpperCase() ||
          c.token.toUpperCase() === `STF-${tokenParam.toUpperCase()}`
      );
      if (byToken) return byToken;
    }

    // 3. Parsed fields match
    if (parsed.id) {
      const pId = parsed.id.toUpperCase();
      const byParsedId = cards.find(
        (c) =>
          c.id.toUpperCase() === pId ||
          c.regNumber.toUpperCase() === pId
      );
      if (byParsedId) return byParsedId;
    }

    if (parsed.token) {
      const pTok = parsed.token.toUpperCase();
      const byParsedToken = cards.find(
        (c) =>
          c.token.toUpperCase() === pTok ||
          c.token.toUpperCase() === `STF-${pTok}`
      );
      if (byParsedToken) return byParsedToken;
    }

    // 4. Try Cloud Supabase query if not found locally
    try {
      const { data } = await supabase
        .from('staff_cards')
        .select('*')
        .or(`id.ilike.%${clean}%,reg_number.ilike.%${clean}%,token.ilike.%${clean}%`)
        .limit(1);

      if (data && data.length > 0) {
        const c = data[0];
        const cloudCard: StaffCard = {
          id: c.id,
          batchId: c.batch_id,
          regNumber: c.reg_number,
          token: c.token,
          qrPayload: c.qr_payload,
          category: c.category,
          status: c.status,
          isActivated: Boolean(c.is_activated),
          staffName: c.staff_name,
          designation: c.designation,
          mobileNumber: c.mobile_number,
          department: c.department,
          notes: c.notes,
          mealFacilities: Array.isArray(c.meal_facilities) ? c.meal_facilities : [],
          activatedAt: c.activated_at,
          activatedGate: c.activated_gate,
          activatedByStaffId: c.activated_by_staff_id,
          activatedByStaffName: c.activated_by_staff_name,
          revocationReason: c.revocation_reason,
          revokedAt: c.revoked_at,
          revokedBy: c.revoked_by,
          generationDate: c.generation_date || c.created_at,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
        // Merge into local store
        const existing = this.getStaffCards().filter((x) => x.id !== cloudCard.id);
        this.saveStaffCards([cloudCard, ...existing]);
        return cloudCard;
      }
    } catch (_) {}

    return null;
  }

  /**
   * 4. Get Meal Entitlements & Collection Status for a Specific Staff Card
   */
  static async getStaffMealFacilities(cardId: string): Promise<StaffMealFacilitiesStatus> {
    return this.getMealFacilities(cardId);
  }

  static async getMealFacilities(cardId: string): Promise<StaffMealFacilitiesStatus> {
    const card = this.getStaffCards().find((c) => c.id === cardId);
    const collections = this.getFoodCollections().filter((fc) => fc.cardId === cardId);

    const bCol = collections.find((c) => c.mealType === 'breakfast');
    const lCol = collections.find((c) => c.mealType === 'lunch');
    const dCol = collections.find((c) => c.mealType === 'dinner');

    const isAssigned = (m: StaffMealType) =>
      card ? card.mealFacilities.includes(m) : false;

    return {
      breakfast: bCol
        ? 'Collected'
        : isAssigned('breakfast')
        ? 'Available'
        : 'Not Assigned',
      lunch: lCol
        ? 'Collected'
        : isAssigned('lunch')
        ? 'Available'
        : 'Not Assigned',
      dinner: dCol
        ? 'Collected'
        : isAssigned('dinner')
        ? 'Available'
        : 'Not Assigned',
      dress: 'Not Eligible',
      breakfastCollectedAt: bCol?.collectedAt,
      lunchCollectedAt: lCol?.collectedAt,
      dinnerCollectedAt: dCol?.collectedAt,
    };
  }

  /**
   * 5. Staff Card Scanning & Meal Validation (Atomic & Controlled by Meal Schedule)
   */
  static async collectStaffMeal(
    codeOrToken: string,
    mealType: StaffMealType,
    tokenParam?: string,
    staffId: string = 'FOOD_STAFF',
    staffName: string = 'Food Staff',
    counterId: string = 'Staff Counter 01',
    options?: { checkSchedule?: boolean }
  ): Promise<{
    success: boolean;
    record?: StaffFoodCollection;
    error?: string;
    errorType?: string;
    message?: string;
  }> {
    const clean = codeOrToken.trim();
    const parsed = parseScannedInput(clean);
    const lookupId = parsed.id || parsed.regNumber || (clean.startsWith('{') ? '' : clean);
    const lookupToken = tokenParam || parsed.token || null;

    // Check Meal Time & Scanner Control System (Asia/Dhaka)
    if (options?.checkSchedule) {
      const mealControl = MealControlService.evaluateMealStatus(mealType);
      if (!mealControl.isOpen) {
        return {
          success: false,
          errorType: 'TIMEOUT',
          error: 'Time Out',
          message: mealControl.reasonEn,
        };
      }
    }

    // 1. Try Supabase RPC first
    try {
      const { data, error } = await supabase.rpc('rpc_collect_staff_food', {
        p_identifier: lookupId || clean,
        p_meal_type: mealType,
        p_token: lookupToken,
        p_staff_id: staffId,
        p_staff_name: staffName,
        p_counter_id: counterId,
      });

      if (!error && data?.success) {
        await this.syncWithSupabase();
        return {
          success: true,
          message: data.message || 'Food collection confirmed successfully.',
          record: data.record,
        };
      } else if (data && !data.success) {
        return {
          success: false,
          errorType: data.errorType,
          error: data.error || data.message,
          message: data.message,
        };
      }
    } catch (e) {
      console.warn('[StaffCardService] RPC collect notice, using fallback logic:', e);
    }

    // 2. Resilient Local Engine
    const card = await this.findStaffCardByCode(clean, tokenParam);
    if (!card) {
      return {
        success: false,
        errorType: 'CARD_NOT_FOUND',
        error: `Staff Card "${clean}" not found.`,
        message: 'No matching staff card record found.',
      };
    }

    // Condition 1: Must be ACTIVE
    if (card.status === 'INACTIVE' || !card.isActivated) {
      return {
        success: false,
        errorType: 'CARD_NOT_ACTIVATED',
        error: 'Card Not Activated',
        message: `Staff card "${card.id}" is inactive. Super Admin must activate this card first.`,
      };
    }

    if (card.status === 'REVOKED') {
      return {
        success: false,
        errorType: 'CARD_REVOKED',
        error: 'Card Revoked',
        message: `Staff card "${card.id}" has been revoked by Super Admin.`,
      };
    }

    // Condition 2: Meal facility entitlement check
    if (!card.mealFacilities.includes(mealType)) {
      const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
      return {
        success: false,
        errorType: 'MEAL_NOT_ASSIGNED',
        error: 'Meal Not Assigned',
        message: `Staff card "${card.id}" is not authorized for ${mealName}. Assigned facilities: ${
          card.mealFacilities.length > 0 ? card.mealFacilities.join(', ') : 'None'
        }.`,
      };
    }

    // Condition 3: Meal Time Schedule check (if not checked before)
    if (options?.checkSchedule !== false) {
      const mealControl = MealControlService.evaluateMealStatus(mealType);
      if (!mealControl.isOpen) {
        return {
          success: false,
          errorType: 'TIMEOUT',
          error: 'Time Out',
          message: mealControl.reasonEn,
        };
      }
    }

    // Condition 4: Duplicate collection check
    const existingCollections = this.getFoodCollections();
    const already = existingCollections.find(
      (c) => c.cardId === card.id && c.mealType === mealType
    );

    if (already) {
      const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
      return {
        success: false,
        errorType: 'ALREADY_COLLECTED',
        error: 'Already Collected',
        message: `${mealName} has already been claimed for staff card "${card.id}" at ${new Date(
          already.collectedAt
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      };
    }

    // Confirm Collection
    const nowIso = new Date().toISOString();
    const newCollection: StaffFoodCollection = {
      id: `COL-STF-${card.id}-${mealType}`,
      cardId: card.id,
      token: card.token,
      mealType,
      status: 'COLLECTED',
      collectedAt: nowIso,
      staffId,
      staffName,
      counterId,
      staffMemberName: card.staffName || undefined,
    };

    const updatedCols = [newCollection, ...existingCollections];
    this.saveFoodCollections(updatedCols);

    // Cloud push
    supabase.from('staff_food_collections').insert([
      {
        id: newCollection.id,
        card_id: newCollection.cardId,
        token: newCollection.token,
        meal_type: newCollection.mealType,
        status: newCollection.status,
        collected_at: newCollection.collectedAt,
        staff_id: newCollection.staffId,
        staff_name: newCollection.staffName,
        counter_id: newCollection.counterId,
        staff_member_name: newCollection.staffMemberName,
      },
    ]).then(({ error }) => {
      if (error) console.warn('[StaffCardService] Local collection confirmed, cloud notice:', error);
    });

    return {
      success: true,
      record: newCollection,
      message: `${mealType.toUpperCase()} marked as COLLECTED for ${card.staffName || card.id}.`,
    };
  }

  /**
   * 6. Staff Card Directory Statistics
   */
  static getStatistics(): StaffPortalStatistics {
    const cards = this.getStaffCards();
    const cols = this.getFoodCollections();

    let totalActive = 0;
    let totalInactive = 0;
    let totalRevoked = 0;
    let totalBreakfastEligible = 0;
    let totalLunchEligible = 0;
    let totalDinnerEligible = 0;

    cards.forEach((c) => {
      if (c.status === 'ACTIVE') totalActive++;
      else if (c.status === 'REVOKED') totalRevoked++;
      else totalInactive++;

      if (c.mealFacilities.includes('breakfast')) totalBreakfastEligible++;
      if (c.mealFacilities.includes('lunch')) totalLunchEligible++;
      if (c.mealFacilities.includes('dinner')) totalDinnerEligible++;
    });

    const totalBreakfastCollected = cols.filter((c) => c.mealType === 'breakfast').length;
    const totalLunchCollected = cols.filter((c) => c.mealType === 'lunch').length;
    const totalDinnerCollected = cols.filter((c) => c.mealType === 'dinner').length;

    return {
      totalGenerated: cards.length,
      totalCards: cards.length,
      totalActive,
      activeCards: totalActive,
      totalInactive,
      inactiveCards: totalInactive,
      totalRevoked,
      revokedCards: totalRevoked,
      totalBreakfastEligible,
      totalLunchEligible,
      totalDinnerEligible,
      totalBreakfastCollected,
      totalLunchCollected,
      totalDinnerCollected,
    };
  }

  /**
   * Clear local staff storage (for unit test isolation)
   */
  static clearLocalStaffData(): void {
    try {
      localStorage.removeItem(KEY_STAFF_CARDS);
      localStorage.removeItem(KEY_STAFF_BATCHES);
      localStorage.removeItem(KEY_STAFF_COLLECTIONS);
      localStorage.removeItem(KEY_STAFF_ACTIVATIONS);
    } catch (_) {}
  }
}
