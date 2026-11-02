import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { toEvent } from '../events/routes.js';

export const athleticsRouter = Router();
athleticsRouter.use(requireAuth);

// Varsity games: last ~30 days of results plus everything upcoming that's been imported.
athleticsRouter.get('/schedule', (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, b.name AS building_name, b.lat, b.lng
       FROM events e LEFT JOIN buildings b ON b.code = e.building_code
       WHERE e.source = 'athletics'
       ORDER BY e.start_at`
    )
    .all();
  res.json({ games: rows.map((r) => toEvent(r)) });
});
