import React, { useState } from 'react';
import { Key, Eye, EyeOff, Lock, ShieldCheck, AlertCircle, LogOut } from 'lucide-react';
import { UserManagementService } from '../../services/userManagementService';
import { Language } from '../../types';

interface ForcePasswordChangeGateProps {
  fullName: string;
  username: string;
  role: string;
  language?: Language;
  onPasswordUpdated: () => void;
  onLogout: () => void;
}

export const ForcePasswordChangeGate: React.FC<ForcePasswordChangeGateProps> = ({
  fullName,
  username,
  role,
  language = 'en',
  onPasswordUpdated,
  onLogout,
}) => {
  const isBn = language === 'bn';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = newPassword.trim();
    if (trimmed.length < 6) {
      setErrorMsg(isBn ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters long.');
      return;
    }
    if (trimmed !== confirmPassword.trim()) {
      setErrorMsg(isBn ? 'পাসওয়ার্ড দুটো মিলছে না।' : 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await UserManagementService.completeForcedPasswordChange(trimmed);
      if (res.success) {
        onPasswordUpdated();
      } else {
        setErrorMsg(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to complete password change.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-amber-200 shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Security Required
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-1">
                {isBn ? 'নতুন পাসওয়ার্ড সেট করুন' : 'Change Temporary Password'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isBn ? 'লগআউট' : 'Sign Out'}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
          <div className="font-bold text-slate-900">{fullName}</div>
          <div className="text-slate-500 font-mono text-[11px]">
            @{username} • {role}
          </div>
          <p className="text-slate-600 pt-1 leading-relaxed">
            {isBn
              ? 'আপনার অ্যাকাউন্টের সাময়িক পাসওয়ার্ড পরিবর্তন করা বাধ্যতামূলক। পোর্টালে প্রবেশ করতে একটি নতুন স্থায়ী পাসওয়ার্ড সেট করুন।'
              : 'Your account is using a temporary password issued by the Super Administrator. Please set your own private password before continuing.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {isBn ? 'নতুন স্থায়ী পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *' : 'NEW PERMANENT PASSWORD (MIN 6 CHARS) *'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {isBn ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন *' : 'CONFIRM NEW PASSWORD *'}
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <span>{isBn ? 'আপডেট হচ্ছে...' : 'Updating Password...'}</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{isBn ? 'নতুন পাসওয়ার্ড সংরক্ষণ ও প্রবেশ করুন' : 'Update Password & Continue'}</span>
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Lock className="w-3 h-3" />
          <span>Secured via Supabase Auth</span>
        </div>
      </div>
    </div>
  );
};
