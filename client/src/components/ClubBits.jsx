import { useState } from 'react';

const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', unknown: 'Not checked' };
const STATUS_CLASS = { active: 'tag positive', inactive: 'tag', unknown: 'tag outline' };

// Initials tiles use the three tag tones, picked by name so each club keeps its colour.
const LOGO_TONES = ['campus', 'athletics', 'student'];
function logoTone(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return LOGO_TONES[h % LOGO_TONES.length];
}

export function ClubLogo({ club, large = false }) {
  const [failed, setFailed] = useState(false);
  const className = `logo ${logoTone(club.name)}${large ? ' large' : ''}`;
  if (club.logoUrl && !failed) {
    return <img className={className} src={club.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return <div className={className} aria-hidden="true">{(club.acronym || club.name).slice(0, 2).toUpperCase()}</div>;
}

export function StatusBadge({ instagram }) {
  return (
    <span className={STATUS_CLASS[instagram.status]} title={instagram.reason}>
      {STATUS_LABEL[instagram.status]}
    </span>
  );
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
}
