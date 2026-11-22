import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GuestService } from '../services/guestService';
import { parseScannedInput } from './tokenGenerator';

// Mock in-memory localStorage for Node test runner environment
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k in mockStorage) delete mockStorage[k];
    },
  };
}

// Ensure clean state before tests
GuestService.clearLocalGuestData();

test('1. Dynamic Guest Card Generator generates requested quantity with sequential IDs', async () => {
  // Generate first batch of 2 cards
  const res = await GuestService.generateBatch(2, 'VIP Guest', 'Super Admin 1', 'VIP Batch 1');
  assert.equal(res.success, true, 'Batch generation must succeed');
  assert.equal(res.cards.length, 2, 'Must generate exactly 2 cards');

  const cards = GuestService.getGuestCards();
  assert.equal(cards.length, 2, 'Stored cards must equal 2');
  assert.equal(cards[0].id, 'GUEST-0001', 'First card ID must be GUEST-0001');
  assert.equal(cards[1].id, 'GUEST-0002', 'Second card ID must be GUEST-0002');
  assert.equal(cards[0].regNumber, 'PLSCF-GST-2027-0001', 'First card reg number must match pattern');
  assert.equal(cards[1].regNumber, 'PLSCF-GST-2027-0002', 'Second card reg number must match pattern');
});

test('2. Unique cryptographic tokens & unguessable QR codes', () => {
  const cards = GuestService.getGuestCards();
  assert.equal(cards.length, 2);

  // Tokens must be unique and non-sequential
  assert.notEqual(cards[0].token, cards[1].token, 'Tokens must not match');
  assert.match(cards[0].token, /^GST-[A-Z0-9]{6}-[A-Z0-9]{3}$/, 'Token format must match GST-XXXXXX-XXX');
  assert.match(cards[1].token, /^GST-[A-Z0-9]{6}-[A-Z0-9]{3}$/, 'Token format must match GST-XXXXXX-XXX');

  // Must not be predictable sequential IDs
  assert.equal(cards[0].token.includes('0001'), false, 'Token must not be sequential ID');
  assert.equal(cards[1].token.includes('0002'), false, 'Token must not be sequential ID');

  // Initial status must be strictly INACTIVE
  assert.equal(cards[0].status, 'INACTIVE', 'Initial card status must be INACTIVE');
  assert.equal(cards[0].isActivated, false, 'isActivated must be false upon generation');

  // Verify QR parser correctly identifies guest pass
  const parsed0 = parseScannedInput(cards[0].qrPayload);
  assert.equal(parsed0.isGuestPass, true, 'Parser must mark QR payload as isGuestPass');
  assert.equal(parsed0.id, cards[0].id, 'Parsed ID must match card ID');
  assert.equal(parsed0.token, cards[0].token, 'Parsed token must match card token');
});

test('3. Inactive guest cards are rejected at Food Counter prior to Gate activation', async () => {
  const cards = GuestService.getGuestCards();
  const card1 = cards[0];
  assert.equal(card1.status, 'INACTIVE');

  // Attempting to collect meal on an inactive card must fail
  const collectRes = await GuestService.collectMeal(
    card1.id,
    'breakfast',
    card1.token,
    'STAFF_FOOD',
    'Food Operator 1'
  );

  assert.equal(collectRes.success, false, 'Collection on inactive card must fail');
  assert.equal(collectRes.errorType, 'INACTIVE_CARD', 'Error type must be INACTIVE_CARD');
  assert.match(collectRes.error || '', /Main Gate/i, 'Error message must instruct gate activation');
});

test('4. Gate QR Scanner activates inactive guest card (INACTIVE -> ACTIVE)', async () => {
  const cards = GuestService.getGuestCards();
  const card1 = cards[0];

  const actRes = await GuestService.activateGuestCard(
    card1.id,
    card1.token,
    'Gate 01 - Main Entrance',
    'STAFF_GATE_01',
    'Tanvir Gate Staff'
  );

  assert.equal(actRes.success, true, 'Activation must succeed');
  assert.equal(actRes.alreadyActive, false, 'First activation must not be already active');
  assert.equal(actRes.card?.status, 'ACTIVE', 'Status must now be ACTIVE');
  assert.equal(actRes.card?.isActivated, true, 'isActivated must now be true');
  assert.equal(actRes.card?.activatedGate, 'Gate 01 - Main Entrance', 'Gate name must be recorded');
  assert.equal(actRes.card?.activatedByStaffName, 'Tanvir Gate Staff', 'Staff name must be recorded');

  // Verify activation log was created
  const activations = GuestService.getGateActivations();
  const foundAct = activations.find((a) => a.guestId === card1.id);
  assert.ok(foundAct, 'Gate activation log must be saved');
  assert.equal(foundAct.gateId, 'Gate 01 - Main Entrance');
});

