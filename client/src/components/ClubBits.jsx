import { useState } from 'react';

const STATUS_LABEL = { active: 'Active', inactive: 'Inactive' };
const STATUS_CLASS = { active: 'tag positive', inactive: 'tag' };

export function ClubLogo({ club, large = false }) {
  const [failed, setFailed] = useState(false);
  const className = large ? 'logo club large' : 'logo club';
  if (club.logoUrl && !failed) {
    return <img className={className} src={club.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return <div className={className} aria-hidden="true">{(club.acronym || club.name).slice(0, 2).toUpperCase()}</div>;
}

export function StatusBadge({ status }) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
}
