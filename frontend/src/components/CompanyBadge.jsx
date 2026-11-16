const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
// Company badge with logo and initials fallback.
export function CompanyBadge({ company, size = 72, showName = false }) {
  return (
    <div className="company-item" title={company.name}>
      <div
        className="company-circle"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.34,
          overflow: 'hidden'
        }}
      >
        {company.logo ? (
          <img
            src={company.logo}
            alt={company.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '50%',
              display: 'block'
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <span style={{
          display: company.logo ? 'none' : 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {initials(company.name)}
        </span>
      </div>
      {showName && <span className="company-name">{company.name}</span>}
    </div>
  );
}
// Empty company slot.
export function EmptyBadge({ size = 72, showName = false }) {
  return (
    <div className="company-item empty" aria-hidden="true">
      <div className="company-circle empty" style={{ width: size, height: size }} />
      {showName && <span className="company-name">Not assigned</span>}
    </div>
  );
}
