import test from 'node:test';
import assert from 'node:assert/strict';
import { StaffCardService } from '../services/staffCardService';
import { MealControlService } from '../services/mealControlService';

// Polyfill in-memory localStorage for Node test runner
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
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    },
  };
}

test('Staff Card System: 1. Bulk Staff Card Generation', async () => {
  localStorage.clear();

  // Super Admin generates a batch of 5 staff cards
  const batchRes = await StaffCardService.generateBatch(
    5,
    'Logistics & Security',
    'Event Volunteer',
    'superadmin@plscf.org'
  );

  assert.equal(batchRes.success, true);
  assert.equal(batchRes.cards!.length, 5);
  assert.ok(batchRes.batch);
  assert.equal(batchRes.batch.totalCards, 5);

  // Validate card properties: all must start in INACTIVE state
  const firstCard = batchRes.cards![0];
  assert.equal(firstCard.id, 'STF-0001');
  assert.equal(firstCard.regNumber, 'PLSCF-STF-2027-0001');
  assert.equal(firstCard.status, 'INACTIVE');
  assert.equal(firstCard.isActivated, false);
  assert.equal(firstCard.staffName, null);
  assert.ok(firstCard.token.length >= 6);
  assert.deepEqual(firstCard.mealFacilities, []);

  const fifthCard = batchRes.cards![4];
  assert.equal(fifthCard.id, 'STF-0005');
  assert.equal(fifthCard.regNumber, 'PLSCF-STF-2027-0005');
  assert.equal(fifthCard.status, 'INACTIVE');
  assert.equal(fifthCard.isActivated, false);
});

test('Staff Card System: 2. Inactive cards strictly blocked from Food Scanner', async () => {
  const cards = StaffCardService.getStaffCards();
  const inactiveCard = cards[0]; // STF-0001 is inactive

  // Attempt meal collection without activating
  const res = await StaffCardService.collectStaffMeal(
    inactiveCard.id,
    'lunch',
    inactiveCard.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: false }
  );

  assert.equal(res.success, false);
  assert.equal(res.errorType, 'CARD_NOT_ACTIVATED');
  assert.ok(res.error?.includes('Card Not Activated'));
});

test('Staff Card System: 3. Staff Card Activation & Entitlement Assignment', async () => {
  const cards = StaffCardService.getStaffCards();
  const cardToActivate = cards[0];

  // Super Admin scans inactive card and activates it with staff information & specific meal facilities
  const actRes = await StaffCardService.activateStaffCard(
    cardToActivate.id,
    {
      staffName: 'Md. Tariqul Islam',
      designation: 'Senior Security Officer',
      mobileNumber: '01712345678',
      department: 'Campus Security',
      notes: 'Main Gate Control Team',
      mealFacilities: ['breakfast', 'lunch'], // Breakfast + Lunch only (No dinner)
    },
    'SUPER_ADMIN_01',
    'Chief Convener'
  );

  assert.equal(actRes.success, true);
  assert.ok(actRes.card);
  assert.equal(actRes.card.status, 'ACTIVE');
  assert.equal(actRes.card.isActivated, true);
  assert.equal(actRes.card.staffName, 'Md. Tariqul Islam');
  assert.equal(actRes.card.designation, 'Senior Security Officer');
  assert.equal(actRes.card.department, 'Campus Security');
  assert.deepEqual(actRes.card.mealFacilities, ['breakfast', 'lunch']);
});

test('Staff Card System: 4. Meal Not Assigned Validation', async () => {
  const cards = StaffCardService.getStaffCards();
  const activeCard = cards[0]; // Has breakfast and lunch, but NOT dinner

  // Attempt to collect Dinner (which is not assigned)
  const dinnerRes = await StaffCardService.collectStaffMeal(
    activeCard.id,
    'dinner',
    activeCard.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: false }
  );

  assert.equal(dinnerRes.success, false);
  assert.equal(dinnerRes.errorType, 'MEAL_NOT_ASSIGNED');
  assert.ok(dinnerRes.error?.includes('Meal Not Assigned'));
});

test('Staff Card System: 5. Successful Meal Collection & Duplicate Protection', async () => {
  const cards = StaffCardService.getStaffCards();
  const activeCard = cards[0]; // Has lunch assigned

  // 1. First collection succeeds
  const firstCollect = await StaffCardService.collectStaffMeal(
    activeCard.id,
    'lunch',
    activeCard.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: false }
  );

  assert.equal(firstCollect.success, true);
  assert.ok(firstCollect.record);
  assert.equal(firstCollect.record.mealType, 'lunch');
  assert.equal(firstCollect.record.cardId, activeCard.id);

  // 2. Query meal facilities status confirms Collected
  const facilities = await StaffCardService.getMealFacilities(activeCard.id);
  assert.equal(facilities.lunch, 'Collected');
  assert.equal(facilities.breakfast, 'Available');
  assert.equal(facilities.dinner, 'Not Assigned');

  // 3. Duplicate collection is strictly rejected with ALREADY_COLLECTED
  const duplicateCollect = await StaffCardService.collectStaffMeal(
    activeCard.id,
    'lunch',
    activeCard.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: false }
  );

  assert.equal(duplicateCollect.success, false);
  assert.equal(duplicateCollect.errorType, 'ALREADY_COLLECTED');
  assert.equal(duplicateCollect.error, 'Already Collected');
});

