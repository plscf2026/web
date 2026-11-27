import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizePublicReunionStats,
  ReunionStatsService,
} from '../services/reunionStatsService';

test('ReunionStatsService: normalizes snake_case Supabase RPC stats cleanly without fake minimums', () => {
  const zeroStats = normalizePublicReunionStats({
    total_registered: 0,
    former_students: 0,
    current_students: 0,
    batches_represented: 0,
    updated_at: '2026-11-27T07:40:29Z',
  });
  assert.deepEqual(zeroStats, {
    totalRegistered: 0,
    formerStudents: 0,
    currentStudents: 0,
    batchesRepresented: 0,
    updatedAt: '2026-11-27T07:40:29Z',
  });

  const liveStats = normalizePublicReunionStats({
    total_registered: 5,
    former_students: 5,
    current_students: 0,
    batches_represented: 2,
    updated_at: '2026-11-27T07:40:29Z',
  });
  assert.deepEqual(liveStats, {
    totalRegistered: 5,
    formerStudents: 5,
    currentStudents: 0,
    batchesRepresented: 2,
    updatedAt: '2026-11-27T07:40:29Z',
  });
});

test('ReunionStatsService: rejects invalid or non-object payloads cleanly', () => {
  assert.equal(normalizePublicReunionStats(null), null);
  assert.equal(normalizePublicReunionStats([]), null);
  assert.equal(normalizePublicReunionStats('bad'), null);
});

test('ReunionStatsService: initial snapshot fails safely in loading state without fabricated numbers', () => {
  const snap = ReunionStatsService.getSnapshot();
  assert.ok(['loading', 'ready', 'error'].includes(snap.status));
  if (snap.status === 'loading') {
    assert.equal(snap.stats, null);
  }
});

test('HomePage source: eradicates hardcoded 36 / 23 / 13 / 50+ stats fallbacks', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/components/HomePage.tsx'),
    'utf8'
  );
  assert.equal(src.includes('Math.max(paidCount, 36)'), false);
  assert.equal(src.includes('Math.max(formerCount, 23)'), false);
  assert.equal(src.includes('Math.max(currentCount, 13)'), false);
  assert.equal(src.includes('>50+<') || src.includes('\n                50+\n'), false);
  assert.equal(src.includes('ReunionStatsService'), true);
});
