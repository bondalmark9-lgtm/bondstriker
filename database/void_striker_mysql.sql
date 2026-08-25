CREATE DATABASE IF NOT EXISTS void_striker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE void_striker;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS user_purchased_players;
DROP TABLE IF EXISTS user_progress;
DROP TABLE IF EXISTS device_profiles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS levels;
DROP TABLE IF EXISTS level_tiers;
DROP TABLE IF EXISTS maps;
DROP TABLE IF EXISTS players;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE players (
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

CREATE TABLE maps (
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

CREATE TABLE level_tiers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  level_from TINYINT UNSIGNED NOT NULL,
  level_to TINYINT UNSIGNED NOT NULL,
  color CHAR(7) NOT NULL,
  CHECK (level_from BETWEEN 1 AND 50),
  CHECK (level_to BETWEEN 1 AND 50),
  CHECK (level_from <= level_to)
);

CREATE TABLE levels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level_number TINYINT UNSIGNED NOT NULL UNIQUE,
  tier_id INT UNSIGNED NOT NULL,
  is_boss_level BOOLEAN NOT NULL DEFAULT FALSE,
  base_reward INT UNSIGNED NOT NULL DEFAULT 28,
  FOREIGN KEY (tier_id) REFERENCES level_tiers(id)
);

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  salt CHAR(32) NOT NULL,
  password_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE device_profiles (
  device_id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  best_score INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_progress (
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
  CHECK (unlocked_level BETWEEN 1 AND 50),
  CHECK (sfx_volume BETWEEN 0 AND 1),
  CHECK (music_volume BETWEEN 0 AND 1),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_player_id) REFERENCES players(id),
  FOREIGN KEY (selected_map_id) REFERENCES maps(id)
);

CREATE TABLE user_purchased_players (
  user_id CHAR(36) NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  purchased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, player_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

INSERT INTO players
  (id, code, name, description, primary_color, secondary_color, speed_stat, fire_stat, damage_stat, speed, fire_rate_ms, damage, cost, shield, image_path)
VALUES
  (1, 'sakura', 'SAKURA', 'Balanced striker, twin blossom cannon.', '#ff2e93', '#ffd1e8', 65, 60, 55, 6.20, 230, 1, 0, 0, 'src/assets/images/players/1.png'),
  (2, 'kaito', 'KAITO', 'Rapid interceptor, thin but relentless.', '#00e5ff', '#c6faff', 90, 85, 30, 8.00, 140, 1, 250, 0, 'src/assets/images/players/2.png'),
  (3, 'raiden', 'RAIDEN', 'Heavy gunship, slow and devastating.', '#8b5cf6', '#e4d6ff', 40, 35, 90, 4.60, 340, 3, 500, 1, 'src/assets/images/players/3.png'),
  (4, 'nova', 'NOVA', 'Glass cannon, blistering fire rate.', '#ffd23f', '#fff3c4', 70, 95, 45, 6.60, 110, 1, 1500, 0, 'src/assets/images/players/4.png'),
  (5, 'rocket', 'ROCKET', 'Titanium defender, built to absorb the void.', '#00ff9d', '#d0ffe8', 60, 55, 85, 6.40, 300, 3, 5000, 1, 'src/assets/images/players/5.png'),
  (6, 'aurora', 'AURORA', 'Prism ace, fast shots with shield tech.', '#38bdf8', '#f0f9ff', 82, 78, 58, 7.40, 165, 2, 8500, 1, 'src/assets/images/players/6.png'),
  (7, 'vortex', 'VORTEX', 'Gravity bruiser, slow but brutally stable.', '#a855f7', '#f5d0fe', 48, 50, 100, 5.10, 390, 4, 12000, 2, 'src/assets/images/players/7.png'),
  (8, 'solaris', 'SOLARIS', 'Legendary sunblade, elite burst striker.', '#f97316', '#ffedd5', 88, 92, 72, 7.80, 125, 2, 18000, 1, 'src/assets/images/players/8.png');

INSERT INTO maps
  (id, code, name, description, sky_top_color, sky_bottom_color, particle_type, accent_color, image_path)
VALUES
  (1, 'sakura_sky', 'SAKURA SKY', 'Petals drift over a pink dusk.', '#3a1030', '#ff2e93', 'petals', '#ff2e93', 'src/assets/images/maps/sakura_sky.jpg'),
  (2, 'neon_city', 'NEON CITY', 'Skyline streaks beneath violet clouds.', '#0a0e2e', '#5b21b6', 'streaks', '#00e5ff', 'src/assets/images/maps/neon_city.jpg'),
  (3, 'star_void', 'STAR VOID', 'Silent deep space, endless stars.', '#02030c', '#141a3d', 'stars', '#8b5cf6', 'src/assets/images/maps/star_void.jpg'),
  (4, 'crimson_caldera', 'CRIMSON CALDERA', 'Embers rise over a molten horizon.', '#2b0705', '#7a1f0d', 'embers', '#ff4655', 'src/assets/images/maps/crimson_caldera.jpg'),
  (5, 'nebula_core', 'NEBULA CORE', 'A burning stellar forge in the void.', '#050712', '#2bc7ff', 'embers', '#00ff9d', 'src/assets/images/maps/nebula_core.svg');

INSERT INTO level_tiers
  (id, code, name, level_from, level_to, color)
VALUES
  (1, 'rookie_wing', 'ROOKIE WING', 1, 10, '#00e5ff'),
  (2, 'storm_wing', 'STORM WING', 11, 20, '#8b5cf6'),
  (3, 'blossom_wing', 'BLOSSOM WING', 21, 30, '#ff2e93'),
  (4, 'inferno_wing', 'INFERNO WING', 31, 40, '#ffd23f'),
  (5, 'void_wing', 'VOID WING', 41, 50, '#ff4655');

INSERT INTO levels (level_number, tier_id, is_boss_level, base_reward)
SELECT n.level_number, t.id, n.level_number % 10 = 0, 28
FROM (
  SELECT 1 level_number UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
  UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
  UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
  UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
  UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
  UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
  UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
  UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45
  UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49 UNION ALL SELECT 50
) n
JOIN level_tiers t ON n.level_number BETWEEN t.level_from AND t.level_to;

CREATE INDEX idx_players_cost ON players(cost);
CREATE INDEX idx_levels_tier_id ON levels(tier_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_progress_best_score ON user_progress(best_score);
CREATE INDEX idx_device_profiles_best_score ON device_profiles(best_score);
