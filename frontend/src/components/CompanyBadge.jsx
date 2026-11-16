
const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

// Company logo with initials fallback.
export function CompanyBadge({ company, size = 72, showName = false }) {
  const logo = company.logo;

  return (
    <div className="company-item" title={company.name}>
      <div
        className="company-circle"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.34,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt={`${company.name} logo`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '50%'
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.textContent = initials(company.name);
            }}
          />
        ) : (
          initials(company.name)
        )}
      </div>
      {showName && <span className="company-name">{company.name}</span>}
    </div>
  );
}

// Empty slot for unassigned companies.
export function EmptyBadge({ size = 72, showName = false }) {
  return (
    <div className="company-item empty" aria-hidden="true">
      <div className="company-circle empty" style={{ width: size, height: size }} />
      {showName && <span className="company-name">Not assigned</span>}
    </div>
  );
}
