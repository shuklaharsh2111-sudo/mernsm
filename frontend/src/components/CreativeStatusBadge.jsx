import { Check, Clock, RotateCcw } from 'lucide-react';

// Admin review status of a creative. The admin's "reject" shows to the SME as "Redo".
export const STATUS_META = {
  pending: { label: 'Pending', icon: Clock },
  approved: { label: 'Approved', icon: Check },
  rejected: { label: 'Redo', icon: RotateCcw },
};

export default function CreativeStatusBadge({ status, compact = false }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`cstatus ${STATUS_META[status] ? status : 'pending'} ${compact ? 'compact' : ''}`} title={`Admin review: ${meta.label}`}>
      <Icon size={compact ? 10 : 13} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
