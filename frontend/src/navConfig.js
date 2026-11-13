import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Settings, CalendarDays, FolderOpen, Bookmark,
  ChartNoAxesCombined, FileBarChart, Clock, Building2, Receipt,
  CalendarCheck, Palette, UserCheck
} from 'lucide-react';
export const ADMIN_NAV = [
  {
    heading: 'Overview', items: [
      { title: 'Dashboard', path: '/admin', icon: LayoutDashboard }
    ]
  },
  {
    heading: 'Management', items: [
      { title: 'Users', path: '/admin/users', icon: Users },
      { title: 'Companies', path: '/admin/companies', icon: Building2 },
      { title: 'Invoices', path: '/admin/invoices', icon: Receipt }
    ]
  },
  {
    heading: 'Operations', items: [
      { title: 'Meetings', path: '/admin/meetings', icon: CalendarCheck },
      { title: 'Creatives', path: '/admin/creatives', icon: Palette },
      { title: 'Attendance', path: '/admin/attendance', icon: UserCheck },
      { title: 'Calendar', path: '/admin/calendar', icon: CalendarDays }
    ]
  }
];
export const SME_NAV = [
  {
    heading: 'Overview', items: [
      { title: 'Dashboard', path: '/sme', icon: LayoutDashboard },
      { title: 'Calendar', path: '/sme/calendar', icon: CalendarDays }
    ]
  },
  {
    heading: 'Workflow', items: [
      { title: 'Pending Creative', path: '/sme/pending-creatives', icon: Clock },
      { title: 'Records', path: '/sme/records', icon: FolderOpen },
      { title: 'Saved', path: '/sme/saved', icon: Bookmark }
    ]
  },
  {
    heading: 'Insights', items: [
      { title: 'Analytics', path: '/sme/analytics', icon: ChartNoAxesCombined },
      { title: 'Monthly Reports', path: '/sme/monthly-reports', icon: FileBarChart }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/sme/settings', icon: Settings }
    ]
  }
];
export const DES_NAV = [
  {
    heading: 'Overview',
    items: [
      { title: 'Dashboard', path: '/des', icon: LayoutDashboard },
      { title: 'Calendar', path: '/des/calendar', icon: CalendarDays }
    ]
  },
  {
    heading: 'Workflow',
    items: [
      { title: 'Creatives', path: '/des/creatives', icon: Palette }
    ]
  },
  {
    heading: 'Insights',
    items: [
      { title: 'Monthly Reports', path: '/des/monthly-reports', icon: FileBarChart }
    ]
  }
];
export const SMI_NAV = [
  {
    heading: 'Overview',
    items: [
      { title: 'Dashboard', path: '/smi', icon: LayoutDashboard }
    ]
  },
  {
    heading: 'Workflow',
    items: [
      { title: 'Saved', path: '/smi/saved', icon: Bookmark }
    ]
  }
];
export const HR_NAV = [
  {
    heading: 'Overview',
    items: [
      { title: 'Dashboard', path: '/hr', icon: LayoutDashboard }
    ]
  },
  {
    heading: 'Management',
    items: [
      { title: 'Employees', path: '/hr/employees', icon: Users },
      { title: 'Attendance', path: '/hr/attendance', icon: UserCheck }
    ]
  }
];
export const navFor = (role) => {
  switch (role) {
    case 'admin': return ADMIN_NAV;
    case 'sme': return SME_NAV;
    case 'des': return DES_NAV;
    case 'smi': return SMI_NAV;
    case 'hr': return HR_NAV;
    default: return [];
  }
};
export const titleFor = (role, pathname) => {
  const groups = navFor(role);
  const all = groups.flatMap((g) => g.items);
  const hit = [...all].sort((a, b) => b.path.length - a.path.length)
    .find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  return hit
    ? { title: hit.title, section: groups.find((g) => g.items.includes(hit))?.heading }
    : { title: 'Dashboard', section: 'Overview' };
};
