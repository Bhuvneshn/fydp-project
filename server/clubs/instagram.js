// Checks each club's most recent Instagram post date.
// Usage: npm run check:instagram [-- --force]
//
// Uses the official Instagram Graph API "Business Discovery" endpoint, which lets
// an Instagram Business/Creator account look up other Business/Creator accounts.
// Setup (one time):
//   1. Convert an Instagram account you own to Business or Creator and link it to a Facebook Page.
//   2. Create a Meta app (developers.facebook.com) with the Instagram Graph API product.
//   3. Generate a long-lived user access token with instagram_basic + pages_show_list (+ business_management).
//   4. Set IG_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID (your account's IG user id) in .env.
//
// Limitations: Business Discovery can't see personal or private accounts; those clubs
// are stored with an error and show as "Not checked".
import { db } from '../db.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const { IG_ACCESS_TOKEN, IG_BUSINESS_ACCOUNT_ID } = process.env;
// Graph API allows ~200 calls/hour per token; default stays under that.
const DELAY_MS = Number(process.env.IG_REQUEST_DELAY_MS ?? 18_000);
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;
const force = process.argv.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns the ISO timestamp of the newest of the last few posts (handles pinned posts), or null.
async function fetchLatestPostAt(handle) {
  const fields = `business_discovery.username(${handle}){media.limit(5){timestamp}}`;
  const url = `${GRAPH}/${IG_BUSINESS_ACCOUNT_ID}?fields=${encodeURIComponent(fields)}&access_token=${IG_ACCESS_TOKEN}`;
  const body = await (await fetch(url)).json();

  if (body.error) {
    const err = new Error(body.error.message);
    // 110 / 2207013 etc: account isn't a discoverable Business/Creator account.
    err.notDiscoverable = body.error.code === 110 || body.error.error_subcode === 2207013;
    err.rateLimited = [4, 17, 32, 613].includes(body.error.code);
    throw err;
  }

  const timestamps = body.business_discovery?.media?.data?.map((m) => m.timestamp) ?? [];
  return timestamps.sort().at(-1) ?? null;
}

async function main() {
  if (!IG_ACCESS_TOKEN || !IG_BUSINESS_ACCOUNT_ID) {
    console.error('Set IG_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID first (see the comment at the top of this file).');
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - RECHECK_AFTER_MS).toISOString();
  const clubs = db
    .prepare(
      `SELECT id, name, instagram_handle FROM clubs
       WHERE instagram_handle IS NOT NULL ${force ? '' : 'AND (ig_checked_at IS NULL OR ig_checked_at < ?)'}
       ORDER BY ig_checked_at IS NOT NULL, ig_checked_at`
    )
    .all(...(force ? [] : [cutoff]));

  console.log(`Checking ${clubs.length} Instagram accounts (~${Math.ceil((clubs.length * DELAY_MS) / 60000)} min)...`);
  const save = db.prepare(
    'UPDATE clubs SET ig_last_post_at = ?, ig_check_error = ?, ig_checked_at = ? WHERE id = ?'
  );

  for (const [i, club] of clubs.entries()) {
    try {
      const latest = await fetchLatestPostAt(club.instagram_handle);
      save.run(latest, latest ? null : 'No posts', new Date().toISOString(), club.id);
      console.log(`  [${i + 1}/${clubs.length}] @${club.instagram_handle}: ${latest ?? 'no posts'}`);
    } catch (err) {
      if (err.rateLimited) {
        console.warn('Rate limited by Instagram; stopping. Re-run later to continue.');
        break;
      }
      const message = err.notDiscoverable ? 'Not a public Business/Creator account' : err.message;
      save.run(null, message, new Date().toISOString(), club.id);
      console.warn(`  [${i + 1}/${clubs.length}] @${club.instagram_handle}: ${message}`);
    }
    if (i < clubs.length - 1) await sleep(DELAY_MS);
  }
}

await main();
