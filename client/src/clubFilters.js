// Club directory filtering. Filter state lives in the URL query string so views are shareable.

export const TABS = [
  { value: 'active', label: 'Active', note: 'Posted on Instagram within the last month.' },
  { value: 'inactive', label: 'Inactive', note: 'No Instagram linked, or no Instagram post in the last month.' },
  { value: 'unknown', label: 'Not checked', note: "Instagram is linked but we couldn't read its latest post (not checked yet, or a personal/private account)." },
  { value: 'all', label: 'All' },
];

export const MEMBER_OPTIONS = [
  { value: '', label: 'Any size' },
  { value: '1', label: '1+ members' },
  { value: '15', label: '15+ members' },
  { value: '50', label: '50+ members' },
  { value: '100', label: '100+ members' },
];

export const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'members', label: 'Most members' },
  { value: 'newest', label: 'Newest founded' },
  { value: 'oldest', label: 'Oldest founded' },
  { value: 'instagram', label: 'Latest Instagram post' },
  { value: 'updated', label: 'Recently updated on WUSA' },
];

export function readFilters(params) {
  return {
    tab: params.get('tab') ?? 'active',
    q: params.get('q') ?? '',
    categories: params.getAll('cat'),
    socials: params.getAll('social'),
    term: params.get('term') ?? '',
    minMembers: params.get('members') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    meeting: params.get('meeting') === '1',
    sort: params.get('sort') ?? 'name',
  };
}

// Everything except the tab, so tab counts reflect the other filters.
function matchesFilters(club, f) {
  const q = f.q.trim().toLowerCase();
  if (q && ![club.name, club.acronym, club.tagline].some((s) => s?.toLowerCase().includes(q))) return false;
  if (f.categories.length && !f.categories.some((c) => club.categories.includes(c))) return false;
  if (f.socials.length && !f.socials.every((t) => club.socials.some((s) => s.type === t))) return false;
  if (f.term === 'yes' && !club.wusaActiveThisTerm) return false;
  if (f.term === 'no' && club.wusaActiveThisTerm) return false;
  if (f.minMembers && (club.memberCount ?? 0) < Number(f.minMembers)) return false;
  if (f.from && (club.yearStarted ?? 0) < Number(f.from)) return false;
  if (f.to && (club.yearStarted ?? Infinity) > Number(f.to)) return false;
  if (f.meeting && !club.hasMeetingInfo) return false;
  return true;
}

const byDateDesc = (a, b) => (b ?? '').localeCompare(a ?? '');
const COMPARATORS = {
  name: (a, b) => a.name.localeCompare(b.name),
  members: (a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0),
  newest: (a, b) => (b.yearStarted ?? 0) - (a.yearStarted ?? 0),
  oldest: (a, b) => (a.yearStarted ?? 9999) - (b.yearStarted ?? 9999),
  instagram: (a, b) => byDateDesc(a.instagram.lastPostAt, b.instagram.lastPostAt),
  updated: (a, b) => byDateDesc(a.wusaLastUpdated, b.wusaLastUpdated),
};

export function applyFilters(clubs, f) {
  const filtered = clubs.filter((c) => matchesFilters(c, f));
  const counts = { all: filtered.length, active: 0, inactive: 0, unknown: 0 };
  for (const c of filtered) counts[c.instagram.status]++;

  const visible = f.tab === 'all' ? filtered : filtered.filter((c) => c.instagram.status === f.tab);
  const compare = COMPARATORS[f.sort] ?? COMPARATORS.name;
  return { visible: visible.sort((a, b) => compare(a, b) || COMPARATORS.name(a, b)), counts };
}

// Options derived from the data so new categories / social types show up automatically.
export function filterOptions(clubs) {
  const categories = new Set();
  const socials = new Map();
  const years = new Set();
  for (const c of clubs) {
    c.categories.forEach((x) => categories.add(x));
    c.socials.forEach((s) => socials.set(s.type, s.name));
    if (c.yearStarted) years.add(c.yearStarted);
  }
  return {
    categories: [...categories].sort(),
    socials: [...socials].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    years: [...years].sort((a, b) => a - b),
  };
}
