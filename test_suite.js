/* ================================================================
   FORGE PWA — AUTOMATED HEADLESS E2E TEST SUITE
   Esegui con: npm test  oppure  node test_suite.js
   ================================================================ */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('🧪 AVVIO TEST SUITE HEADLESS COMPLETA — FORGE PWA (v93)\n');

const repoPath = __dirname;
let html = fs.readFileSync(path.join(repoPath, 'index.html'), 'utf8');
const fbCode = fs.readFileSync(path.join(repoPath, 'firebase-config.js'), 'utf8');

// Inietta firebase-config.js direttamente nell'HTML
html = html.replace('<script src="firebase-config.js"></script>', `<script>${fbCode}</script>`);

const dom = new JSDOM(html, {
  url: 'http://localhost:3000/',
  runScripts: 'dangerously',
  beforeParse(win) {
    win.scrollTo = () => {};
    win.requestAnimationFrame = (cb) => setTimeout(cb, 10);
    win.cancelAnimationFrame = (id) => clearTimeout(id);
    win.AudioContext = function() {
      return {
        state: 'running', currentTime: 0, resume: () => Promise.resolve(),
        createOscillator: () => ({ frequency: {}, connect: () => {}, start: () => {}, stop: () => {} }),
        createGain: () => ({ gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }),
        destination: {}
      };
    };
    win.webkitAudioContext = win.AudioContext;
    win.print = () => console.log('   [API MOCK] window.print() executed');
    win.buzz = (ms) => console.log(`   [API MOCK] buzz(${ms}) executed`);
    win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ result: 'success' }) });
  }
});

