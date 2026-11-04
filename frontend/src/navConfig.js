import {
  LayoutDashboard, Users, Settings, CalendarDays, FolderOpen, Bookmark,
  ChartNoAxesCombined, FileBarChart, Clock, Building2, Receipt,
  CalendarCheck, Palette, UserCheck
} from 'lucide-react';

/* One source of truth for the sidebar groups and the page titles shown in the top bar. */
export const ADMIN_NAV = [
  { heading: 'Overview', items: [
    { title: 'Dashboard', path: '/admin', icon: LayoutDashboard }
  ] },
  { heading: 'Management', items: [
    { title: 'Users', path: '/admin/users', icon: Users },
    { title: 'Companies', path: '/admin/companies', icon: Building2 },
    { title: 'Invoices', path: '/admin/invoices', icon: Receipt }
  ] },
  { heading: 'Operations', items: [
    { title: 'Meetings', path: '/admin/meetings', icon: CalendarCheck },
    { title: 'Creatives', path: '/admin/creatives', icon: Palette },
    { title: 'Attendance', path: '/admin/attendance', icon: UserCheck },
    { title: 'Calendar', path: '/admin/calendar', icon: CalendarDays }
  ] }
];

export const SME_NAV = [
  { heading: 'Overview', items: [
    { title: 'Dashboard', path: '/sme', icon: LayoutDashboard },
    { title: 'Calendar', path: '/sme/calendar', icon: CalendarDays }
  ] },
  { heading: 'Workflow', items: [
    { title: 'Pending Creative', path: '/sme/pending-creatives', icon: Clock },
    { title: 'Records', path: '/sme/records', icon: FolderOpen },
    { title: 'Saved', path: '/sme/saved', icon: Bookmark }
  ] },
  { heading: 'Insights', items: [
    { title: 'Analytics', path: '/sme/analytics', icon: ChartNoAxesCombined },
    { title: 'Monthly Reports', path: '/sme/monthly-reports', icon: FileBarChart }
  ] },
  { heading: 'Account', items: [
    { title: 'Settings', path: '/sme/settings', icon: Settings }
  ] }
];

export const navFor = (role) => (role === 'admin' ? ADMIN_NAV : SME_NAV);

export const titleFor = (role, pathname) => {
  const all = navFor(role).flatMap((g) => g.items);
  const hit = [...all].sort((a, b) => b.path.length - a.path.length)
    .find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  return hit ? { title: hit.title, section: navFor(role).find((g) => g.items.includes(hit))?.heading } : { title: 'Dashboard', section: 'Overview' };
};
