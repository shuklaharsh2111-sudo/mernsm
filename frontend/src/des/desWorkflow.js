// The designer's own workflow for a creative (separate from the SME's approve / reject of the creative itself).
//   todo     - nothing delivered yet
//   redo     - SME sent the file back, a new version is needed
//   review   - delivered, waiting for the SME
//   approved - SME approved the file, it is final
export const WORKFLOW = {
  todo: { key: 'todo', label: 'To do', badge: 'pending', rank: 1 },
  redo: { key: 'redo', label: 'Redo requested', badge: 'rejected', rank: 0 },
  review: { key: 'review', label: 'Awaiting review', badge: 'review', rank: 2 },
  approved: { key: 'approved', label: 'Approved', badge: 'approved', rank: 3 }
};

export const workflowOf = (creative) => {
  const out = creative?.designOutput;
  if (!out || !out.url) return WORKFLOW.todo;
  if (out.status === 'approved') return WORKFLOW.approved;
  if (out.status === 'redo') return WORKFLOW.redo;
  return WORKFLOW.review;
};

// Redo first, then to do, then in review, then approved; earliest scheduled date first inside each group.
export const byPriority = (a, b) => {
  const diff = workflowOf(a).rank - workflowOf(b).rank;
  if (diff !== 0) return diff;
  return new Date(a.date || 0) - new Date(b.date || 0);
};

export const countByWorkflow = (creatives) => creatives.reduce(
  (acc, c) => {
    acc[workflowOf(c).key] += 1;
    acc.all += 1;
    return acc;
  },
  { all: 0, todo: 0, redo: 0, review: 0, approved: 0 }
);

export const formatDate = (date) => {
  if (!date) return 'Not specified';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