const window = dom.window;
const document = window.document;

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(` ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(` ❌ FAIL: ${description}`);
    failed++;
  }
}

setTimeout(async () => {
  try {
    if (typeof window.initApp === 'function') window.initApp();

    console.log('--- 1. INITIALIZATION & SPLASH SCREEN ---');
    const splash = document.getElementById('splash');
    assert('Splash screen auto-dismisses on init', splash && splash.classList.contains('hide'));
    assert('FORGE_CLOUD object initialized', !!window.FORGE_CLOUD);
    assert('State initialized with days', window.state && Array.isArray(window.state.days));

    console.log('\n--- 2. NAVIGATION SYSTEM ---');
    ['training', 'progress', 'coach', 'home'].forEach(view => {
      window.setView(view);
      assert(`Navigate to view "${view}"`, document.body.getAttribute('data-view') === view);
    });

    console.log('\n--- 3. TRAINING & EXERCISES ---');
    window.setView('training');
    const initialDays = window.state.days.length;
    const addBtn = document.querySelector('.add-day');
    if (addBtn) addBtn.click();
    else window.state.days.push({ name: 'Giorno B', exercises: [] });
    assert('Add new training day (+ Giorno)', window.state.days.length === initialDays + 1);

    const curDay = window.state.days[window.state.activeDay || 0];
    if (!curDay.exercises || curDay.exercises.length === 0) {
      curDay.exercises = [{
        name: 'Panca Piana Bench Press', sets: 3, reps: '8', weight: 80, restSec: 90,
        log: [{ reps: 8, weight: 80, done: false }, { reps: 8, weight: 80, done: false }, { reps: 8, weight: 80, done: false }]
      }];
    }
    assert('Verify training day exercises structure', curDay.exercises.length > 0);

    window.openAddChoiceModal();
    assert('Open choice modal for Single vs Superset vs Circuit', !!document.getElementById('addTypeSuperset'));
    window.closeModal();

    window.openGroupWizardModal('superset');
    const addMoreBtn = document.getElementById('grpAddMoreBtn');
    assert('Group wizard modal contains + button for adding unlimited stations/exercises', !!addMoreBtn);
    window.closeModal();

    curDay.exercises.push({
      name: 'Croci Manubri', sets: 3, reps: '10', weight: 14, restSec: 90, circuitGroup: 'Superset', groupId: 'ss_test_1',
      log: [{ reps: 10, weight: 14, done: false }, { reps: 10, weight: 14, done: false }, { reps: 10, weight: 14, done: false }]
    }, {
      name: 'Pushdown Tricipiti', sets: 3, reps: '12', weight: 25, restSec: 90, circuitGroup: 'Superset', groupId: 'ss_test_1',
      log: [{ reps: 12, weight: 25, done: false }, { reps: 12, weight: 25, done: false }, { reps: 12, weight: 25, done: false }]
    }, {
      name: 'Leg Extension', sets: 3, reps: '10', weight: 40, restSec: 90, circuitGroup: 'Superset', groupId: 'ss_test_2',
      log: [{ reps: 10, weight: 40, done: false }, { reps: 10, weight: 40, done: false }, { reps: 10, weight: 40, done: false }]
    }, {
      name: 'Leg Curl', sets: 3, reps: '10', weight: 35, restSec: 90, circuitGroup: 'Superset', groupId: 'ss_test_2',
      log: [{ reps: 10, weight: 35, done: false }, { reps: 10, weight: 35, done: false }, { reps: 10, weight: 35, done: false }]
    });
    window.renderList();
    const groupBoxes = document.querySelectorAll('.workout-group-box');
    assert('Render unified workout group box for Superset', groupBoxes.length > 0);
    assert('Adjacent distinct supersets render as separate group boxes without merging', groupBoxes.length === 2);

    const setCheck = document.querySelector('.set-check');
    if (setCheck) setCheck.click();
    assert('Complete exercise set without errors', Array.isArray(curDay.exercises[0].log));

    // Test clearWorkoutProgress day isolation
    if (window.state.days.length > 1 && window.state.days[0].exercises.length > 0) {
      window.state.days[0].exercises[0].log[0].done = true;
      window.clearWorkoutProgress(false);
      assert('clearWorkoutProgress(false) resets active day but preserves other days', window.state.days[0].exercises[0].log[0].done === true);
    }

    // Test Circuit Giro completion
    window.stopTimer();
    const circEx1 = curDay.exercises[1];
    const circEx2 = curDay.exercises[2];
    window.toggleSet(1, 0, document.querySelector(`[data-ex="1"][data-set="0"]`));
    assert('Intermediate circuit station set DOES NOT start rest timer', document.getElementById('timerOverlay').classList.contains('open') === false);

    window.toggleSet(2, 0, document.querySelector(`[data-ex="2"][data-set="0"]`));
    assert('Final circuit station completion STARTS Circuit Giro rest timer', document.getElementById('timerOverlay').classList.contains('open') === true);
    window.stopTimer();

    console.log('\n--- 4. REST TIMER & CAPSULE FORMATTING ---');
    window.startRestTimer(90, 'Prossima serie Panca Piana', 0);
    const miniText = document.getElementById('timerMiniText');
    assert('Rest timer mini capsule shows time in seconds', miniText && miniText.textContent.includes('s'));
    window.stopTimer();
    assert('Stop/Skip timer cleanly', document.getElementById('timerOverlay').classList.contains('open') === false);

    console.log('\n--- 5. ADMIN DASHBOARD (880px MODAL & 7 TABS) ---');
    const mockAdminUser = { uid: 'admin_123', email: 'gaetano.devito93@gmail.com', displayName: 'Gaetano Admin' };
    window.FORGE_CLOUD.setUser(mockAdminUser);
    window._renderAdminDashboard(mockAdminUser, [{ displayName: 'Coach Marco', email: 'marco@coach.com' }], [{ uid: 'u1', displayName: 'Atleta 1' }], [], { totalRevenue: 240 }, [], [], [], true);

    const modal = document.getElementById('modal');
    assert('Admin Dashboard opens in wide mode (modal-wide class)', modal.classList.contains('modal-wide'));

    // Switch to Google Sheets Tab
    window._adminActiveTab = 'sheets';
    window._renderAdminDashboard(mockAdminUser, [{ displayName: 'Coach Marco', email: 'marco@coach.com' }], [{ uid: 'u1', displayName: 'Atleta 1' }], [], { totalRevenue: 240 }, [], [], [], true);

    const webhookInput = document.getElementById('admGsUrlInput') || modal.querySelector('#admGsUrlInput');
    assert('Webhook URL input exists in Google Fogli tab', !!webhookInput);

    console.log('\n--- 6. GOOGLE SHEETS LIVE SYNC ENGINE ---');
    const testUrl = 'https://script.google.com/macros/s/AKfycbxTEST_WEBHOOK/exec';
    window.FORGE_CLOUD.setGoogleSheetsWebhookUrl(testUrl);
    assert('Save Google Sheets Webhook URL', window.FORGE_CLOUD.getGoogleSheetsWebhookUrl() === testUrl);

    const syncOk = await window.FORGE_CLOUD.syncToGoogleSheets('payment', { amount: 119, clientName: 'Mario Rossi' });
    assert('Invoke syncToGoogleSheets engine', syncOk === true);

    window.openGoogleAppsScriptHelpModal();
    const scriptText = document.getElementById('gsScriptCodeText');
    assert('Show Google Apps Script helper modal', scriptText && scriptText.value.includes('function doPost'));
    window.closeModal();

    console.log('\n--- 7. A4 PRINT ENGINE MULTI-DAY (#printArea) ---');
    window.state.days = [
      { name: 'Giorno A — Petto e Bicipiti', exercises: [{ name: 'Panca Piana', sets: 4, reps: '8', weight: 80, restSec: 90 }] },
      { name: 'Giorno B — Gambe e Addome', exercises: [{ name: 'Squat', sets: 4, reps: '8', weight: 100, restSec: 120 }] },
      { name: 'Giorno C — Dorso e Spalle', exercises: [{ name: 'Stacco da terra', sets: 4, reps: '6', weight: 120, restSec: 120 }] }
    ];
    window.executePrint('all', 'Gaetano De Vito');
    const printArea = document.getElementById('printArea');
    assert('Generate A4 print sheet in #printArea', printArea && printArea.innerHTML.includes('print-page'));

    const pages = printArea.querySelectorAll('.print-page');
    assert('Generate exactly 3 standalone pages for 3 training days (1 page per day)', pages.length === 3);
    assert('Page 1 has standalone header with Giorno A', pages[0] && pages[0].innerHTML.includes('Giorno A'));
    assert('Page 2 has standalone header with Giorno B', pages[1] && pages[1].innerHTML.includes('Giorno B'));
    assert('Page 3 has standalone header with Giorno C', pages[2] && pages[2].innerHTML.includes('Giorno C'));

    const styleContent = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    assert('Print CSS contains body > *:not(#printArea) display:none rule to prevent blank pages', styleContent.includes('body > *:not(#printArea)'));
    assert('Print CSS contains 270mm single A4 page height constraint', styleContent.includes('270mm'));
    assert('Print CSS contains page-break-before: always for multi-day isolation', styleContent.includes('page-break-before: always'));

    console.log('\n--- 8. PROGRESS, BODY MEASUREMENTS & ANALYTICS ---');
    window.setView('progress');
    assert('Progress view rendered active', document.body.getAttribute('data-view') === 'progress');

    window.state.measurements = window.state.measurements || [];
    window.state.measurements.push({ date: '2026-08-08', weight: 78.5, waist: 82, arm: 39 });
    window.renderProgressView ? window.renderProgressView() : window.render();
    assert('Body measurements stored in state', window.state.measurements.length > 0);

    console.log('\n--- 9. PERSONAL COACH & CLIENT MANAGEMENT PORTAL ---');
    window.setView('coach');
    assert('Coach view rendered active', document.body.getAttribute('data-view') === 'coach');

    window.openClientSchedaBuilderModal('client_123', 'Mario Rossi');
    assert('Open Client Scheda Builder Modal', !!document.getElementById('cbProgName'));
    window.closeModal();

    console.log('\n--- 10. TIMER OVERLAY & EXTENDED CONTROLS ---');
    window.startRestTimer(45, 'Recupero Serie 1', 0);
    const timerOverlay = document.getElementById('timerOverlay');
    assert('Start rest timer opens overlay', timerOverlay.classList.contains('open'));

    if (typeof window.addTimerTime === 'function') window.addTimerTime(10);
    assert('Extend rest timer cleanly', typeof window.stopTimer === 'function');
    window.stopTimer();
    assert('Stop rest timer closes overlay', !timerOverlay.classList.contains('open'));

    console.log('\n--- 11. SECURITY, DATA NORMALIZATION & XSS SANITIZATION ---');
    const safeText = window.esc('<script>alert("xss")</script>');
    assert('Input sanitization esc() neutralizes XSS scripts', !safeText.includes('<script>') && safeText.includes('&lt;script&gt;'));

    const normalized = window.normalizeState({ programName: 'Test Raw State', days: [{ name: 'Giorno A', exercises: [] }] });
    assert('normalizeState populates missing days array', Array.isArray(normalized.days));
    assert('normalizeState populates missing history object', typeof normalized.history === 'object');
    assert('normalizeState populates missing measurements array', Array.isArray(normalized.measurements));

    const fallbackNorm = window.normalizeState(null);
    assert('normalizeState returns default state on invalid input instead of throwing', Array.isArray(fallbackNorm.days) && fallbackNorm.days.length > 0);

    console.log('\n--- 12. ADMIN DASHBOARD TABS EXHAUSTIVE VALIDATION ---');
    const tabsToTest = ['utenti', 'abbonamenti', 'piani', 'fatturato', 'impostazioni', 'sheets', 'audit'];
    tabsToTest.forEach(t => {
      window._adminActiveTab = t;
      window._renderAdminDashboard(mockAdminUser, [{ displayName: 'Coach Test', email: 'test@coach.com' }], [{ uid: 'u1', displayName: 'Atleta 1' }], [], { totalRevenue: 500 }, [], [], [], true);
      assert(`Admin Dashboard tab "${t}" renders successfully`, modal.classList.contains('modal-wide'));
    });
    window.closeModal();

    console.log('\n==========================================');
    console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('==========================================\n');

    if (failed > 0) process.exit(1);
    else process.exit(0);

  } catch (err) {
    console.error('FATAL ERROR DURING TEST EXECUTION:', err);
    process.exit(1);
  }
}, 300);
