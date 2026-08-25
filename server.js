/* =====================================================================
   VOID STRIKER — API server (Neon serverless Postgres backend)
   =====================================================================
   Browsers can't talk to Postgres directly (there's no equivalent of
   Firestore's client SDK + security rules for Postgres, and shipping
   DB credentials to the browser would let anyone read/write everyone's
   data). This small server sits in between: the game's db.js calls
   these HTTP endpoints, and this server is the only thing that holds
   the Neon connection string.

   ------------------------------------------------------------------
   ONE-TIME SETUP:
   ------------------------------------------------------------------
   1. Go to https://neon.tech -> sign up (free tier is fine) -> New Project.
   2. In the Neon console, open the SQL Editor and run the contents of
      migrations/schema.sql (creates the `users` table).
   3. Project -> Connection Details -> copy the pooled connection
      string into DATABASE_URL in your .env (see .env.example).
   4. Set JWT_SECRET in .env to a long random string.
   5. Set ALLOWED_ORIGINS in .env to the URL(s) your game is served from.
   6. npm install
   7. npm start   (or deploy this folder to Render/Railway/Fly/a VM/etc.)
   8. Point API_BASE_URL at the top of the game's db.js to wherever
      this server ends up running.
   ===================================================================== */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

const { DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS, PORT } = process.env;

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set (see .env.example).');
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set (see .env.example).');

const sql = neon(DATABASE_URL);

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

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    accountType: 'account',
    progress: Object.assign(cloneDefaultProgress(), row.progress || {})
  };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

/* ---- middleware ---- */

const app = express();
app.use(express.json());

const allowedOrigins = (ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: false
}));

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

async function fetchUserById(id) {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

/* ---- routes ---- */

app.post('/api/auth/signup', async (req, res) => {
  try {
    const username = normalizeName(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length) return res.status(409).json({ error: 'An account with that email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const progress = cloneDefaultProgress();
    const rows = await sql`
      INSERT INTO users (username, email, password_hash, progress)
      VALUES (${username}, ${email}, ${passwordHash}, ${sql.json(progress)})
      RETURNING *
    `;
    const user = rows[0];
    res.json({ token: signToken(user.id), user: toPublicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'No pilot account found for that email.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect password.' });

    res.json({ token: signToken(user.id), user: toPublicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  const user = await fetchUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json({ user: toPublicUser(user) });
});

app.patch('/api/me/name', requireAuth, async (req, res) => {
  try {
    const cleanName = normalizeName(req.body.name);
    const rows = await sql`
      UPDATE users SET username = ${cleanName} WHERE id = ${req.userId} RETURNING *
    `;
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save pilot name.' });
  }
});

app.patch('/api/me/progress', requireAuth, async (req, res) => {
  try {
    const current = await fetchUserById(req.userId);
    if (!current) return res.status(404).json({ error: 'Account not found.' });
    const mergedProgress = Object.assign(
      cloneDefaultProgress(),
      current.progress || {},
      req.body.progress || {}
    );
    const rows = await sql`
      UPDATE users SET progress = ${sql.json(mergedProgress)} WHERE id = ${req.userId} RETURNING *
    `;
    res.json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save progress.' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, username, progress
      FROM users
      ORDER BY ((progress->>'bestScore')::numeric) DESC NULLS LAST
      LIMIT 50
    `;
    const leaderboard = rows.map((row) => ({
      userId: row.id,
      username: row.username,
      bestScore: (row.progress && row.progress.bestScore) || 0,
      source: 'account'
    }));
    res.json({ leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load leaderboard.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = PORT || 8787;
app.listen(port, () => console.log(`VOID STRIKER API listening on :${port}`));