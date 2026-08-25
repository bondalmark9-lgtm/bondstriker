/* =====================================================================
   VOID STRIKER — cloud backend (Firebase Auth + Firestore)
   =====================================================================
   This replaces the old localStorage-only "accounts" system so that
   pilot accounts and best scores are shared across every browser and
   device — not just the one they were created on.

   ------------------------------------------------------------------
   ONE-TIME SETUP (you must do this before it will work):
   ------------------------------------------------------------------
   1. Go to https://console.firebase.google.com -> "Add project" (free).
   2. In the project: Build -> Authentication -> Get started ->
      enable the "Email/Password" sign-in provider.
   3. In the project: Build -> Firestore Database -> Create database
      (start in "production mode" is fine -- rules below lock it down).
   4. Project settings (gear icon) -> General -> "Your apps" ->
      Add app -> Web (</>) -> register it -> copy the firebaseConfig
      object it gives you -> paste the values into FIREBASE_CONFIG
      below.
   5. Firestore Database -> Rules -> paste this, then Publish:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /users/{userId} {
              allow read: if request.auth != null;
              allow write: if request.auth != null && request.auth.uid == userId;
            }
          }
        }

      This lets any signed-in pilot READ every profile (so the
      leaderboard can show everyone), but only WRITE their own.
   ===================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ---- 4. Paste your project's config here ---- */
const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

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

function toPublicUser(uid, data) {
  return {
    id: uid,
    username: data.username,
    email: data.email,
    accountType: 'account',
    progress: Object.assign(cloneDefaultProgress(), data.progress || {})
  };
}

/* Wait for Firebase to tell us whether anyone is already signed in
   (it restores the session automatically), resolving once. */
function waitForAuthReady() {
  return new Promise(function (resolve) {
    const unsubscribe = onAuthStateChanged(auth, function (user) {
      unsubscribe();
      resolve(user);
    });
  });
}

async function fetchUserDoc(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

(function () {
  window.GameDb = {
    async getCurrentUser() {
      const user = await waitForAuthReady();
      if (!user) return null;

      let data = await fetchUserDoc(user.uid);
      if (!data) {
        // Auth account exists but the Firestore profile is missing
        // (e.g. it was never created) -- recreate a minimal one.
        data = {
          username: normalizeName(user.email),
          email: user.email,
          progress: cloneDefaultProgress()
        };
        await setDoc(doc(db, 'users', user.uid), data);
      }
      return toPublicUser(user.uid, data);
    },

    async saveName(name) {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in.');
      const cleanName = normalizeName(name);
      await updateDoc(doc(db, 'users', user.uid), { username: cleanName });
      const data = await fetchUserDoc(user.uid);
      return toPublicUser(user.uid, data);
    },

    async saveProgress(userId, progress) {
      const user = auth.currentUser;
      if (!user || user.uid !== userId) throw new Error('You must be signed in.');
      const current = await fetchUserDoc(user.uid);
      const mergedProgress = Object.assign(cloneDefaultProgress(), (current && current.progress) || {}, progress);
      await updateDoc(doc(db, 'users', user.uid), { progress: mergedProgress });
      return toPublicUser(user.uid, Object.assign({}, current, { progress: mergedProgress }));
    },

    async signIn(email, password) {
      const cleanEmail = normalizeEmail(email);
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (error) {
        if (error.code === 'auth/user-not-found') throw new Error('No pilot account found for that email.');
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') throw new Error('Incorrect password.');
        throw new Error(error.message || 'Could not sign in.');
      }
      let data = await fetchUserDoc(cred.user.uid);
      if (!data) {
        data = { username: normalizeName(cleanEmail), email: cleanEmail, progress: cloneDefaultProgress() };
        await setDoc(doc(db, 'users', cred.user.uid), data);
      }
      return toPublicUser(cred.user.uid, data);
    },

    async signUp(username, email, password) {
      const cleanEmail = normalizeEmail(email);
      const cleanName = normalizeName(username);
      if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Enter a valid email.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') throw new Error('An account with that email already exists.');
        throw new Error(error.message || 'Could not create account.');
      }

      const data = { username: cleanName, email: cleanEmail, progress: cloneDefaultProgress() };
      await setDoc(doc(db, 'users', cred.user.uid), data);
      return toPublicUser(cred.user.uid, data);
    },

    async signOut() {
      await firebaseSignOut(auth);
      return null;
    },

    async getLeaderboard() {
      const q = query(collection(db, 'users'), orderBy('progress.bestScore', 'desc'), limit(50));
      const snap = await getDocs(q);
      const rows = [];
      snap.forEach(function (docSnap) {
        const data = docSnap.data();
        rows.push({
          userId: docSnap.id,
          username: data.username,
          bestScore: (data.progress && data.progress.bestScore) || 0,
          source: 'account'
        });
      });
      return rows;
    }
  };
})();