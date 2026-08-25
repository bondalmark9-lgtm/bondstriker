/* =====================================================================
   VOID STRIKER — cloud backend client (Neon serverless Postgres)
   =====================================================================
   The game itself never talks to Postgres directly — browsers can't do
   that safely. Instead this file calls a small API server (see
   server.js) which is the only thing holding the Neon connection
   string.

   The game no longer has accounts (no login / signup / logout) —
   player progress is stored locally in the browser (see app.js). This
   client now only reads the public leaderboard from the server.

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

(function () {
  window.GameDb = {
    async getLeaderboard() {
      let res;
      try {
        res = await fetch(API_BASE_URL + '/api/leaderboard', { method: 'GET' });
      } catch (networkErr) {
        throw new Error('Could not reach the server. Check your connection and try again.');
      }

      let data = null;
      try { data = await res.json(); } catch (e) { /* empty body */ }

      if (!res.ok) {
        throw new Error((data && data.error) || 'Could not load leaderboard.');
      }
      return (data && data.leaderboard) || [];
    }
  };
})();