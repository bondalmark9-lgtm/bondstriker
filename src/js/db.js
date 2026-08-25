const PROFILE_KEY = 'voidStrikerGuestProfile.v1';
const SESSION_KEY = 'voidStrikerSession.v1';
const DEVICE_KEY = 'voidStrikerDeviceId.v1';

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

async function apiJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function jsonOptions(method, body) {
  return {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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

async function syncDevice(profile) {
  const local = writeProfile(profile || readProfile());
  const data = await apiJson('/api/device-progress', jsonOptions('POST', {
    deviceId: getDeviceId(),
    username: local.username,
    progress: local.progress
  }));
  return Object.assign({}, local, data.user || {}, {
    id: deviceUserId(),
    accountType: 'device',
    progress: local.progress
  });
}

async function saveAccountProgress(userId, progress) {
  const data = await apiJson('/api/users/' + encodeURIComponent(userId) + '/progress', jsonOptions('PATCH', {
    progress: progress
  }));
  const user = data.user;
  if (user) user.accountType = 'account';
  return user;
}

(function () {
  window.GameDb = {
    defaults: { users: [DEFAULT_PROFILE] },

    async getCurrentUser() {
      const session = readSession();
      if (session && session.id) {
        try {
          const data = await apiJson('/api/users/' + encodeURIComponent(session.id));
          if (data.user) {
            data.user.accountType = 'account';
            return data.user;
          }
        } catch (error) {
          clearSession();
        }
      }

      return null;
    },

    async saveName(name) {
      const cleanName = normalizeName(name);
      const session = readSession();

      if (session && session.id) {
        const data = await apiJson('/api/users/' + encodeURIComponent(session.id) + '/profile', jsonOptions('PATCH', {
          username: cleanName
        }));
        if (data.user) {
          data.user.accountType = 'account';
          return data.user;
        }
      }

      const profile = readProfile();
      profile.username = cleanName;
      writeProfile(profile);
      try {
        return await syncDevice(profile);
      } catch (error) {
        return profile;
      }
    },

    async saveProgress(userId, progress) {
      const profile = readProfile();
      profile.progress = Object.assign({}, profile.progress, progress);
      writeProfile(profile);

      const session = readSession();
      if (session && session.id && userId === session.id) {
        return saveAccountProgress(session.id, progress);
      }

      try {
        return await syncDevice(profile);
      } catch (error) {
        return profile;
      }
    },

    async signIn(email, password) {
      const deviceProfile = readProfile();
      const data = await apiJson('/api/auth/signin', jsonOptions('POST', {
        email: email,
        password: password
      }));
      const user = data.user;
      if (!user) throw new Error('Unable to sign in.');

      writeSession(user);
      user.accountType = 'account';
      const mergedProgress = mergeProgress(user.progress, deviceProfile.progress);
      return saveAccountProgress(user.id, mergedProgress);
    },

    async signUp(username, email, password) {
      const deviceProfile = readProfile();
      const data = await apiJson('/api/auth/signup', jsonOptions('POST', {
        username: username,
        email: email,
        password: password,
        confirmPassword: password
      }));
      const user = data.user;
      if (!user) throw new Error('Unable to create account.');

      writeSession(user);
      user.accountType = 'account';
      const mergedProgress = mergeProgress(user.progress, deviceProfile.progress);
      return saveAccountProgress(user.id, mergedProgress);
    },

    async signOut() {
      clearSession();
      return null;
    },

    async getLeaderboard() {
      try {
        const data = await apiJson('/api/leaderboard');
        if (Array.isArray(data.leaderboard)) return data.leaderboard;
      } catch (error) {
        // Static builds and offline play still get a local leaderboard entry.
      }

      const profile = readProfile();
      return [{
        userId: profile.id,
        username: profile.username,
        bestScore: profile.progress.bestScore || 0,
        source: profile.accountType || 'device'
      }];
    }
  };
})();
