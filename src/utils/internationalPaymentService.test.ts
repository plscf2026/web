import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERNATIONAL_PAYMENT_INFO,
  InternationalPaymentService,
  normalizeInternationalPaymentInfo,
} from '../services/internationalPaymentService';
import { DEFAULT_ABOUT_CONTACT_CONTENT } from '../types/aboutContact';
import { PORTAL_ROLE_CONFIGS } from '../types';
import { getUrlForView } from './navigation';

test('1. InternationalPaymentService: Default fields include bank, routing, SWIFT, mobile, and email', () => {
  assert.equal(DEFAULT_INTERNATIONAL_PAYMENT_INFO.isEnabled, true);
  assert.ok(DEFAULT_INTERNATIONAL_PAYMENT_INFO.bankName.length > 0);
  assert.ok(DEFAULT_INTERNATIONAL_PAYMENT_INFO.accountNumber.length > 0);
  assert.ok(DEFAULT_INTERNATIONAL_PAYMENT_INFO.routingNumber.length > 0);
  assert.ok(DEFAULT_INTERNATIONAL_PAYMENT_INFO.swiftCode.length > 0);
  assert.equal(DEFAULT_INTERNATIONAL_PAYMENT_INFO.contactEmail, 'sagarsaha3371@gmail.com');
  assert.ok(DEFAULT_INTERNATIONAL_PAYMENT_INFO.mobileNumber.includes('+880 1637-85 7040'));
});

test('2. InternationalPaymentService: Normalization and local cache subscription update live', () => {
  const normalized = normalizeInternationalPaymentInfo({
    bankName: 'Dutch-Bangla Bank PLC',
    accountNumber: '1234567890',
    routingNumber: '090261234',
    swiftCode: 'DBBLBDDH',
  });
  assert.equal(normalized.bankName, 'Dutch-Bangla Bank PLC');
  assert.equal(normalized.accountNumber, '1234567890');
  assert.equal(normalized.routingNumber, '090261234');

  let observedBank = '';
  const unsub = InternationalPaymentService.subscribe((info) => {
    observedBank = info.bankName;
  });
  InternationalPaymentService.setLocalCache(normalized, false);
  assert.equal(observedBank, 'Dutch-Bangla Bank PLC');
  unsub();

  InternationalPaymentService.setLocalCache({ ...DEFAULT_INTERNATIONAL_PAYMENT_INFO }, false);
});

test('3. Navigation and Super Admin role include international-payment page & CMS tab', () => {
  assert.equal(getUrlForView('international-payment'), '/international-payment');
  assert.ok(PORTAL_ROLE_CONFIGS.super_admin.allowedTabs.includes('internationalPaymentManagement'));
  assert.equal(PORTAL_ROLE_CONFIGS.admin.allowedTabs.includes('internationalPaymentManagement'), false);
});

test('4. Default contact details reflect Kamlapur address, official phones, email, and 65 Years', () => {
  assert.equal(
    DEFAULT_ABOUT_CONTACT_CONTENT.addressEn,
    'Police Lines area in Kamlapur, Faridpur Sadar, Faridpur-7800'
  );
  assert.equal(
    DEFAULT_ABOUT_CONTACT_CONTENT.helplinePhoneEn,
    '+880 1637-85 7040 / +880 1309-026240'
  );
  assert.equal(DEFAULT_ABOUT_CONTACT_CONTENT.helplineEmail, 'sagarsaha3371@gmail.com');
  assert.ok(DEFAULT_ABOUT_CONTACT_CONTENT.historyTitleEn.includes('65 Years'));
});
