const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

// A white circle with the company's initials. Used on the SME dashboard (max 5).
export function CompanyBadge({ company, size = 72, showName = false }) {
  return (
    <div className="company-item" title={company.name}>
      <div className="company-circle" style={{ width: size, height: size, fontSize: size * 0.34 }}>
        {initials(company.name)}
      </div>
      {showName && <span className="company-name">{company.name}</span>}
    </div>
  );
}

// A dashed empty slot, shown for each of the 5 places not yet assigned.
export function EmptyBadge({ size = 72, showName = false }) {
  return (
    <div className="company-item empty" aria-hidden="true">
      <div className="company-circle empty" style={{ width: size, height: size }} />
      {showName && <span className="company-name">Not assigned</span>}
    </div>
  );
}
