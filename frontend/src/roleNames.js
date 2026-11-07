// Full names for the short role codes used across the app (the codes themselves are what the API stores).
export const ROLE_NAMES = {
  admin: 'Admin',
  reporting_manager: 'Reporting Manager',
  sme: 'Social Media Executive',
  smi: 'Social Media Intern',
  des: 'Design Executive',
  clients: 'Clients',
};

// 'SME' | 'sme' | 'REPORTING_MANAGER' -> 'Social Media Executive' | 'Reporting Manager'
export const roleName = (role) => {
  const key = String(role || '').toLowerCase();
  return ROLE_NAMES[key] || String(role || '').replace(/_/g, ' ');
};