test('Staff Card System: 6. Integration with Global Meal Timing & Timeout Control', async () => {
  const cards = StaffCardService.getStaffCards();
  const activeCard = cards[0]; // Has breakfast assigned

  // Super Admin turns Breakfast scanner MANUAL_OFF
  MealControlService.setScannerMode('breakfast', 'MANUAL_OFF');

  // Attempt to collect Breakfast while scanner is closed -> Rejects with Time Out
  const timeoutRes = await StaffCardService.collectStaffMeal(
    activeCard.id,
    'breakfast',
    activeCard.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: true }
  );

  assert.equal(timeoutRes.success, false);
  assert.equal(timeoutRes.errorType, 'TIMEOUT');
  assert.equal(timeoutRes.error, 'Time Out');

  // Super Admin turns Breakfast scanner MANUAL_ON
  MealControlService.setScannerMode('breakfast', 'MANUAL_ON');

  // Now collection succeeds
  const onRes = await StaffCardService.collectStaffMeal(
    activeCard.id,
    'breakfast',
    activeCard.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: true }
  );

  assert.equal(onRes.success, true);
  assert.ok(onRes.record);

  // Reset to scheduled
  MealControlService.setScannerMode('breakfast', 'SCHEDULED');
});

test('Staff Card System: 7. Individual Meal Entitlement Modification Anytime', async () => {
  const cards = StaffCardService.getStaffCards();
  const card = cards[0];

  // Super Admin updates entitlements to add Dinner
  const updateRes = await StaffCardService.updateEntitlements(
    card.id,
    ['breakfast', 'lunch', 'dinner'],
    'Super Admin'
  );

  assert.equal(updateRes.success, true);
  assert.ok(updateRes.card);
  assert.deepEqual(updateRes.card.mealFacilities, ['breakfast', 'lunch', 'dinner']);

  // Check updated facilities status
  const facilities = await StaffCardService.getMealFacilities(card.id);
  assert.equal(facilities.breakfast, 'Collected');
  assert.equal(facilities.lunch, 'Collected');
  assert.equal(facilities.dinner, 'Available');
});

test('Staff Card System: 8. Card Revocation & Reactivation Lifecycle', async () => {
  const cards = StaffCardService.getStaffCards();
  const card = cards[0];

  // Revoke card for security reason
  const revokeRes = await StaffCardService.revokeCard(
    card.id,
    'Lost badge reported on site',
    'Security Officer'
  );

  assert.equal(revokeRes.success, true);
  assert.ok(revokeRes.card);
  assert.equal(revokeRes.card.status, 'REVOKED');

  // Meal collection rejected for revoked card
  const collectRevoked = await StaffCardService.collectStaffMeal(
    card.id,
    'dinner',
    card.token,
    'STAFF_01',
    'Food Desk Operator',
    'Food Counter 01',
    { checkSchedule: false }
  );

  assert.equal(collectRevoked.success, false);
  assert.equal(collectRevoked.errorType, 'CARD_REVOKED');
  assert.equal(collectRevoked.error, 'Card Revoked');

  // Super Admin reactivates the card
  const reactivateRes = await StaffCardService.reactivateCard(card.id, 'Super Admin');
  assert.equal(reactivateRes.success, true);
  assert.ok(reactivateRes.card);
  assert.equal(reactivateRes.card.status, 'ACTIVE');
});

test('Staff Card System: 9. Directory Search, Filtering and Statistics', async () => {
  const stats = StaffCardService.getStatistics();
  assert.equal(stats.totalCards, 5);
  assert.equal(stats.activeCards, 1);
  assert.equal(stats.inactiveCards, 4);
  assert.equal(stats.revokedCards, 0);
  assert.equal(stats.totalBreakfastCollected, 1);
  assert.equal(stats.totalLunchCollected, 1);
  assert.equal(stats.totalDinnerCollected, 0);

  // Lookup by Code or Token
  const foundById = await StaffCardService.findStaffCardByCode('STF-0001');
  assert.ok(foundById);
  assert.equal(foundById.staffName, 'Md. Tariqul Islam');

  const foundByReg = await StaffCardService.findStaffCardByCode('PLSCF-STF-2027-0001');
  assert.ok(foundByReg);
  assert.equal(foundByReg.id, 'STF-0001');

  const foundByToken = await StaffCardService.findStaffCardByCode(foundById.token);
  assert.ok(foundByToken);
  assert.equal(foundByToken.id, 'STF-0001');
});
