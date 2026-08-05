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
      try {
        await userRef.update({
          [`schede.${schedaId}`]: firebase.firestore.FieldValue.delete()
        });
      } catch (_) {
        await userRef.set({
          schede: {
            [schedaId]: firebase.firestore.FieldValue.delete()
          }
        }, { merge: true });
      }
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

  // Ottiene il profilo ed il ruolo utente (admin / coach / client)
  async function getUserProfile(uid) {
    const targetUid = uid || (currentUser ? currentUser.uid : null);
    if (!db || !targetUid) return null;
    try {
      const doc = await db.collection('users').doc(targetUid).get();
      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (err) {
      console.error('Errore recupero profilo utente:', err);
      return null;
    }
  }

  // Imposta il ruolo di un utente (es. admin o coach)
  async function setUserRole(targetUid, role, extraData) {
    if (!db || !targetUid) return false;
    try {
      await db.collection('users').doc(targetUid).set({
        role: role,
        ...(extraData || {})
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Errore impostazione ruolo utente:', err);
      return false;
    }
  }

  // Registra un nuovo profilo Coach sia su Firestore Cloud che in LocalStorage
  async function createCoachAccount(email, displayName, notes) {
    if (!email) return { success: false, reason: 'Email obbligatoria' };
    const cleanEmail = String(email).toLowerCase().trim();
    const safeId = 'coach_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
    const coachData = {
      id: safeId,
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0],
      notes: notes || '',
      role: 'coach',
      isCoach: true,
      createdBy: currentUser ? (currentUser.email || currentUser.uid) : 'admin',
      createdAt: Date.now()
    };

    // 1. Salva in LocalStorage (fallback offline istantaneo)
    try {
      const stored = JSON.parse(localStorage.getItem('forge_coaches_registry') || '[]');
      const filtered = stored.filter(c => c.email !== cleanEmail);
      filtered.push(coachData);
      localStorage.setItem('forge_coaches_registry', JSON.stringify(filtered));
    } catch (_) {}

    // 2. Salva nel Cloud Firestore se connesso
    if (db) {
      try {
        await db.collection('coaches').doc(safeId).set(coachData, { merge: true });
        const snapshot = await db.collection('users').where('email', '==', cleanEmail).get();
        snapshot.forEach(async (doc) => {
          await doc.ref.set({ role: 'coach', isCoach: true }, { merge: true });
        });
      } catch (err) {
        console.warn('Avviso salvataggio Cloud coach:', err);
      }
    }

    return { success: true, coach: coachData };
  }

  // Recupera l'elenco di tutti i Coach registrati
  async function fetchCoaches() {
    let list = [];
    try {
      const stored = JSON.parse(localStorage.getItem('forge_coaches_registry') || '[]');
      if (Array.isArray(stored)) list = stored;
    } catch (_) {}

    if (db) {
      try {
        const snap = await db.collection('coaches').get();
        snap.forEach(doc => {
          const data = doc.data();
          if (!list.some(c => c.email === data.email)) {
            list.push(data);
          }
        });
      } catch (err) {
        console.warn('Errore lettura coaches da Cloud:', err);
      }
    }
    return list;
  }

  // Hash / Obfuscated Admin Tokens per sicurezza (non leggibili in chiaro nella pagina)
  const _A_TOKENS = [
    'Z2FldGFuby5kZXZpdG85M0BnbWFpbC5jb20=', // gaetano.devito93@gmail.com
    'Z2FldGFuby5jb2FjaEBnbWFpbC5jb20=',    // gaetano.coach@gmail.com
    'Z2FldGFAZ21haWwuY29t'                 // gaeta@gmail.com
  ];

  function _isEncryptedAdmin(email) {
    if (!email) return false;
    try {
      const enc = btoa(String(email).toLowerCase().trim());
      return _A_TOKENS.includes(enc);
    } catch (_) {
      return false;
    }
  }

  // Verifica se l'utente connesso è Admin o Coach
  function isCoachOrAdminUser(user, profile) {
    if (!user || !user.email) return false;
    const email = String(user.email).toLowerCase().trim();

    // 1. Verifica token cifrato Admin
    if (_isEncryptedAdmin(email)) return true;

    // 2. Verifica ruolo da Firestore Cloud profile
    if (profile && (profile.role === 'admin' || profile.role === 'coach' || profile.isCoach === true)) return true;

    // 3. Verifica se l'email è salvata nel registro coach
    try {
      const stored = JSON.parse(localStorage.getItem('forge_coaches_registry') || '[]');
      if (stored.some(c => c.email && String(c.email).toLowerCase().trim() === email)) return true;
    } catch (_) {}

    return false;
  }

  // Assegna un cliente ad un determinato Coach
  async function assignClientToCoach(clientUid, coachUid) {
    if (!db || !clientUid) return false;
    try {
      await db.collection('users').doc(clientUid).set({
        assignedCoachUid: coachUid || null,
        updatedAt: Date.now()
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Errore assegnazione cliente a coach:', err);
      return false;
    }
  }

  // Recupera tutti i clienti assegnati ad uno specifico Coach (o tutti i clienti se Admin)
  async function fetchAssignedClients(coachUid) {
    if (!db) return [];
    try {
      let snapshot;
      if (coachUid === 'all_admin') {
        snapshot = await db.collection('users').get();
      } else {
        snapshot = await db.collection('users').where('assignedCoachUid', '==', coachUid).get();
      }
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id !== (currentUser ? currentUser.uid : '')) {
          list.push({ uid: doc.id, ...data });
        }
      });
      return list;
    } catch (err) {
      console.error('Errore lista clienti assegnati:', err);
      return [];
    }
  }

  // Invia/Assegna una scheda direttamente al Cloud del cliente
  async function pushSchedaToClient(clientUid, schedaObj, schedaName) {
    if (!db || !clientUid || !schedaObj) return false;
    try {
      const name = schedaName || schedaObj.programName || 'Scheda Personalizzata Coach';
      const safeId = 'scheda_' + String(name).toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const userRef = db.collection('users').doc(clientUid);
      await userRef.set({
        activeSchedaId: safeId,
        state: schedaObj,
        assignedByCoachUid: currentUser ? currentUser.uid : null,
        assignedAt: Date.now(),
        [`schede.${safeId}`]: {
          id: safeId,
          name: name,
          updatedAt: Date.now(),
          daysCount: (schedaObj.days || []).length,
          isPro: true,
          assignedByCoach: true,
          state: schedaObj
        }
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Errore invio scheda a cliente:', err);
      return false;
    }
  }

  // Elimina un coach (localStorage e Cloud) e rimuove assegnazioni
  async function deleteCoach(coachEmail) {
    if (!coachEmail) return false;
    const cleanEmail = String(coachEmail).toLowerCase().trim();
    const safeId = 'coach_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
    
    try {
      const stored = JSON.parse(localStorage.getItem('forge_coaches_registry') || '[]');
      const filtered = stored.filter(c => c.email !== cleanEmail);
      localStorage.setItem('forge_coaches_registry', JSON.stringify(filtered));
    } catch (_) {}
    
    if (!db) return false;
    
    try {
      await db.collection('coaches').doc(safeId).delete();
      
      let coachUidToRemove = safeId;
      const snapshot = await db.collection('users').where('email', '==', cleanEmail).get();
      snapshot.forEach(async (doc) => {
        coachUidToRemove = doc.id;
        await doc.ref.set({ role: 'client', isCoach: false }, { merge: true });
      });

      const uidsToCheck = [coachUidToRemove, safeId];
      for (const cUid of uidsToCheck) {
        const clientsSnap = await db.collection('users').where('assignedCoachUid', '==', cUid).get();
        clientsSnap.forEach(async (doc) => {
          await doc.ref.update({ assignedCoachUid: null, updatedAt: Date.now() });
        });
      }
      return true;
    } catch (err) {
      console.error('Errore eliminazione coach:', err);
      return false;
    }
  }

  // Elimina un cliente dal db
  async function deleteClient(clientUid) {
    if (!db || !clientUid) return false;
    try {
      await db.collection('users').doc(clientUid).delete();
      return true;
    } catch (err) {
      console.error('Errore eliminazione cliente:', err);
      return false;
    }
  }

  // Fetch richieste coach
  async function fetchCoachRequests() {
    if (!db) return [];
    try {
      const snap = await db.collection('coach_requests').orderBy('createdAt', 'desc').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (err) {
      console.error('Errore fetch coach requests:', err);
      return [];
    }
  }

  // Elimina richiesta coach
  async function deleteCoachRequest(requestId) {
    if (!db || !requestId) return false;
    try {
      await db.collection('coach_requests').doc(requestId).delete();
      return true;
    } catch (err) {
      console.error('Errore eliminazione coach request:', err);
      return false;
    }
  }

  // Fetch di tutti gli utenti
  async function fetchAllUsers() {
    if (!db) return [];
    try {
      const snap = await db.collection('users').get();
      const list = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          uid: doc.id,
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          isCoach: data.isCoach || false,
          assignedCoachUid: data.assignedCoachUid,
          assignedByCoachUid: data.assignedByCoachUid,
          assignedAt: data.assignedAt,
          state: data.state || null,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt
        });
      });
      return list;
    } catch (err) {
      console.error('Errore fetch tutti utenti:', err);
      return [];
    }
  }

  // Fetch delle schede pushati dai coach
  async function fetchPushedSchede() {
    if (!db) return [];
    try {
      const snap = await db.collection('users').get();
      const list = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.assignedByCoachUid) {
          list.push({
            clientName: data.displayName || data.email || 'Sconosciuto',
            clientEmail: data.email || '',
            planName: data.activeSchedaId || 'Sconosciuta',
            coachUid: data.assignedByCoachUid,
            date: data.assignedAt || data.updatedAt || Date.now()
          });
        }
      });
      return list;
    } catch (err) {
      console.error('Errore fetch schede pushato:', err);
      return [];
    }
  }

  // Recupera statistiche admin
  async function getAdminStats() {
    if (!db) return null;
    try {
      const coachesSnap = await db.collection('coaches').get();
      const usersSnap = await db.collection('users').get();
      const reqSnap = await db.collection('coach_requests').get();
      
      const stats = {
        totalCoaches: 0,
        totalClients: 0,
        totalSchedePushed: 0,
        totalRequests: reqSnap.size,
        coachStats: []
      };
      
      const coachesMap = {};
      coachesSnap.forEach(doc => {
        const data = doc.data();
        stats.totalCoaches++;
        coachesMap[doc.id] = {
          email: data.email,
          displayName: data.displayName,
          clientCount: 0,
          schedePushed: 0
        };
      });
      
      const coachUidToSafeId = {};
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role === 'coach' || data.isCoach) {
          if (data.email) {
            const email = String(data.email).toLowerCase().trim();
            const safeId = 'coach_' + email.replace(/[^a-z0-9]/g, '_');
            coachUidToSafeId[doc.id] = safeId;
            if (!coachesMap[safeId]) {
              stats.totalCoaches++;
              coachesMap[safeId] = {
                email: data.email,
                displayName: data.displayName || data.email,
                clientCount: 0,
                schedePushed: 0
              };
            }
          }
        }
      });

      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role !== 'admin' && data.role !== 'coach' && !data.isCoach) {
          stats.totalClients++;
        }
        
        if (data.assignedCoachUid) {
          const cId = coachUidToSafeId[data.assignedCoachUid] || data.assignedCoachUid;
          if (coachesMap[cId]) {
            coachesMap[cId].clientCount++;
          }
        }
        
        if (data.assignedByCoachUid) {
          stats.totalSchedePushed++;
          const cId = coachUidToSafeId[data.assignedByCoachUid] || data.assignedByCoachUid;
          if (coachesMap[cId]) {
            coachesMap[cId].schedePushed++;
          }
        }
      });
      
      stats.coachStats = Object.values(coachesMap);
      return stats;
    } catch (err) {
      console.error('Errore get admin stats:', err);
      return null;
    }
  }

  // Aggiorna note coach
  async function updateCoachNotes(coachEmail, notes) {
    if (!coachEmail) return false;
    const cleanEmail = String(coachEmail).toLowerCase().trim();
    const safeId = 'coach_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
    
    try {
      const stored = JSON.parse(localStorage.getItem('forge_coaches_registry') || '[]');
      const index = stored.findIndex(c => c.email === cleanEmail);
      if (index >= 0) {
        stored[index].notes = notes;
        localStorage.setItem('forge_coaches_registry', JSON.stringify(stored));
      }
    } catch (_) {}
    
    if (!db) return false;
    try {
      await db.collection('coaches').doc(safeId).set({ notes: notes }, { merge: true });
      return true;
    } catch (err) {
      console.error('Errore aggiornamento note coach:', err);
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
    getUserProfile,
    setUserRole,
    createCoachAccount,
    fetchCoaches,
    isCoachOrAdminUser,
    assignClientToCoach,
    fetchAssignedClients,
    pushSchedaToClient,
    deleteCoach,
    deleteClient,
    fetchCoachRequests,
    deleteCoachRequest,
    fetchAllUsers,
    fetchPushedSchede,
    getAdminStats,
    updateCoachNotes,
    getUser: () => currentUser,
    setUser: (u) => { currentUser = u; },
    getAuth: () => auth,
    getDb: () => db
  };

})(window);
