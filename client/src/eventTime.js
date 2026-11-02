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

// Pieces for the date block and card headings, all in Waterloo time.
const partsFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
function dateParts(d) {
  const parts = Object.fromEntries(partsFmt.formatToParts(new Date(d)).map((p) => [p.type, p.value]));
  return { weekday: parts.weekday, month: parts.month, day: Number(parts.day) };
}

export const monthAbbr = (d) => dateParts(d).month.slice(0, 3).toUpperCase(); // "NOV"
export const dayOfMonth = (d) => dateParts(d).day; // 3
export const weekdayShort = (d) => dateParts(d).weekday.slice(0, 3); // "Tue"

// "Tuesday 3 November"
export function formatLongDate(d) {
  const { weekday, month, day } = dateParts(d);
  return `${weekday} ${day} ${month}`;
}

// "6:00 PM"
const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const formatClock = (d) => clockFmt.format(new Date(d));

// "6:00–9:00 PM", or "11:00 AM–1:00 PM" when the period changes
export function formatTimeRange(event) {
  if (event.allDay) return 'All day';
  const start = formatClock(event.startAt);
  if (!event.endAt || dateKey(event.startAt) !== dateKey(event.endAt)) return start;
  const end = formatClock(event.endAt);
  const [startTime, startPeriod] = start.split(' ');
  return startPeriod === end.split(' ')[1] ? `${startTime}–${end}` : `${start}–${end}`;
}

// The bold line on an event card: "Tue · 6:00–9:00 PM", "Mon · All day", or a date span for multi-day events.
export function formatCardWhen(event) {
  const end = event.endAt ? new Date(new Date(event.endAt).getTime() - (event.allDay ? 60_000 : 0)) : null;
  if (end && dateKey(event.startAt) !== dateKey(end)) {
    return `${weekdayShort(event.startAt)} ${dayOfMonth(event.startAt)} – ${weekdayShort(end)} ${dayOfMonth(end)} ${dateParts(end).month.slice(0, 3)}`;
  }
  return `${weekdayShort(event.startAt)} · ${formatTimeRange(event)}`;
}
