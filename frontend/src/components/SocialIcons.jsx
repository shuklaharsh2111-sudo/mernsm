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