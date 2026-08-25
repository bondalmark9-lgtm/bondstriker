import crypto from 'node:crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const databaseName = process.env.MYSQL_DATABASE || 'void_striker';

let pool = null;

function createPool(database) {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: database,
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });
}

async function ensureDatabase() {
  const setupPool = createPool();
  await setupPool.query(
    'CREATE DATABASE IF NOT EXISTS `' + databaseName + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
  );
  await setupPool.end();

  pool = createPool(databaseName);
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(80) NOT NULL,
        description VARCHAR(255) NOT NULL,
        primary_color CHAR(7) NOT NULL,
        secondary_color CHAR(7) NOT NULL,
        speed_stat TINYINT UNSIGNED NOT NULL,
        fire_stat TINYINT UNSIGNED NOT NULL,
        damage_stat TINYINT UNSIGNED NOT NULL,
        speed DECIMAL(4, 2) NOT NULL,
        fire_rate_ms SMALLINT UNSIGNED NOT NULL,
        damage TINYINT UNSIGNED NOT NULL,
        cost INT UNSIGNED NOT NULL DEFAULT 0,
        shield TINYINT UNSIGNED NOT NULL DEFAULT 0,
        image_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS maps (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(80) NOT NULL,
        description VARCHAR(255) NOT NULL,
        sky_top_color CHAR(7) NOT NULL,
        sky_bottom_color CHAR(7) NOT NULL,
        particle_type ENUM('petals', 'streaks', 'stars', 'embers') NOT NULL,
        accent_color CHAR(7) NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS level_tiers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(80) NOT NULL,
        level_from TINYINT UNSIGNED NOT NULL,
        level_to TINYINT UNSIGNED NOT NULL,
        color CHAR(7) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS levels (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        level_number TINYINT UNSIGNED NOT NULL UNIQUE,
        tier_id INT UNSIGNED NOT NULL,
        is_boss_level BOOLEAN NOT NULL DEFAULT FALSE,
        base_reward INT UNSIGNED NOT NULL DEFAULT 28,
        FOREIGN KEY (tier_id) REFERENCES level_tiers(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        username VARCHAR(80) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        salt CHAR(32) NOT NULL,
        password_hash CHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS device_profiles (
        device_id CHAR(36) PRIMARY KEY,
        username VARCHAR(80) NOT NULL,
        best_score INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_progress (
        user_id CHAR(36) PRIMARY KEY,
        unlocked_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
        selected_player_id INT UNSIGNED NOT NULL DEFAULT 1,
        selected_map_id INT UNSIGNED NOT NULL DEFAULT 1,
        sfx_volume DECIMAL(3, 2) NOT NULL DEFAULT 0.70,
        music_volume DECIMAL(3, 2) NOT NULL DEFAULT 0.40,
        difficulty ENUM('easy', 'normal', 'hard') NOT NULL DEFAULT 'normal',
        control_scheme ENUM('arrows', 'wasd') NOT NULL DEFAULT 'arrows',
        screen_shake BOOLEAN NOT NULL DEFAULT TRUE,
        money INT UNSIGNED NOT NULL DEFAULT 320,
        best_score INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (selected_player_id) REFERENCES players(id),
        FOREIGN KEY (selected_map_id) REFERENCES maps(id)
      );

      CREATE TABLE IF NOT EXISTS user_purchased_players (
        user_id CHAR(36) NOT NULL,
        player_id INT UNSIGNED NOT NULL,
        purchased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, player_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
    `);

    await ensureUserProgressColumns(connection);
    await seedGameData(connection);
  } finally {
    connection.release();
  }
}

async function ensureUserProgressColumns(connection) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress'`,
    [databaseName]
  );
  const columnNames = new Set(columns.map(function (column) {
    return column.COLUMN_NAME;
  }));

  if (!columnNames.has('best_score')) {
    await connection.execute(
      'ALTER TABLE user_progress ADD COLUMN best_score INT UNSIGNED NOT NULL DEFAULT 0 AFTER money'
    );
  }
}

async function seedGameData(connection) {
  await connection.query(`
    INSERT IGNORE INTO players
      (id, code, name, description, primary_color, secondary_color, speed_stat, fire_stat, damage_stat, speed, fire_rate_ms, damage, cost, shield, image_path)
    VALUES
      (1, 'sakura', 'SAKURA', 'Balanced striker, twin blossom cannon.', '#ff2e93', '#ffd1e8', 65, 60, 55, 6.20, 230, 1, 0, 0, 'src/assets/images/players/sakura.png'),
      (2, 'kaito', 'KAITO', 'Rapid interceptor, thin but relentless.', '#00e5ff', '#c6faff', 90, 85, 30, 8.00, 140, 1, 250, 0, 'src/assets/images/players/kaito.png'),
      (3, 'raiden', 'RAIDEN', 'Heavy gunship, slow and devastating.', '#8b5cf6', '#e4d6ff', 40, 35, 90, 4.60, 340, 3, 500, 1, 'src/assets/images/players/raiden.png'),
      (4, 'nova', 'NOVA', 'Glass cannon, blistering fire rate.', '#ffd23f', '#fff3c4', 70, 95, 45, 6.60, 110, 1, 1500, 0, 'src/assets/images/players/nova.png'),
      (5, 'rocket', 'ROCKET', 'Titanium defender, built to absorb the void.', '#00ff9d', '#d0ffe8', 60, 55, 85, 6.40, 300, 3, 5000, 1, 'src/assets/images/players/rocket_red.png'),
      (6, 'aurora', 'AURORA', 'Prism ace, fast shots with shield tech.', '#38bdf8', '#f0f9ff', 82, 78, 58, 7.40, 165, 2, 8500, 1, 'src/assets/images/players/kaito.png'),
      (7, 'vortex', 'VORTEX', 'Gravity bruiser, slow but brutally stable.', '#a855f7', '#f5d0fe', 48, 50, 100, 5.10, 390, 4, 12000, 2, 'src/assets/images/players/raiden.png'),
      (8, 'solaris', 'SOLARIS', 'Legendary sunblade, elite burst striker.', '#f97316', '#ffedd5', 88, 92, 72, 7.80, 125, 2, 18000, 1, 'src/assets/images/players/nova.png');

    INSERT IGNORE INTO maps
      (id, code, name, description, sky_top_color, sky_bottom_color, particle_type, accent_color, image_path)
    VALUES
      (1, 'sakura_sky', 'SAKURA SKY', 'Petals drift over a pink dusk.', '#3a1030', '#ff2e93', 'petals', '#ff2e93', 'src/assets/images/maps/sakura_sky.jpg'),
      (2, 'neon_city', 'NEON CITY', 'Skyline streaks beneath violet clouds.', '#0a0e2e', '#5b21b6', 'streaks', '#00e5ff', 'src/assets/images/maps/neon_city.jpg'),
      (3, 'star_void', 'STAR VOID', 'Silent deep space, endless stars.', '#02030c', '#141a3d', 'stars', '#8b5cf6', 'src/assets/images/maps/star_void.jpg'),
      (4, 'crimson_caldera', 'CRIMSON CALDERA', 'Embers rise over a molten horizon.', '#2b0705', '#7a1f0d', 'embers', '#ff4655', 'src/assets/images/maps/crimson_caldera.jpg'),
      (5, 'nebula_core', 'NEBULA CORE', 'A burning stellar forge in the void.', '#050712', '#2bc7ff', 'embers', '#00ff9d', 'src/assets/images/maps/nebula_core.svg');

    INSERT IGNORE INTO level_tiers
      (id, code, name, level_from, level_to, color)
    VALUES
      (1, 'rookie_wing', 'ROOKIE WING', 1, 10, '#00e5ff'),
      (2, 'storm_wing', 'STORM WING', 11, 20, '#8b5cf6'),
      (3, 'blossom_wing', 'BLOSSOM WING', 21, 30, '#ff2e93'),
      (4, 'inferno_wing', 'INFERNO WING', 31, 40, '#ffd23f'),
      (5, 'void_wing', 'VOID WING', 41, 50, '#ff4655');
  `);

  const levelNumbers = Array.from({ length: 50 }, function (_, index) {
    return index + 1;
  });

  for (const levelNumber of levelNumbers) {
    await connection.execute(
      `INSERT IGNORE INTO levels (level_number, tier_id, is_boss_level, base_reward)
       SELECT ?, id, ?, 28 FROM level_tiers WHERE ? BETWEEN level_from AND level_to`,
      [levelNumber, levelNumber % 10 === 0 ? 1 : 0, levelNumber]
    );
  }
}

app.use(cors());
app.use(express.json());

function normalizeUsername(username) {
  return String(username || '').trim();
}

function normalizeDeviceId(deviceId) {
  const clean = String(deviceId || '').trim();
  return /^[0-9a-f-]{36}$/i.test(clean) ? clean : '';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function createId() {
  return crypto.randomUUID();
}

function settingsFromRow(row) {
  return {
    sfxVol: Number(row.sfx_volume),
    musicVol: Number(row.music_volume),
    difficulty: row.difficulty,
    scheme: row.control_scheme,
    screenShake: Boolean(row.screen_shake)
  };
}

async function getPlayerCount(connection) {
  const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM players');
  return Number(rows[0].count || 0);
}

async function getPurchasedPlayers(connection, userId, playerCount) {
  const [rows] = await connection.execute(
    'SELECT player_id FROM user_purchased_players WHERE user_id = ?',
    [userId]
  );
  const purchased = Array.from({ length: playerCount }, function (_, index) {
    return index === 0;
  });
  rows.forEach(function (row) {
    purchased[Number(row.player_id) - 1] = true;
  });
  return purchased;
}

async function publicUser(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT
      u.id,
      u.username,
      u.email,
      u.created_at,
      u.updated_at,
      p.unlocked_level,
      p.selected_player_id,
      p.selected_map_id,
      p.sfx_volume,
      p.music_volume,
      p.difficulty,
      p.control_scheme,
      p.screen_shake,
      p.money,
      p.best_score
    FROM users u
    JOIN user_progress p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  const playerCount = await getPlayerCount(connection);
  const purchasedPlayers = await getPurchasedPlayers(connection, userId, playerCount);

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    progress: {
      unlockedLevel: Number(row.unlocked_level),
      selectedPlayer: Number(row.selected_player_id) - 1,
      selectedMap: Number(row.selected_map_id) - 1,
      settings: settingsFromRow(row),
      money: Number(row.money),
      bestScore: Number(row.best_score),
      purchasedPlayers: purchasedPlayers
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getUserByEmail(connection, email) {
  const [rows] = await connection.execute(
    'SELECT id, salt, password_hash FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

app.get('/api/health', async function (_req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/users/:id', async function (req, res) {
  try {
    const connection = await pool.getConnection();
    try {
      const user = await publicUser(connection, req.params.id);
      if (!user) return sendError(res, 404, 'User not found.');
      return res.json({ user: user });
    } finally {
      connection.release();
    }
  } catch (error) {
    return sendError(res, 500, 'Unable to load account.');
  }
});

app.post('/api/auth/signup', async function (req, res) {
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (username.length < 3) return sendError(res, 400, 'Pilot name must be at least 3 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'Enter a valid email address.');
  if (password.length < 6) return sendError(res, 400, 'Password must be at least 6 characters.');
  if (password !== confirmPassword) return sendError(res, 400, 'Passwords do not match.');

  const connection = await pool.getConnection();
  try {
    const existing = await getUserByEmail(connection, email);
    if (existing) return sendError(res, 409, 'An account already exists for that email.');

    const id = createId();
    const salt = createSalt();
    const passwordHash = sha256(salt + password);

    await connection.beginTransaction();
    await connection.execute(
      'INSERT INTO users (id, username, email, salt, password_hash) VALUES (?, ?, ?, ?, ?)',
      [id, username, email, salt, passwordHash]
    );
    await connection.execute(
      'INSERT INTO user_progress (user_id, unlocked_level, selected_player_id, selected_map_id, money) VALUES (?, 1, 1, 1, 320)',
      [id]
    );
    await connection.execute(
      'INSERT INTO user_purchased_players (user_id, player_id) VALUES (?, 1)',
      [id]
    );
    await connection.commit();

    const user = await publicUser(connection, id);
    return res.status(201).json({ user: user });
  } catch (error) {
    await connection.rollback();
    if (error && error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'An account already exists for that email.');
    }
    return sendError(res, 500, 'Unable to create account.');
  } finally {
    connection.release();
  }
});

app.post('/api/auth/signin', async function (req, res) {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  const connection = await pool.getConnection();
  try {
    const user = await getUserByEmail(connection, email);
    if (!user) return sendError(res, 404, 'No account found for that email.');
    if (user.password_hash !== sha256(user.salt + password)) {
      return sendError(res, 401, 'Incorrect password.');
    }

    const publicAccount = await publicUser(connection, user.id);
    return res.json({ user: publicAccount });
  } catch (error) {
    return sendError(res, 500, 'Unable to sign in.');
  } finally {
    connection.release();
  }
});

app.patch('/api/users/:id/profile', async function (req, res) {
  const username = normalizeUsername(req.body.username);
  if (username.length < 2) return sendError(res, 400, 'Pilot name must be at least 2 characters.');

  try {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE users SET username = ? WHERE id = ?',
        [username, req.params.id]
      );
      if (!result.affectedRows) return sendError(res, 404, 'User not found.');

      const user = await publicUser(connection, req.params.id);
      return res.json({ user: user });
    } finally {
      connection.release();
    }
  } catch (error) {
    return sendError(res, 500, 'Unable to save pilot name.');
  }
});

app.patch('/api/users/:id/progress', async function (req, res) {
  const progress = req.body.progress || {};
  const settings = progress.settings || {};
  const selectedPlayerId = Number(progress.selectedPlayer || 0) + 1;
  const selectedMapId = Number(progress.selectedMap || 0) + 1;
  const unlockedLevel = Math.max(1, Math.min(50, Number(progress.unlockedLevel || 1)));
  const money = Math.max(0, Number(progress.money || 0));
  const bestScore = Math.max(0, Number(progress.bestScore || 0));
  const purchasedPlayers = Array.isArray(progress.purchasedPlayers) ? progress.purchasedPlayers : [];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE user_progress
       SET unlocked_level = ?,
           selected_player_id = ?,
           selected_map_id = ?,
           sfx_volume = ?,
           music_volume = ?,
           difficulty = ?,
           control_scheme = ?,
           screen_shake = ?,
           money = ?,
           best_score = GREATEST(best_score, ?)
       WHERE user_id = ?`,
      [
        unlockedLevel,
        selectedPlayerId,
        selectedMapId,
        Number(settings.sfxVol ?? 0.7),
        Number(settings.musicVol ?? 0.4),
        ['easy', 'normal', 'hard'].includes(settings.difficulty) ? settings.difficulty : 'normal',
        ['arrows', 'wasd'].includes(settings.scheme) ? settings.scheme : 'arrows',
        settings.screenShake === false ? 0 : 1,
        money,
        bestScore,
        req.params.id
      ]
    );

    if (!result.affectedRows) {
      await connection.rollback();
      return sendError(res, 404, 'User not found.');
    }

    await connection.execute('DELETE FROM user_purchased_players WHERE user_id = ?', [req.params.id]);
    const ownedIds = purchasedPlayers
      .map(function (owned, index) { return owned ? index + 1 : null; })
      .filter(Boolean);

    if (!ownedIds.includes(1)) ownedIds.unshift(1);

    for (const playerId of ownedIds) {
      await connection.execute(
        'INSERT INTO user_purchased_players (user_id, player_id) VALUES (?, ?)',
        [req.params.id, playerId]
      );
    }

    await connection.commit();
    const user = await publicUser(connection, req.params.id);
    return res.json({ user: user });
  } catch (error) {
    await connection.rollback();
    return sendError(res, 500, 'Unable to save progress.');
  } finally {
    connection.release();
  }
});

app.post('/api/device-progress', async function (req, res) {
  const deviceId = normalizeDeviceId(req.body.deviceId);
  const username = normalizeUsername(req.body.username) || 'Guest Pilot';
  const progress = req.body.progress || {};
  const bestScore = Math.max(0, Number(progress.bestScore || 0));

  if (!deviceId) return sendError(res, 400, 'Device id is required.');

  try {
    await pool.execute(
      `INSERT INTO device_profiles (device_id, username, best_score)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         best_score = GREATEST(best_score, VALUES(best_score))`,
      [deviceId, username, bestScore]
    );

    return res.json({
      user: {
        id: 'device:' + deviceId,
        username: username,
        accountType: 'device',
        progress: { bestScore: bestScore }
      }
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to save device score.');
  }
});

app.get('/api/leaderboard', async function (_req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT userId, username, bestScore, updatedAt, source
       FROM (
         SELECT
           CONCAT('user:', u.id) AS userId,
           u.username AS username,
           p.best_score AS bestScore,
           p.updated_at AS updatedAt,
           'account' AS source
         FROM user_progress p
         JOIN users u ON u.id = p.user_id
         UNION ALL
         SELECT
           CONCAT('device:', d.device_id) AS userId,
           d.username AS username,
           d.best_score AS bestScore,
           d.updated_at AS updatedAt,
           'device' AS source
         FROM device_profiles d
       ) scores
       ORDER BY bestScore DESC, updatedAt ASC`
    );

    return res.json({
      leaderboard: rows.map(function (row) {
        return {
          userId: row.userId,
          username: row.username,
          bestScore: Number(row.bestScore),
          updatedAt: row.updatedAt,
          source: row.source
        };
      })
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to load leaderboard.');
  }
});

ensureDatabase()
  .then(function () {
    const server = app.listen(port, function () {
      console.log(`Void Striker API listening on http://localhost:${port}`);
      console.log(`MySQL database ready: ${databaseName}`);
      console.log(`Start the game from the project root with "npm run dev".`);
    });
    server.on('error', function (error) {
      if (error && error.code === 'EADDRINUSE') {
        console.error(
          'Port ' + port + ' is already in use by another API server.\n' +
          'Stop the other "node server.js" / "npm run dev" process, then run "npm run dev" once.'
        );
      } else {
        console.error('Unable to start Void Striker API.', error.message);
      }
      process.exit(1);
    });
  })
  .catch(function (error) {
    console.error(
      'Unable to start Void Striker API.\n' +
      'Check that MySQL is installed and running, and that MYSQL_HOST, MYSQL_USER and MYSQL_PASSWORD in .env are correct.'
    );
    console.error(error.message);
    process.exit(1);
  });
