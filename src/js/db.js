const PROFILE_KEY = 'voidStrikerGuestProfile.v1';

const DEFAULT_PROFILE = {
  id: 'guest',
  username: 'Guest Pilot',
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

function readProfile() {
  const saved = localStorage.getItem(PROFILE_KEY);
  if (!saved) return cloneDefaultProfile();

  try {
    const stored = JSON.parse(saved);
    const profile = Object.assign(cloneDefaultProfile(), stored);
    profile.progress = Object.assign(cloneDefaultProfile().progress, stored.progress || {});
    profile.username = normalizeName(profile.username);
    return profile;
  } catch (error) {
    localStorage.removeItem(PROFILE_KEY);
    return cloneDefaultProfile();
  }
}

function normalizeName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  return clean || DEFAULT_PROFILE.username;
}

function writeProfile(profile) {
  profile.username = normalizeName(profile.username);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

async function apiJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

(function () {
  window.GameDb = {
    defaults: { users: [DEFAULT_PROFILE] },

    async getCurrentUser() {
      return readProfile();
    },

    async saveName(name) {
      const profile = readProfile();
      profile.username = normalizeName(name);
      return writeProfile(profile);
    },

    async saveProgress(userId, progress) {
      const profile = readProfile();
      profile.progress = Object.assign({}, profile.progress, progress);
      return writeProfile(profile);
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
        bestScore: profile.progress.bestScore || 0
      }];
    }
  };
})();
