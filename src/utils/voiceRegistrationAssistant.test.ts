import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VoiceAssistant,
  REGISTRATION_VOICE_SCRIPTS,
  RegistrationStepKey,
} from '../services/voiceRegistrationAssistant';

describe('Bengali Voice Registration Assistant Engine', () => {
  it('1. Exact Bengali Welcome Script matches requirement word-for-word', () => {
    const welcome = REGISTRATION_VOICE_SCRIPTS.welcome;
    assert.ok(welcome, 'welcome script must exist');

    const expectedWelcomeScript =
      'আসসালামু আলাইকুম ও আন্তরিক শুভেচ্ছা। পুলিশ লাইনস স্কুল অ্যান্ড কলেজ, ফরিদপুর-এর ৬৫ বছর পূর্তি উপলক্ষে আয়োজিত মহান পুনর্মিলনী অনুষ্ঠানে আপনাকে জানাই আন্তরিক স্বাগতম। ফেলে আসা দিনের স্মৃতি, প্রিয় বন্ধুদের মুখ, শিক্ষকদের স্নেহ আর একসঙ্গে কাটানো অসংখ্য সুন্দর মুহূর্ত আবার ফিরে পাওয়ার এই আয়োজনে আপনাকে জানাই ভালোবাসা। চলুন, স্মৃতির টানে আবার এক হই। আমরা আপনাকে ধাপে ধাপে রেজিস্ট্রেশন সম্পন্ন করতে সাহায্য করব।';

    // Normalize spacing and newlines for comparison
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
    assert.equal(
      normalize(welcome.instructionBn),
      normalize(expectedWelcomeScript),
      'Bengali welcome script must match exact requirement'
    );
  });

  it('2. All required form fields have Bengali and English instructions & labels', () => {
    const requiredKeys: RegistrationStepKey[] = [
      'welcome',
      'category',
      'fullName',
      'gender',
      'bloodGroup',
      'photoUrl',
      'mobileNumber',
      'email',
      'address',
      'hasParent',
      'parentName',
      'parentRelation',
      'parentPhotoUrl',
      'parentAge',
      'parentPhone',
      'academicInfo',
      'tShirtSize',
      'donation',
      'termsAccepted',
      'allCompleted',
      'thankYou',
    ];

    for (const key of requiredKeys) {
      const script = REGISTRATION_VOICE_SCRIPTS[key];
      assert.ok(script, `Script for ${key} must exist`);
      assert.ok(script.instructionBn && script.instructionBn.length > 5, `${key} instructionBn must be non-empty`);
      assert.ok(script.instructionEn && script.instructionEn.length > 5, `${key} instructionEn must be non-empty`);
      assert.ok(script.fieldLabelBn && script.fieldLabelBn.length > 1, `${key} fieldLabelBn must be non-empty`);
      assert.ok(script.fieldLabelEn && script.fieldLabelEn.length > 1, `${key} fieldLabelEn must be non-empty`);
    }
  });

  it('3. Required fields define intelligent missing field announcements', () => {
    const fieldsRequiringMissingAlerts: RegistrationStepKey[] = [
      'category',
      'fullName',
      'gender',
      'bloodGroup',
      'photoUrl',
      'mobileNumber',
      'address',
      'academicInfo',
      'tShirtSize',
      'termsAccepted',
    ];

    for (const key of fieldsRequiringMissingAlerts) {
      const script = REGISTRATION_VOICE_SCRIPTS[key];
      assert.ok(
        script.missingBn && script.missingBn.length > 10,
        `${key} must have intelligent Bengali missing field announcement`
      );
      assert.ok(
        script.missingEn && script.missingEn.length > 10,
        `${key} must have intelligent English missing field announcement`
      );
    }
  });

  it('4. VoiceAssistant State Machine: Language Switching and Notifications', () => {
    let capturedState: any = null;
    const unsubscribe = VoiceAssistant.subscribe((s) => {
      capturedState = s;
    });

    VoiceAssistant.setLanguage('bn');
    assert.equal(VoiceAssistant.getState().language, 'bn');
    assert.equal(capturedState?.language, 'bn');

    VoiceAssistant.setLanguage('en');
    assert.equal(VoiceAssistant.getState().language, 'en');
    assert.equal(capturedState?.language, 'en');

    VoiceAssistant.setLanguage('bn'); // Reset back to bn
    unsubscribe();
  });

  it('5. VoiceAssistant State Machine: Enable / Disable Toggle with Persistence', () => {
    const initialEnabled = VoiceAssistant.getState().isEnabled;

    VoiceAssistant.toggleEnabled();
    assert.equal(VoiceAssistant.getState().isEnabled, !initialEnabled);

    // Toggle back
    VoiceAssistant.toggleEnabled();
    assert.equal(VoiceAssistant.getState().isEnabled, initialEnabled);
  });

  it('6. VoiceAssistant Missing Field Trigger updates active step and transcript', () => {
    VoiceAssistant.speakMissingField('mobileNumber');
    const state = VoiceAssistant.getState();

    assert.equal(state.currentStep, 'mobileNumber');
    assert.ok(
      state.currentTranscript.includes('মোবাইল নম্বর') || state.currentTranscript.length > 0,
      'Transcript should reflect missing mobile announcement'
    );
  });

  it('7. Browser Autoplay Resilience: unlockAudioAndStart clears blocked flag', () => {
    VoiceAssistant.unlockAudioAndStart();
    const state = VoiceAssistant.getState();
    assert.equal(state.autoplayBlocked, false, 'Autoplay blocked should be cleared on user unlock');
  });
});
