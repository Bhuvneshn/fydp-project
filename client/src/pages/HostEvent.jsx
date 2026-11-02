import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { request } from '../api.js';
import CampusMap from '../components/CampusMap.jsx';
import { dateKey } from '../eventTime.js';

const ELSEWHERE = '';

// Next full hour in Waterloo time, as "HH:00".
function nextHour(offset = 1) {
  const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return `${String((hour + offset) % 24).padStart(2, '0')}:00`;
}

export default function HostEvent() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [category, setCategory] = useState('Study session');
  const [buildingCode, setBuildingCode] = useState('DC');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request('/api/events/host-options').then(setOptions).catch((err) => setError(err.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...Object.fromEntries(new FormData(e.currentTarget)), category, buildingCode };
      const { event } = await request('/api/events', body);
      navigate(`/events/${encodeURIComponent(event.id)}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!options) return error ? <p className="error">{error}</p> : <p className="empty">Loading…</p>;

  const building = options.buildings.find((b) => b.code === buildingCode);
  // Starting after 11 pm rolls the default into tomorrow.
  const lateNight = nextHour() === '00:00';
  const defaultDate = dateKey(lateNight ? Date.now() + 864e5 : Date.now());

  return (
    <form className="host-event" onSubmit={submit}>
      <Link to="/events" className="back">← Events</Link>
      <input className="host-title" name="title" maxLength={100} placeholder="Event name" required autoFocus />

      <div className="chip-row">
        {options.categories.map((c) => (
          <button key={c} type="button" className={category === c ? 'chip-btn on' : 'chip-btn'} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="host-layout">
        <div className="host-fields">
          <section className="panel form-grid">
            <label>Date
              <input type="date" name="date" required defaultValue={defaultDate} min={dateKey(Date.now())} />
            </label>
            <label>Starts
              <input type="time" name="startTime" required defaultValue={nextHour()} />
            </label>
            <label>Ends
              <input type="time" name="endTime" required defaultValue={nextHour(3)} />
            </label>
          </section>

          <section className="panel form-grid">
            <label>Where
              <select value={buildingCode} onChange={(e) => setBuildingCode(e.target.value)}>
                {options.buildings.map((b) => <option key={b.code} value={b.code}>{b.code} – {b.name}</option>)}
                <option value={ELSEWHERE}>Somewhere else (not on the map)</option>
              </select>
            </label>
            {building ? (
              <label>Room
                <input name="room" maxLength={40} placeholder="e.g. 1350 (optional)" />
              </label>
            ) : (
              <label>Location
                <input name="location" maxLength={120} placeholder="e.g. Uptown Waterloo, online" required />
              </label>
            )}
            <label>Capacity
              <input type="number" name="capacity" min={2} max={500} placeholder="Unlimited" />
            </label>
          </section>

          <label className="panel host-description">Description
            <textarea name="description" rows={5} maxLength={2000} placeholder="What's the plan? Who should come? What should they bring?" />
          </label>

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
        </div>

        {building && (
          <aside className="panel event-mini-map">
            <h2>{building.code} – {building.name}</h2>
            <CampusMap
              markers={[{ id: building.code, lng: building.lng, lat: building.lat, text: building.code, label: building.name }]}
              selectedId={building.code}
              center={[building.lng, building.lat]}
              zoom={16.3}
              pitch={45}
            />
          </aside>
        )}
      </div>
    </form>
  );
}
