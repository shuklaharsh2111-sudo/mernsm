const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

// Round company badge. assigned=false turns it grey.
export default function CompanyBadge({ company, assigned = true, size = 64, showName = false }) {
  return (
    <div
      className={`company-badge ${assigned ? 'on' : 'off'}`}
      title={`${company.name}${assigned ? '' : ' (not assigned)'}`}
    >
      <div className="company-circle" style={{ width: size, height: size, fontSize: size / 2.8 }}>
        {company.logo ? <img src={company.logo} alt={company.name} /> : initialsOf(company.name)}
      </div>
      {showName && <span className="company-name">{company.name}</span>}
    </div>
  );
}

// A free slot (fewer than 5 companies exist yet).
export function EmptyBadge({ size = 64, showName = false }) {
  return (
    <div className="company-badge empty" title="No company in this slot yet">
      <div className="company-circle" style={{ width: size, height: size }} />
      {showName && <span className="company-name">—</span>}
    </div>
  );
}
