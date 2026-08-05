<div align="center">

# ⚡ FORGE — Piattaforma Gestionale & App Palestra

### Allenati · Programma · Incassa · Progredisci

**L'ecosistema PWA ufficiale per la Palestra FORGE: Gestione Clienti, Area Istruttori, Pagamenti PayPal & Google Pay, Sincronizzazione Cloud e Dashboard Amministrativa per la Direzione.**

[![PWA](https://img.shields.io/badge/PWA-installabile--offline-C6FF3D?style=flat-square)](https://gaetanodevito93-bot.github.io/forge-allenamento/)
[![Versione](https://img.shields.io/badge/versione-v88-0A0A0F?style=flat-square)](#-versione-forge-v88)
[![Backend](https://img.shields.io/badge/backend-Firebase%20Cloud-FFCA28?style=flat-square)](#-backend--cloud)
[![Pagamenti](https://img.shields.io/badge/pagamenti-PayPal%20%7C%20GPay-003087?style=flat-square)](#-pagamenti-paypal--google-pay)
[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-222?style=flat-square)](https://gaetanodevito93-bot.github.io/forge-allenamento/)
[![Licenza](https://img.shields.io/badge/licenza-proprietaria-red?style=flat-square)](LICENSE)

</div>

---

## 📱 Cos'è FORGE

**FORGE** è una Progressive Web App (PWA) di livello enterprise progettata su misura per la **Palestra FORGE**. 
Fornisce un'esperienza integrata su 3 livelli:

1. **Atleti & Clienti:** Consultazione schede di allenamento, timer di recupero automatico, tracciamento carichi e massimali 1RM, sincronizzazione Cloud e acquisto piani di coaching in 1-Click.
2. **Istruttori & Coach:** Pannello dedicato per la gestione dei clienti assegnati e la creazione e **spinta in tempo reale ("1-Click Push")** delle schede sui dispositivi mobili degli atleti.
3. **Direzione Palestra (Super Admin):** Dashboard avanzata a 6 tab per monitorare il **Fatturato Totale Incassato (€)** via PayPal/GPay, registrare nuovi istruttori, assegnare atleti e gestire il parco clienti.

---

## ✨ Funzionalità Principali

### 🏋️ Esperienza Atleta
- **Schede giornaliere dinamiche** — organizzazione esercizi in split (Giorno A, B, C, D…).
- **Registro carichi e serie** — tracciamento in tempo reale di peso, ripetizioni, note ed esecuzione.
- **Timer di recupero automatico** — avvio immediato al completamento di una serie con avviso acustico e vibrazione.
- **Sincronizzazione Cloud** — login Google per salvare e recuperare i dati su qualsiasi dispositivo.
- **Marketplace Piani & Coaching** — acquisto di schede PRO e abbonamenti di coaching.

### 💳 Pagamenti PayPal & Google Pay (GPay)
- **PayPal Express Checkout:** Pagamento sicuro istantaneo per tutti i piani di coaching.
- **Google Pay (GPay):** Checkout in 1-Tap con le carte salvate nel wallet Google.
- **Registrazione Transazioni Cloud:** Ogni incasso genera un record univoco (es. `PAYPAL_...` o `GPAY_...`) aggiornando istantaneamente il fatturato nella Admin Dashboard.

### 🏋️ Pannello Istruttore / Coach
- **Riconoscimento automatico dell'account:** L'Area Istruttore si attiva in Home quando l'utente accede con un'email autorizzata.
- **Gestione atleti assegnati:** Elenco atleti associati, stato e scheda attiva.
- **Spinta scheda in tempo reale ("Assegna & Spingi"):** Creazione e invio istantaneo di schede personalizzate (o da Template PRO) direttamente sullo smartphone del cliente.

### 🔑 Super Admin Dashboard (6 Tab)
- **📊 Stats & KPI:** Monitoraggio fatturato complessivo (€), numero istruttori, clienti e schede elaborate.
- **💶 Incassi:** Log dettagliato di tutte le transazioni incassate via PayPal e Google Pay.
- **🏋️ Coach:** Registrazione ed eliminazione dei profili istruttore.
- **👥 Clienti:** Registro completo atleti, assegnazione coach e creazione schede.
- **📩 Richieste:** Gestione delle richieste di coaching paganti e di contatto.
- **📋 Schede:** Storico di tutte le programmazioni inviate ai clienti.

### 📖 Manuale Operativo Integrato
- **In-App Manual:** Modale interattiva `openForgeManualModal()` accessibile dal menu e dalla dashboard admin.
- **Documentazione Ufficiale:** File guida completo [`MANUALE_PALESTRA_FORGE.md`](MANUALE_PALESTRA_FORGE.md) per lo staff della palestra.

---

## 🛠️ Stack Tecnico & Architettura

- **Frontend Core:** HTML5 Semantic Markup, Vanilla JavaScript ES6+, CSS Volt Design System (Dark Mode, Neon Accents, Glassmorphism).
- **Backend & Cloud:** Firebase SDK v9 (Authentication OAuth Google, Cloud Firestore DB, Offline Persistence).
- **Offline-First PWA:** Service Worker (`sw.js` versione `forge-v88`), Web App Manifest (`manifest.webmanifest`).
- **Nessuna dipendenza pesante:** 0 npm build steps richiesti, compatibile con qualsiasi hosting statico.

---

## 🚀 Guida all'Avvio

### 🌐 Utilizzo Online
Apri l'app pubblicata su GitHub Pages:
**→ [gaetanodevito93-bot.github.io/forge-allenamento/](https://gaetanodevito93-bot.github.io/forge-allenamento/)**

### 💻 Server Locale
Servono solo i file statici (es. tramite `npx serve` o `python`):

```bash
git clone https://github.com/gaetanodevito93-bot/forge-allenamento.git
cd forge-allenamento

# Avvio con npx serve
npx serve -l 3000 .

# Oppure con Python
python3 -m http.server 3000
```
Apri il browser su `http://localhost:3000`.

---

## 🧱 Struttura Repository

```
forge-allenamento/
├── index.html                # Single Page Application completa (UI, Modali, Controller)
├── firebase-config.js        # Modulo Cloud Firebase (Auth, Firestore, Payments, Admin API)
├── sw.js                     # Service Worker PWA Offline (versione forge-v88)
├── manifest.webmanifest      # Manifest PWA (icone, colori, avvio)
├── MANUALE_PALESTRA_FORGE.md # Manuale operativo ufficiale Palestra FORGE
├── icon-192.png              # Icone PWA
├── icon-512.png
├── apple-touch-icon.png
└── .github/workflows/        # Deployment automatico GitHub Pages
```

---

## 📄 Licenza

Questo progetto è distribuito con **licenza proprietaria — tutti i diritti riservati**.  
Uso esclusivo autorizzato per la **Palestra FORGE**. Vedi il file [LICENSE](LICENSE) per i dettagli.

---

<div align="center">
<sub>FORGE v88 — Piattaforma Gestionale Palestra. © 2026 Gaetano De Vito.</sub>
</div>
