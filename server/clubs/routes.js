import { Router } from 'express';
import { db, toId } from '../db.js';
import { requireAuth } from '../auth.js';

export const clubsRouter = Router();
clubsRouter.use(requireAuth);

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Computed per request so the 30-day window is always relative to now.
function instagramActivity(club) {
  if (!club.instagram_handle) {
    return { status: 'inactive', reason: 'No Instagram linked' };
  }
  if (club.ig_last_post_at) {
    const active = Date.now() - Date.parse(club.ig_last_post_at) <= ACTIVE_WINDOW_MS;
    return {
      status: active ? 'active' : 'inactive',
      reason: active ? 'Posted on Instagram in the last month' : 'No Instagram post in the last month',
    };
  }
  if (club.ig_check_error === 'No posts') {
    return { status: 'inactive', reason: 'No Instagram posts' };
  }
  return {
    status: 'unknown',
    reason: club.ig_check_error ?? 'Instagram not checked yet',
  };
}

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
    wusaActiveThisTerm: Boolean(row.wusa_active_this_term),
    currentTermName: row.current_term_name,
    categories: JSON.parse(row.categories),
    socials: JSON.parse(row.socials),
    hasMeetingInfo: Boolean(row.membership_and_meeting),
    hasEmail: Boolean(row.email),
    wusaLastUpdated: row.wusa_last_updated,
    instagram: {
      handle: row.instagram_handle,
      lastPostAt: row.ig_last_post_at,
      checkedAt: row.ig_checked_at,
      ...instagramActivity(row),
    },
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
clubsRouter.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM clubs ORDER BY lower(name) COLLATE "C"').all();
  const lastScrapedAt = rows.reduce((max, r) => (r.scraped_at > max ? r.scraped_at : max), '') || null;
  res.json({ clubs: rows.map((r) => toClub(r)), lastScrapedAt });
});

clubsRouter.get('/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM clubs WHERE id = ?').get(toId(req.params.id));
  if (!row) return res.status(404).json({ error: 'Club not found.' });
  res.json({ club: toClub(row, { full: true }) });
});
