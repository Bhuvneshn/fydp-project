import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { request } from '../api.js';
import { ClubLogo, StatusBadge, formatDate } from '../components/ClubBits.jsx';
import { FiltersIcon, SearchIcon } from '../components/Icons.jsx';
import { MEMBER_OPTIONS, SORTS, TABS, applyFilters, filterOptions, readFilters } from '../clubFilters.js';

export default function Clubs() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);

  useEffect(() => {
    request('/api/clubs').then(setData).catch((err) => setError(err.message));
  }, []);

  const clubs = data?.clubs ?? [];
  const options = useMemo(() => filterOptions(clubs), [clubs]);
  const { visible, counts } = applyFilters(clubs, filters);

  // Updates one query param (string, boolean or array); empty values are removed.
  function setParam(key, value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        for (const v of [].concat(value)) {
          if (v === true) next.set(key, '1');
          else if (v) next.append(key, v);
        }
        return next;
      },
      { replace: true }
    );
  }

  const toggle = (key, list, value) =>
    setParam(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  function clearFilters() {
    setParams(filters.tab === 'active' ? {} : { tab: filters.tab }, { replace: true });
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="empty">Loading clubs…</p>;
  if (clubs.length === 0) {
    return <p className="empty">No clubs yet. Run <code>npm run scrape:clubs</code> to import them from WUSA.</p>;
  }

  const tabNote = TABS.find((t) => t.value === filters.tab)?.note;
  const activeFilterCount =
    filters.categories.length + filters.socials.length +
    [filters.q, filters.minMembers, filters.from, filters.to, filters.meeting].filter(Boolean).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clubs</h1>
          <p>{clubs.length} clubs from the WUSA directory · synced {formatDate(data.lastScrapedAt)}</p>
        </div>
      </div>

      <div className="clubs-tabs">
        <div className="chip-row" role="group" aria-label="Instagram activity">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className="chip"
              aria-pressed={filters.tab === t.value}
              onClick={() => setParam('tab', t.value === 'active' ? '' : t.value)}
            >
              {t.label}
              <span className="count">{counts[t.value]}</span>
            </button>
          ))}
        </div>
        {tabNote && <p className="tab-note">{tabNote}</p>}
      </div>

      <div className="clubs-layout">
        <button type="button" className="btn btn-secondary filters-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          <FiltersIcon size={16} />
          {showFilters ? 'Hide filters' : 'Filters'}{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
        <aside className={showFilters ? 'filters open' : 'filters'} aria-label="Filters">
          <label className="search small-search">
            <SearchIcon size={18} />
            <span className="sr-only">Search clubs</span>
            <input
              type="search"
              placeholder="Name, acronym, tagline…"
              value={filters.q}
              onChange={(e) => setParam('q', e.target.value)}
            />
          </label>

          <div>
            <h3>Category</h3>
            {options.categories.map((c) => (
              <label key={c} className="check">
                <input type="checkbox" checked={filters.categories.includes(c)} onChange={() => toggle('cat', filters.categories, c)} />
                {c}
              </label>
            ))}
          </div>

          <div>
            <h3>Size</h3>
            <select className="select" aria-label="Size" value={filters.minMembers} onChange={(e) => setParam('members', e.target.value)}>
              {MEMBER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <h3>Founded</h3>
            <div className="row">
              <select className="select" aria-label="Founded from" value={filters.from} onChange={(e) => setParam('from', e.target.value)}>
                <option value="">From</option>
                {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="select" aria-label="Founded to" value={filters.to} onChange={(e) => setParam('to', e.target.value)}>
                <option value="">To</option>
                {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <h3>Has links</h3>
            {options.socials.map((s) => (
              <label key={s.value} className="check">
                <input type="checkbox" checked={filters.socials.includes(s.value)} onChange={() => toggle('social', filters.socials, s.value)} />
                {s.label}
              </label>
            ))}
            <label className="check">
              <input type="checkbox" checked={filters.meeting} onChange={(e) => setParam('meeting', e.target.checked)} />
              Meeting info
            </label>
          </div>

          <button type="button" className="btn btn-secondary btn-block" onClick={clearFilters}>Clear filters</button>
        </aside>

        <section className="clubs-results">
          <div className="toolbar">
            <span className="results-count">{visible.length} {visible.length === 1 ? 'club' : 'clubs'}</span>
            <select className="select" aria-label="Sort" value={filters.sort} onChange={(e) => setParam('sort', e.target.value === 'name' ? '' : e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="empty">No clubs match these filters.</p>
          ) : (
            <div className="club-grid">
              {visible.map((club) => <ClubCard key={club.id} club={club} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ClubCard({ club }) {
  return (
    <Link to={`/clubs/${club.id}`} className="club-card">
      <div className="top">
        <ClubLogo club={club} />
        <h2>{club.name}</h2>
      </div>
      {club.tagline && <p className="tagline">{club.tagline}</p>}
      <div className="meta">
        <StatusBadge status={club.status} />
        {club.categories.slice(0, 1).map((c) => <span key={c} className="tag">{c}</span>)}
        {club.categories.length > 1 && <span className="tag">+{club.categories.length - 1}</span>}
        <span className="card-meta">
          {[
            club.memberCount > 0 && `${club.memberCount} members`,
            club.yearStarted && `since ${club.yearStarted}`,
          ].filter(Boolean).join(' · ')}
        </span>
      </div>
    </Link>
  );
}
