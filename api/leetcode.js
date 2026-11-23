/* Vercel serverless function: live LeetCode stats for the portfolio.
 *
 * Browsers cannot call LeetCode's GraphQL service directly (CORS), so the page asks this function,
 * which fetches PUBLIC profile data and returns a small, normalized JSON document.
 *
 * Set the username in ONE place: the LEETCODE_USERNAME below, or the LEETCODE_USERNAME environment
 * variable in Vercel (the variable wins). While it is empty the section stays hidden on the site.
 * The username is fixed on the server on purpose: this is not an open proxy.
 */
const LEETCODE_USERNAME = '';

const GRAPHQL = 'https://leetcode.com/graphql';
const QUERY = `
query portfolio($username: String!) {
  matchedUser(username: $username) {
    username
    profile { realName userAvatar ranking reputation }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    submissionCalendar
    badges { displayName icon }
    languageProblemCount { languageName problemsSolved }
  }
  allQuestionsCount { difficulty count }
  recentAcSubmissionList(username: $username, limit: 10) { title titleSlug timestamp }
  userContestRanking(username: $username) { rating globalRanking attendedContestsCount topPercentage }
}`;

const ALLOWED_IMG_HOSTS = new Set(['leetcode.com', 'assets.leetcode.com', 'www.leetcode.com']);
const USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/;

function safeImage(src) {
  if (typeof src !== 'string' || !src) return null;
  try {
    const u = new URL(src, 'https://leetcode.com');
    return u.protocol === 'https:' && ALLOWED_IMG_HOSTS.has(u.hostname) ? u.href : null;
  } catch (e) { return null; }
}

const dayKey = (d) => d.toISOString().slice(0, 10);

/** submissionCalendar is a JSON string: { "<unix seconds at UTC midnight>": count }. */
function buildCalendar(raw, now) {
  let parsed = {};
  try { parsed = JSON.parse(raw || '{}'); } catch (e) { parsed = {}; }
  const byDay = {};
  Object.keys(parsed).forEach((ts) => {
    const n = Number(parsed[ts]);
    const t = Number(ts) * 1000;
    if (Number.isFinite(t) && Number.isFinite(n) && n > 0) byDay[dayKey(new Date(t))] = (byDay[dayKey(new Date(t))] || 0) + n;
  });
  const days = {};
  let active = 0;
  let total = 0;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const k = dayKey(d);
    const c = byDay[k] || 0;
    days[k] = c;
    if (c > 0) { active++; total += c; }
  }
  // current streak: consecutive active days ending today (or yesterday if nothing yet today)
  let streak = 0;
  let cursor = today.getTime();
  if (!days[dayKey(new Date(cursor))]) cursor -= 86400000;
  while (days[dayKey(new Date(cursor))] > 0) { streak++; cursor -= 86400000; }
  // longest streak in the window
  let longest = 0;
  let run = 0;
  Object.keys(days).forEach((k) => { if (days[k] > 0) { run++; if (run > longest) longest = run; } else run = 0; });
  return { days, activeDays: active, submissions: total, streak, longestStreak: longest };
}

function countBy(list, key) {
  const out = { all: 0, easy: 0, medium: 0, hard: 0 };
  (Array.isArray(list) ? list : []).forEach((x) => {
    const d = String(x.difficulty || '').toLowerCase();
    const n = Number(x[key]) || 0;
    if (d === 'all') out.all = n;
    else if (d in out) out[d] = n;
  });
  return out;
}

/** Turns LeetCode's response into the compact shape the page uses. Exported for testing. */
function normalize(data, username, now) {
  const u = data && data.matchedUser;
  if (!u) return null;
  const solved = countBy(u.submitStatsGlobal && u.submitStatsGlobal.acSubmissionNum, 'count');
  const totals = countBy(data.allQuestionsCount, 'count');
  const cal = buildCalendar(u.submissionCalendar, now);
  const contest = data.userContestRanking;
  return {
    configured: true,
    username: u.username || username,
    fetchedAt: now.toISOString(),
    profile: {
      realName: (u.profile && u.profile.realName) || '',
      avatar: safeImage(u.profile && u.profile.userAvatar),
      ranking: (u.profile && Number(u.profile.ranking)) || null,
    },
    solved, totals,
    calendar: cal.days,
    activeDays: cal.activeDays,
    submissions: cal.submissions,
    streak: cal.streak,
    longestStreak: cal.longestStreak,
    contest: contest ? {
      rating: Math.round(Number(contest.rating) || 0),
      globalRanking: Number(contest.globalRanking) || null,
      attended: Number(contest.attendedContestsCount) || 0,
      topPercentage: contest.topPercentage == null ? null : Number(contest.topPercentage),
    } : null,
    badges: (Array.isArray(u.badges) ? u.badges : []).slice(0, 8).map((b) => ({ name: String(b.displayName || ''), icon: safeImage(b.icon) })),
    languages: (Array.isArray(u.languageProblemCount) ? u.languageProblemCount : [])
      .map((l) => ({ name: String(l.languageName || ''), solved: Number(l.problemsSolved) || 0 }))
      .sort((a, b) => b.solved - a.solved).slice(0, 5),
    recent: (Array.isArray(data.recentAcSubmissionList) ? data.recentAcSubmissionList : []).slice(0, 10).map((r) => ({
      title: String(r.title || ''),
      slug: /^[a-z0-9-]+$/.test(String(r.titleSlug || '')) ? String(r.titleSlug) : '',
      at: new Date((Number(r.timestamp) || 0) * 1000).toISOString(),
    })),
  };
}

async function fetchProfile(username, fetchImpl) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetchImpl(GRAPHQL, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com', 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-stats)' },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
    });
    if (!r.ok) { const e = new Error('LeetCode returned ' + r.status); e.status = 502; throw e; }
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function handler(req, res, deps) {
  const fetchImpl = (deps && deps.fetch) || fetch;
  const now = (deps && deps.now) || new Date();
  const username = String(process.env.LEETCODE_USERNAME || LEETCODE_USERNAME || '').trim();
  const send = (status, body, cache) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache || 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method && req.method !== 'GET') return send(405, { error: 'Method not allowed' });
  if (!username) return send(200, { configured: false }, 'public, s-maxage=60');
  if (!USERNAME_RE.test(username)) return send(500, { configured: true, username, error: 'The LeetCode username is not valid.' });
  try {
    const json = await fetchProfile(username, fetchImpl);
    const out = normalize(json && json.data, username, now);
    if (!out) return send(404, { configured: true, username, error: 'LeetCode user not found, or the profile is private.' });
    // Edge cache for 2 minutes, then serve stale while refreshing: fresh enough to feel live, gentle on LeetCode.
    return send(200, out, 'public, s-maxage=120, stale-while-revalidate=600');
  } catch (e) {
    return send(e.status || 502, { configured: true, username, error: 'Could not reach LeetCode right now.' });
  }
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
module.exports.normalize = normalize;
module.exports.buildCalendar = buildCalendar;
