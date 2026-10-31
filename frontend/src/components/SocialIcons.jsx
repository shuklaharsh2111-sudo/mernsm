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
