/* ══════════════════════════════════════════════════════════════════
   FORGE — FIREBASE AUTH & CLOUD FIRESTORE INTEGRATION MODULE
   ══════════════════════════════════════════════════════════════════ */

(function (window) {
  'use strict';

  const CONFIG_KEY = 'forge_firebase_config';

  // Configurazione Firebase del progetto FORGE
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtyHflSn6mduPaFwy9uLpm4nXDeavO2yQ",
    authDomain: "forge-d5fa5.firebaseapp.com",
    projectId: "forge-d5fa5",
    storageBucket: "forge-d5fa5.firebasestorage.app",
    messagingSenderId: "521233699353",
    appId: "1:521233699353:web:cf9233bedc28d7eb909088",
    measurementId: "G-WTB1MD5227"
  };

  function getStoredConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return DEFAULT_FIREBASE_CONFIG;
  }

  function saveStoredConfig(cfg) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch (_) {}
  }

  let app = null;
  let auth = null;
  let db = null;
  let currentUser = null;
  let unsubscribeSnapshot = null;

  function isConfigured(cfg) {
    const c = cfg || getStoredConfig();
    return !!(c && c.apiKey && c.projectId && String(c.apiKey).trim() !== "");
  }

  function initFirebase(cfg) {
    const config = cfg || getStoredConfig();
    if (!isConfigured(config)) return false;

    try {
      if (typeof firebase === 'undefined') {
        console.warn('SDK Firebase non ancora caricato.');
        return false;
      }
      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.app();
      }
      auth = firebase.auth();
      db = firebase.firestore();

      // Abilita la persistenza offline di Firestore (offline-first PWA)
      db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Persistenza Firestore disabilitata: schede multiple aperte.');
        } else if (err.code === 'unimplemented') {
          console.warn('Persistenza Firestore non supportata dal browser.');
        }
      });

      return true;
    } catch (err) {
      console.error('Errore inizializzazione Firebase:', err);
      return false;
    }
  }

  // Google OAuth Login
  async function signInWithGoogle() {
    if (!auth) {
      const configured = initFirebase();
      if (!configured) {
        throw new Error('Configura prima le credenziali Firebase nel menu dell\'app.');
      }
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      const result = await auth.signInWithPopup(provider);
      return result.user;
    } catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        return auth.signInWithRedirect(provider);
      }
      throw err;
    }
  }

  // Logout
  async function logOut() {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (auth) {
      await auth.signOut();
    }
    currentUser = null;
  }

  // Salva stato completo su Cloud Firestore
  async function saveStateToCloud(state) {
    if (!db || !currentUser) return false;
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      await userRef.set({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        state: state
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Errore salvataggio Cloud:', err);
      return false;
    }
  }

  // Ascolta i cambiamenti nel cloud in tempo reale
  function listenToCloudState(onUpdate) {
    if (!db || !currentUser) return null;
    if (unsubscribeSnapshot) unsubscribeSnapshot();

    const userRef = db.collection('users').doc(currentUser.uid);
    unsubscribeSnapshot = userRef.onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data && data.state) {
          onUpdate(data.state);
        }
      }
    }, (err) => {
      console.error('Errore ascolto Cloud:', err);
    });

    return unsubscribeSnapshot;
  }

  // Oggetto globale FORGE_CLOUD
  window.FORGE_CLOUD = {
    getStoredConfig,
    saveStoredConfig,
    isConfigured,
    initFirebase,
    signInWithGoogle,
    logOut,
    saveStateToCloud,
    listenToCloudState,
    getUser: () => currentUser,
    setUser: (u) => { currentUser = u; },
    getAuth: () => auth,
    getDb: () => db
  };

})(window);
