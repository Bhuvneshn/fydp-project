// Club events for the "Clubs" map layer.
//
// SCAFFOLDING: nothing is imported yet, so the layer is empty. Return events in the same shape as
// the other sources (see wusa.js) with source: 'club', and importEvents.js stores and maps them.
// Options for where they could come from:
//   1. Club execs post events in the app, like student-run events but linked to a club in the
//      `clubs` table (add a club_id column to events and check the poster is an exec).
//   2. Instagram posts from each club's linked account (via the Instagram Graph API; an earlier
//      activity checker that called it is in git history), with event details pulled out of captions.
//   3. Club pages on clubs.wusa.ca, if WUSA starts listing events there.
// Set `organizer` to the club name and put { clubId } in `extra` so the event can link to the club.

export async function fetchClubEvents() {
  return { events: [], failures: [] };
}
