import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Settings, CalendarDays, FolderOpen, Bookmark,
  ChartNoAxesCombined, FileBarChart, Clock, Building2, Receipt,
  CalendarCheck, Palette, UserCheck, Briefcase, Wifi, MapPin, Music, Megaphone, ListChecks, Lightbulb, FileText,
  ShieldCheck, UserPlus, Crown
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
      { title: 'Suggestions', path: '/rm/suggestions', icon: Lightbulb },
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
      // ON HOLD: { title: 'Devices & Locations', path: '/admin/devices', icon: MapPin },
      { title: 'Calendar', path: '/admin/calendar', icon: CalendarDays }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Suggestions', path: '/admin/suggestions', icon: Lightbulb },
      { title: 'Settings', path: '/admin/settings', icon: Settings }
    ]
  },
  {
    heading: 'Music', items: [
      { title: 'Playlist', path: '/admin/playlist', icon: Music }
    ]
  }
];
// Super admin: the super-admin pages (see src/superadmin) first, then everything a normal admin has.
export const SUPER_NAV = [
  {
    heading: 'Super Admin', items: [
      { title: 'Overall Dashboard', path: '/superadmin', icon: ShieldCheck },
      { title: 'Create Admin', path: '/superadmin/create-admin', icon: UserPlus },
      { title: 'Manage Admins', path: '/superadmin/manage-admins', icon: Crown }
    ]
  },
  // same pages as a normal admin, but the super admin sees them under their management names
  ...ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.map((i) => (
      i.path === '/admin/users' ? { ...i, title: 'Manage Employee' }
        : i.path === '/admin/companies' ? { ...i, title: 'Manage Company' } : i
    ))
  }))
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
      { title: 'Calendar', path: '/sme/calendar', icon: CalendarDays },
      { title: 'Companies', path: '/sme/companies', icon: Building2 }
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
      { title: 'Suggestions', path: '/sme/suggestions', icon: Lightbulb },
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
      { title: 'Suggestions', path: '/des/suggestions', icon: Lightbulb },
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
      { title: 'Dashboard', path: '/smi', icon: LayoutDashboard },
      { title: 'Companies', path: '/smi/companies', icon: Building2 }
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
      { title: 'Suggestions', path: '/smi/suggestions', icon: Lightbulb },
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
      { title: 'Online / Offline', path: '/hr/online', icon: Wifi },
      { title: 'Attendance', path: '/hr/attendance', icon: CalendarCheck }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Suggestions', path: '/hr/suggestions', icon: Lightbulb },
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
export const CLIENT_NAV = [
  {
    heading: 'Overview', items: [
      { title: 'Dashboard', path: '/client', icon: LayoutDashboard },
      { title: 'Calendar', path: '/client/calendar', icon: CalendarDays },
      { title: 'Forms', path: '/client/forms', icon: FileText }
    ]
  },
  {
    heading: 'Account', items: [
      { title: 'Settings', path: '/client/settings', icon: Settings }
    ]
  }
];
export const navFor = (role, isSuper = false) => {
  switch (role) {
    case 'admin': return isSuper ? SUPER_NAV : ADMIN_NAV;
    case 'operation_manager': return OM_NAV;
    case 'reporting_manager': return RM_NAV;
    case 'sme': return SME_NAV;
    case 'des': return DES_NAV;
    case 'smi': return SMI_NAV;
    case 'hr': return HR_NAV;
    case 'clients': return CLIENT_NAV;
    default: return [];
  }
};
export const titleFor = (role, pathname, isSuper = false) => {
  const groups = navFor(role, isSuper);
  const all = groups.flatMap((g) => g.items);
  const hit = [...all].sort((a, b) => b.path.length - a.path.length)
    .find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  return hit
    ? { title: hit.title, section: groups.find((g) => g.items.includes(hit))?.heading }
    : { title: 'Dashboard', section: 'Overview' };
};
