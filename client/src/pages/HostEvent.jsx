import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { request } from '../api.js';
import CampusMap from '../components/CampusMap.jsx';
import { BackIcon } from '../components/Icons.jsx';
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
    <div className="host-event">
      <Link to="/events" className="back"><BackIcon />Events</Link>
      <div className="page-head">
        <div>
          <h1>Host an event</h1>
          <p>Small, low-key and open to other students. It shows up on the map once you create it.</p>
        </div>
      </div>

      <div className="host-layout">
        <form className="form host-form" onSubmit={submit}>
          <label className="field"><span>Event name</span>
            <input name="title" maxLength={100} placeholder="e.g. CS 135 midterm study session" required autoFocus />
          </label>

          <fieldset className="field-group">
            <legend>Category</legend>
            <div className="tile-grid">
              {options.categories.map((c) => (
                <button key={c} type="button" className="chip tile" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </fieldset>

          <div className="field-grid">
            <label className="field"><span>Date</span>
              <input type="date" name="date" required defaultValue={defaultDate} min={dateKey(Date.now())} />
            </label>
            <label className="field"><span>Starts</span>
              <input type="time" name="startTime" required defaultValue={nextHour()} />
            </label>
            <label className="field"><span>Ends</span>
              <input type="time" name="endTime" required defaultValue={nextHour(3)} />
            </label>
          </div>

          <div className="field-grid">
            <label className="field wide"><span>Where</span>
              <select value={buildingCode} onChange={(e) => setBuildingCode(e.target.value)}>
                {options.buildings.map((b) => <option key={b.code} value={b.code}>{b.code} – {b.name}</option>)}
                <option value={ELSEWHERE}>Somewhere else (not on the map)</option>
              </select>
            </label>
            {building ? (
              <label className="field"><span>Room <span className="optional">(optional)</span></span>
                <input name="room" maxLength={40} placeholder="e.g. 1350" />
              </label>
            ) : (
              <label className="field"><span>Location</span>
                <input name="location" maxLength={120} placeholder="e.g. Uptown Waterloo, online" required />
              </label>
            )}
            <label className="field"><span>Capacity <span className="optional">(optional)</span></span>
              <input type="number" name="capacity" min={2} max={500} placeholder="Unlimited" />
            </label>
          </div>

          <label className="field"><span>Details <span className="optional">(optional)</span></span>
            <textarea name="description" rows={4} maxLength={2000} placeholder="What's the plan? Who should come? What should they bring?" />
          </label>

          {error && <p className="error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
            <Link to="/events" className="btn btn-secondary btn-lg">Cancel</Link>
          </div>
        </form>

        <aside className="host-aside" aria-label="Location preview">
          <h2 className="section-label">Location</h2>
          {building ? (
            <div className="location-card">
              <div className="location-map">
                <CampusMap
                  key={building.code}
                  markers={[{ id: building.code, lng: building.lng, lat: building.lat, text: building.code, label: building.name }]}
                  selectedId={building.code}
                  center={[building.lng, building.lat]}
                  zoom={16.3}
                  pitch={45}
                  interactive={false}
                />
              </div>
              <div className="location-row">
                <span>
                  <strong>{building.name}</strong>
                  <span className="muted">{building.code}</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="panel tinted muted">Events somewhere else are listed without a pin on the map.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
