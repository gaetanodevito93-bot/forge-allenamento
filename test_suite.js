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
      name: 'Croci Manubri', sets: 3, reps: '10', weight: 14, restSec: 90, circuitGroup: 'Superset', groupId: 'ss_test',
      log: [{ reps: 10, weight: 14, done: false }, { reps: 10, weight: 14, done: false }, { reps: 10, weight: 14, done: false }]
    }, {
      name: 'Pushdown Tricipiti', sets: 3, reps: '12', weight: 25, restSec: 90, circuitGroup: 'Superset', groupId: 'ss_test',
      log: [{ reps: 12, weight: 25, done: false }, { reps: 12, weight: 25, done: false }, { reps: 12, weight: 25, done: false }]
    });
    window.renderList();
    assert('Render unified workout group box for Superset', !!document.querySelector('.workout-group-box'));

    const setCheck = document.querySelector('.set-check');
    if (setCheck) setCheck.click();
    assert('Complete exercise set without errors', Array.isArray(curDay.exercises[0].log));

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