test('5. Duplicate Gate scan prevents duplicate activation write', async () => {
  const cards = GuestService.getGuestCards();
  const card1 = cards[0];

  const actRes2 = await GuestService.activateGuestCard(
    card1.id,
    card1.token,
    'Gate 02',
    'STAFF_GATE_02',
    'Rafiq Staff'
  );

  assert.equal(actRes2.success, true, 'Should return success for valid active card');
  assert.equal(actRes2.alreadyActive, true, 'Must indicate already active');
  assert.equal(actRes2.message, 'GUEST CARD IS ALREADY ACTIVE', 'Message must state already active');
  // Original activation gate must not be overwritten
  assert.equal(actRes2.card?.activatedGate, 'Gate 01 - Main Entrance', 'Original gate must remain unchanged');
});

test('6. Activated card can collect Breakfast, Lunch, and Dinner independently', async () => {
  const cards = GuestService.getGuestCards();
  const card1 = cards[0];

  // 1. Collect Breakfast
  const bRes = await GuestService.collectMeal(
    card1.id,
    'breakfast',
    card1.token,
    'FOOD_01',
    'Breakfast Staff'
  );
  assert.equal(bRes.success, true, 'Breakfast collection must succeed');
  assert.equal(bRes.record?.mealType, 'breakfast');

  // Check facility status
  let facilities = GuestService.getMealFacilities(card1.id);
  assert.equal(facilities.breakfast, 'Collected');
  assert.equal(facilities.lunch, 'Available');
  assert.equal(facilities.dinner, 'Available');
  assert.equal(facilities.dress, 'Not Eligible');

  // 2. Collect Lunch
  const lRes = await GuestService.collectMeal(
    card1.id,
    'lunch',
    card1.token,
    'FOOD_02',
    'Lunch Staff'
  );
  assert.equal(lRes.success, true, 'Lunch collection must succeed');

  facilities = GuestService.getMealFacilities(card1.id);
  assert.equal(facilities.breakfast, 'Collected');
  assert.equal(facilities.lunch, 'Collected');
  assert.equal(facilities.dinner, 'Available');

  // 3. Collect Dinner
  const dRes = await GuestService.collectMeal(
    card1.id,
    'dinner',
    card1.token,
    'FOOD_03',
    'Dinner Staff'
  );
  assert.equal(dRes.success, true, 'Dinner collection must succeed');

  facilities = GuestService.getMealFacilities(card1.id);
  assert.equal(facilities.breakfast, 'Collected');
  assert.equal(facilities.lunch, 'Collected');
  assert.equal(facilities.dinner, 'Collected');
  assert.equal(facilities.dress, 'Not Eligible');
});

test('7. Duplicate collection of the same meal is strictly rejected', async () => {
  const cards = GuestService.getGuestCards();
  const card1 = cards[0];

  // Try collecting Breakfast again
  const duplicateB = await GuestService.collectMeal(
    card1.id,
    'breakfast',
    card1.token,
    'FOOD_01',
    'Breakfast Staff'
  );
  assert.equal(duplicateB.success, false, 'Duplicate breakfast must fail');
  assert.equal(duplicateB.errorType, 'ALREADY_COLLECTED');
  assert.match(duplicateB.error || '', /ALREADY COLLECTED/i);

  // Try collecting Lunch again
  const duplicateL = await GuestService.collectMeal(
    card1.id,
    'lunch',
    card1.token,
    'FOOD_02',
    'Lunch Staff'
  );
  assert.equal(duplicateL.success, false, 'Duplicate lunch must fail');
  assert.equal(duplicateL.errorType, 'ALREADY_COLLECTED');
});

test('8. Guest cards are strictly NOT eligible for dress / gift distribution', () => {
  const cards = GuestService.getGuestCards();
  const card1 = cards[0];

  const facilities = GuestService.getMealFacilities(card1.id);
  assert.equal(facilities.dress, 'Not Eligible', 'Dress must be strictly Not Eligible');

  // Parser test: Dress scanner checks parsed.isGuestPass
  const parsed = parseScannedInput(card1.qrPayload);
  assert.equal(parsed.isGuestPass, true);

  // Any check on GUEST- prefix triggers dress rejection
  const isGuestId = card1.id.startsWith('GUEST-');
  assert.equal(isGuestId, true, 'Guest card ID starts with GUEST-');
});

