import test from 'node:test';
import assert from 'node:assert/strict';
import { EventStore } from '../services/eventStore';

test('Audit Trail - recordAuditHistory records locally and triggers database persistence', () => {
  const entry = EventStore.recordAuditHistory({
    adminId: 'ADMIN-01',
    adminName: 'Chief Proctor',
    entityType: 'REGISTRATION',
    entityId: 'PLSC-2027-001',
    action: 'APPROVE_MANUAL',
    previousValue: 'pending',
    newValue: 'approved',
    reason: 'Verified on-site token and payment receipt',
  });

  assert.ok(entry, 'Entry must be returned');
  assert.match(entry.id, /^HIST-/);
  assert.equal(entry.adminId, 'ADMIN-01');

  const history = EventStore.getAuditHistory();
  assert.ok(history.length >= 1, 'History must contain at least one record');
  assert.equal(history[0].entityId, 'PLSC-2027-001');
});

test('Audit Trail - syncAuditHistoryWithSupabase safely falls back to local cache when offline', async () => {
  EventStore.recordAuditHistory({
    adminId: 'SUPER_ADMIN',
    adminName: 'Super Administrator',
    entityType: 'STAFF',
    entityId: 'STF-TEST',
    action: 'CREATE_STAFF',
    newValue: 'Gate 01 Staff',
    reason: 'Test setup',
  });

  const result = await EventStore.syncAuditHistoryWithSupabase(true);
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 1);
});
