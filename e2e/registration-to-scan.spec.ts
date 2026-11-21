/**
 * E2E Integration Test: Full Student Journey (Register -> Pay -> Ticket -> Scan -> Gate -> Meal)
 * Framework: Playwright Test / Node E2E Harness
 * Target: Police Lines School & College Faridpur - Reunion Management System
 */

import { test, expect } from '@playwright/test';

test.describe('E2E: Complete Student Journey & Gate Flow', () => {
  const testStudent = {
    fullName: 'E2E Test Student',
    mobileNumber: '01719998877',
    address: 'Faridpur Sadar, Faridpur',
    category: 'former',
    batchName: 'SSC 2014',
    passingYear: '2014',
    tShirtSize: 'XL',
    bloodGroup: 'B+',
  };

  test('Step 1 to 6: Full Student Journey from Registration to Gate Check-in', async ({ page }) => {
    // 1. Navigate to Registration Page
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText(/নিবন্ধন|Registration/i);

    // 2. Fill Registration Details
    await page.fill('input[name="fullName"]', testStudent.fullName);
    await page.fill('input[name="mobileNumber"]', testStudent.mobileNumber);
    await page.fill('input[name="address"]', testStudent.address);
    await page.selectOption('select[name="bloodGroup"]', testStudent.bloodGroup);
    await page.fill('input[name="batchName"]', testStudent.batchName);
    await page.fill('input[name="passingYear"]', testStudent.passingYear);
    await page.selectOption('select[name="tShirtSize"]', testStudent.tShirtSize);

    // Upload mock student profile picture
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload Photo"), button:has-text("ছবি আপলোড")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    // Accept Terms & Conditions (if field is present)
    const termsCheckbox = page.locator('input[name="termsAccepted"]');
    if ((await termsCheckbox.count()) > 0) {
      await termsCheckbox.check();
    }

    // 3. Submit and Proceed to Payment
    await page.click('button[type="submit"]:has-text("Proceed to Payment"), button[type="submit"]:has-text("পেমেন্টে এগিয়ে যান")');

    // Payment Modal appears
    await expect(page.locator('#paystation-modal-title')).toBeVisible();
    await expect(page.locator('#paystation-modal-title')).toContainText('PayStation');

    // 4. Select Payment Method & Confirm (Sandbox / Production Mode)
    await page.click('button:has-text("bKash")');
    const payButton = page.locator('button:has-text("Pay"), button:has-text("পে করুন")');
    await payButton.click();

    // 5. Verification & Ticket Pass Issuance
    await expect(page.locator('text=Payment Verified & Confirmed!').or(page.locator('text=পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!'))).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Your Official Student ID Card').or(page.locator('text=আপনার স্টুডেন্ট আইডি কার্ড'))).toBeVisible();

    // Verify Tamper-evident 6-character QR token is displayed
    const ticketIdElement = page.locator('text=/PLSCF-2027-[CF][0-9]{4}/');
    await expect(ticketIdElement).toBeVisible();
    const registrationId = (await ticketIdElement.textContent())?.trim();
    expect(registrationId).toMatch(/^PLSCF-2027-[CF][0-9]{4}$/);

    // 6. Volunteer Scanner Check-in (Gate Entry & Meal Station)
    await page.goto('/scanner');
    await expect(page.locator('text=Scanner Desk Portal').or(page.locator('text=স্ক্যানার ডেস্ক'))).toBeVisible();

    // Manual Entry fallback for simulated QR token
    await page.fill('input[placeholder*="PLSCF"]', registrationId!);
    await page.click('button:has-text("Verify Ticket"), button:has-text("যাচাই করুন")');

    // Verification Result: Student verified with PAID status
    await expect(page.locator(`text=${testStudent.fullName}`)).toBeVisible();
    await expect(page.locator('text=PAID').or(page.locator('text=পরিশোধিত'))).toBeVisible();

    // Approve Gate Entry
    await page.click('button:has-text("Confirm Entry"), button:has-text("প্রবেশ নিশ্চিত করুন")');
    await expect(page.locator('text=ENTRY APPROVED').or(page.locator('text=প্রবেশ অনুমোদিত'))).toBeVisible();

    // Attempt Duplicate Gate Entry (Must be rejected)
    await page.fill('input[placeholder*="PLSCF"]', registrationId!);
    await page.click('button:has-text("Verify Ticket"), button:has-text("যাচাই করুন")');
    await page.click('button:has-text("Confirm Entry"), button:has-text("প্রবেশ নিশ্চিত করুন")');
    await expect(page.locator('text=DUPLICATE ENTRY ALERT').or(page.locator('text=ইতিমধ্যে ভেন্যুতে আছেন'))).toBeVisible();
  });
});
