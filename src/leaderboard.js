// Pramageddon arcade score storage.
//
// Scores are always saved locally. The global board is a free DreamLo
// leaderboard (HTTP-only), reached through Jina's HTTPS reader proxy so the
// GitHub Pages build can read and write it without a backend or API keys.
// If either third-party service is unavailable, the local board still works.

const DREAMLO_PUBLIC = '6b080b578f40bba050729400';
const DREAMLO_PRIVATE = 'ZprIMvtql0aYx6ZrH0pHNg3AHl13KieECDxNXn3wJbpg';
const JINA_PREFIX = 'https://r.jina.ai/http://dreamlo.com/lb/';
const LOCAL_KEY = 'pramageddon.arcade.scores.v2';
const NAME_KEY = 'pramageddon.arcade.name';
const MAX_LOCAL = 25;
const MAX_GLOBAL = 25;

let remoteCache = { at: 0, entries: null };

export function formatRunClock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function sanitizeName(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9ÆØÅ _-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 12);
  return cleaned || 'INGER';
}

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  } catch (error) {
    return [];
  }
}

function writeLocal(entries) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
  } catch (error) {
    // Private-mode storage may be unavailable; the current run still finishes.
  }
}

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry.name === 'string' &&
    Number.isFinite(Number(entry.score)) &&
    Number(entry.score) >= 0
  );
}

function normalizeEntry(entry) {
  return {
    name: sanitizeName(entry.name),
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    seconds: Math.max(0, Math.floor(Number(entry.seconds) || 0)),
    date: entry.date || '',
    local: Boolean(entry.local),
  };
}

export function getLocalScores() {
  return readLocal()
    .map(normalizeEntry)
    .sort((a, b) => b.score - a.score || b.seconds - a.seconds);
}

export function getLocalBest() {
  const scores = getLocalScores();
  return scores[0]?.score || 0;
}

export function saveLocalScore({ name, score, seconds, soothed = 0, combo = 1 }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: sanitizeName(name),
    score: Math.max(0, Math.floor(Number(score) || 0)),
    seconds: Math.max(0, Math.floor(Number(seconds) || 0)),
    soothed: Math.max(0, Math.floor(Number(soothed) || 0)),
    combo: Math.max(1, Math.floor(Number(combo) || 1)),
    date: new Date().toISOString(),
    local: true,
  };
  writeLocal([entry, ...readLocal()]);
  return entry;
}

export function getSavedName() {
  try {
    return sanitizeName(window.localStorage.getItem(NAME_KEY) || 'INGER');
  } catch (error) {
    return 'INGER';
  }
}

export function savePlayerName(name) {
  const clean = sanitizeName(name);
  try {
    window.localStorage.setItem(NAME_KEY, clean);
  } catch (error) {
    // Ignore storage failures.
  }
  return clean;
}

function parseDreamloEntries(text) {
  if (!text) return [];
  const marker = text.indexOf('{"dreamlo"');
  if (marker < 0) return [];
  const jsonText = text.slice(marker);
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (error) {
    return [];
  }
  const leaderboard = data?.dreamlo?.leaderboard;
  if (!leaderboard || !leaderboard.entry) return [];
  const entries = Array.isArray(leaderboard.entry) ? leaderboard.entry : [leaderboard.entry];
  return entries
    .map((entry) =>
      normalizeEntry({
        name: entry.name,
        score: entry.score,
        seconds: entry.seconds,
        date: entry.date,
      })
    )
    .filter((entry) => entry.name && entry.score > 0)
    .sort((a, b) => b.score - a.score || b.seconds - a.seconds)
    .slice(0, MAX_GLOBAL);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchGlobalScores({ force = false } = {}) {
  if (!force && remoteCache.entries && Date.now() - remoteCache.at < 30000) {
    return { ok: true, entries: remoteCache.entries, cached: true };
  }
  const stamp = Date.now();
  const url = `${JINA_PREFIX}${DREAMLO_PUBLIC}/json?t=${stamp}`;
  try {
    const response = await fetchWithTimeout(url, { cache: 'no-store', headers: { Accept: 'text/plain' } });
    if (!response.ok) throw new Error(`leaderboard read ${response.status}`);
    const text = await response.text();
    const entries = parseDreamloEntries(text);
    remoteCache = { at: Date.now(), entries };
    return { ok: true, entries, cached: false };
  } catch (error) {
    return { ok: false, entries: remoteCache.entries || [], error: error.message || 'network' };
  }
}

export async function submitGlobalScore(name, score, seconds) {
  const clean = sanitizeName(name);
  const safeScore = Math.max(0, Math.min(9999999, Math.floor(Number(score) || 0)));
  const safeSeconds = Math.max(0, Math.min(359999, Math.floor(Number(seconds) || 0)));
  const url = `${JINA_PREFIX}${DREAMLO_PRIVATE}/add/${encodeURIComponent(clean)}/${safeScore}/${safeSeconds}?t=${Date.now()}`;
  try {
    const response = await fetchWithTimeout(url, { cache: 'no-store', headers: { Accept: 'text/plain' } }, 15000);
    if (!response.ok) throw new Error(`leaderboard write ${response.status}`);
    // The body is a rendered page, but a 200 means the proxy fetched the
    // DreamLo add endpoint. Refresh the cache so the next read is fresh.
    remoteCache = { at: 0, entries: null };
    savePlayerName(clean);
    return { ok: true, name: clean, score: safeScore, seconds: safeSeconds };
  } catch (error) {
    return { ok: false, error: error.message || 'network' };
  }
}

export function clearRemoteCache() {
  remoteCache = { at: 0, entries: null };
}

export function getLeaderboardDisplay(globalEntries, localEntries) {
  const global = (globalEntries || []).map(normalizeEntry);
  const local = (localEntries || []).map(normalizeEntry);
  const globalHasScores = global.length > 0;
  return {
    global,
    local: local.slice(0, 10),
    globalHasScores,
    best: local[0]?.score || global[0]?.score || 0,
  };
}

export function renameLocalScore(id, name) {
  if (!id) return null;
  const entries = readLocal();
  const entry = entries.find((item) => item.id === id);
  if (!entry) return null;
  entry.name = sanitizeName(name);
  writeLocal(entries);
  return entry;
}
