import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Settings, CalendarDays, FolderOpen, Bookmark,
  ChartNoAxesCombined, FileBarChart, Clock, Building2, Receipt,
  CalendarCheck, Palette, UserCheck, Briefcase, Wifi, Music, Megaphone, ListChecks
} from 'lucide-react';
export const RM_NAV = [
  {
    heading: 'Overview', items: [
      { title: 'Dashboard', path: '/rm', icon: LayoutDashboard }
    ]
  },
  {
    heading: 'My Team', items: [
      { title: 'Team', path: '/rm/team', icon: Users },
      { title: 'Attendance', path: '/rm/attendance', icon: UserCheck }
    ]
  },
  {
    heading: 'Approvals', items: [
      { title: 'Creatives', path: '/rm/creatives', icon: Palette },
      { title: 'Meetings', path: '/rm/meetings', icon: CalendarCheck }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/rm/settings', icon: Settings }
    ]
  },
  {
    heading: 'Music', items: [
      { title: 'Playlist', path: '/rm/playlist', icon: Music }
    ]
  }
];
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
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/admin/settings', icon: Settings }
    ]
  },
  {
    heading: 'Music', items: [
      { title: 'Playlist', path: '/admin/playlist', icon: Music }
    ]
  }
];
// Operation Manager: the admin menu under /om, minus the user/company setup pages.
const withBase = (groups, from, to) => groups.map((g) => ({
  ...g,
  items: g.items.map((i) => ({ ...i, path: i.path.replace(from, to) }))
}));
// Manage-only: no Users or Companies pages (adding people/companies stays with the admin).
const OM_HIDDEN = ['/om/users', '/om/companies'];
export const OM_NAV = withBase(ADMIN_NAV, '/admin', '/om')
  .map((g) => ({ ...g, items: g.items.filter((i) => !OM_HIDDEN.includes(i.path)) }))
  .filter((g) => g.items.length);
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
      { title: 'Saved', path: '/sme/saved', icon: Bookmark },
      { title: 'Influencers', path: '/sme/influencers', icon: Megaphone }
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
  },
  {
    heading: 'Music', items: [
      { title: 'Playlist', path: '/sme/playlist', icon: Music }
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
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/des/settings', icon: Settings }
    ]
  },
  {
    heading: 'Music',
    items: [
      { title: 'Playlist', path: '/des/playlist', icon: Music }
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
      { title: 'Saved', path: '/smi/saved', icon: Bookmark },
      { title: 'Influencers', path: '/smi/influencers', icon: Megaphone }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/smi/settings', icon: Settings }
    ]
  },
  {
    heading: 'Music',
    items: [
      { title: 'Playlist', path: '/smi/playlist', icon: Music }
    ]
  }
];
export const HR_NAV = [
  {
    heading: 'Hiring',
    items: [
      { title: 'Recruitment', path: '/hr/recruitment', icon: Briefcase },
      { title: 'Base Skills', path: '/hr/base-skills', icon: ListChecks }
    ]
  },
  {
    heading: 'People',
    items: [
      { title: 'Employees', path: '/hr/employees', icon: Users },
      { title: 'Online / Offline', path: '/hr/online', icon: Wifi }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/hr/settings', icon: Settings }
    ]
  },
  {
    heading: 'Music',
    items: [
      { title: 'Playlist', path: '/hr/playlist', icon: Music }
    ]
  }
];
export const navFor = (role) => {
  switch (role) {
    case 'admin': return ADMIN_NAV;
    case 'operation_manager': return OM_NAV;
    case 'reporting_manager': return RM_NAV;
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
