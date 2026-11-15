import React from 'react';
import { StudentIdCardRecord } from '../../types/idcard';
import { Language } from '../../types';
import { OfficialCardBadge } from './OfficialCardBadge';

export interface ParentIdCardBadgeProps {
  student: StudentIdCardRecord;
  language?: Language;
  showActions?: boolean;
  className?: string;
  isPreview?: boolean;
}

export const ParentIdCardBadge: React.FC<ParentIdCardBadgeProps> = (props) => {
  return <OfficialCardBadge {...props} isParentPass={true} cardType="parent" />;
};
