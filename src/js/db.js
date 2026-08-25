const PROFILE_KEY = 'voidStrikerGuestProfile.v1';
const SESSION_KEY = 'voidStrikerSession.v1';
const DEVICE_KEY = 'voidStrikerDeviceId.v1';
const ACCOUNTS_KEY = 'voidStrikerAccounts.v1';

const DEFAULT_PROFILE = {
  id: '',
  username: 'Guest Pilot',
  accountType: 'device',
  progress: {
    bestScore: 0,
    selectedPlayer: 0,
    selectedMap: 0,
    settings: {},
    money: 320,
    purchasedPlayers: [true, false, false, false, false, false, false]
  }
};

function cloneDefaultProfile() {
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
    const rand = Math.random() * 16 | 0;
    const value = char === 'x' ? rand : (rand & 0x3 | 0x8);
    return value.toString(16);
  });
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = createId();
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

function deviceUserId() {
  return 'device:' + getDeviceId();
}

function normalizeName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  return clean || DEFAULT_PROFILE.username;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeProfile(profile) {
  const merged = Object.assign(cloneDefaultProfile(), profile || {});
  merged.progress = Object.assign(cloneDefaultProfile().progress, (profile && profile.progress) || {});
  merged.id = merged.id || deviceUserId();
  merged.accountType = merged.accountType || (String(merged.id).startsWith('device:') ? 'device' : 'account');
  merged.username = normalizeName(merged.username);
  return merged;
}

function readProfile() {
  const saved = localStorage.getItem(PROFILE_KEY);
  if (!saved) return normalizeProfile();

  try {
    return normalizeProfile(JSON.parse(saved));
  } catch (error) {
    localStorage.removeItem(PROFILE_KEY);
    return normalizeProfile();
  }
}

function writeProfile(profile) {
  const normalized = normalizeProfile(profile);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  return normalized;
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function writeSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ================= LOCAL "ACCOUNTS" STORE ================= */
/* No backend server exists for this game, so accounts are kept
   in this browser's localStorage. Good enough for a solo/offline
   game; NOT real server-side auth (don't reuse real passwords). */

function readAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function writeAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function hashPassword(password) {
  const enc = new TextEncoder().encode('void-striker::' + password);
  if (window.crypto && window.crypto.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  // Fallback if SubtleCrypto isn't available (e.g. non-HTTPS context).
  let hash = 0;
  for (let i = 0; i < password.length; i++) hash = ((hash << 5) - hash + password.charCodeAt(i)) | 0;
  return 'fallback:' + hash;
}

function toPublicUser(account) {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    accountType: 'account',
    progress: account.progress
  };
}

function mergeProgress(accountProgress, deviceProgress) {
  const account = accountProgress || {};
  const device = deviceProgress || {};
  return Object.assign({}, account, {
    bestScore: Math.max(Number(account.bestScore || 0), Number(device.bestScore || 0)),
    money: Math.max(Number(account.money || 0), Number(device.money || 0)),
    unlockedLevel: Math.max(Number(account.unlockedLevel || 1), Number(device.unlockedLevel || 1)),
    purchasedPlayers: (account.purchasedPlayers || device.purchasedPlayers || []).map(function (owned, index) {
      return !!owned || !!(device.purchasedPlayers && device.purchasedPlayers[index]);
    })
  });
}

(function () {
  window.GameDb = {
    defaults: { users: [DEFAULT_PROFILE] },

    async getCurrentUser() {
      const session = readSession();
      if (session && session.id) {
        const accounts = readAccounts();
        const account = accounts[session.id];
        if (account) return toPublicUser(account);
        clearSession();
      }
      return readProfile();
    },

    async saveName(name) {
      const cleanName = normalizeName(name);
      const session = readSession();

      if (session && session.id) {
        const accounts = readAccounts();
        const account = accounts[session.id];
        if (account) {
          account.username = cleanName;
          writeAccounts(accounts);
          return toPublicUser(account);
        }
      }

      const profile = readProfile();
      profile.username = cleanName;
      return writeProfile(profile);
    },

    async saveProgress(userId, progress) {
      const session = readSession();

      if (session && session.id && userId === session.id) {
        const accounts = readAccounts();
        const account = accounts[session.id];
        if (account) {
          account.progress = Object.assign({}, account.progress, progress);
          writeAccounts(accounts);
          return toPublicUser(account);
        }
      }

      const profile = readProfile();
      profile.progress = Object.assign({}, profile.progress, progress);
      return writeProfile(profile);
    },

    async signIn(email, password) {
      const cleanEmail = normalizeEmail(email);
      const accounts = readAccounts();
      const id = 'account:' + cleanEmail;
      const account = accounts[id];
      if (!account) throw new Error('No pilot account found for that email.');

      const hash = await hashPassword(password);
      if (hash !== account.passwordHash) throw new Error('Incorrect password.');

      const deviceProfile = readProfile();
      account.progress = mergeProgress(account.progress, deviceProfile.progress);
      writeAccounts(accounts);
      writeSession({ id: account.id });
      return toPublicUser(account);
    },

    async signUp(username, email, password) {
      const cleanEmail = normalizeEmail(email);
      const cleanName = normalizeName(username);
      if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Enter a valid email.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

      const accounts = readAccounts();
      const id = 'account:' + cleanEmail;
      if (accounts[id]) throw new Error('An account with that email already exists.');

      const deviceProfile = readProfile();
      const passwordHash = await hashPassword(password);
      const account = {
        id: id,
        username: cleanName,
        email: cleanEmail,
        passwordHash: passwordHash,
        progress: Object.assign({}, deviceProfile.progress)
      };
      accounts[id] = account;
      writeAccounts(accounts);
      writeSession({ id: account.id });
      return toPublicUser(account);
    },

    async signOut() {
      clearSession();
      return readProfile();
    },

    async getLeaderboard() {
      const accounts = readAccounts();
      const rows = Object.keys(accounts).map(function (id) {
        const account = accounts[id];
        return {
          userId: account.id,
          username: account.username,
          bestScore: (account.progress && account.progress.bestScore) || 0,
          source: 'account'
        };
      });

      const profile = readProfile();
      if (profile && profile.progress) {
        rows.push({
          userId: profile.id,
          username: profile.username,
          bestScore: profile.progress.bestScore || 0,
          source: profile.accountType || 'device'
        });
      }

      return rows.sort(function (a, b) { return b.bestScore - a.bestScore; });
    }
  };
})();