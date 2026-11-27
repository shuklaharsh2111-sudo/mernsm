// Company health rules, shared by the SME pages and the super admin's company overview.
// Any ONE matching number puts the company in that level; the worst level wins.
//   healthy  = no delays, redo, rejections or overdue at all
//   risk     = 2 delays, 4 redo, 2 rejections or 2 overdue
//   critical = 3 delays, 5 redo, 3 rejections or 3 overdue
// Any other problem (below the risk numbers) is still not healthy, so it counts as risk.
export const HEALTH_RULES = {
  risk: { delays: 2, redo: 4, rejected: 2, overdue: 2 },
  critical: { delays: 3, redo: 5, rejected: 3, overdue: 3 },
};
export const healthOf = (m) => {
  const hit = (rule) =>
    m.delays >= rule.delays || m.redo >= rule.redo || m.rejected >= rule.rejected || m.overdue >= rule.overdue;
  if (hit(HEALTH_RULES.critical)) return 'critical';
  if (hit(HEALTH_RULES.risk)) return 'risk';
  if (m.delays || m.redo || m.rejected || m.overdue) return 'risk';
  return 'healthy';
};
