'use strict';
/* =========================================================================
   CHICKEN BLAST – Highscore: geschützter Punktestand, verschlüsselter Spielstand,
   signierte Einreichung, Offline-Warteschlange, Firebase-Bestenliste, Nickname-Dialog.
   Ladereihenfolge: core.js -> worlds.js -> firebase-config.js -> highscore.js -> game.js

   Schutzniveau: hält einfache Manipulation ab (G.score = 100000, localStorage editieren,
   REST-Aufruf mit kopierter Firebase-Config). Wer den Code zerlegt, kommt durch – gewollt.
   ========================================================================= */

/* ---------------------------------------------------------------- SHA-256 (synchron, auch ohne HTTPS) */
const sha256 = (() => {
  const K = [], H0 = [];
  const frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
  for (let n = 2, c = 0; c < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (!prime) continue;
    if (c < 8) H0[c] = frac(Math.pow(n, 1 / 2));
    K[c++] = frac(Math.pow(n, 1 / 3));
  }
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  return str => {
    const b = Array.from(new TextEncoder().encode(str)), bits = b.length * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    const hi = Math.floor(bits / 4294967296);
    for (let i = 3; i >= 0; i--) b.push((hi >>> (i * 8)) & 255);
    for (let i = 3; i >= 0; i--) b.push((bits >>> (i * 8)) & 255);
    const H = H0.slice(), w = new Array(64);
    for (let o = 0; o < b.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const x = w[i - 15], y = w[i - 2];
        w[i] = (w[i - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + w[i - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) | 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();

/* ---------------------------------------------------------------- Laufender Punktestand
   Score und Abschüsse liegen maskiert im Speicher, mit Prüfsumme. G.score / G.kills sind
   nur Getter; wer sie direkt setzt oder im Speicher verändert, markiert die Runde als
   manipuliert – sie wird dann nicht eingereicht. */
const Ledger = (() => {
  let key = 0, s = 0, k = 0, chk = 0, bad = false;
  const mix = (a, b) => (Math.imul(a ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul((b + key) | 0, 0x165667b1)) >>> 0;
  const read = () => {
    const sc = s ^ key, kl = k ^ key ^ 0x2f1a;
    if (mix(sc, kl) !== chk) bad = true;
    return [sc, kl];
  };
  const write = (sc, kl) => { s = sc ^ key; k = kl ^ key ^ 0x2f1a; chk = mix(sc, kl); };
  const reset = () => { key = (Math.random() * 0x7fffffff) | 0; bad = false; write(0, 0); };
  reset();
  return Object.freeze({
    reset,
    add(pts, kills = 0) {
      pts = Math.round(pts);
      if (!Number.isFinite(pts) || pts < 0 || pts > 60000 || !Number.isInteger(kills) || kills < 0 || kills > 100) { bad = true; return; }
      const [sc, kl] = read();
      write(sc + pts, kl + kills);
    },
    get score() { return read()[0]; },
    get kills() { return read()[1]; },
    get tampered() { read(); return bad; },
    flag() { bad = true; },
  });
})();

const HS = (() => {
  const SECRET = ['5MM9xizHgBtV4LJ9nygCC8jqPt6e'].map(s => [...s].reverse().join(''))[0];
  const SCORE_VERSION = 1;
  const RATE_MS = 31000;          // Rules erlauben eine Einreichung pro 30 s
  const QUEUE_MAX = 10;
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const WORLD_IDS = WORLDS.map(w => w.id);
  const configured = !!(typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId);

  /* -------------------------------------------------------------- Verschlüsselter Spielstand */
  const keyBytes = sha256(SECRET + '|keystream').match(/../g).map(h => parseInt(h, 16));
  const xorBytes = bytes => bytes.map((v, i) => v ^ keyBytes[i % keyBytes.length]);
  function seal(obj) {
    const json = JSON.stringify(obj);
    const bytes = xorBytes(Array.from(new TextEncoder().encode(json)));
    return btoa(String.fromCharCode(...bytes)) + '.' + sha256(SECRET + '|save|' + json).slice(0, 20);
  }
  function unseal(str) {
    try {
      const [b64, sig] = String(str).split('.');
      const bytes = xorBytes(Array.from(atob(b64), ch => ch.charCodeAt(0)));
      const json = new TextDecoder().decode(new Uint8Array(bytes));
      if (sha256(SECRET + '|save|' + json).slice(0, 20) !== sig) return null;
      return JSON.parse(json);
    } catch (e) { return null; }
  }
  const int = (v, max) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
  function loadProgress() {
    const p = { unlocked: 0, best: {} };
    for (const id of WORLD_IDS) p.best[id] = 0;
    const raw = store.get('save', null);
    if (raw !== null) {
      const d = unseal(raw);
      if (d) {
        p.unlocked = int(d.unlocked, WORLD_IDS.length - 1);
        for (const id of WORLD_IDS) p.best[id] = int(d.best && d.best[id], 10000000);
      }
      return p;
    }
    // einmalige Übernahme der alten, unverschlüsselten Werte
    const old = ['unlocked', 'best', ...WORLD_IDS.map(id => 'best_' + id)];
    p.unlocked = int(store.get('unlocked', 0), WORLD_IDS.length - 1);
    for (const id of WORLD_IDS) p.best[id] = int(store.get('best_' + id, id === 'farm' ? store.get('best', 0) : 0), 10000000);
    saveProgress(p);
    try { old.forEach(k => localStorage.removeItem('chickenblast_' + k)); } catch (e) {}
    return p;
  }
  function saveProgress(p) { store.set('save', seal({ unlocked: p.unlocked, best: p.best })); }

  /* -------------------------------------------------------------- Nickname */
  // nur grobe Beleidigungen/Nazi-Kram; derbe Wörter sind ausdrücklich erlaubt.
  // Gleiche Liste (ohne Leetspeak-Umwandlung) steht in firestore.rules.
  const BLOCK = ['hitler', 'nazi', 'siegheil', 'heilhitler', '1488', 'kkk', 'nigger', 'nigga', 'neger', 'kanake', 'schwuchtel', 'faggot', 'judensau', 'auschwitz'];
  const INVISIBLE = /[⠀ㅤᅟᅠﾠ]/u;
  const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}\p{Zl}\p{Zp}]/u;
  const graphemes = s => {
    try { return [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(s)].length; } catch (e) { return Array.from(s).length; }
  };
  function validateName(raw) {
    const name = String(raw || '').normalize('NFC').replace(/\s+/gu, ' ').trim();
    const n = graphemes(name);
    if (n < 2) return { error: 'Mindestens 2 Zeichen.' };
    if (n > 16 || name.length > 64) return { error: 'Höchstens 16 Zeichen.' };
    if (FORBIDDEN.test(name.replace(/‍/g, '')) || INVISIBLE.test(name)) return { error: 'Unsichtbare oder Steuerzeichen sind nicht erlaubt.' };
    if (/\p{M}{3,}/u.test(name)) return { error: 'Zu viele übereinandergestapelte Akzente.' };
    if (!/[\p{L}\p{N}\p{S}]/u.test(name)) return { error: 'Mindestens ein Buchstabe, eine Ziffer oder ein Emoji.' };
    const flat = name.toLowerCase().replace(/[0134578@$]/g, c => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' }[c])).replace(/[^\p{L}]/gu, '');
    const plain = name.toLowerCase().replace(/\s/g, '');
    if (BLOCK.some(w => flat.includes(w) || plain.includes(w))) return { error: 'Diesen Namen lassen wir nicht zu.' };
    return { name };
  }
  let myName = store.get('name', null);

  /* -------------------------------------------------------------- Firebase (wird erst bei Bedarf geladen) */
  let fbP = null, profileOk = false;
  function firebase() {
    if (!configured) return Promise.reject(Object.assign(new Error('nicht eingerichtet'), { code: 'noconfig' }));
    if (!fbP) {
      fbP = (async () => {
        const [A, Au, F, AC] = await Promise.all([
          import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
          RECAPTCHA_SITE_KEY ? import(SDK + 'firebase-app-check.js') : null,
        ]);
        const app = A.initializeApp(FIREBASE_CONFIG);
        if (AC) {
          // Debug-Token nur auf Wunsch: localStorage.setItem('chickenblast_appcheck_debug', '1') und neu laden
          if (store.get('appcheck_debug', 0)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          AC.initializeAppCheck(app, { provider: new AC.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
        }
        const auth = Au.getAuth(app), db = F.getFirestore(app);
        if (self.FIREBASE_EMULATOR) {   // lokale Tests: window.FIREBASE_EMULATOR = true vor dem Laden setzen
          Au.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
          F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
        }
        await new Promise(r => { const off = Au.onAuthStateChanged(auth, () => { off(); r(); }); });
        return { F, Au, auth, db };
      })();
      fbP.catch(() => { fbP = null; });
    }
    return fbP;
  }
  async function user() {
    const fb = await firebase();
    if (!fb.auth.currentUser) await fb.Au.signInAnonymously(fb.auth);
    return fb.auth.currentUser;
  }
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

  // Profil = players/{uid} mit dem endgültigen Nickname dieses Geräts
  async function ensureProfile() {
    if (profileOk) return;
    const { F, db } = await firebase(), u = await user();
    const ref = F.doc(db, 'players', u.uid), snap = await F.getDoc(ref);
    if (snap.exists()) {
      const n = snap.data().name;
      if (n !== myName) { myName = n; store.set('name', n); }   // Server gewinnt – Name ist endgültig
    } else {
      await F.setDoc(ref, { name: myName, created: F.serverTimestamp() });
    }
    profileOk = true;
  }

  /* -------------------------------------------------------------- Einreichen (Warteschlange) */
  const sign = it => sha256([SECRET, it.id, it.world, it.score, it.kills, it.v].join('|'));
  const newId = () => {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const r = new Uint8Array(20); crypto.getRandomValues(r);
    return Array.from(r, b => c[b % 62]).join('');
  };
  const loadQueue = () => { const q = store.get('hs_queue', []); return Array.isArray(q) ? q : []; };
  const saveQueue = q => store.set('hs_queue', q);
  let round = null;                 // Status der zuletzt beendeten Runde (für den Ergebnis-Bildschirm)
  let flushing = false, flushT = 0;

  function roundEnd(world, score, kills, tampered) {
    if (!configured) { round = null; return; }
    if (tampered) { round = { status: 'tampered' }; return; }
    if (score <= 0) { round = null; return; }
    const item = { id: newId(), world, score, kills, v: SCORE_VERSION };
    item.sig = sign(item);
    let q = loadQueue();
    q.push(item);
    if (q.length > QUEUE_MAX) q = q.sort((a, b) => b.score - a.score).slice(0, QUEUE_MAX);
    saveQueue(q);
    round = { id: item.id, world, score, status: myName ? 'sending' : 'noname' };
    flush();
  }
  function later(ms) { clearTimeout(flushT); flushT = setTimeout(flush, ms); }
  function setRound(id, patch) { if (round && round.id === id) Object.assign(round, patch); }

  async function submit(it) {
    const { F, db } = await firebase(), u = await user();
    await ensureProfile();
    const tRef = F.doc(db, 'totals', u.uid), tSnap = await F.getDoc(tRef);
    const old = tSnap.exists() ? tSnap.data() : {};
    const tot = { name: myName, last: it.id, t: F.serverTimestamp(), v: SCORE_VERSION, total: 0 };
    for (const id of WORLD_IDS) {
      tot[id] = old[id] | 0;
      if (id === it.world && it.score > tot[id]) tot[id] = it.score;
      tot.total += tot[id];
    }
    const b = F.writeBatch(db);
    b.set(F.doc(db, 'scores', it.id), {
      uid: u.uid, name: myName, world: it.world, score: it.score, kills: it.kills, v: it.v, ts: F.serverTimestamp(), sig: it.sig,
    });
    b.set(tRef, tot);
    await b.commit();
  }
  async function exists(id) {
    const { F, db } = await firebase();
    return (await F.getDoc(F.doc(db, 'scores', id))).exists();
  }
  async function rankOf(world, score) {
    const { F, db } = await firebase();
    const c = await F.getCountFromServer(F.query(F.collection(db, 'scores'), F.where('world', '==', world), F.where('score', '>', score)));
    return c.data().count + 1;
  }

  async function flush() {
    if (!configured || !myName || flushing) return;
    const q = loadQueue();
    if (!q.length) return;
    if (!navigator.onLine) { q.forEach(it => setRound(it.id, { status: 'later' })); return; }
    const wait = store.get('hs_last', 0) + RATE_MS - Date.now();
    if (wait > 0 && wait <= RATE_MS) { later(wait); return; }
    flushing = true;
    const it = q[0];
    let ok = false;
    try {
      await timeout(submit(it), 20000);
      ok = true;
    } catch (e) {
      if (e.code === 'permission-denied') {
        // schon angekommen (z. B. Wiederholung nach Zeitüberschreitung)? Sonst bis zu 3 Versuche.
        try { ok = await timeout(exists(it.id), 10000); } catch (e2) {}
        if (!ok) {
          it.tries = (it.tries || 0) + 1;
          if (it.tries >= 3) { drop(it.id); setRound(it.id, { status: 'rejected' }); }
          else saveQueue(loadQueue().map(x => (x.id === it.id ? it : x)));
        }
      } else setRound(it.id, { status: 'later' });
      if (!ok) { flushing = false; later(e.code === 'permission-denied' ? RATE_MS : 60000); return; }
    }
    drop(it.id);
    store.set('hs_last', Date.now());
    for (const k in boards) boards[k].t = 0;      // Bestenliste neu laden
    setRound(it.id, { status: 'done' });
    flushing = false;
    if (round && round.id === it.id) rankOf(it.world, it.score).then(r => setRound(it.id, { rank: r })).catch(() => {});
    if (loadQueue().length) later(RATE_MS);
  }
  function drop(id) { saveQueue(loadQueue().filter(x => x.id !== id)); }
  window.addEventListener('online', () => flush());

  /* -------------------------------------------------------------- Bestenliste lesen */
  const boards = {};
  function board(tab) {
    let b = boards[tab];
    if (!configured) return { status: 'noconfig' };
    if (!b || (b.status !== 'loading' && Date.now() - b.t > 60000)) {
      b = boards[tab] = Object.assign(b || { rows: null, me: null }, { status: 'loading', t: Date.now() });
      loadBoard(tab, b);
    }
    return b;
  }
  async function loadBoard(tab, b) {
    try {
      await timeout((async () => {
        const { F, db, auth } = await firebase();
        if (myName && !auth.currentUser) await user().catch(() => {});
        const uid = auth.currentUser ? auth.currentUser.uid : null;
        let rows, mine = null;
        if (tab === 'total') {
          const s = await F.getDocs(F.query(F.collection(db, 'totals'), F.orderBy('total', 'desc'), F.limit(10)));
          rows = s.docs.map(d => ({ name: d.data().name, score: d.data().total, mine: d.id === uid }));
        } else {
          const s = await F.getDocs(F.query(F.collection(db, 'scores'), F.where('world', '==', tab), F.orderBy('score', 'desc'), F.orderBy('ts', 'asc'), F.limit(10)));
          rows = s.docs.map(d => ({ name: d.data().name, score: d.data().score, mine: d.data().uid === uid }));
        }
        if (uid && !rows.some(r => r.mine)) {
          const t = await F.getDoc(F.doc(db, 'totals', uid));
          const best = t.exists() ? (tab === 'total' ? t.data().total : t.data()[tab] | 0) : 0;
          if (best > 0) {
            const q = tab === 'total'
              ? F.query(F.collection(db, 'totals'), F.where('total', '>', best))
              : F.query(F.collection(db, 'scores'), F.where('world', '==', tab), F.where('score', '>', best));
            mine = { rank: (await F.getCountFromServer(q)).data().count + 1, score: best };
          }
        }
        Object.assign(b, { status: 'ok', rows, me: mine });
      })(), 15000);
    } catch (e) {
      console.warn('Bestenliste:', e);
      b.status = navigator.onLine ? 'error' : 'offline';
      b.t = Date.now() - 45000;                  // in 15 s erneut versuchen
    }
  }

  /* -------------------------------------------------------------- Nickname-Dialog (HTML über dem Canvas) */
  const CSS = `
#hs-dlg{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:rgba(20,10,0,.75);font-family:'Press Start 2P','Courier New',monospace;padding:12px;box-sizing:border-box}
#hs-dlg .box{background:#ffe9a8;border:4px solid #3b1600;border-radius:14px;box-shadow:4px 6px 0 rgba(40,15,0,.55);padding:20px 22px;width:min(560px,100%);max-height:100%;overflow:auto;box-sizing:border-box;color:#3b1600}
#hs-dlg h2{margin:0 0 14px;font-size:18px;color:#5c0008;font-weight:normal}
#hs-dlg input{width:100%;box-sizing:border-box;font:16px 'Press Start 2P','Courier New',monospace;padding:12px;border:3px solid #3b1600;border-radius:8px;background:#fffbea;color:#3b1600;outline:none}
#hs-dlg input:focus{border-color:#e3102a}
#hs-dlg .hint{font-size:10px;line-height:1.7;margin:10px 0 0}
#hs-dlg .err{font-size:10px;line-height:1.6;color:#c1121f;min-height:16px;margin:8px 0 0}
#hs-dlg .row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
#hs-dlg button{flex:1;min-width:140px;font:12px 'Press Start 2P','Courier New',monospace;padding:12px 8px;border:3px solid #3b1600;border-radius:10px;background:#ffd83a;color:#3b1600;cursor:pointer}
#hs-dlg button.alt{background:transparent}
#hs-dlg button:disabled{opacity:.5;cursor:default}
#hs-dlg .legal{font-family:system-ui,sans-serif;font-size:11px;line-height:1.5;color:#5c3a1a;margin:14px 0 0}
#hs-dlg .legal a{color:#5c0008}
.grecaptcha-badge{visibility:hidden}`;
  let dlgOpen = false;
  function nameDialog(done = () => {}) {
    if (dlgOpen || myName) { done(!!myName); return; }
    dlgOpen = true;
    if (!document.getElementById('hs-css')) {
      const st = document.createElement('style'); st.id = 'hs-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.id = 'hs-dlg';
    el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="hs-t">
      <h2 id="hs-t">DEIN NICKNAME</h2>
      <input type="text" maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Nickname">
      <p class="hint">2–16 Zeichen, Emojis erlaubt. Der Name gilt für dieses Gerät und kann später nicht geändert werden.</p>
      <p class="err" aria-live="polite"></p>
      <div class="row"><button type="button" class="alt" data-a="no">ABBRECHEN</button><button type="button" data-a="ok">SPEICHERN</button></div>
      <p class="legal">Nickname und Punkte werden bei Google Firebase gespeichert und öffentlich angezeigt. Geschützt durch reCAPTCHA – es gelten die
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Datenschutzerklärung</a> und
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Nutzungsbedingungen</a> von Google.</p></div>`;
    document.body.appendChild(el);
    const inp = el.querySelector('input'), err = el.querySelector('.err');
    const ok = el.querySelector('[data-a=ok]'), no = el.querySelector('[data-a=no]');
    let confirmFor = null;
    const close = res => { el.remove(); dlgOpen = false; done(res); };
    inp.addEventListener('input', () => { confirmFor = null; ok.textContent = 'SPEICHERN'; err.textContent = ''; });
    async function save() {
      const v = validateName(inp.value);
      if (v.error) { err.textContent = v.error; confirmFor = null; ok.textContent = 'SPEICHERN'; return; }
      if (confirmFor !== v.name) {   // zweiter Klick bestätigt – der Name ist endgültig
        confirmFor = v.name; inp.value = v.name;
        ok.textContent = 'JA, ENDGÜLTIG';
        err.textContent = `„${v.name}“ für immer? Nochmal klicken zum Bestätigen.`;
        return;
      }
      ok.disabled = no.disabled = inp.disabled = true;
      ok.textContent = 'SPEICHERE…'; err.textContent = '';
      myName = v.name; store.set('name', myName);
      if (navigator.onLine) {
        try { await timeout(ensureProfile(), 15000); } catch (e) {
          if (e.code === 'permission-denied') {
            myName = null; profileOk = false;
            try { localStorage.removeItem('chickenblast_name'); } catch (e2) {}
            err.textContent = 'Dieser Name wurde abgelehnt. Bitte einen anderen wählen.';
            ok.disabled = no.disabled = inp.disabled = false; ok.textContent = 'SPEICHERN'; confirmFor = null;
            return;
          }
          // offline / Zeitüberschreitung: Profil wird beim nächsten Einreichen angelegt
        }
      }
      if (round && round.status === 'noname') round.status = 'sending';
      for (const k in boards) boards[k].t = 0;
      close(true);
      flush();
    }
    ok.addEventListener('click', save);
    no.addEventListener('click', () => close(false));
    // Tastatur gehört dem Dialog – nicht ans Spiel weiterreichen (R, M, F, Enter …)
    el.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); if (!ok.disabled) save(); }
      else if (e.key === 'Escape' && !no.disabled) close(false);
    });
    el.addEventListener('pointerdown', e => { if (e.target === el && !no.disabled) close(false); });
    setTimeout(() => inp.focus(), 50);
  }

  if (configured && myName) setTimeout(flush, 1500);

  return {
    get configured() { return configured; },
    get name() { return myName; },
    get round() { return round; },
    get pending() { return loadQueue().length; },
    get dialogOpen() { return dlgOpen; },
    loadProgress, saveProgress, roundEnd, board, nameDialog, validateName,
  };
})();
