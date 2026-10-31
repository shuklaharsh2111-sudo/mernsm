export default function Avatar({ name = '', src = '', size = 72 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div className="admin-avatar" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {src ? <img src={src} alt={name} /> : initials || '?'}
    </div>
  );
}
