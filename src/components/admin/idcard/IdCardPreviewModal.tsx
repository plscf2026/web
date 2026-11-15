/**
 * Police Lines School & College, Faridpur - Grand Reunion 2026 / 2027
 * Official Vector ID Card Preview Modal (Admin Portal)
 * Renders the authoritative SVG templates (Student, Alumni, and Parent Pass)
 */

import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StudentIdCardRecord } from '../../../types/idcard';
import { OfficialCardBadge } from '../../idcard/OfficialCardBadge';

interface IdCardPreviewModalProps {
  student: StudentIdCardRecord;
  currentUserName: string;
  currentUserRole: string;
  onClose: () => void;
  onCardGenerated?: () => void;
}

export const IdCardPreviewModal: React.FC<IdCardPreviewModalProps> = ({
  student,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'parent'>('student');

  if (!student) {
    return null;
  }

  const isCurrentStudent =
    student.category === 'current' ||
    (student.batchName || student.batchYear || '').toLowerCase().includes('class');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">
              {activeTab === 'parent'
                ? 'Parent / Guardian Pass Preview'
                : isCurrentStudent
                ? 'Current Student ID Card Preview'
                : 'Alumni Member ID Card Preview'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher if student registered with parent */}
        {student.hasParent && (
          <div className="px-6 pt-3 bg-slate-950/50 flex justify-center">
            <div className="flex p-1 bg-slate-800 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('student')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'student'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎓 {isCurrentStudent ? 'Student Card' : 'Alumni Card'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('parent')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'parent'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👨‍👩‍👧 Parent Pass
              </button>
            </div>
          </div>
        )}

        {/* Modal Content - The Official Card Render */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-900/60 overflow-y-auto">
          <OfficialCardBadge
            student={student}
            isParentPass={activeTab === 'parent' && Boolean(student.hasParent)}
            cardType={
              activeTab === 'parent' && Boolean(student.hasParent)
                ? 'parent'
                : isCurrentStudent
                ? 'student'
                : 'alumni'
            }
            showActions={true}
          />

          {/* Review Alert if missing info */}
          {student.cardStatus === 'FLAGGED_REVIEW' && (
            <div className="mt-4 w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Review Required:</strong> {student.reviewReason || 'Missing data detected.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
