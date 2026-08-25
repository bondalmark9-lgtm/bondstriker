(function () {
  'use strict';

  angular.module('animeShooter', [])
    .controller('MainCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
      const vm = this;

      /* ================= STATIC DATA ================= */

      const ASSET_BASE = '/assets/images/';

      vm.players = [
        { name: 'SAKURA', desc: 'Balanced striker, twin blossom cannon.', primary: '#ff2e93', secondary: '#ffd1e8', speedStat: 65, fireStat: 60, dmgStat: 55, speed: 6.2, fireRate: 230, dmg: 1, cost: 0, shield: 0, img: ASSET_BASE + 'players/sakura.png' },
        { name: 'KAITO', desc: 'Rapid interceptor, thin but relentless.', primary: '#00e5ff', secondary: '#c6faff', speedStat: 90, fireStat: 85, dmgStat: 30, speed: 8.0, fireRate: 140, dmg: 1, cost: 250, shield: 0, img: ASSET_BASE + 'players/kaito.png' },
        { name: 'RAIDEN', desc: 'Heavy gunship, slow and devastating.', primary: '#8b5cf6', secondary: '#e4d6ff', speedStat: 40, fireStat: 35, dmgStat: 90, speed: 4.6, fireRate: 340, dmg: 3, cost: 500, shield: 1, img: ASSET_BASE + 'players/raiden.png' },
        { name: 'NOVA', desc: 'Glass cannon, blistering fire rate.', primary: '#ffd23f', secondary: '#fff3c4', speedStat: 70, fireStat: 95, dmgStat: 45, speed: 6.6, fireRate: 110, dmg: 1, cost: 1500, shield: 0, img: ASSET_BASE + 'players/nova.png' },
        { name: 'ROCKET', desc: 'Titanium defender, built to absorb the void.', primary: '#00ff9d', secondary: '#d0ffe8', speedStat: 60, fireStat: 55, dmgStat: 85, speed: 6.4, fireRate: 300, dmg: 3, cost: 3000, shield: 1, img: ASSET_BASE + 'players/rocket_red.png' },
        { name: 'AURORA', desc: 'Prism ace, fast shots with shield tech.', primary: '#38bdf8', secondary: '#f0f9ff', speedStat: 82, fireStat: 78, dmgStat: 58, speed: 7.4, fireRate: 165, dmg: 2, cost: 5000, shield: 2, img: ASSET_BASE + 'players/1.png' },
        { name: 'VORTEX', desc: 'Gravity bruiser, slow but brutally stable.', primary: '#a855f7', secondary: '#f5d0fe', speedStat: 98, fireStat: 90, dmgStat: 100, speed: 7.1, fireRate: 100, dmg: 5, cost: 8000, shield: 3, img: ASSET_BASE + 'players/2.png' }
      ];

      vm.maps = [
        { name: 'SAKURA SKY', desc: 'Petals drift over a pink dusk.', sky: ['#3a1030', '#ff2e93'], particle: 'petals', accent: '#ff2e93', img: ASSET_BASE + 'maps/neon_city.jpg' },
        { name: 'NEON CITY', desc: 'Skyline streaks beneath violet clouds.', sky: ['#0a0e2e', '#5b21b6'], particle: 'streaks', accent: '#00ff9d', img: ASSET_BASE + 'maps/sakura_sky.jpg' },
        { name: 'STAR VOID', desc: 'Silent deep space, endless stars.', sky: ['#02030c', '#141a3d'], particle: 'stars', accent: '#8b5cf6', img: ASSET_BASE + 'maps/star_void.jpg' },
        { name: 'CRIMSON CALDERA', desc: 'Embers rise over a molten horizon.', sky: ['#2b0705', '#7a1f0d'], particle: 'embers', accent: '#ff4655', img: ASSET_BASE + 'maps/crimson_caldera.jpg' },
        { name: 'NEBULA CORE', desc: 'A burning stellar forge in the void.', sky: ['#050712', '#2bc7ff'], particle: 'embers', accent: '#00ff9d', img: ASSET_BASE + 'maps/nebula_core.svg' }
      ];

      const ENEMY_IMG = ASSET_BASE + 'enemies/drone.png';
      const BOSS_IMG = ASSET_BASE + 'enemies/boss.png';
      const BULLET_PLAYER_IMG = ASSET_BASE + 'ui/bullet_player.png';
      const BULLET_ENEMY_IMG = ASSET_BASE + 'ui/bullet_enemy.png';

      vm.livesSlots = [0, 1, 2];
      vm.screen = 'menu';
      vm.selectedPlayer = 0;
      vm.selectedMap = 0;
      vm.wave = 1;
      vm.score = 0;
      vm.bestScore = 0;
      vm.lives = 3;
      vm.money = 320;
      vm.purchasedPlayers = [true, false, false, false, false, false, false, false];
      vm.bossActive = false;
      vm.bossHpPct = 100;
      vm.spawned = 0;
      vm.enemiesAlive = 0;
      vm.levelCfg = {};
      vm.waveBanner = '';
      vm.showWaveBanner = false;
      vm.newBest = false;
      vm.leaderboard = [];
      vm.leaderboardBusy = false;
      vm.leaderboardError = '';
      vm.pilotName = '';
      vm.nameError = '';
      vm.nameSaved = false;

      vm.topScore = function () { return Math.max(vm.bestScore, vm.score); };

      const defaultSettings = {
        sfxVol: 0.7,
        musicVol: 0.4,
        difficulty: 'normal',
        scheme: 'arrows',
        screenShake: true
      };
      vm.settings = angular.copy(defaultSettings);

      loadProgress();

      vm.goTo = function (screen) {
        vm.screen = screen;
      };
      vm.selectPlayer = function (i) {
        if (!vm.purchasedPlayers[i]) return;
        vm.selectedPlayer = i;
        saveProfile();
      };
      vm.selectMap = function (i) { vm.selectedMap = i; saveProfile(); };
      vm.canAfford = function (i) { return vm.money >= vm.players[i].cost; };
      vm.buyPlayer = function (i) {
        if (vm.purchasedPlayers[i]) { vm.selectPlayer(i); return; }
        const cost = vm.players[i].cost || 0;
        if (vm.money < cost) return;
        vm.money -= cost;
        vm.purchasedPlayers[i] = true;
        vm.selectedPlayer = i;
        saveProfile();
      };

      vm.startRun = function () {
        vm.wave = 1;
        vm.score = 0;
        vm.lives = 3;
        vm.newBest = false;
        beginWave();
        vm.screen = 'game';
      };
      vm.restartRun = vm.startRun;
      vm.pauseGame = function () { if (vm.screen === 'game') vm.screen = 'pause'; };
      vm.resumeGame = function () {
        vm.screen = 'game';
      };
      vm.quitToMenu = function () { vm.goTo('menu'); };
      vm.applyMusicVolume = function () { setMusicGain(vm.settings.musicVol); saveProfile(); };
      vm.saveSettings = saveProfile;
      vm.savePilotName = function () {
        const name = String(vm.pilotName || '').trim().replace(/\s+/g, ' ');
        vm.nameSaved = false;
        if (name.length < 2) {
          vm.nameError = 'Pilot name must be at least 2 characters.';
          return;
        }
        vm.pilotName = name;
        vm.nameError = '';
        vm.nameSaved = true;
        saveProfile();
      };

      vm.openLeaderboard = function () {
        vm.screen = 'leaderboard';
        vm.leaderboardBusy = true;
        vm.leaderboardError = '';
        GameDb.getLeaderboard().then(function (rows) {
          $scope.$applyAsync(function () {
            vm.leaderboard = dedupeLeaderboard(rows);
            vm.leaderboardBusy = false;
          });
        }).catch(function (error) {
          $scope.$applyAsync(function () {
            vm.leaderboardBusy = false;
            vm.leaderboardError = error.message || 'Could not load leaderboard.';
          });
        });
      };

      function dedupeLeaderboard(rows) {
        const best = {};
        (rows || []).forEach(function (row) {
          const key = row.userId || row.username;
          if (!best[key] || row.bestScore > best[key].bestScore) best[key] = row;
        });
        return Object.keys(best).map(function (k) { return best[k]; })
          .sort(function (a, b) { return b.bestScore - a.bestScore; });
      }

      const PROGRESS_KEY = 'voidstriker.progress';

      function loadProgress() {
        let progress = null;
        try {
          const raw = localStorage.getItem(PROGRESS_KEY);
          if (raw) progress = JSON.parse(raw);
        } catch (e) { progress = null; }

        if (!progress) {
          vm.money = 320;
          vm.bestScore = 0;
          vm.purchasedPlayers = [true, false, false, false, false, false, false, false];
          vm.pilotName = 'Guest Pilot';
          return;
        }
        vm.pilotName = progress.pilotName || 'Guest Pilot';
        vm.bestScore = Math.max(0, progress.bestScore || 0);
        vm.selectedPlayer = Math.max(0, Math.min(vm.players.length - 1, progress.selectedPlayer || 0));
        vm.selectedMap = Math.max(0, Math.min(vm.maps.length - 1, progress.selectedMap || 0));
        vm.settings = angular.extend(angular.copy(defaultSettings), progress.settings || {});
        vm.money = Math.max(0, progress.money || 0);
        vm.purchasedPlayers = progress.purchasedPlayers || [true, false, false, false, false, false, false, false];
        if (vm.purchasedPlayers.length !== vm.players.length) {
          vm.purchasedPlayers = vm.players.map(function (p, idx) { return idx === 0 || !!vm.purchasedPlayers[idx]; });
        }
      }

      function saveProfile() {
        const progress = {
          pilotName: vm.pilotName,
          bestScore: vm.bestScore,
          selectedPlayer: vm.selectedPlayer,
          selectedMap: vm.selectedMap,
          settings: angular.copy(vm.settings),
          money: vm.money,
          purchasedPlayers: vm.purchasedPlayers
        };
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* storage unavailable */ }
      }

      function difficultyMult() {
        return { easy: 0.72, normal: 1, hard: 1.4 }[vm.settings.difficulty] || 1;
      }

      function waveConfig(n) {
        const boss = (n % 10 === 0);
        const mult = difficultyMult();
        return {
          boss: boss,
          enemyCount: boss ? 1 : Math.min(10 + Math.floor(n * 2.0), 90),
          enemyHp: Math.max(1, Math.ceil((boss ? (6 + n * 1.1) : (1 + Math.floor(n / 5))) * mult)),
          enemySpeed: (boss ? 0.6 : (1.2 + n * 0.03)) * mult,
          spawnInterval: Math.max(1100 - n * 12, 180),
          enemyFireChance: Math.min(0.0012 + n * 0.00035, 0.025) * mult,
          bulletSpeed: (boss ? 2.4 : 2.4 + n * 0.02) * (0.85 + mult * 0.15)
        };
      }

      const canvas = document.getElementById('gameCanvas');
      const ctx = canvas.getContext('2d');
      let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

      const inputState = { left: false, right: false, up: false, down: false };
      function setInputDirection(dir, active) {
        if (inputState.hasOwnProperty(dir)) inputState[dir] = active;
      }
      function bindControlEvents() {
        document.addEventListener('keydown', function (e) {
          if (vm.screen !== 'game') return;
          const key = e.key.toLowerCase();
          if (key === 'arrowleft' || key === 'a') { setInputDirection('left', true); e.preventDefault(); }
          if (key === 'arrowright' || key === 'd') { setInputDirection('right', true); e.preventDefault(); }
          if (key === 'arrowup' || key === 'w') { setInputDirection('up', true); e.preventDefault(); }
          if (key === 'arrowdown' || key === 's') { setInputDirection('down', true); e.preventDefault(); }
        });
        document.addEventListener('keyup', function (e) {
          const key = e.key.toLowerCase();
          if (key === 'arrowleft' || key === 'a') setInputDirection('left', false);
          if (key === 'arrowright' || key === 'd') setInputDirection('right', false);
          if (key === 'arrowup' || key === 'w') setInputDirection('up', false);
          if (key === 'arrowdown' || key === 's') setInputDirection('down', false);
        });
        document.addEventListener('pointerdown', function (e) {
          const dir = e.target.dataset && e.target.dataset.dir;
          if (dir) { setInputDirection(dir, true); e.preventDefault(); }
        });
        document.addEventListener('pointerup', function (e) {
          const dir = e.target.dataset && e.target.dataset.dir;
          if (dir) { setInputDirection(dir, false); e.preventDefault(); }
        });
        document.addEventListener('pointercancel', function (e) {
          const dir = e.target.dataset && e.target.dataset.dir;
          if (dir) setInputDirection(dir, false);
        });
      }
      bindControlEvents();

      const imgCache = {};
      function getImg(src) {
        if (!imgCache[src]) { const im = new Image(); im.src = src; imgCache[src] = im; }
        return imgCache[src];
      }
      function drawImgCentered(img, x, y, w, h, alpha) {
        if (!img.complete || !img.naturalWidth) return;
        ctx.save();
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
        ctx.restore();
      }
      function drawImgCover(img, x, y, w, h) {
        if (!img.complete || !img.naturalWidth) return false;
        const ir = img.naturalWidth / img.naturalHeight;
        const tr = w / h;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.naturalHeight; sw = sh * tr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
        else { sw = img.naturalWidth; sh = sw / tr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        return true;
      }
      vm.players.forEach(function (p) { getImg(p.img); });
      vm.maps.forEach(function (m) { getImg(m.img); });
      getImg(ENEMY_IMG); getImg(BOSS_IMG); getImg(BULLET_PLAYER_IMG); getImg(BULLET_ENEMY_IMG);

      function resize() {
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * DPR; canvas.height = H * DPR;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
      window.addEventListener('resize', resize);
      resize();

      let pointerGoalX = null, pointerGoalY = null;
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', function (e) {
        setPointerGoal(e);
      });
      canvas.addEventListener('pointermove', function (e) {
        setPointerGoal(e);
      });
      window.addEventListener('pointermove', function (e) {
        if (e.target.closest && e.target.closest('.touch-controls')) return;
        setPointerGoal(e);
      });
      function setPointerGoal(e) {
        if (vm.screen !== 'game') return;
        if (e.target.closest && e.target.closest('.touch-controls')) return;
        const rect = canvas.getBoundingClientRect();
        pointerGoalX = Math.max(30, Math.min(W - 30, e.clientX - rect.left));
        pointerGoalY = Math.max(30, Math.min(H - 30, e.clientY - rect.top));
      }

      let player, bullets, enemyBullets, enemies, spawnTimer, invuln, muzzleFlash;
      let ambientParticles = [];
      let shakeT = 0, shakeMag = 0;

      function beginWave() {
        vm.levelCfg = waveConfig(vm.wave);
        vm.bossActive = vm.levelCfg.boss;
        vm.bossHpPct = 100;
        vm.spawned = 0;
        vm.enemiesAlive = 0;
        bullets = []; enemyBullets = []; enemies = [];
        spawnTimer = 0; invuln = 90; muzzleFlash = 0;
        const pilot = vm.players[vm.selectedPlayer];
        player = {
          x: W / 2,
          y: H - 90,
          w: 44,
          h: 44,
          speed: pilot.speed,
          fireRate: pilot.fireRate,
          dmg: pilot.dmg,
          shield: pilot.shield || 0,
          lastShot: 0
        };
        seedAmbient(vm.maps[vm.selectedMap], 46);
      }

      function spawnEnemy() {
        const cfg = vm.levelCfg;
        const boss = cfg.boss;
        const x = boss ? W / 2 : 30 + Math.random() * (W - 60);
        const e = {
          x: x, y: -40,
          w: boss ? 120 : 34, h: boss ? 100 : 30,
          hp: cfg.enemyHp, maxHp: cfg.enemyHp,
          speed: cfg.enemySpeed * (0.85 + Math.random() * 0.3),
          boss: boss,
          phase: Math.random() * Math.PI * 2,
          baseX: x,
          dir: Math.random() < 0.5 ? -1 : 1,
          hue: 200 + Math.random() * 120
        };
        enemies.push(e);
        vm.spawned++;
        vm.enemiesAlive = enemies.length;
      }

      function fireBullet() {
        const now = performance.now();
        if (now - player.lastShot < player.fireRate) return;
        player.lastShot = now;
        bullets.push({ x: player.x - 10, y: player.y - 20, vy: -11, dmg: player.dmg });
        bullets.push({ x: player.x + 10, y: player.y - 20, vy: -11, dmg: player.dmg });
        muzzleFlash = 6;
        beep(880, 0.04, 'square', vm.settings.sfxVol * 0.35);
      }

      function beep(freq, dur, type, vol) {
        if (!audioCtx || vol <= 0) return;
        try {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = type || 'sine';
          o.frequency.value = freq;
          g.gain.value = vol;
          g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
          o.connect(g); g.connect(audioCtx.destination);
          o.start(); o.stop(audioCtx.currentTime + dur);
        } catch (e) {}
      }

      function triggerShake(mag) { if (vm.settings.screenShake) { shakeT = 12; shakeMag = mag; } }

      function updateGame(dt) {
        const cfg = vm.levelCfg;
        if (invuln > 0) invuln -= dt;
        if (muzzleFlash > 0) muzzleFlash -= dt;
        if (shakeT > 0) shakeT -= dt;

        const keyboardActive = inputState.left || inputState.right || inputState.up || inputState.down;
        if (keyboardActive) {
          const moveSpeed = player.speed * dt * 0.7;
          if (inputState.left) player.x -= moveSpeed;
          if (inputState.right) player.x += moveSpeed;
          if (inputState.up) player.y -= moveSpeed;
          if (inputState.down) player.y += moveSpeed;
        } else {
          if (pointerGoalX !== null) {
            player.x = pointerGoalX;
          }
          if (pointerGoalY !== null) {
            player.y = pointerGoalY;
          }
        }
        player.x = Math.max(30, Math.min(W - 30, player.x));
        player.y = Math.max(30, Math.min(H - 30, player.y));
        fireBullet();

        if (!cfg.boss || (cfg.boss && vm.spawned < cfg.enemyCount)) {
          spawnTimer -= dt * 16.6667;
          if (spawnTimer <= 0 && vm.spawned < cfg.enemyCount) {
            spawnEnemy();
            spawnTimer = cfg.spawnInterval;
          }
        }

        for (let i = bullets.length - 1; i >= 0; i--) { const b = bullets[i]; b.y += b.vy * dt; if (b.y < -20) bullets.splice(i, 1); }
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const eb = enemyBullets[i]; eb.x += eb.vx * dt; eb.y += eb.vy * dt;
          if (eb.y > H + 20 || eb.x < -20 || eb.x > W + 20) { enemyBullets.splice(i, 1); continue; }
          if (invuln <= 0 && dist(eb.x, eb.y, player.x, player.y) < 22) {
            enemyBullets.splice(i, 1);
            hitPlayer();
          }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
          const en = enemies[i];
          en.phase += 0.05 * dt;
          en.y += en.speed * dt * (en.boss ? 0.25 : 1);
          if (en.boss) {
            en.y = Math.min(en.y, 110);
            en.x = en.baseX + Math.sin(en.phase) * (W * 0.28);
          } else {
            en.x += Math.sin(en.phase) * 1.4 * dt * en.dir;
          }
          if (Math.random() < cfg.enemyFireChance * dt) {
            const ang = Math.atan2(player.y - en.y, player.x - en.x);
            enemyBullets.push({ x: en.x, y: en.y + en.h / 2, vx: Math.cos(ang) * cfg.bulletSpeed, vy: Math.sin(ang) * cfg.bulletSpeed });
          }
          if (!en.boss && en.y > H + 60) { enemies.splice(i, 1); continue; }
          if (invuln <= 0 && rectHit(en, player)) {
            enemies.splice(i, 1);
            hitPlayer();
            continue;
          }
          for (let j = bullets.length - 1; j >= 0; j--) {
            const bl = bullets[j];
            if (bl.x > en.x - en.w / 2 && bl.x < en.x + en.w / 2 && bl.y > en.y - en.h / 2 && bl.y < en.y + en.h / 2) {
              en.hp -= bl.dmg;
              bullets.splice(j, 1);
              spawnHit(bl.x, bl.y, en.boss ? '#ff4655' : '#ffd23f');
              if (en.hp <= 0) {
                spawnExplosion(en.x, en.y, en.boss ? 70 : 26);
                beep(en.boss ? 140 : 220, en.boss ? 0.4 : 0.12, 'sawtooth', vm.settings.sfxVol * 0.6);
                triggerShake(en.boss ? 10 : 3);
                enemies.splice(i, 1);
                addScore(en.boss ? 500 : (10 + vm.wave));
              }
              break;
            }
          }
        }
        vm.enemiesAlive = enemies.length;
        if (cfg.boss && enemies[0]) {
          vm.bossHpPct = Math.max(0, (enemies[0].hp / enemies[0].maxHp) * 100);
        }

        updateFx(dt);
        updateAmbient(dt);

        const doneSpawning = vm.spawned >= cfg.enemyCount;
        if (doneSpawning && enemies.length === 0 && vm.lives > 0) {
          onWaveClear();
        }
      }

      function hitPlayer() {
        if (player.shield > 0) {
          player.shield -= 1;
          invuln = 140;
          triggerShake(6);
          beep(240, 0.18, 'triangle', vm.settings.sfxVol * 0.6);
          $scope.$applyAsync();
          return;
        }
        vm.lives--;
        invuln = 100;
        triggerShake(8);
        beep(120, 0.25, 'sawtooth', vm.settings.sfxVol * 0.7);
        $scope.$applyAsync();
        if (vm.lives <= 0) {
          $timeout(function () { endRun(); }, 250);
        }
      }

      function addScore(v) { vm.score += v; vm.money += Math.max(1, Math.floor(v * 0.1)); $scope.$applyAsync(); }

      function endRun() {
        vm.newBest = vm.score > vm.bestScore;
        if (vm.newBest) vm.bestScore = vm.score;
        saveProfile();
        vm.screen = 'gameOver';
      }

      function onWaveClear() {
        const clearedBoss = vm.levelCfg.boss;
        vm.money += 28;
        vm.wave++;
        vm.waveBanner = 'WAVE ' + vm.wave + ' INCOMING' + (clearedBoss ? ' · BOSS DOWN' : '');
        vm.showWaveBanner = true;
        $timeout(function () { vm.showWaveBanner = false; }, 1400);
        beginWave();
        $scope.$applyAsync();
      }

      function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }
      function rectHit(en, pl) {
        return Math.abs(en.x - pl.x) < (en.w + pl.w) / 2.6 && Math.abs(en.y - pl.y) < (en.h + pl.h) / 2.6;
      }

      const fx = [];
      function spawnHit(x, y, color) {
        for (let i = 0; i < 4; i++) fx.push({ x: x, y: y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 14, max: 14, color: color, r: 2 });
      }
      function spawnExplosion(x, y, size) {
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2, sp = Math.random() * (size / 12);
          fx.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 26, max: 26, color: i % 2 ? '#ffd23f' : '#ff4655', r: 3 + Math.random() * 4 });
        }
      }
      function updateFx(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
          const p = fx[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
          if (p.life <= 0) fx.splice(i, 1);
        }
      }

      function seedAmbient(map, count) {
        ambientParticles = [];
        for (let i = 0; i < count; i++) ambientParticles.push(makeAmbient(map));
      }
      function makeAmbient(map) {
        const type = map.particle;
        if (type === 'petals') return { x: Math.random() * W, y: Math.random() * H, vx: -0.4 - Math.random() * 0.6, vy: 0.6 + Math.random() * 0.8, r: 3 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.05, type: type };
        if (type === 'streaks') return { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 3 + Math.random() * 5, len: 20 + Math.random() * 60, type: type };
        if (type === 'stars') return { x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3, tw: Math.random() * 6.28, type: type };
        return { x: Math.random() * W, y: H + Math.random() * 100, vx: (Math.random() - 0.5) * 0.5, vy: -0.5 - Math.random() * 1.2, r: 1.5 + Math.random() * 3, life: 200 + Math.random() * 200, type: type };
      }
      function updateAmbient(dt) {
        const map = vm.maps[vm.selectedMap];
        for (let i = 0; i < ambientParticles.length; i++) {
          const p = ambientParticles[i];
          if (p.type === 'petals') { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y > H + 10) angular.extend(p, makeAmbient(map), { y: -10 }); }
          else if (p.type === 'streaks') { p.y += p.vy * dt; if (p.y > H) p.y = -p.len; }
          else if (p.type === 'stars') { p.tw += 0.03 * dt; }
          else { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life < 0 || p.y < -20) angular.extend(p, makeAmbient(map)); }
        }
      }

      function drawSky(map) {
        const drew = drawImgCover(getImg(map.img), 0, 0, W, H);
        if (!drew) {
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, map.sky[0]); g.addColorStop(1, map.sky[1]);
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
      }

      function drawAmbient(map) {
        ctx.save();
        for (let i = 0; i < ambientParticles.length; i++) {
          const p = ambientParticles[i];
          if (p.type === 'petals') {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = 'rgba(255,182,213,0.85)';
            ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, 6.28); ctx.fill();
            ctx.restore();
          } else if (p.type === 'streaks') {
            ctx.strokeStyle = 'rgba(0,229,255,0.25)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - p.len); ctx.stroke();
          } else if (p.type === 'stars') {
            const a = 0.4 + Math.sin(p.tw) * 0.4 + 0.2;
            ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
          } else {
            const lf = Math.max(0, p.life / 300);
            ctx.fillStyle = 'rgba(255,140,60,' + (0.3 + lf * 0.5) + ')';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
          }
        }
        ctx.restore();
      }

      function drawShip(img, x, y, w, h, flame) {
        if (flame > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, flame / 6) * 0.7;
          const fg = ctx.createRadialGradient(x, y + h / 2, 2, x, y + h / 2, 18);
          fg.addColorStop(0, 'rgba(255,230,150,0.9)'); fg.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(x, y + h / 2, 18, 0, 6.28); ctx.fill();
          ctx.restore();
        }
        drawImgCentered(img, x, y, w, h);
      }

      function drawEnemy(en) {
        const img = en.boss ? getImg(BOSS_IMG) : getImg(ENEMY_IMG);
        drawImgCentered(img, en.x, en.y, en.w * 1.35, en.h * 1.35);
        if (en.hp < en.maxHp && !en.boss) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(en.x - 16, en.y - en.h / 2 - 10, 32, 4);
          ctx.fillStyle = '#ff4655'; ctx.fillRect(en.x - 16, en.y - en.h / 2 - 10, 32 * (en.hp / en.maxHp), 4);
        }
      }

      function renderGame() {
        const map = vm.maps[vm.selectedMap];
        ctx.save();
        if (shakeT > 0) ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
        drawSky(map);
        drawAmbient(map);

        const pilot = vm.players[vm.selectedPlayer];
        const bImg = getImg(BULLET_PLAYER_IMG), ebImg = getImg(BULLET_ENEMY_IMG);
        bullets.forEach(function (b) { drawImgCentered(bImg, b.x, b.y, 14, 26); });
        enemyBullets.forEach(function (b) { drawImgCentered(ebImg, b.x, b.y, 16, 16); });

        enemies.forEach(drawEnemy);

        if (invuln <= 0 || Math.floor(invuln / 6) % 2 === 0) {
          drawShip(getImg(pilot.img), player.x, player.y, player.w * 1.7, player.h * 1.7, muzzleFlash);
        }

        fx.forEach(function (p) {
          ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life / p.max);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
        });

        ctx.restore();
      }

      function renderAmbient() {
        const map = vm.maps[vm.selectedMap];
        drawSky(map);
        drawAmbient(map);
      }

      let audioCtx = null;
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      let musicGain;
      function setMusicGain(v) { if (musicGain) musicGain.gain.value = v * 0.12; }
      function startMusic() {
        if (!audioCtx) return;
        musicGain = audioCtx.createGain();
        musicGain.gain.value = vm.settings.musicVol * 0.12;
        musicGain.connect(audioCtx.destination);
        const notes = [220, 246.94, 277.18, 329.63];
        let i = 0;
        setInterval(function () {
          if (!audioCtx || audioCtx.state === 'suspended') return;
          const o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = 'triangle'; o.frequency.value = notes[i % notes.length];
          g.gain.value = 0.0001;
          g.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
          o.connect(g); g.connect(musicGain);
          o.start(); o.stop(audioCtx.currentTime + 0.9);
          i++;
        }, 950);
      }
      document.addEventListener('click', resumeAudioOnce, { once: true });
      document.addEventListener('keydown', resumeAudioOnce, { once: true });
      function resumeAudioOnce() { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); startMusic(); }

      seedAmbient(vm.maps[vm.selectedMap], 60);
      let lastTime = performance.now();
      function frame(ts) {
        requestAnimationFrame(frame);
        const dt = Math.min((ts - lastTime) / 16.6667, 3);
        lastTime = ts;
        if (vm.screen === 'game') { updateGame(dt); renderGame(); }
        else if (vm.screen === 'pause') { renderGame(); }
        else { updateAmbient(dt); renderAmbient(); }
      }
      requestAnimationFrame(frame);

    }]);
})();