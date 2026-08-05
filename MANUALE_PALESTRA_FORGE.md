# ⚡ PALESTRA FORGE — MANUALE D'USO E CONSEGNA SISTEMA

**Piattaforma:** FORGE Web PWA (Progressive Web App)  
**Versione:** `forge-v88`  
**Architettura:** Single Page Application (HTML5 / Vanilla JS / CSS Volt Design System) + Firebase Cloud Backend (Auth, Firestore, Offline Persistence)  
**Siti / URL:** http://localhost:3000 (o dominio di produzione)

---

## 🎯 1. PANORAMICA DEL SISTEMA FORGE

FORGE è la piattaforma PWA ufficiale per la gestione dell'allenamento, della programmazione e del coaching 1-to-1 della **Palestra FORGE**.

Il sistema supporta tre livelli di esperienza integrati:
1. **Atleta / Cliente (User Experience):** Tracciamento allenamenti, timer di recupero automatico, storico massimali 1RM, sincronizzazione Cloud e acquisto piani di coaching in 1-Click.
2. **Istruttore / Coach (Coach Panel):** Gestione clienti assegnati, creazione e spinta di schede personalizzate in tempo reale sul dispositivo del cliente.
3. **Direzione Palestra (Super Admin Dashboard):** Gestione completa istruttori, assegnazione atleti, tracciamento del fatturato reale incassato (€) via PayPal e Google Pay, e analisi delle metriche di performance.

---

## 📱 2. MANUALE PER GLI ATLETI / CLIENTI

### A. Accesso & Sincronizzazione Cloud
- Aprire l'app FORGE da qualsiasi browser mobile o desktop.
- Cliccare su **"Accedi con Google"** (nel menu o nell'header) per collegare il proprio account.
- Tutti i dati di allenamento, massimali e schede vengono sincronizzati automaticamente nel Cloud Firestore.

### B. Esecuzione Allenamento & Timer
- Selezionare il giorno di allenamento (es. *Lunedì — Petto & Bicipiti*).
- Toccare la cella del peso o delle ripetizioni per inserire i dati effettivi.
- Toccare la spunta di completamento della serie: il **Timer di Recupero** parte in automatico con avviso acustico al termine.

### C. Acquisto Piani Coaching & Pagamenti Sicuri
- Accedere alla tab **"Coach"** nell'app.
- Scegliere tra i vari piani disponibili:
  - *Scheda Singola Personalizzata (€29)*
  - *Programmazione Mensile (€49/mese)*
  - *Programmazione Trimestrale (€119/3 mesi)*
  - *Coaching Trasformazione Integrale (€89/m, €219/3m, €399 VIP 6 mesi)*
- Cliccare sul pulsante del piano e selezionare il metodo di pagamento desiderato:
  - **🅿️ PayPal Express Checkout:** Pagamento istantaneo sicuro via PayPal.
  - **💳 Google Pay (GPay):** Pagamento in 1-Tap con le carte salvate nel Google Wallet.
- La transazione viene registrata istantaneamente con codice univoco (es. `PAYPAL_1785...` o `GPAY_1785...`) e il Coach riceve la notifica automatica.

---

## 🏋️ 3. MANUALE PER GLI ISTRUTTORI / COACH

### A. Sblocco dell'Area Istruttore
- L'istruttore deve effettuare il login Google utilizzando l'email indicata dalla Direzione Palestra.
- Se l'email è abilitata nel registro Coach, nella Home dell'app comparirà automaticamente la card **"🏋️ Area Istruttore / Coach Panel"**.

### B. Gestione Clienti Assegnati
- Accedendo all'Area Istruttore, il Coach vede la lista dei propri atleti assegnati con:
  - Nome ed email dell'atleta.
  - Data di ultimo aggiornamento.
  - Nome della scheda attualmente attiva sul suo dispositivo.

### C. Assegnazione & Spinta della Scheda ("1-Click Push")
1. Cliccare su **"✍️ Fa' Scheda"** accanto al nome del cliente.
2. Definire il nome del programma o scegliere un **Template PRO** o la propria scheda come base.
3. Cliccare su **"🚀 Assegna & Spingi Scheda a [Nome Cliente]"**.
4. La nuova scheda sostituirà **in tempo reale** la scheda attiva sul dispositivo dell'atleta non appena questo si connette.

---

## 🔑 4. MANUALE PER LA DIREZIONE PALESTRA (SUPER ADMIN)

### A. Accesso alla Admin Dashboard
- Accedere con l'email dell'amministratore (es. `gaetano.devito93@gmail.com`).
- Nel banner principale o nella Home cliccare su **"🏋️ Admin Dashboard"**.

### B. Sezioni della Dashboard Admin (6 Tab)

1. **📊 Stats (Panoramica):**
   - **Fatturato Incassato (€):** Mostra l'importo totale accumulato dalle vendite dei piani con PayPal e Google Pay.
   - **KPI Cards:** Numero totale di Istruttori, Clienti registrati, Schede Inviate e Richieste pendenti.
   - **Performance per Coach:** Elenco degli istruttori con conteggio clienti serviti e schede elaborate.

2. **💶 Incassi (Pagamenti):**
   - Registro storico di tutte le transazioni completate.
   - Mostra nome cliente, piano acquistato, importo in €, badge del metodo (**🅿️ PayPal** o **💳 Google Pay**), ID transazione e data/ora.

3. **🏋️ Coach (Gestione Istruttori):**
   - **➕ Nuovo Istruttore:** Registra l'email e il nome di un nuovo coach per sbloccare le sue credenziali.
   - **🗑️ Elimina:** Rimuove un istruttore (disassociando i suoi clienti in sicurezza).

4. **👥 Clienti (Gestione Atleti):**
   - Elenco completo di tutti gli utenti registrati su FORGE.
   - **✍️ Scheda:** Permette al Super Admin di creare o modificare direttamente la scheda dell'atleta.
   - **🔗 Coach:** Associa o riassegna l'atleta ad un determinato istruttore della palestra.
   - **🗑️ Elimina:** Rimuove l'atleta dal database Cloud.

5. **📩 Richieste (Incontri & Piani):**
   - Elenco delle richieste di coaching inviate dagli utenti dal form in-app.
   - Evidenza visiva dei piani **PAGATI** rispetto alle richieste di contatto semplice.

6. **📋 Schede (Storico Inviate):**
   - Registro di tutte le programmazioni inviate ai clienti dai vari istruttori.

---

## 💳 5. CONFIGURAZIONE PAGAMENTI PAYPAL & GOOGLE PAY

La piattaforma gestisce i pagamenti direttamente dal client in modo nativo:
- **PayPal Checkout:** Riceve i pagamenti tramite PayPal Smart Checkout / Direct API integration.
- **Google Pay:** Sfrutta le API GPay per pagamenti rapidi da mobile e browser Chrome.
- **Registrazione Firestore:** Ogni acquisto viene salvato nel collection `payments` e `coach_requests` con stato `status: 'completed'`, garantendo che il fatturato mostrato nella Dashboard Admin sia sempre reale e verificabile.

---

## 🛡️ 6. INSTALLAZIONE PWA SU DISPOSITIVI MOBILE

FORGE è una **Progressive Web App (PWA)** offline-first:
- **iOS (iPhone/iPad):** Aprire Safari, premere il tasto Condividi (icona col quadrato e la freccia in alto) e selezionare **"Aggiungi a Schermata Home"**.
- **Android:** Aprire Chrome, toccare i tre pallini in alto a destra e selezionare **"Installa applicazione"** o **"Aggiungi a schermata Home"**.
