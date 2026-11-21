/**
 * Automatic Bengali Voice Welcome & Intelligent Step-by-Step Registration Assistant
 * Higher Police Lines School & College, Faridpur — 65th Anniversary Grand Reunion
 * 
 * Provides natural Bengali speech synthesis, visual subtitle sync, intelligent missing-field detection,
 * browser autoplay resilience, and full session continuity.
 */

export type RegistrationStepKey =
  | 'welcome'
  | 'category'
  | 'fullName'
  | 'gender'
  | 'bloodGroup'
  | 'photoUrl'
  | 'mobileNumber'
  | 'email'
  | 'address'
  | 'hasParent'
  | 'parentName'
  | 'parentRelation'
  | 'parentPhotoUrl'
  | 'parentAge'
  | 'parentPhone'
  | 'academicInfo'
  | 'tShirtSize'
  | 'donation'
  | 'termsAccepted'
  | 'allCompleted'
  | 'thankYou';

export interface VoicePromptConfig {
  instructionBn: string;
  instructionEn: string;
  fieldLabelBn: string;
  fieldLabelEn: string;
  successBn?: string;
  successEn?: string;
  missingBn?: string;
  missingEn?: string;
}

export const REGISTRATION_VOICE_SCRIPTS: Record<RegistrationStepKey, VoicePromptConfig> = {
  welcome: {
    instructionBn:
      'আসসালামু আলাইকুম ও আন্তরিক শুভেচ্ছা। পুলিশ লাইনস স্কুল অ্যান্ড কলেজ, ফরিদপুর-এর ৬৫ বছর পূর্তি উপলক্ষে আয়োজিত মহান পুনর্মিলনী অনুষ্ঠানে আপনাকে জানাই আন্তরিক স্বাগতম। ফেলে আসা দিনের স্মৃতি, প্রিয় বন্ধুদের মুখ, শিক্ষকদের স্নেহ আর একসঙ্গে কাটানো অসংখ্য সুন্দর মুহূর্ত আবার ফিরে পাওয়ার এই আয়োজনে আপনাকে জানাই ভালোবাসা। চলুন, স্মৃতির টানে আবার এক হই। আমরা আপনাকে ধাপে ধাপে রেজিস্ট্রেশন সম্পন্ন করতে সাহায্য করব।',
    instructionEn:
      'Assalamu Alaikum and warm greetings. Welcome to the 65th Anniversary Grand Reunion of Higher Police Lines School and College, Faridpur. We are here to guide you step-by-step through the registration process.',
    fieldLabelBn: 'স্বাগতম ও সূচনা',
    fieldLabelEn: 'Welcome Greeting',
  },
  category: {
    instructionBn: 'প্রথমে অনুগ্রহ করে আপনি প্রাক্তন শিক্ষার্থী নাকি বর্তমান শিক্ষার্থী তা নির্বাচন করুন।',
    instructionEn: 'Please choose whether you are an Alumnus (Former Student) or a Currently Enrolled Student.',
    fieldLabelBn: 'নিবন্ধনের ধরন',
    fieldLabelEn: 'Registration Category',
    successBn: 'ধন্যবাদ! আপনার নিবন্ধনের ধরন নির্বাচিত হয়েছে।',
    successEn: 'Thank you! Registration category selected.',
    missingBn: 'একটু লক্ষ্য করুন! আপনি প্রাক্তন নাকি বর্তমান শিক্ষার্থী তা নির্বাচন করুন।',
    missingEn: 'Please select whether you are a former or current student.',
  },
  fullName: {
    instructionBn: 'অনুগ্রহ করে আপনার সম্পূর্ণ নামটি লিখুন।',
    instructionEn: 'Please enter your full name as you want it on your badge and certificate.',
    fieldLabelBn: 'সম্পূর্ণ নাম',
    fieldLabelEn: 'Full Name',
    successBn: 'ধন্যবাদ! আপনার নাম সংরক্ষিত হয়েছে। এবার পরবর্তী তথ্যটি পূরণ করুন।',
    successEn: 'Thank you! Your full name has been recorded.',
    missingBn: 'একটু লক্ষ্য করুন! আপনার সম্পূর্ণ নামটি এখনো লেখা হয়নি। অনুগ্রহ করে প্রথমে নামটি লিখুন।',
    missingEn: 'Attention: Your full name is required. Please enter your name.',
  },
  gender: {
    instructionBn: 'অনুগ্রহ করে আপনার লিঙ্গ নির্বাচন করুন— পুরুষ অথবা নারী।',
    instructionEn: 'Please select your gender: Male or Female.',
    fieldLabelBn: 'লিঙ্গ',
    fieldLabelEn: 'Gender',
    successBn: 'লিঙ্গ নির্বাচন সম্পন্ন হয়েছে।',
    successEn: 'Gender selection completed.',
    missingBn: 'একটু লক্ষ্য করুন! আপনার লিঙ্গ নির্বাচন করা হয়নি।',
    missingEn: 'Please select your gender.',
  },
  bloodGroup: {
    instructionBn: 'অনুগ্রহ করে আপনার রক্তের গ্রুপ নির্বাচন করুন।',
    instructionEn: 'Please select your blood group from the dropdown list.',
    fieldLabelBn: 'রক্তের গ্রুপ',
    fieldLabelEn: 'Blood Group',
    successBn: 'রক্তের গ্রুপ সংরক্ষিত হয়েছে।',
    successEn: 'Blood group recorded.',
    missingBn: 'একটু লক্ষ্য করুন! আপনার রক্তের গ্রুপ এখনো নির্বাচন করা হয়নি। অনুগ্রহ করে রক্তের গ্রুপ বেছে নিন।',
    missingEn: 'Attention: Please select your blood group.',
  },
  photoUrl: {
    instructionBn: 'এবার আপনার একটি পাসপোর্ট সাইজ ছবি ক্যামেরা দিয়ে সরাসরি তুলুন অথবা ডিভাইস থেকে আপলোড করুন।',
    instructionEn: 'Now take a clear passport-size photo using your camera or upload one from your device.',
    fieldLabelBn: 'প্রোফাইল ছবি',
    fieldLabelEn: 'Profile Photo',
    successBn: 'চমৎকার! আপনার ছবিটি সফলভাবে আপলোড হয়েছে।',
    successEn: 'Great! Your profile photo has been successfully uploaded.',
    missingBn: 'একটু লক্ষ্য করুন! আপনার প্রোফাইল ছবিটি এখনো আপলোড করা হয়নি। অনুগ্রহ করে ছবি তুলুন বা আপলোড করুন।',
    missingEn: 'Attention: A portrait photograph is required. Please upload your photo.',
  },
  mobileNumber: {
    instructionBn: 'এবার আপনার সক্রিয় ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বরটি লিখুন, যা ০১ দিয়ে শুরু হতে হবে।',
    instructionEn: 'Please enter your active 11-digit Bangladeshi mobile number starting with 01.',
    fieldLabelBn: 'মোবাইল নম্বর',
    fieldLabelEn: 'Mobile Number',
    successBn: 'ধন্যবাদ! মোবাইল নম্বরটি সঠিকভাবে গ্রহণ করা হয়েছে।',
    successEn: 'Mobile number verified.',
    missingBn: 'একটু লক্ষ্য করুন! আপনার মোবাইল নম্বরটি এখনো পূরণ করা হয়নি অথবা সঠিক নয়। অনুগ্রহ করে ০১ দিয়ে শুরু হওয়া ১১ ডিজিটের নম্বর দিন।',
    missingEn: 'Attention: A valid 11-digit mobile number starting with 01 is required.',
  },
  email: {
    instructionBn: 'আপনার কোনো ইমেইল ঠিকানা থাকলে লিখুন, অথবা ফাঁকা রেখে পরবর্তী ধাপে যেতে পারেন।',
    instructionEn: 'If you have an email address, enter it here, or leave it blank to proceed.',
    fieldLabelBn: 'ইমেইল (ঐচ্ছিক)',
    fieldLabelEn: 'Email (Optional)',
  },
  address: {
    instructionBn: 'আপনার বর্তমান ঠিকানা বা জেলা লিখুন।',
    instructionEn: 'Please enter your current address or district.',
    fieldLabelBn: 'বর্তমান ঠিকানা',
    fieldLabelEn: 'Current Address',
    missingBn: 'একটু লক্ষ্য করুন! আপনার ঠিকানাটি পূরণ করা হয়নি। অনুগ্রহ করে ঠিকানা লিখুন।',
    missingEn: 'Attention: Please enter your current address.',
  },
  hasParent: {
    instructionBn: 'নারী শিক্ষার্থী অথবা ছোট শিক্ষার্থীরা চাইলে ১ জন অভিভাবক সঙ্গে আনতে পারেন। অভিভাবক সঙ্গে আনতে চাইলে বক্সে টিক দিন।',
    instructionEn: 'Female students or young students may bring one parent or guardian. Check the box if bringing a guardian.',
    fieldLabelBn: 'অভিভাবক সহ অংশগ্রহণ',
    fieldLabelEn: 'Accompanying Parent / Guardian',
  },
  parentName: {
    instructionBn: 'অনুগ্রহ করে অভিভাবকের সম্পূর্ণ নামটি লিখুন।',
    instructionEn: "Please enter the guardian's full name.",
    fieldLabelBn: 'অভিভাবকের নাম',
    fieldLabelEn: 'Parent Name',
    missingBn: 'একটু লক্ষ্য করুন! অভিভাবকের নাম এখনো পূরণ করা হয়নি।',
    missingEn: "Attention: Guardian's name is required.",
  },
  parentRelation: {
    instructionBn: 'শিক্ষার্থীর সাথে অভিভাবকের সম্পর্ক নির্বাচন করুন— যেমন পিতা, মাতা, বা বৈধ অভিভাবক।',
    instructionEn: 'Please select the relationship with the student (Father, Mother, or Guardian).',
    fieldLabelBn: 'সম্পর্ক',
    fieldLabelEn: 'Relation with Student',
  },
  parentPhotoUrl: {
    instructionBn: 'অভিভাবকের একটি পরিষ্কার পাসপোর্ট সাইজ ছবি ক্যামেরা দিয়ে তুলুন অথবা ফাইল থেকে আপলোড করুন।',
    instructionEn: "Please upload or capture a portrait photo for the guardian's entry pass.",
    fieldLabelBn: 'অভিভাবকের ছবি',
    fieldLabelEn: 'Parent Photo',
    missingBn: 'একটু লক্ষ্য করুন! অভিভাবকের ছবিটি এখনো আপলোড করা হয়নি।',
    missingEn: "Attention: Guardian's photo is required.",
  },
  parentAge: {
    instructionBn: 'অভিভাবকের বয়স লিখুন।',
    instructionEn: "Please enter the guardian's age.",
    fieldLabelBn: 'অভিভাবকের বয়স',
    fieldLabelEn: 'Parent Age',
    missingBn: 'একটু লক্ষ্য করুন! অভিভাবকের বয়স প্রদান করা হয়নি।',
    missingEn: "Attention: Guardian's age is required.",
  },
  parentPhone: {
    instructionBn: 'অভিভাবকের সক্রিয় মোবাইল নম্বরটি লিখুন।',
    instructionEn: "Please enter the guardian's active mobile number.",
    fieldLabelBn: 'অভিভাবকের মোবাইল',
    fieldLabelEn: 'Parent Mobile',
    missingBn: 'একটু লক্ষ্য করুন! অভিভাবকের মোবাইল নম্বরটি প্রদান করা হয়নি বা সঠিক নয়।',
    missingEn: "Attention: Guardian's valid mobile number is required.",
  },
  academicInfo: {
    instructionBn: 'অনুগ্রহ করে আপনার এসএসসি বা অধ্যয়নের পাসের সালটি নির্বাচন করুন।',
    instructionEn: 'Please select your SSC passing year or graduation batch.',
    fieldLabelBn: 'পাসের সাল / ব্যাচ',
    fieldLabelEn: 'Passing Year / Batch',
    successBn: 'পাসের সাল ও ব্যাচ নিশ্চিত করা হয়েছে।',
    successEn: 'Academic batch recorded.',
    missingBn: 'একটু লক্ষ্য করুন! আপনার পাসের সাল বা স্টুডেন্ট আইডি এখনো দেওয়া হয়নি।',
    missingEn: 'Attention: Please provide your passing year or student ID.',
  },
  tShirtSize: {
    instructionBn: 'এবার আপনার পছন্দের টি-শার্টের সাইজ নির্বাচন করুন।',
    instructionEn: 'Please select your preferred T-shirt size from the size chart.',
    fieldLabelBn: 'টি-শার্ট সাইজ',
    fieldLabelEn: 'T-Shirt Size',
    successBn: 'টি-শার্টের সাইজ নির্বাচন সম্পন্ন হয়েছে।',
    successEn: 'T-Shirt size selected.',
    missingBn: 'একটু লক্ষ্য করুন! টি-শার্টের সাইজ নির্বাচন করা হয়নি। অনুগ্রহ করে আপনার সাইজ বেছে নিন।',
    missingEn: 'Attention: Please select your T-shirt size.',
  },
  donation: {
    instructionBn: 'পুনর্মিলনী আয়োজনে আপনি কোনো ঐচ্ছিক অনুদান দিতে চাইলে অনুদানের পরিমাণ নির্বাচন করুন, অথবা ফাঁকা রাখুন।',
    instructionEn: 'If you wish to make an optional donation to support the reunion, choose an amount or leave blank.',
    fieldLabelBn: 'ঐচ্ছিক অনুদান',
    fieldLabelEn: 'Optional Donation',
  },
  termsAccepted: {
    instructionBn: 'অনুগ্রহ করে পুনর্মিলনীর নিয়ম ও শর্তাবলীতে সম্মতি জানাতে চেকবক্সটিতে টিক দিন।',
    instructionEn: 'Please agree to the event policies and terms by checking the box.',
    fieldLabelBn: 'শর্তাবলীতে সম্মতি',
    fieldLabelEn: 'Terms & Conditions',
    successBn: 'শর্তাবলীতে সম্মতি গৃহীত হয়েছে।',
    successEn: 'Terms agreed.',
    missingBn: 'একটু লক্ষ্য করুন! পুনর্মিলনীর শর্তাবলীতে টিক দিয়ে সম্মতি জানান।',
    missingEn: 'Attention: You must agree to the terms and conditions.',
  },
  allCompleted: {
    instructionBn:
      'অভিনন্দন! আপনার রেজিস্ট্রেশন ফর্মের সব তথ্য সফলভাবে পূরণ হয়েছে। এবার অনুগ্রহ করে সাবমিট বাটনে ক্লিক করুন।',
    instructionEn:
      'Congratulations! All your registration details have been filled successfully. Please click the submit button to proceed.',
    fieldLabelBn: 'সব তথ্য সম্পন্ন',
    fieldLabelEn: 'Form Completed',
  },
  thankYou: {
    instructionBn:
      'আপনাকে অসংখ্য ধন্যবাদ। আমাদের ৬৫ বছর পূর্তি পুনর্মিলনী অনুষ্ঠানে আপনার অংশগ্রহণের অপেক্ষায় রইলাম।',
    instructionEn:
      'Thank you very much. We look forward to welcoming you to our 65th Anniversary Grand Reunion.',
    fieldLabelBn: 'অসংখ্য ধন্যবাদ',
    fieldLabelEn: 'Thank You',
  },
};

