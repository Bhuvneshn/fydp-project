import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const clubsRouter = Router();
clubsRouter.use(requireAuth);

function toClub(row, { full = false } = {}) {
  const club = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    acronym: row.acronym,
    tagline: row.tagline,
    yearStarted: row.year_started,
    memberCount: row.member_count,
    executiveCount: row.executive_count,
    logoUrl: row.logo_url,
    // Active = listed as active for the current term on clubs.wusa.ca.
    status: row.wusa_active_this_term ? 'active' : 'inactive',
    currentTermName: row.current_term_name,
    categories: JSON.parse(row.categories),
    socials: JSON.parse(row.socials),
    hasMeetingInfo: Boolean(row.membership_and_meeting),
    hasEmail: Boolean(row.email),
    wusaLastUpdated: row.wusa_last_updated,
  };
  if (full) {
    Object.assign(club, {
      description: row.description,
      email: row.email,
      membershipAndMeeting: row.membership_and_meeting,
      activities: row.activities,
      other: row.other,
      associatedClubs: JSON.parse(row.associated_clubs),
      gallery: JSON.parse(row.gallery),
      wusaUrl: `https://clubs.wusa.ca/clubs/${row.id}`,
    });
  }
  return club;
}

// The directory is small (~300 clubs), so send it all and filter client-side.
clubsRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM clubs ORDER BY name COLLATE NOCASE').all();
  const lastScrapedAt = rows.reduce((max, r) => (r.scraped_at > max ? r.scraped_at : max), '') || null;
  res.json({ clubs: rows.map((r) => toClub(r)), lastScrapedAt });
});

clubsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clubs WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Club not found.' });
  res.json({ club: toClub(row, { full: true }) });
});
