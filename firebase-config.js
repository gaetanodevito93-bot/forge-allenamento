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
      console.warn('signInWithPopup fallito/bloccato, passo a signInWithRedirect:', err);
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        /popup/i.test(err.code || '')
      ) {
        await auth.signInWithRedirect(provider);
        return null;
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
      if (err.code === 'permission-denied' && typeof toast === 'function') {
        toast('Errore salva cloud: Attiva le Regole su Firestore Console');
      }
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
        // Ignora gli snapshot locali temporanei mentre un salvataggio è in corso
        if (doc.metadata && doc.metadata.hasPendingWrites) return;
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

  // Recupera l'ultimo stato salvato nel cloud
  async function fetchCloudState() {
    if (!db || !currentUser) return null;
    try {
      const doc = await db.collection('users').doc(currentUser.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data && data.state) return data.state;
      }
      return null;
    } catch (err) {
      console.error('Errore recupero scheda dal Cloud:', err);
      return null;
    }
  }

  // Salva una scheda specifica nel Cloud con nome e id (rispettando il limite di 10 schede per utenti free)
  async function saveSchedaToCloudList(schedaName, stateObj, isProOrPurchased) {
    if (!db || !currentUser) return { success: false, reason: 'unauthenticated' };
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      const doc = await userRef.get();
      const userData = doc.exists ? doc.data() : {};
      const currentSchede = (userData && userData.schede && typeof userData.schede === 'object') ? Object.values(userData.schede) : [];
      const isCoachingOrPro = isProOrPurchased || userData.isCoaching || userData.isPro;

      const name = schedaName || (stateObj && stateObj.programName) || 'La mia Scheda';
      const safeId = 'scheda_' + String(name).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const alreadyExists = currentSchede.some(s => s.id === safeId);

      // Limite di 10 schede nel Cloud per utenti free (se non è un aggiornamento di una esistente)
      if (!alreadyExists && !isCoachingOrPro && currentSchede.length >= 10) {
        return { success: false, reason: 'quota_exceeded', count: currentSchede.length };
      }

      const entry = {
        id: safeId,
        name: name,
        updatedAt: Date.now(),
        daysCount: (stateObj && stateObj.days || []).length,
        isPro: !!isProOrPurchased,
        state: stateObj
      };

      await userRef.set({
        activeSchedaId: safeId,
        state: stateObj,
        [`schede.${safeId}`]: entry
      }, { merge: true });

      return { success: true, count: currentSchede.length + (alreadyExists ? 0 : 1), isCoachingOrPro };
    } catch (err) {
      console.error('Errore salvataggio scheda Cloud:', err);
      return { success: false, reason: 'error' };
    }
  }

  // Ottiene la lista di tutte le schede salvate nel Cloud dall'utente
  async function fetchCloudSchedeList() {
    if (!db || !currentUser) return [];
    try {
      const doc = await db.collection('users').doc(currentUser.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data && data.schede && typeof data.schede === 'object') {
          return Object.values(data.schede).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } else if (data && data.state) {
          return [{
            id: 'scheda_default',
            name: data.state.programName || 'La mia Scheda',
            updatedAt: Date.now(),
            daysCount: (data.state.days || []).length,
            state: data.state
          }];
        }
      }
      return [];
    } catch (err) {
      console.error('Errore lista schede Cloud:', err);
      return [];
    }
  }

  // Elimina una scheda specifica dal Cloud
  async function deleteCloudScheda(schedaId) {
    if (!db || !currentUser || !schedaId) return false;
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      await userRef.update({
        [`schede.${schedaId}`]: firebase.firestore.FieldValue.delete()
      });
      return true;
    } catch (err) {
      console.error('Errore eliminazione scheda Cloud:', err);
      return false;
    }
  }

  // Sincronizza ed archivia la prova di consenso legale su Cloud Firestore
  async function syncLegalConsentToCloud(user) {
    const targetUser = user || currentUser;
    if (!db || !targetUser) return false;
    try {
      let ack = false;
      let ts = new Date().toISOString();
      try {
        ack = localStorage.getItem('forge_legal_ack') === '1';
        ts = localStorage.getItem('forge_legal_ack_ts') || ts;
      } catch (_) {}

      if (ack) {
        const userRef = db.collection('users').doc(targetUser.uid);
        await userRef.set({
          legalConsent: {
            accepted: true,
            timestamp: ts,
            version: 'v1.0 (Disclaimer Medico + GDPR 2016/679 + Termini Coaching)',
            userEmail: targetUser.email || '',
            userName: targetUser.displayName || ''
          }
        }, { merge: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Errore archiviazione consenso legale Cloud:', err);
      return false;
    }
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
    saveSchedaToCloudList,
    fetchCloudSchedeList,
    deleteCloudScheda,
    syncLegalConsentToCloud,
    fetchCloudState,
    listenToCloudState,
    getUser: () => currentUser,
    setUser: (u) => { currentUser = u; },
    getAuth: () => auth,
    getDb: () => db
  };

})(window);