test('9. Generating second batch preserves original cards & continues numbering seamlessly', async () => {
  // Generate 3 additional cards in second batch
  const res2 = await GuestService.generateBatch(3, 'Honorary Guest', 'Super Admin 1', 'Honorary Batch 2');
  assert.equal(res2.success, true);
  assert.equal(res2.cards.length, 3);

  const allCards = GuestService.getGuestCards();
  assert.equal(allCards.length, 5, 'Total cards must now be 2 + 3 = 5');

  // Verify continuous numbering
  assert.equal(allCards[0].id, 'GUEST-0001', 'Card 1 must remain GUEST-0001');
  assert.equal(allCards[1].id, 'GUEST-0002', 'Card 2 must remain GUEST-0002');
  assert.equal(allCards[2].id, 'GUEST-0003', 'Card 3 must be GUEST-0003');
  assert.equal(allCards[3].id, 'GUEST-0004', 'Card 4 must be GUEST-0004');
  assert.equal(allCards[4].id, 'GUEST-0005', 'Card 5 must be GUEST-0005');

  // Previously activated card 1 must remain ACTIVE with all collection logs preserved
  assert.equal(allCards[0].status, 'ACTIVE', 'Card 1 must still be ACTIVE');
  const card1Facilities = GuestService.getMealFacilities(allCards[0].id);
  assert.equal(card1Facilities.breakfast, 'Collected', 'Card 1 breakfast must remain Collected');

  // Newly generated cards must be INACTIVE
  assert.equal(allCards[2].status, 'INACTIVE');
  assert.equal(allCards[3].status, 'INACTIVE');
  assert.equal(allCards[4].status, 'INACTIVE');

  // Batches list must have 2 batches
  const batches = GuestService.getGuestBatches();
  assert.equal(batches.length, 2, 'Must have 2 batches');
  assert.equal(batches[0].totalCards, 3, 'Latest batch (Batch 2) has 3 cards');
  assert.equal(batches[1].totalCards, 2, 'Initial batch (Batch 1) has 2 cards');
});

test('10. Card Revocation flags card as REVOKED while preserving historical audit logs', async () => {
  const card1 = GuestService.getGuestCards()[0];
  assert.equal(card1.status, 'ACTIVE');

  // Revoke Card 1
  const revokeRes = await GuestService.revokeCard(
    card1.id,
    'Lost badge reported by guest',
    'SUPER_ADMIN_01',
    'Chief Convenor'
  );
  assert.equal(revokeRes.success, true, 'Revocation must succeed');
  assert.equal(revokeRes.card?.status, 'REVOKED');
  assert.equal(revokeRes.card?.revocationReason, 'Lost badge reported by guest');

  // Historical activation and meal collection records must still exist in database
  const activations = GuestService.getGateActivations();
  const card1Act = activations.find((a) => a.guestId === card1.id);
  assert.ok(card1Act, 'Historical gate activation record must NOT be deleted');

  const collections = GuestService.getFoodCollections();
  const card1Meals = collections.filter((c) => c.guestId === card1.id);
  assert.equal(card1Meals.length, 3, 'Historical 3 meals must NOT be deleted upon revocation');

  // Any future attempt to collect meal must be denied due to REVOKED status
  const futureMeal = await GuestService.collectMeal(
    card1.id,
    'dinner',
    card1.token,
    'FOOD_01',
    'Staff'
  );
  assert.equal(futureMeal.success, false);
  assert.equal(futureMeal.errorType, 'REVOKED');
});

test('11. Portal statistics calculate accurately', () => {
  const stats = GuestService.getStatistics();
  assert.equal(stats.totalGenerated, 5, 'Total generated cards must equal 5');
  assert.equal(stats.totalRevoked, 1, 'Total revoked cards must equal 1');
  assert.equal(stats.totalInactive, 4, 'Remaining inactive cards must equal 4');
  assert.equal(stats.totalActive, 0, 'Currently active non-revoked cards must equal 0');
  assert.equal(stats.totalGateEntered, 1, 'Total gate entries must equal 1');
  assert.equal(stats.totalBreakfast, 1, 'Total breakfast collections must equal 1');
  assert.equal(stats.totalLunch, 1, 'Total lunch collections must equal 1');
  assert.equal(stats.totalDinner, 1, 'Total dinner collections must equal 1');
});
