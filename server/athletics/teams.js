// Intramural team finder: teams looking for players, and players looking for teams.
import { Router } from 'express';
import { db, toId } from '../db.js';
import { requireAuth } from '../auth.js';
import { DIVISIONS, INTRAMURAL_SPORTS, SKILL_LEVELS } from './intramurals.js';

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

const MAX_OPEN_POSTS = 5;
const SPORT_NAMES = new Set(INTRAMURAL_SPORTS.map((s) => s.name));

// Public handle = WatIAM part of the email.
const handleOf = (email) => email.split('@')[0];

const POST_SELECT = `
  SELECT p.*, u.email AS author_email,
         (SELECT COUNT(*) FROM team_responses r WHERE r.post_id = p.id AND r.status = 'pending') AS pending_count
  FROM team_posts p JOIN users u ON u.id = p.user_id
`;

function toPost(row, userId, myResponse = null) {
  return {
    id: row.id,
    kind: row.kind,
    sport: row.sport,
    division: row.division,
    skill: row.skill,
    teamName: row.team_name,
    playersHave: row.players_have,
    teamSize: row.team_size,
    spotsLeft: row.kind === 'team' ? Math.max(row.team_size - row.players_have, 0) : null,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    author: handleOf(row.author_email),
    isMine: row.user_id === userId,
    pendingCount: row.user_id === userId ? row.pending_count : undefined,
    myResponse,
  };
}

function findPost(id) {
  return db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(toId(id));
}

async function ownPostOr404(req, res) {
  const post = await findPost(req.params.id);
  if (!post || post.user_id !== req.session.userId) {
    res.status(404).json({ error: 'Post not found.' });
    return null;
  }
  return post;
}

const cleanText = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const toInt = (v) => (v === '' || v == null ? null : Number.parseInt(v, 10));

// Returns [values, error].
function validatePost(body) {
  const kind = body.kind === 'player' ? 'player' : body.kind === 'team' ? 'team' : null;
  if (!kind) return [null, 'Choose whether you are a team or a player.'];
  if (!SPORT_NAMES.has(body.sport)) return [null, 'Choose an intramural sport.'];
  if (body.division && !DIVISIONS.includes(body.division)) return [null, 'Unknown division.'];
  if (body.skill && !SKILL_LEVELS.includes(body.skill)) return [null, 'Unknown skill level.'];

  const values = {
    kind,
    sport: body.sport,
    division: body.division || null,
    skill: body.skill || null,
    team_name: kind === 'team' ? cleanText(body.teamName, 60) : null,
    players_have: null,
    team_size: null,
    note: cleanText(body.note, 500),
  };

  if (kind === 'team') {
    const size = toInt(body.teamSize);
    const have = toInt(body.playersHave);
    if (!Number.isInteger(size) || size < 2 || size > 30) return [null, 'Team size must be between 2 and 30.'];
    if (!Number.isInteger(have) || have < 1 || have >= size) {
      return [null, `Players you have must be between 1 and ${size - 1}.`];
    }
    values.team_size = size;
    values.players_have = have;
  }
  return [values, null];
}

teamsRouter.get('/options', (req, res) => {
  res.json({ sports: INTRAMURAL_SPORTS, divisions: DIVISIONS, skills: SKILL_LEVELS });
});

// Open posts, newest first. ?kind=team|player&sport=
teamsRouter.get('/', async (req, res) => {
  const where = ["p.status = 'open'"];
  const args = [];
  if (req.query.kind === 'team' || req.query.kind === 'player') {
    where.push('p.kind = ?');
    args.push(req.query.kind);
  }
  if (req.query.sport) {
    where.push('p.sport = ?');
    args.push(String(req.query.sport));
  }
  const rows = await db.prepare(`${POST_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC`).all(...args);
  const responses = await db.prepare('SELECT post_id, status FROM team_responses WHERE user_id = ?').all(req.session.userId);
  const mine = new Map(responses.map((r) => [r.post_id, { status: r.status }]));
  res.json({ posts: rows.map((r) => toPost(r, req.session.userId, mine.get(r.id) ?? null)) });
});

// My posts (with who responded) and my requests on other people's posts.
teamsRouter.get('/mine', async (req, res) => {
  const userId = req.session.userId;
  const posts = await db.prepare(`${POST_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC`).all(userId);
  const responsesFor = db.prepare(
    `SELECT r.*, u.email FROM team_responses r JOIN users u ON u.id = r.user_id
     WHERE r.post_id = ? ORDER BY r.created_at`
  );
  const myResponses = await db
    .prepare(
      `SELECT r.id AS response_id, r.status AS response_status, r.message AS response_message,
              r.created_at AS responded_at, p.*, u.email AS author_email, 0 AS pending_count
       FROM team_responses r JOIN team_posts p ON p.id = r.post_id JOIN users u ON u.id = p.user_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`
    )
    .all(userId);

  res.json({
    posts: await Promise.all(
      posts.map(async (p) => ({
        ...toPost(p, userId),
        responses: (await responsesFor.all(p.id)).map((r) => ({
          id: r.id,
          handle: handleOf(r.email),
          email: r.email,
          message: r.message,
          status: r.status,
          createdAt: r.created_at,
        })),
      }))
    ),
    requests: myResponses.map((r) => ({
      id: r.response_id,
      status: r.response_status,
      message: r.response_message,
      createdAt: r.responded_at,
      post: toPost(r, userId),
      // The poster's email is shared once they accept.
      contactEmail: r.response_status === 'accepted' ? r.author_email : null,
    })),
  });
});

