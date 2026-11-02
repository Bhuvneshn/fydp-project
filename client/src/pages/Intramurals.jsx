import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { request, send } from '../api.js';

const TABS = [
  { value: 'team', label: 'Teams need players' },
  { value: 'player', label: 'Free agents' },
  { value: 'mine', label: 'My activity' },
];

function timeAgo(iso) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Intramural team matching: teams post open spots, free agents post themselves, and people request to join.
export default function Intramurals() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'team';
  const sport = params.get('sport') ?? '';
  const [options, setOptions] = useState(null);
  const [posts, setPosts] = useState(null);
  const [mine, setMine] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, activity] = await Promise.all([request('/api/teams'), request('/api/teams/mine')]);
      setPosts(list.posts);
      setMine(activity);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    request('/api/teams/options').then(setOptions).catch((err) => setError(err.message));
  }, []);

  // Refresh on tab switch and when coming back to the window, so accepts/requests show up.
  useEffect(() => {
    load();
  }, [load, tab]);
  useEffect(() => {
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  function setParam(key, value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  if (error) return <p className="error">{error}</p>;
  if (!posts || !options) return <p className="empty">Loading…</p>;

  const pendingForMe = mine.posts.reduce((n, p) => n + p.responses.filter((r) => r.status === 'pending').length, 0);
  const visible = posts.filter((p) => p.kind === tab && (!sport || p.sport === sport));

  return (
    <div className="intramurals">
      <header className="section-head">
        <h1>Intramurals</h1>
        <p className="muted">Short a few players? Post your team. Want to play? Find one.</p>
      </header>
      <div className="schedule-toolbar">
        <div className="segmented">
          {TABS.map((t) => (
            <button key={t.value} type="button" className={tab === t.value ? 'on' : ''} onClick={() => setParam('tab', t.value === 'team' ? '' : t.value)}>
              {t.label}
              {t.value === 'mine' && pendingForMe > 0 && <span className="dot-count">{pendingForMe}</span>}
            </button>
          ))}
        </div>
        {tab !== 'mine' && (
          <select aria-label="Sport" value={sport} onChange={(e) => setParam('sport', e.target.value)}>
            <option value="">All sports</option>
            {options.sports.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <span className="spacer" />
        <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New post'}
        </button>
      </div>

      {showForm && (
        <PostForm
          options={options}
          onCreated={async (post) => {
            setShowForm(false);
            await load();
            setParam('tab', post.kind === 'team' ? '' : 'player');
          }}
        />
      )}

      {tab === 'mine' ? (
        <MyActivity mine={mine} reload={load} />
      ) : visible.length === 0 ? (
        <div className="empty">
          <p>No {tab === 'team' ? 'teams looking for players' : 'free agents'}{sport ? ` for ${sport}` : ''} yet.</p>
          <button type="button" className="chip-btn" onClick={() => setShowForm(true)}>Be the first to post</button>
        </div>
      ) : (
        <div className="team-grid">
          {visible.map((p) => <PostCard key={p.id} post={p} reload={load} />)}
        </div>
      )}
    </div>
  );
}

function RosterDots({ have, size }) {
  return (
    <span className="roster" aria-label={`${have} of ${size} players`}>
      {Array.from({ length: size }, (_, i) => <span key={i} className={i < have ? 'filled' : ''} />)}
    </span>
  );
}

function PostCard({ post, reload }) {
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isTeam = post.kind === 'team';
  return (
    <article className="team-card">
      <div className="team-card-top">
        <span className="chip">{post.sport}</span>
        <span className="muted small">{timeAgo(post.createdAt)}</span>
      </div>

      {isTeam ? (
        <>
          <h3>Need {post.spotsLeft} more</h3>
          <div className="team-roster">
            <RosterDots have={post.playersHave} size={post.teamSize} />
            <span className="muted small">{post.playersHave}/{post.teamSize} players</span>
          </div>
          {post.teamName && <p className="team-name">{post.teamName}</p>}
        </>
      ) : (
        <h3>{post.author} wants a team</h3>
      )}

      <div className="chip-row">
        {post.division && <span className="tag">{post.division}</span>}
        {post.skill && <span className="tag">{post.skill}</span>}
      </div>
      {post.note && <p className="team-note">{post.note}</p>}

      <footer className="team-card-foot">
        <span className="muted small">{isTeam ? `Captain: ${post.author}` : 'Free agent'}</span>
        {post.isMine ? (
          <span className="muted small">Your post{post.pendingCount ? ` · ${post.pendingCount} request${post.pendingCount === 1 ? '' : 's'}` : ''}</span>
        ) : post.myResponse ? (
          post.myResponse.status === 'pending' ? (
            <button type="button" className="link-btn" disabled={busy} onClick={() => act(() => send(`/api/teams/${post.id}/responses`, 'DELETE'))}>
              Requested · Withdraw
            </button>
          ) : (
            <span className={`tag cap ${post.myResponse.status === 'accepted' ? 'home' : ''}`}>{post.myResponse.status}</span>
          )
        ) : (
          !composing && (
            <button type="button" className="btn-primary small" onClick={() => setComposing(true)}>
              {isTeam ? "I'm in" : 'Invite to my team'}
            </button>
          )
        )}
      </footer>

      {composing && (
        <form
          className="team-compose"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await send(`/api/teams/${post.id}/responses`, 'POST', { message });
              setComposing(false);
            });
          }}
        >
          <textarea
            rows={2}
            maxLength={300}
            placeholder={isTeam ? 'Position, experience, availability… (optional)' : 'Tell them about your team (optional)'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="row-end">
            <button type="button" className="link-btn" onClick={() => setComposing(false)}>Cancel</button>
            <button type="submit" className="btn-primary small" disabled={busy}>Send request</button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  );
}

function PostForm({ options, onCreated }) {
  const [kind, setKind] = useState('team');
  const [sport, setSport] = useState(options.sports[0].name);
  const [teamSize, setTeamSize] = useState(options.sports[0].teamSize ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function pickSport(name) {
    setSport(name);
    const suggested = options.sports.find((s) => s.name === name)?.teamSize;
    if (suggested) setTeamSize(suggested);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...Object.fromEntries(new FormData(e.currentTarget)), kind, sport, teamSize };
      const { post } = await send('/api/teams', 'POST', body);
      onCreated(post);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel team-form" onSubmit={submit}>
      <div className="segmented">
        <button type="button" className={kind === 'team' ? 'on' : ''} onClick={() => setKind('team')}>My team needs players</button>
        <button type="button" className={kind === 'player' ? 'on' : ''} onClick={() => setKind('player')}>I'm looking for a team</button>
      </div>

      <div className="form-grid">
        <label>Sport
          <select value={sport} onChange={(e) => pickSport(e.target.value)}>
            {options.sports.map((s) => <option key={s.name}>{s.name}</option>)}
          </select>
        </label>
        <label>Division
          <select name="division" defaultValue="">
            <option value="">Any</option>
            {options.divisions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>Skill level
          <select name="skill" defaultValue="">
            <option value="">Any</option>
            {options.skills.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {kind === 'team' && (
          <>
            <label>Team name
              <input name="teamName" maxLength={60} placeholder="Optional" />
            </label>
            <label>Players you have
              <input name="playersHave" type="number" min={1} max={29} required defaultValue={1} />
            </label>
            <label>Team size
              <input type="number" min={2} max={30} required value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <label>Note
        <textarea name="note" rows={3} maxLength={500} placeholder={kind === 'team' ? 'When you play, vibe, what positions you need…' : 'Positions, experience, which nights you can play…'} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row-end">
        <button type="submit" className="btn-primary" disabled={busy}>Post</button>
      </div>
    </form>
  );
}

function MyActivity({ mine, reload }) {
  const [error, setError] = useState('');

  async function act(fn) {
    setError('');
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="my-activity">
      {error && <p className="error">{error}</p>}
      <h2>Your posts</h2>
      {mine.posts.length === 0 && <p className="muted">You haven't posted yet.</p>}
      {mine.posts.map((p) => (
        <section key={p.id} className="panel my-post">
          <div className="my-post-head">
            <div>
              <strong>{p.sport}</strong>
              <span className="muted"> · {p.kind === 'team' ? `${p.teamName ?? 'Team'} · ${p.playersHave}/${p.teamSize} players` : 'Free agent'}</span>
            </div>
            <span className={`tag cap ${p.status === 'open' ? 'home' : ''}`}>{p.status}</span>
          </div>
          <div className="chip-row">
            {p.kind === 'team' && (
              <>
                <button type="button" className="chip-btn" disabled={p.playersHave <= 1} onClick={() => act(() => send(`/api/teams/${p.id}`, 'PATCH', { playersHave: p.playersHave - 1 }))}>− player</button>
                <button type="button" className="chip-btn" disabled={p.playersHave >= p.teamSize} onClick={() => act(() => send(`/api/teams/${p.id}`, 'PATCH', { playersHave: p.playersHave + 1 }))}>+ player</button>
              </>
            )}
            {p.status === 'open' ? (
              <button type="button" className="chip-btn" onClick={() => act(() => send(`/api/teams/${p.id}`, 'PATCH', { status: p.kind === 'team' ? 'filled' : 'closed' }))}>
                {p.kind === 'team' ? 'Mark filled' : 'Found a team'}
              </button>
            ) : (
              <button type="button" className="chip-btn" onClick={() => act(() => send(`/api/teams/${p.id}`, 'PATCH', { status: 'open' }))}>Reopen</button>
            )}
            <button type="button" className="chip-btn danger" onClick={() => confirm('Delete this post?') && act(() => send(`/api/teams/${p.id}`, 'DELETE'))}>Delete</button>
          </div>

          {p.responses.length > 0 && (
            <ul className="responses">
              {p.responses.map((r) => (
                <li key={r.id}>
                  <div>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                    <span className="muted small"> · {timeAgo(r.createdAt)}</span>
                    {r.message && <p>{r.message}</p>}
                  </div>
                  {r.status === 'pending' ? (
                    <div className="chip-row">
                      <button type="button" className="chip-btn on" onClick={() => act(() => send(`/api/teams/${p.id}/responses/${r.id}`, 'PATCH', { status: 'accepted' }))}>Accept</button>
                      <button type="button" className="chip-btn" onClick={() => act(() => send(`/api/teams/${p.id}/responses/${r.id}`, 'PATCH', { status: 'declined' }))}>Decline</button>
                    </div>
                  ) : (
                    <span className={`tag cap ${r.status === 'accepted' ? 'home' : ''}`}>{r.status}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <h2>Your requests</h2>
      {mine.requests.length === 0 && <p className="muted">You haven't asked to join anything yet.</p>}
      {mine.requests.map((r) => (
        <section key={r.id} className="panel my-post">
          <div className="my-post-head">
            <div>
              <strong>{r.post.sport}</strong>
              <span className="muted"> · {r.post.kind === 'team' ? `${r.post.teamName ?? `${r.post.author}'s team`}` : `${r.post.author} (free agent)`}</span>
            </div>
            <span className={`tag cap ${r.status === 'accepted' ? 'home' : ''}`}>{r.status}</span>
          </div>
          {r.contactEmail ? (
            <p>You're in! Reach out at <a href={`mailto:${r.contactEmail}`}>{r.contactEmail}</a>.</p>
          ) : r.status === 'pending' ? (
            <p className="muted">Waiting for {r.post.author} to respond.</p>
          ) : (
            <p className="muted">Not this time.</p>
          )}
        </section>
      ))}
    </div>
  );
}
