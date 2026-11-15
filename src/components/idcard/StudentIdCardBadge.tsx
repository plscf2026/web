import React from 'react';
import { StudentIdCardRecord } from '../../types/idcard';
import { Language } from '../../types';
import { OfficialCardBadge } from './OfficialCardBadge';

export interface StudentIdCardBadgeProps {
  student: StudentIdCardRecord;
  language?: Language;
  showActions?: boolean;
  className?: string;
  customPhotoSlot?: React.ReactNode;
  isPreview?: boolean;
}

export const StudentIdCardBadge: React.FC<StudentIdCardBadgeProps> = (props) => {
  return <OfficialCardBadge {...props} />;
};