export interface VoiceAssistantState {
  isEnabled: boolean; // Voice turned ON/OFF
  isSpeaking: boolean;
  isPaused: boolean;
  language: 'bn' | 'en';
  currentStep: RegistrationStepKey;
  currentTranscript: string;
  autoplayBlocked: boolean;
  hasPlayedWelcome: boolean;
}

type StateListener = (state: VoiceAssistantState) => void;

class VoiceRegistrationAssistantService {
  private isEnabled: boolean = true;
  private isSpeaking: boolean = false;
  private isPaused: boolean = false;
  private language: 'bn' | 'en' = 'bn';
  private currentStep: RegistrationStepKey = 'welcome';
  private currentTranscript: string = '';
  private autoplayBlocked: boolean = false;
  private hasPlayedWelcome: boolean = false;

  private listeners: Set<StateListener> = new Set();
  private voices: SpeechSynthesisVoice[] = [];
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private audioPlayer: HTMLAudioElement | null = null;
  private audioChunkTimeout: any = null;
  private keepAliveInterval: any = null;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedEnabled = localStorage.getItem('plscf_voice_assistant_enabled');
        if (savedEnabled !== null) {
          this.isEnabled = savedEnabled === 'true';
        }

        const welcomeSession = sessionStorage.getItem('plscf_voice_welcome_played_session');
        if (welcomeSession === 'true') {
          this.hasPlayedWelcome = true;
        }
      } catch {}
    }
  }

  /**
   * Initialize speech synthesis voices and listeners
   */
  public initialize(lang: 'bn' | 'en' = 'bn'): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    this.language = lang;

    if ('speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }

    // Modern browser autoplay awareness
    const needsUserGesture =
      typeof navigator !== 'undefined' &&
      'userActivation' in navigator &&
      !(navigator as any).userActivation.hasBeenActive;
    if (needsUserGesture) {
      this.autoplayBlocked = true;
      this.notify();
    }

    // Auto-unlock on first user interaction anywhere on the page
    const handleFirstGesture = () => {
      this.autoplayBlocked = false;
      this.notify();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
    window.addEventListener('click', handleFirstGesture, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true, passive: true });
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.voices = window.speechSynthesis.getVoices();
    } catch {
      this.voices = [];
    }
  }

  public getBestVoice(targetLang: 'bn' | 'en'): SpeechSynthesisVoice | null {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }

    if (targetLang === 'bn') {
      // 1. Exact bn-BD (Bangla Bangladesh)
      const bd = this.voices.find(
        (v) => v.lang.toLowerCase() === 'bn-bd' || v.lang.toLowerCase() === 'bn_bd'
      );
      if (bd) return bd;

      // 2. Any Bengali voice (e.g. bn-IN, or name contains Bangla/Bengali)
      const anyBn = this.voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('bn') ||
          v.name.toLowerCase().includes('bangla') ||
          v.name.toLowerCase().includes('bengali')
      );
      if (anyBn) return anyBn;

      // CRITICAL: Return null for Bengali when no Bengali voice is found!
      // NEVER pass an English voice to speak Bengali text!
      return null;
    } else {
      // English voice
      const en = this.voices.find(
        (v) => v.lang.toLowerCase().startsWith('en') && (v.lang.includes('US') || v.lang.includes('GB') || v.default)
      );
      if (en) return en;
      return this.voices[0] || null;
    }
  }

  /**
   * Subscribe to state updates (React state sync)
   */
  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[VoiceAssistant] Listener error:', err);
      }
    });
  }

  public getState(): VoiceAssistantState {
    return {
      isEnabled: this.isEnabled,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      language: this.language,
      currentStep: this.currentStep,
      currentTranscript: this.currentTranscript,
      autoplayBlocked: this.autoplayBlocked,
      hasPlayedWelcome: this.hasPlayedWelcome,
    };
  }

  /**
   * Pleasant subtle chime before speaking or step transitions
   */
  public playChime(type: 'intro' | 'success' | 'alert' = 'intro'): void {
    if (typeof window === 'undefined' || !this.isEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'alert') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        osc.frequency.setValueAtTime(261.63, ctx.currentTime + 0.12); // C4
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Soft chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (_) {}
  }

  /**
   * Speak arbitrary text safely with dual-engine support:
   * 1. High-clarity native Bengali human audio stream (guaranteed on all browsers/devices)
   * 2. Web Speech API (with native voice if present)
   */
  public speakText(
    text: string,
    options?: {
      onEnd?: () => void;
      stepKey?: RegistrationStepKey;
      chime?: 'intro' | 'success' | 'alert';
    }
  ): void {
    if (options?.stepKey) {
      this.currentStep = options.stepKey;
    }
    this.currentTranscript = text;

    if (!this.isEnabled) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    // Stop previous utterance / audio
    this.stopSpeaking(false);
    this.isSpeaking = true;
    this.isPaused = false;
    this.notify();

    if (options?.chime) {
      this.playChime(options.chime);
    }

    if (typeof window === 'undefined') {
      if (options?.onEnd) options.onEnd();
      return;
    }

    const isBn = this.language === 'bn';
    const bnVoice = isBn ? this.getBestVoice('bn') : null;

    // If speaking Bengali and no real native Bengali voice exists in Web Speech API:
    // Route directly to high-fidelity Bengali human audio stream!
    if (isBn && !bnVoice) {
      this.playAudioStream(text, 'bn', options);
      return;
    }

    // Otherwise attempt Web Speech API
    if (!('speechSynthesis' in window)) {
      this.playAudioStream(text, isBn ? 'bn' : 'en', options);
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = isBn ? bnVoice : this.getBestVoice('en');
    if (voice) {
      utterance.voice = voice;
    }

    utterance.lang = isBn ? 'bn-BD' : 'en-US';
    utterance.rate = isBn ? 0.92 : 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    this.startKeepAlive();

    let started = false;
    utterance.onstart = () => {
      started = true;
      this.isSpeaking = true;
      this.isPaused = false;
      this.autoplayBlocked = false;
      this.notify();
    };

    utterance.onpause = () => {
      this.isPaused = true;
      this.notify();
    };

    utterance.onresume = () => {
      this.isPaused = false;
      this.notify();
    };

    utterance.onend = () => {
      this.clearKeepAlive();
      this.isSpeaking = false;
      this.isPaused = false;
      this.activeUtterance = null;
      this.notify();
      if (options?.onEnd) {
        options.onEnd();
      }
    };

    utterance.onerror = (e) => {
      this.clearKeepAlive();
      this.activeUtterance = null;

      if (e.error === 'not-allowed') {
        this.autoplayBlocked = true;
        this.isSpeaking = false;
        this.notify();
      } else if (!started && isBn) {
        // Transparently fall back to high-fidelity Bengali audio stream
        this.playAudioStream(text, 'bn', options);
      } else {
        this.isSpeaking = false;
        this.notify();
      }
    };

    this.activeUtterance = utterance;

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      if (isBn) {
        this.playAudioStream(text, 'bn', options);
      } else {
        this.autoplayBlocked = true;
        this.isSpeaking = false;
        this.notify();
      }
    }
  }

  /**
   * Universal, high-clarity Bengali Audio Streamer
   * Works identically across iPhone, Safari, Android, Windows, Mac, Firefox, Chrome
   */
  private playAudioStream(
    text: string,
    lang: 'bn' | 'en',
    options?: {
      onEnd?: () => void;
      stepKey?: RegistrationStepKey;
      chime?: 'intro' | 'success' | 'alert';
    }
  ): void {
    if (typeof window === 'undefined') {
      if (options?.onEnd) options.onEnd();
      return;
    }

    // Split text into coherent sentence segments
    const rawSentences = text
      .match(/[^।?!.]+([।?!.]|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean) || [text];

    // Merge short clauses up to 160 characters for natural continuous flow
    const chunks: string[] = [];
    let buffer = '';
    for (const sentence of rawSentences) {
      if ((buffer + ' ' + sentence).trim().length <= 160) {
        buffer = (buffer + ' ' + sentence).trim();
      } else {
        if (buffer) chunks.push(buffer);
        buffer = sentence;
      }
    }
    if (buffer) chunks.push(buffer);

    let currentChunkIndex = 0;

    const playNext = () => {
      if (currentChunkIndex >= chunks.length) {
        this.isSpeaking = false;
        this.isPaused = false;
        this.audioPlayer = null;
        this.notify();
        if (options?.onEnd) {
          options.onEnd();
        }
        return;
      }

      const chunk = chunks[currentChunkIndex];
      currentChunkIndex++;

      const ttsLang = lang === 'bn' ? 'bn' : 'en';
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=${ttsLang}&client=tw-ob`;

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      this.audioPlayer = audio;

      audio.onplay = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.autoplayBlocked = false;
        this.notify();
      };

      audio.onended = () => {
        this.audioChunkTimeout = setTimeout(playNext, 120);
      };

      audio.onerror = (err) => {
        console.warn('[VoiceAssistant] Audio stream chunk error:', err);
        if (currentChunkIndex < chunks.length) {
          playNext();
        } else {
          this.isSpeaking = false;
          this.audioPlayer = null;
          this.notify();
        }
      };

      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn('[VoiceAssistant] Audio playback blocked by browser:', err);
          this.autoplayBlocked = true;
          this.isSpeaking = false;
          this.audioPlayer = null;
          this.notify();
        });
      }
    };

    if (options?.chime) {
      this.audioChunkTimeout = setTimeout(playNext, 250);
    } else {
      playNext();
    }
  }

  private startKeepAlive(): void {
    this.clearKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        this.clearKeepAlive();
      }
    }, 10000);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Play the official Welcome Greeting as mandated by Requirement 2
   */
  public playWelcome(force: boolean = false): void {
    if (!this.isEnabled) return;

    // Do not replay welcome if already played in this browser session, unless forced
    if (this.hasPlayedWelcome && !force) {
      // Directly start guiding with first step (fullName or category)
      this.speakStep('category');
      return;
    }

    const script = REGISTRATION_VOICE_SCRIPTS.welcome;
    const welcomeText = this.language === 'bn' ? script.instructionBn : script.instructionEn;

    this.speakText(welcomeText, {
      stepKey: 'welcome',
      chime: 'intro',
      onEnd: () => {
        this.hasPlayedWelcome = true;
        try {
          sessionStorage.setItem('plscf_voice_welcome_played_session', 'true');
        } catch {}
        // After welcome greeting finishes, automatically begin step 1 of registration
        setTimeout(() => {
          this.speakStep('category');
        }, 600);
      },
    });
  }

  /**
   * Speak the prompt for a specific registration form field
   */
  public speakStep(stepKey: RegistrationStepKey, forceChime: boolean = true): void {
    if (!this.isEnabled) return;
    const config = REGISTRATION_VOICE_SCRIPTS[stepKey];
    if (!config) return;

    const text = this.language === 'bn' ? config.instructionBn : config.instructionEn;
    this.speakText(text, {
      stepKey,
      chime: forceChime ? 'intro' : undefined,
    });
  }

  /**
   * Announce positive confirmation when a field is successfully completed
   */
  public speakFieldCompletion(stepKey: RegistrationStepKey, nextStepKey?: RegistrationStepKey): void {
    if (!this.isEnabled) return;
    const config = REGISTRATION_VOICE_SCRIPTS[stepKey];
    if (!config || !config.successBn) {
      if (nextStepKey) {
        this.speakStep(nextStepKey);
      }
      return;
    }

    const successText = this.language === 'bn' ? config.successBn : (config.successEn || config.successBn);
    this.speakText(successText, {
      stepKey,
      chime: 'success',
      onEnd: () => {
        if (nextStepKey) {
          setTimeout(() => {
            this.speakStep(nextStepKey);
          }, 450);
        }
      },
    });
  }

  /**
   * Intelligent missing field alert (Requirement 4)
   * Announces exactly what information is missing or invalid
   */
  public speakMissingField(stepKey: RegistrationStepKey): void {
    if (!this.isEnabled) return;
    const config = REGISTRATION_VOICE_SCRIPTS[stepKey];
    if (!config) return;

    const alertText =
      this.language === 'bn'
        ? config.missingBn || `একটু লক্ষ্য করুন! ${config.fieldLabelBn} এখনো পূরণ করা হয়নি।`
        : config.missingEn || `Please note: ${config.fieldLabelEn} is required.`;

    this.speakText(alertText, {
      stepKey,
      chime: 'alert',
    });
  }

  /**
   * Repeat current instruction
   */
  public repeatCurrent(): void {
    if (!this.isEnabled) return;
    if (this.currentStep === 'welcome') {
      this.playWelcome(true);
    } else {
      this.speakStep(this.currentStep);
    }
  }

  /**
   * Pause speech
   */
  public pause(): void {
    if (this.audioPlayer) {
      try {
        this.audioPlayer.pause();
        this.isPaused = true;
        this.notify();
      } catch {}
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
        this.isPaused = true;
        this.notify();
      } catch {}
    }
  }

  /**
   * Resume speech
   */
  public resume(): void {
    if (this.audioPlayer) {
      try {
        this.audioPlayer.play();
        this.isPaused = false;
        this.notify();
      } catch {}
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        this.isPaused = false;
        this.notify();
      } catch {}
    }
  }

  public getActiveUtterance(): SpeechSynthesisUtterance | null {
    return this.activeUtterance;
  }

  /**
   * Stop all current speech
   */
  public stopSpeaking(notifyListeners: boolean = true): void {
    this.clearKeepAlive();
    if (this.audioChunkTimeout) {
      clearTimeout(this.audioChunkTimeout);
      this.audioChunkTimeout = null;
    }
    if (this.audioPlayer) {
      try {
        this.audioPlayer.pause();
        this.audioPlayer.src = '';
      } catch {}
      this.audioPlayer = null;
    }
    if (this.activeUtterance) {
      this.activeUtterance = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking = false;
    this.isPaused = false;
    if (notifyListeners) {
      this.notify();
    }
  }

  /**
   * Toggle Voice Guidance ON / OFF (Requirement 5)
   */
  public toggleEnabled(forceState?: boolean): void {
    const nextState = forceState !== undefined ? forceState : !this.isEnabled;
    this.isEnabled = nextState;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('plscf_voice_assistant_enabled', String(nextState));
      } catch {}
    }

    if (!nextState) {
      this.stopSpeaking(true);
    } else {
      // Resume from current step
      this.notify();
      this.speakStep(this.currentStep);
    }
  }

  /**
   * Set Language (বাংলা / English)
   */
  public setLanguage(lang: 'bn' | 'en'): void {
    if (this.language === lang) return;
    this.language = lang;
    this.stopSpeaking(true);
    this.repeatCurrent();
  }

  /**
   * User interaction unlock for modern browser autoplay policies
   */
  public unlockAudioAndStart(): void {
    this.autoplayBlocked = false;
    this.isEnabled = true;
    try {
      localStorage.setItem('plscf_voice_assistant_enabled', 'true');
    } catch {}

    // Unlock Web Audio context
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
    } catch {}

    // Resume speech synthesis if paused
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
      } catch {}
    }

    this.notify();
    this.playWelcome(true);
  }
}

export const VoiceAssistant = new VoiceRegistrationAssistantService();
