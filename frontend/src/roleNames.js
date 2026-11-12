
export const ROLE_NAMES = {
  admin: 'Admin',
  reporting_manager: 'Reporting Manager',
  sme: 'Social Media Executive',
  smi: 'Social Media Intern',
  des: 'Design Executive',
  hr: 'Human Resources',
  clients: 'Clients',
};

export const roleName = (role) => {
  const key = String(role || '').toLowerCase();
  return ROLE_NAMES[key] || String(role || '').replace(/_/g, ' ');
};
