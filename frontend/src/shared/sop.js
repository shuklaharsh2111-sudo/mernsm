export const STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  revision: 'Needs redo',
};

export const fmt = (d) => (d ? new Date(d).toLocaleString() : '');
