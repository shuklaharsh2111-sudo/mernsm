// Slim, single-colour line logos. One shared glyph set so every platform icon in the app
// (calendar tabs, calendar header, pop-ups) looks identical. They follow the text colour.
const GLYPHS = {
  facebook: (
    <path d="M14.2 21v-8h2.7l.5-3.2h-3.2V7.9c0-.9.4-1.6 1.7-1.6h1.6V3.4c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.4H8V13h3v8z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  threads: (
    <path d="M17.6 9.2C16.8 6.5 14.8 5 12 5c-3.6 0-5.6 2.6-5.6 7s2 7 5.6 7c2.9 0 4.8-1.5 4.8-3.6 0-2.3-2-3.3-4.4-3.3-1.7 0-2.9.8-2.9 2 0 1.1 1 1.8 2.3 1.8 2 0 3.2-1.3 3.2-3.9v-.6" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <path d="M8 10.6V16" />
      <circle cx="8" cy="7.7" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 16v-5.4M12 13.3c0-1.5 1.1-2.7 2.5-2.7s2.5 1.2 2.5 2.7V16" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="4.2" />
      <path d="M10.2 9.4v5.2l4.4-2.6z" fill="currentColor" />
    </>
  ),
  x: (
    <>
      <path d="M4.8 4h3.9l10.5 16h-3.9z" />
      <path d="M18.6 4l-5.8 6.6M5.4 20l5.8-6.6" />
    </>
  ),
  pinterest: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.4 20.2l1.6-6.9" />
      <path d="M9.3 12.2c-.7-2.5.9-4.5 3.1-4.5 1.9 0 3.1 1.3 3.1 3.1 0 2.2-1.3 3.7-2.9 3.7-.9 0-1.5-.5-1.8-1.1" />
    </>
  ),
};

export const LinePlatformIcon = ({ platform, size = 18 }) => {
  const glyph = GLYPHS[platform];
  if (!glyph) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
};

export const FacebookIcon = ({ size = 14 }) => <LinePlatformIcon platform="facebook" size={size} />;
export const InstagramIcon = ({ size = 14 }) => <LinePlatformIcon platform="instagram" size={size} />;
export const ThreadsIcon = ({ size = 14 }) => <LinePlatformIcon platform="threads" size={size} />;
export const LinkedinIcon = ({ size = 14 }) => <LinePlatformIcon platform="linkedin" size={size} />;
export const YoutubeIcon = ({ size = 14 }) => <LinePlatformIcon platform="youtube" size={size} />;
export const XIcon = ({ size = 14 }) => <LinePlatformIcon platform="x" size={size} />;
export const PinterestIcon = ({ size = 14 }) => <LinePlatformIcon platform="pinterest" size={size} />;
