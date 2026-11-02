import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { request } from '../api.js';
import { dateKey, formatDay, formatTime } from '../eventTime.js';

const OUTCOME = { W: 'win', L: 'loss', T: 'tie' };

function groupByDay(games) {
  const days = new Map();
  for (const g of games) {
    const key = dateKey(g.startAt);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(g);
  }
  return [...days.entries()];
}

export default function AthleticsSchedule() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'results' ? 'results' : 'upcoming';
  const sport = params.get('sport') ?? '';
  const where = params.get('where') ?? '';

  useEffect(() => {
    request('/api/athletics/schedule').then((d) => setGames(d.games)).catch((err) => setError(err.message));
  }, []);

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
  if (!games) return <p className="empty">Loading schedule…</p>;

  const now = Date.now();
  const sports = [...new Set(games.map((g) => g.extra.sport))].sort();
  const filtered = games.filter((g) => {
    const ended = new Date(g.endAt ?? g.startAt).getTime() < now;
    if (view === 'upcoming' ? ended : !ended) return false;
    if (sport && g.extra.sport !== sport) return false;
    if (where && g.extra.homeAway !== where) return false;
    return true;
  });
  if (view === 'results') filtered.reverse();

  return (
    <>
      <div className="schedule-toolbar">
        <div className="segmented">
          <button type="button" className={view === 'upcoming' ? 'on' : ''} onClick={() => setParam('view', '')}>Upcoming</button>
          <button type="button" className={view === 'results' ? 'on' : ''} onClick={() => setParam('view', 'results')}>Results</button>
        </div>
        <select aria-label="Sport" value={sport} onChange={(e) => setParam('sport', e.target.value)}>
          <option value="">All sports</option>
          {sports.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="chip-row">
          {[['', 'Home & away'], ['home', 'Home'], ['away', 'Away']].map(([v, label]) => (
            <button key={v} type="button" className={where === v ? 'chip-btn on' : 'chip-btn'} onClick={() => setParam('where', v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No {view === 'results' ? 'results' : 'upcoming games'} for these filters.</p>
      ) : (
        groupByDay(filtered).map(([day, dayGames]) => (
          <section key={day} className="schedule-day">
            <h2>{dateKey(new Date()) === day ? 'Today' : formatDay(dayGames[0].startAt)}</h2>
            <ul>
              {dayGames.map((g) => <GameRow key={g.id} game={g} />)}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function GameRow({ game: g }) {
  const { extra: x } = g;
  const home = x.homeAway === 'home';
  const title = (
    <>
      <span className="game-sport">{x.sport}</span>
      <span className="game-opponent">{x.opponent ? `${home ? 'vs' : x.homeAway === 'away' ? 'at' : 'vs'} ${x.opponent}` : x.tournament ?? 'Meet'}</span>
    </>
  );

  return (
    <li className={x.cancelled ? 'game cancelled' : 'game'}>
      <span className="game-time">{g.allDay ? 'All day' : formatTime(g.startAt)}</span>
      {g.imageUrl ? <img className="game-logo" src={g.imageUrl} alt="" loading="lazy" /> : <span className="game-logo" aria-hidden="true" />}
      <span className="game-main">
        {g.building ? <Link to={`/events/${encodeURIComponent(g.id)}`} className="game-title">{title}</Link> : <span className="game-title">{title}</span>}
        <span className="game-meta">
          <span className={`tag cap ${x.homeAway}`}>{x.homeAway}</span>
          {x.gameType && x.gameType !== 'Regular season' && <span className="tag">{x.gameType}</span>}
          {x.cancelled && <span className="tag cancelled">Cancelled</span>}
          <span className="muted">{g.location}{x.homeAway !== 'home' && x.city && g.location !== x.city ? `, ${x.city}` : ''}</span>
        </span>
      </span>
      <span className="game-side">
        {x.result ? (
          <a className={`score ${OUTCOME[x.result.outcome] ?? ''}`} href={x.result.boxScore ?? g.url} target="_blank" rel="noreferrer">
            {x.result.outcome} {x.result.us}–{x.result.them}
          </a>
        ) : (
          <>
            {x.tickets && <a href={x.tickets} target="_blank" rel="noreferrer">Tickets</a>}
            {x.video && <a href={x.video} target="_blank" rel="noreferrer">Watch</a>}
          </>
        )}
      </span>
    </li>
  );
}
