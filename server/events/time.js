// Converts a Waterloo (America/Toronto) wall-clock time to a UTC Date, independent of the
// server's own time zone. month is 1-based.
export function torontoToUtc(year, month, day, hour = 0, minute = 0) {
  // Guess using EST (UTC-5), then correct by however far off Toronto's clock reads.
  const guess = Date.UTC(year, month - 1, day, hour + 5, minute);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(guess)
      .map((p) => [p.type, Number(p.value)])
  );
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess + (wanted - shown));
}
