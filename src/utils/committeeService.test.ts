import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommitteeService,
  COMMITTEE_PHOTOS_BUCKET,
  buildCommitteePhotoStoragePath,
} from '../services/committeeService';

test('1. CommitteeService: Loads default 16 committee members', () => {
  const members = CommitteeService.getMembers();
  assert.equal(members.length, 16);
  assert.equal(members[0].name, 'Dr. M. A. Kashem');
  assert.equal(members[0].order, 1);
  assert.equal(members[15].name, 'Mahmudul Hasan Shuvo');
  assert.equal(members[15].order, 16);
});

test('2. CommitteeService: Adds a new committee member with sequential order', () => {
  const newMember = CommitteeService.addMember({
    name: 'Test Member',
    nameBn: 'টেস্ট সদস্য',
    role: 'Advisor',
    desc: 'Senior Advisor',
    img: 'https://example.com/photo.jpg',
    order: 17,
    isActive: true,
  });

  assert.ok(newMember.id);
  assert.equal(newMember.name, 'Test Member');
  const all = CommitteeService.getMembers();
  assert.equal(all.length, 17);
  assert.equal(all[16].id, newMember.id);
});

test('3. CommitteeService: Updates an existing member', () => {
  const updated = CommitteeService.updateMember('COM-01', {
    name: 'Dr. M. A. Kashem (Updated)',
  });

  assert.ok(updated);
  assert.equal(updated?.name, 'Dr. M. A. Kashem (Updated)');
  const found = CommitteeService.getMembers().find((m) => m.id === 'COM-01');
  assert.equal(found?.name, 'Dr. M. A. Kashem (Updated)');
});

test('4. CommitteeService: Reorders member positions correctly', () => {
  // Move second member up to first position
  const membersBefore = CommitteeService.getMembers();
  const secondId = membersBefore[1].id;
  const reorderResult = CommitteeService.reorderMember(secondId, 'up');
  assert.equal(reorderResult, true);

  const membersAfter = CommitteeService.getMembers();
  assert.equal(membersAfter[0].id, secondId);
  assert.equal(membersAfter[0].order, 1);
});

test('5. CommitteeService: Deletes a committee member', () => {
  const initialLength = CommitteeService.getMembers().length;
  const deleted = CommitteeService.deleteMember('COM-03');
  assert.equal(deleted, true);

  const afterDelete = CommitteeService.getMembers();
  assert.equal(afterDelete.length, initialLength - 1);
  assert.equal(afterDelete.some((m) => m.id === 'COM-03'), false);
});

test('6. CommitteeService: Resets back to default 16 members', () => {
  const resetMembers = CommitteeService.resetToDefault();
  assert.equal(resetMembers.length, 16);
  assert.equal(resetMembers[0].name, 'Dr. M. A. Kashem');
  assert.equal(resetMembers[15].name, 'Mahmudul Hasan Shuvo');
});

test('7. CommitteeService: Manages carousel and grid settings', () => {
  const settings = CommitteeService.getSettings();
  assert.ok(settings.displayMode === 'carousel' || settings.displayMode === 'grid');

  CommitteeService.saveSettings({ displayMode: 'grid', autoScrollSpeedMs: 5000 });
  const updatedSettings = CommitteeService.getSettings();
  assert.equal(updatedSettings.displayMode, 'grid');
  assert.equal(updatedSettings.autoScrollSpeedMs, 5000);

  // Restore default
  CommitteeService.saveSettings({ displayMode: 'carousel', autoScrollSpeedMs: 3500 });
});

test('8. CommitteeService: buildCommitteePhotoStoragePath formats member folder path cleanly', () => {
  const path = buildCommitteePhotoStoragePath('Dr. M. A. Kashem', 'webp');
  assert.ok(path.startsWith('members/dr-m-a-kashem-'));
  assert.ok(path.endsWith('.webp'));
});

test('9. CommitteeService: uploadMemberPhoto rejects invalid image files and uploads valid images to committee-photos bucket', async () => {
  const invalidFile = new File(['not-an-image'], 'bad.txt', { type: 'text/plain' });
  const invalidRes = await CommitteeService.uploadMemberPhoto(invalidFile, 'COM-TEST');
  assert.equal(invalidRes.success, false);
  assert.ok(invalidRes.error);

  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = String(input);
    return new Response(JSON.stringify({ Key: `${COMMITTEE_PHOTOS_BUCKET}/members/com-99-test.webp` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  try {
    // Valid PNG magic bytes header
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const validPng = new File([pngBytes], 'member.png', { type: 'image/png' });
    const res = await CommitteeService.uploadMemberPhoto(validPng, 'COM-99');

    assert.equal(res.success, true);
    assert.ok(capturedUrl.includes(`/storage/v1/object/${COMMITTEE_PHOTOS_BUCKET}/members/com-99-`));
    assert.ok(res.publicUrl.includes(`/storage/v1/object/public/${COMMITTEE_PHOTOS_BUCKET}/members/com-99-`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
