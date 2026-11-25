import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AboutContactService,
  aboutContactContentToRow,
  rowToAboutContactContent,
} from '../services/aboutContactService';
import { DEFAULT_ABOUT_CONTACT_CONTENT } from '../types/aboutContact';
import { PORTAL_ROLE_CONFIGS } from '../types';

test('1. Default About & Contact content includes all bilingual fields and 3 objectives', () => {
  assert.equal(DEFAULT_ABOUT_CONTACT_CONTENT.id, 'singleton');
  assert.ok(DEFAULT_ABOUT_CONTACT_CONTENT.aboutHeadingEn.length > 0);
  assert.ok(DEFAULT_ABOUT_CONTACT_CONTENT.aboutHeadingBn.length > 0);
  assert.ok(DEFAULT_ABOUT_CONTACT_CONTENT.historyContentEn.length > 0);
  assert.ok(DEFAULT_ABOUT_CONTACT_CONTENT.historyContentBn.length > 0);
  assert.equal(DEFAULT_ABOUT_CONTACT_CONTENT.objectives.length, 3);
  assert.equal(DEFAULT_ABOUT_CONTACT_CONTENT.showInquiryForm, true);
});

test('2. DB row serialization & deserialization preserves all editable fields', () => {
  const edited = {
    ...DEFAULT_ABOUT_CONTACT_CONTENT,
    aboutHeadingEn: 'Updated Heading EN',
    aboutHeadingBn: 'আপডেটেড শিরোনাম বাংলা',
    helplinePhoneEn: '+880 1700-000000',
    helplineEmail: 'updated@plscf.edu.bd',
    showInquiryForm: false,
    objectives: [
      ...DEFAULT_ABOUT_CONTACT_CONTENT.objectives,
      {
        id: 'obj-4',
        titleEn: '4. Global Chapter Meetups',
        titleBn: '৪. গ্লোবাল চ্যাপ্টার মিটআপ',
        descriptionEn: 'Connecting alumni worldwide.',
        descriptionBn: 'বিশ্বজুড়ে প্রাক্তনদের সংযোগ।',
      },
    ],
  };

  const dbRow = aboutContactContentToRow(edited, 'Principal Admin');
  assert.equal(dbRow.id, 'singleton');
  assert.equal(dbRow.about_heading_en, 'Updated Heading EN');
  assert.equal(dbRow.about_heading_bn, 'আপডেটেড শিরোনাম বাংলা');
  assert.equal(dbRow.helpline_phone_en, '+880 1700-000000');
  assert.equal(dbRow.helpline_email, 'updated@plscf.edu.bd');
  assert.equal(dbRow.show_inquiry_form, false);
  assert.equal(dbRow.updated_by, 'Principal Admin');
  assert.equal(dbRow.objectives.length, 4);

  const restored = rowToAboutContactContent(dbRow);
  assert.equal(restored.aboutHeadingEn, 'Updated Heading EN');
  assert.equal(restored.aboutHeadingBn, 'আপডেটেড শিরোনাম বাংলা');
  assert.equal(restored.helplinePhoneEn, '+880 1700-000000');
  assert.equal(restored.helplineEmail, 'updated@plscf.edu.bd');
  assert.equal(restored.showInquiryForm, false);
  assert.equal(restored.objectives.length, 4);
});

test('3. Subscribers receive immediate live notification on cache update', () => {
  let receivedHeading = '';
  const unsubscribe = AboutContactService.subscribe((content) => {
    receivedHeading = content.aboutHeadingEn;
  });

  AboutContactService.setLocalCache(
    {
      ...DEFAULT_ABOUT_CONTACT_CONTENT,
      aboutHeadingEn: 'Live Broadcast Heading',
    },
    false
  );

  assert.equal(receivedHeading, 'Live Broadcast Heading');
  assert.equal(AboutContactService.getContent().aboutHeadingEn, 'Live Broadcast Heading');
  unsubscribe();

  // Restore clean default in memory
  AboutContactService.setLocalCache({ ...DEFAULT_ABOUT_CONTACT_CONTENT }, false);
});

test('4. Only Super Admin role config grants aboutContactManagement access', () => {
  assert.ok(PORTAL_ROLE_CONFIGS.super_admin.allowedTabs.includes('aboutContactManagement'));
  assert.equal(PORTAL_ROLE_CONFIGS.admin.allowedTabs.includes('aboutContactManagement'), false);
  assert.equal(PORTAL_ROLE_CONFIGS.moderator.allowedTabs.includes('aboutContactManagement'), false);
  assert.equal(PORTAL_ROLE_CONFIGS.finance_manager.allowedTabs.includes('aboutContactManagement'), false);
  assert.equal(PORTAL_ROLE_CONFIGS.registration_officer.allowedTabs.includes('aboutContactManagement'), false);
});
