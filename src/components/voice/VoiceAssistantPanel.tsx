import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Languages,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  VoiceAssistant,
  VoiceAssistantState,
  RegistrationStepKey,
  REGISTRATION_VOICE_SCRIPTS,
} from '../../services/voiceRegistrationAssistant';

interface VoiceAssistantPanelProps {
  onReplayCurrent?: () => void;
  className?: string;
}

export const VoiceAssistantPanel: React.FC<VoiceAssistantPanelProps> = ({ className = '' }) => {
  const [state, setState] = useState<VoiceAssistantState>(VoiceAssistant.getState());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = VoiceAssistant.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const config = REGISTRATION_VOICE_SCRIPTS[state.currentStep] || REGISTRATION_VOICE_SCRIPTS.welcome;
  const currentStepTitle = state.language === 'bn' ? config.fieldLabelBn : config.fieldLabelEn;

  return (
    <>
      {/* 1. AUTOPLAY BLOCKED FALLBACK PROMPT (Requirement 6) */}
      {state.autoplayBlocked && state.isEnabled && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg animate-bounce">
          <div className="bg-[#172554] text-white p-4 rounded-2xl shadow-2xl border-2 border-[#C5A45D] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C5A45D] text-slate-950 flex items-center justify-center font-black shrink-0">
                <Volume2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#C5A45D]">ভয়েস গাইডেন্স চালু করুন</p>
                <p className="text-sm font-extrabold text-white">
                  {state.language === 'bn' ? 'শুনুন ও রেজিস্ট্রেশন শুরু করুন' : 'Listen & Start Registration'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => VoiceAssistant.unlockAudioAndStart()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-xs shadow-md cursor-pointer shrink-0 transition-transform active:scale-95"
            >
              {state.language === 'bn' ? '▶ শুরু করুন' : '▶ Start Voice'}
            </button>
          </div>
        </div>
      )}

      {/* 2. FLOATING INTELLIGENT VOICE CONTROLLER (Requirement 5 & 7) */}
      <div
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-md w-[calc(100vw-2rem)] sm:w-auto transition-all duration-300 ${className}`}
      >
        <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden ring-1 ring-white/10">
          {/* Header Bar */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                  !state.isEnabled
                    ? 'bg-slate-800 text-slate-400'
                    : state.isSpeaking
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                }`}
              >
                {!state.isEnabled ? (
                  <VolumeX className="w-4 h-4" />
                ) : state.isSpeaking ? (
                  <div className="flex items-center gap-0.5 px-1">
                    <span className="w-1 h-3.5 bg-slate-950 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-4.5 bg-slate-950 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-3.5 bg-slate-950 rounded-full animate-bounce" />
                  </div>
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {state.language === 'bn' ? 'ভয়েস সহকারী' : 'Voice Assistant'}
                  </span>
                  {state.isSpeaking && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                </div>
                <h4 className="text-xs font-black text-slate-100 truncate">
                  {state.isEnabled
                    ? currentStepTitle
                    : state.language === 'bn'
                    ? 'ভয়েস গাইডেন্স বন্ধ'
                    : 'Voice Muted'}
                </h4>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Language Switch */}
              <button
                type="button"
                onClick={() => VoiceAssistant.setLanguage(state.language === 'bn' ? 'en' : 'bn')}
                className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-black text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1"
                title="Change Language"
              >
                <Languages className="w-3 h-3 text-indigo-400" />
                <span>{state.language === 'bn' ? 'English' : 'বাংলা'}</span>
              </button>

              {/* Toggle ON/OFF */}
              <button
                type="button"
                onClick={() => VoiceAssistant.toggleEnabled()}
                className={`p-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  state.isEnabled
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
                title={state.isEnabled ? 'Mute Voice' : 'Enable Voice'}
              >
                {state.isEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Collapse/Expand Toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expandable Body */}
          {isExpanded && state.isEnabled && (
            <div className="p-4 space-y-3">
              {/* Current spoken transcript bubble */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs leading-relaxed text-slate-200 font-medium relative shadow-inner">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#C5A45D] shrink-0 mt-0.5" />
                  <p className="flex-1 text-[13px] text-slate-100 font-sans">
                    {state.currentTranscript ||
                      (state.language === 'bn'
                        ? 'রেজিস্ট্রেশনের নির্দেশনা শুনতে প্রস্তুত...'
                        : 'Ready to guide you through registration...')}
                  </p>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  {/* Pause / Resume */}
                  {state.isSpeaking && !state.isPaused ? (
                    <button
                      type="button"
                      onClick={() => VoiceAssistant.pause()}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                      <span>{state.language === 'bn' ? 'থামান' : 'Pause'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (state.isPaused) {
                          VoiceAssistant.resume();
                        } else {
                          VoiceAssistant.repeatCurrent();
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{state.language === 'bn' ? 'চালু করুন' : 'Resume'}</span>
                    </button>
                  )}

                  {/* Repeat Current */}
                  <button
                    type="button"
                    onClick={() => VoiceAssistant.repeatCurrent()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                    title="Repeat Current Field Instruction"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{state.language === 'bn' ? 'পুনরায় শুনুন' : 'Repeat'}</span>
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  {state.language === 'bn' ? 'স্বয়ংক্রিয় বাংলা গাইড' : 'Bengali Voice AI'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * Field-level audio prompt button:
 * Placed immediately beside each field label to allow elder & novice visitors to tap and replay that specific step
 */
interface FieldVoiceButtonProps {
  stepKey: RegistrationStepKey;
  label?: string;
  className?: string;
}

export const FieldVoiceButton: React.FC<FieldVoiceButtonProps> = ({ stepKey, label, className = '' }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        VoiceAssistant.speakStep(stepKey, true);
      }}
      className={`inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full transition-all cursor-pointer active:scale-95 ${className}`}
      title="Tap to hear voice guidance for this field"
    >
      <Volume2 className="w-3 h-3 text-indigo-600 shrink-0" />
      <span>{label || 'শুনুন'}</span>
    </button>
  );
};
