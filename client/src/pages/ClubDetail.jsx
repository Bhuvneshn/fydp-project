import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { request } from '../api.js';
import { ClubLogo, StatusBadge, formatDate } from '../components/ClubBits.jsx';

export default function ClubDetail() {
  const { id } = useParams();
  const [club, setClub] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setClub(null);
    request(`/api/clubs/${id}`).then((d) => setClub(d.club)).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!club) return <p className="empty">Loading…</p>;

  const ig = club.instagram;

  return (
    <>
      <Link to="/clubs" className="back">← All clubs</Link>

      <div className="club-hero">
        <ClubLogo club={club} large />
        <div>
          <h1>{club.name}{club.acronym && ` (${club.acronym})`}</h1>
          <div className="chips">
            <StatusBadge instagram={ig} />
            {club.categories.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          {/* WUSA's tagline is usually a truncated copy of the description. */}
          {(club.description || club.tagline) && <Section title="About"><p>{club.description || club.tagline}</p></Section>}
          {club.membershipAndMeeting && <Section title="Membership & meetings"><p>{club.membershipAndMeeting}</p></Section>}
          {club.activities && <Section title="Activities"><p>{club.activities}</p></Section>}
          {club.other && <Section title="Other"><p>{club.other}</p></Section>}
          {club.gallery.length > 0 && (
            <Section title="Gallery">
              <div className="gallery">
                {club.gallery.map((url) => <img key={url} src={url} alt="" loading="lazy" />)}
              </div>
            </Section>
          )}
        </div>

        <aside>
          <Section title="Instagram activity">
            <dl className="facts">
              <dt>Status</dt><dd>{ig.reason}</dd>
              {ig.handle && <><dt>Account</dt><dd><a href={`https://www.instagram.com/${ig.handle}`} target="_blank" rel="noreferrer">@{ig.handle}</a></dd></>}
              {ig.lastPostAt && <><dt>Latest post</dt><dd>{formatDate(ig.lastPostAt)}</dd></>}
              {ig.checkedAt && <><dt>Checked</dt><dd>{formatDate(ig.checkedAt)}</dd></>}
            </dl>
          </Section>

          <Section title="Details">
            <dl className="facts">
              <dt>WUSA</dt><dd>{club.wusaActiveThisTerm ? 'Ratified' : 'Not ratified'} for {club.currentTermName}</dd>
              {club.memberCount != null && <><dt>Members</dt><dd>{club.memberCount}</dd></>}
              {club.executiveCount > 0 && <><dt>Executives</dt><dd>{club.executiveCount}</dd></>}
              {club.yearStarted && <><dt>Founded</dt><dd>{club.yearStarted}</dd></>}
              {club.wusaLastUpdated && <><dt>Updated</dt><dd>{formatDate(club.wusaLastUpdated)}</dd></>}
            </dl>
          </Section>

          <Section title="Links">
            <ul className="links">
              {club.socials.map((s) => (
                <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>
              ))}
              {club.email && <li><a href={`mailto:${club.email}`}>{club.email}</a></li>}
              <li><a href={club.wusaUrl} target="_blank" rel="noreferrer">WUSA club page</a></li>
            </ul>
          </Section>

          {club.associatedClubs.length > 0 && (
            <Section title="Associated clubs">
              <ul className="links">
                {club.associatedClubs.map((c) => <li key={c.id}><Link to={`/clubs/${c.id}`}>{c.name}</Link></li>)}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
