/* =====================================================================
   VOID STRIKER — cloud backend client (Neon serverless Postgres)
   =====================================================================
   This replaces the old Firebase (Auth + Firestore) version. The game
   itself never talks to Postgres directly — browsers can't do that
   safely. Instead this file calls a small API server (see server.js)
   which is the only thing holding the Neon connection string.

   ------------------------------------------------------------------
   ONE-TIME SETUP:
   ------------------------------------------------------------------
   1. Deploy the accompanying server.js (see its own setup comment) —
      to Render, Railway, Fly.io, a VPS, wherever. It needs to be
      reachable over HTTPS from wherever this game is hosted.
   2. Point API_BASE_URL below at that server's URL.
   That's it — this file only makes HTTP requests, it holds no secrets.
   ===================================================================== */

/* ---- point this at your deployed API server ---- */
const API_BASE_URL = 'https://YOUR-API-SERVER.example.com';

const TOKEN_KEY = 'voidstriker.authToken';

const DEFAULT_PROGRESS = {
  bestScore: 0,
  selectedPlayer: 0,
  selectedMap: 0,
  settings: {},
  money: 320,
  purchasedPlayers: [true, false, false, false, false, false, false]
};

function cloneDefaultProgress() {
  return JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
}

function normalizeName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  return clean || 'Guest Pilot';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* localStorage unavailable — session just won't persist */ }
}

async function apiRequest(path, options) {
  options = options || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new Error((data && data.error) || 'Something went wrong.');
  }
  return data;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accountType: 'account',
    progress: Object.assign(cloneDefaultProgress(), user.progress || {})
  };
}

(function () {
  window.GameDb = {
    async getCurrentUser() {
      if (!getToken()) return null;
      try {
        const data = await apiRequest('/api/me', { method: 'GET' });
        return normalizeUser(data.user);
      } catch (error) {
        // Bad/expired token -- treat as signed out rather than surfacing an error.
        setToken(null);
        return null;
      }
    },

    async saveName(name) {
      const cleanName = normalizeName(name);
      const data = await apiRequest('/api/me/name', { method: 'PATCH', body: { name: cleanName } });
      return normalizeUser(data.user);
    },

    async saveProgress(userId, progress) {
      const data = await apiRequest('/api/me/progress', { method: 'PATCH', body: { progress: progress } });
      return normalizeUser(data.user);
    },

    async signIn(email, password) {
      const cleanEmail = normalizeEmail(email);
      const data = await apiRequest('/api/auth/signin', {
        method: 'POST',
        body: { email: cleanEmail, password: password }
      });
      setToken(data.token);
      return normalizeUser(data.user);
    },

    async signUp(username, email, password) {
      const cleanEmail = normalizeEmail(email);
      const cleanName = normalizeName(username);
      if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Enter a valid email.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

      const data = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: { username: cleanName, email: cleanEmail, password: password }
      });
      setToken(data.token);
      return normalizeUser(data.user);
    },

    async signOut() {
      setToken(null);
      return null;
    },

    async getLeaderboard() {
      const data = await apiRequest('/api/leaderboard', { method: 'GET' });
      return data.leaderboard;
    }
  };
})();