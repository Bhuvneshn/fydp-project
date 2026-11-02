// Event times are shown in Waterloo time regardless of the viewer's time zone.
const TZ = 'America/Toronto';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const dateKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const dateKey = (d) => dateKeyFmt.format(new Date(d)); // "2026-11-02"
export const formatDay = (d) => dayFmt.format(new Date(d));
export const formatTime = (d) => timeFmt.format(new Date(d)).replace(/\./g, '');

// "Tue, Nov 3 · 6:00 – 9:00 pm", "Mon, Nov 2 · All day", multi-day "Mon, Nov 2 – Fri, Nov 6"
export function formatEventWhen(event) {
  const start = new Date(event.startAt);
  // All-day ends are exclusive midnights; step back a minute to get the last day.
  const end = event.endAt ? new Date(new Date(event.endAt).getTime() - (event.allDay ? 60_000 : 0)) : null;
  const multiDay = end && dateKey(start) !== dateKey(end);

  if (event.allDay) return multiDay ? `${formatDay(start)} – ${formatDay(end)}` : `${formatDay(start)} · All day`;
  if (multiDay) return `${formatDay(start)}, ${formatTime(start)} – ${formatDay(end)}, ${formatTime(end)}`;
  return `${formatDay(start)} · ${formatTime(start)}${end ? ` – ${formatTime(end)}` : ''}`;
}

// live: happening now (timed events only) · today: later today / all-day today · upcoming: later
export function eventStatus(event, now = new Date()) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  if (!event.allDay && start <= now && now < end) return 'live';
  const today = dateKey(now);
  if (dateKey(start) === today || (start <= now && now < end)) return 'today';
  return 'upcoming';
}

export const STATUS_RANK = { live: 0, today: 1, upcoming: 2 };
export const STATUS_LABEL = { live: 'happening now', today: 'today', upcoming: 'upcoming' };