teamsRouter.post('/', async (req, res) => {
  const [values, error] = validatePost(req.body);
  if (error) return res.status(400).json({ error });

  const { n } = await db
    .prepare("SELECT COUNT(*) AS n FROM team_posts WHERE user_id = ? AND status = 'open'")
    .get(req.session.userId);
  if (n >= MAX_OPEN_POSTS) {
    return res.status(400).json({ error: `You can have at most ${MAX_OPEN_POSTS} open posts. Close one first.` });
  }

  const { id } = await db
    .prepare(
      `INSERT INTO team_posts (user_id, kind, sport, division, skill, team_name, players_have, team_size, note)
       VALUES (:user_id, :kind, :sport, :division, :skill, :team_name, :players_have, :team_size, :note)
       RETURNING id`
    )
    .get({ user_id: req.session.userId, ...values });
  res.status(201).json({ post: toPost(await findPost(id), req.session.userId) });
});

// Owner updates: { status } to close/reopen/mark filled, or { playersHave } as the roster changes.
teamsRouter.patch('/:id', async (req, res) => {
  const post = await ownPostOr404(req, res);
  if (!post) return;

  let { status, players_have: have } = post;
  if (req.body.status !== undefined) {
    if (!['open', 'filled', 'closed'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
    status = req.body.status;
  }
  if (req.body.playersHave !== undefined && post.kind === 'team') {
    have = toInt(req.body.playersHave);
    if (!Number.isInteger(have) || have < 1 || have > post.team_size) {
      return res.status(400).json({ error: `Players must be between 1 and ${post.team_size}.` });
    }
    if (req.body.status === undefined) status = have >= post.team_size ? 'filled' : 'open';
  }

  await db
    .prepare('UPDATE team_posts SET status = ?, players_have = ?, updated_at = now_iso() WHERE id = ?')
    .run(status, have, post.id);
  res.json({ post: toPost(await findPost(post.id), req.session.userId) });
});

teamsRouter.delete('/:id', async (req, res) => {
  const post = await ownPostOr404(req, res);
  if (!post) return;
  await db.prepare('DELETE FROM team_posts WHERE id = ?').run(post.id);
  res.json({ ok: true });
});

// "I'm in" on someone else's open post.
teamsRouter.post('/:id/responses', async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post || post.status !== 'open') return res.status(404).json({ error: 'This post is no longer open.' });
  if (post.user_id === req.session.userId) return res.status(400).json({ error: "You can't respond to your own post." });

  const result = await db
    .prepare('INSERT INTO team_responses (post_id, user_id, message) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .run(post.id, req.session.userId, cleanText(req.body.message, 300));
  if (result.changes === 0) return res.status(409).json({ error: "You've already responded to this post." });
  res.status(201).json({ ok: true });
});

// Withdraw my pending request.
teamsRouter.delete('/:id/responses', async (req, res) => {
  const { changes } = await db
    .prepare("DELETE FROM team_responses WHERE post_id = ? AND user_id = ? AND status = 'pending'")
    .run(toId(req.params.id), req.session.userId);
  if (changes === 0) return res.status(404).json({ error: 'No pending request to withdraw.' });
  res.json({ ok: true });
});

// Owner accepts or declines a pending request. Accepting a player fills a spot on the team.
teamsRouter.patch('/:id/responses/:responseId', async (req, res) => {
  const post = await ownPostOr404(req, res);
  if (!post) return;
  const status = req.body.status;
  if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  // Locking the post stops two accepts counting the same open spot.
  const err = await db.transaction(async () => {
    const locked = await db.prepare('SELECT * FROM team_posts WHERE id = ? FOR UPDATE').get(post.id);
    const response = await db
      .prepare('SELECT * FROM team_responses WHERE id = ? AND post_id = ?')
      .get(toId(req.params.responseId), post.id);
    if (!response) return [404, 'Request not found.'];
    if (response.status !== 'pending') return [400, `Already ${response.status}.`];

    await db.prepare('UPDATE team_responses SET status = ? WHERE id = ?').run(status, response.id);
    if (status === 'accepted' && locked.kind === 'team') {
      const have = Math.min(locked.players_have + 1, locked.team_size);
      await db
        .prepare('UPDATE team_posts SET players_have = ?, status = ?, updated_at = now_iso() WHERE id = ?')
        .run(have, have >= locked.team_size ? 'filled' : locked.status, post.id);
    }
    return null;
  });
  if (err) return res.status(err[0]).json({ error: err[1] });
  res.json({ post: toPost(await findPost(post.id), req.session.userId) });
});
