// Small inline brand icons (lucide-react no longer ships brand logos).
const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export const InstagramIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

export const FacebookIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />
  </svg>
);

export const LinkedinIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="M7 10v7M7 7v.01M11 17v-7M11 13a3 3 0 0 1 6 0v4" />
    <rect x="3" y="3" width="18" height="18" rx="3" />
  </svg>
);

export const XIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="M4 4l16 16M20 4L4 20" />
  </svg>
);

export const YoutubeIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
  </svg>
);

export const ThreadsIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="M17.6 9.2C16.8 6.5 14.8 5 12 5c-3.6 0-5.6 2.6-5.6 7s2 7 5.6 7c2.9 0 4.8-1.5 4.8-3.6 0-2.3-2-3.3-4.4-3.3-1.7 0-2.9.8-2.9 2 0 1.1 1 1.8 2.3 1.8 2 0 3.2-1.3 3.2-3.9v-.6" />
  </svg>
);

export const PinterestIcon = ({ size = 14 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10.6 20l1.6-6.4M9.4 12.6c-.8-2.7 1-4.6 3.1-4.6 2 0 3.1 1.5 3.1 3.1 0 2.3-1.4 3.9-3.1 3.9-.9 0-1.6-.5-1.9-1.1" />
  </svg>
);

// Clean single-colour line icons (used by the calendar platform strip). They follow the text colour.
export const LinePlatformIcon = ({ platform, size = 40 }) => {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  switch (platform) {
    case 'facebook':
      return (<svg {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>);
    case 'instagram':
      return (<svg {...p}><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></svg>);
    case 'threads':
      return (<svg {...p}><path d="M17.6 9.2C16.8 6.5 14.8 5 12 5c-3.6 0-5.6 2.6-5.6 7s2 7 5.6 7c2.9 0 4.8-1.5 4.8-3.6 0-2.3-2-3.3-4.4-3.3-1.7 0-2.9.8-2.9 2 0 1.1 1 1.8 2.3 1.8 2 0 3.2-1.3 3.2-3.9v-.6" /></svg>);
    case 'linkedin':
      return (<svg {...p}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>);
    case 'youtube':
      return (<svg {...p}><path d="M22.5 6.4a2.8 2.8 0 0 0-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 11.8a29 29 0 0 0 .5 5.3 2.8 2.8 0 0 0 1.9 2c1.7.5 8.6.5 8.6.5s6.900 0 8.600-.5a2.800 2.800 0 0 0 1.900-2 29 29 0 0 0 .5-5.300 29 29 0 0 0-.5-5.400z" /><path d="M9.750 15 15.500 11.750 9.750 8.500z" /></svg>);
    case 'x':
      return (<svg {...p}><path d="M4 4l11.700 16H20L8.300 4zM4 20l6.800-6.800M13.200 10.800 20 4" /></svg>);
    case 'pinterest':
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 20l4-9" /><path d="M10.700 14c.4 1.300 1.400 2 2.500 2 2.100 0 3.800-1.600 3.800-4a5 5 0 1 0-9.700 1.700" /></svg>);
    default:
      return null;
  }
};
