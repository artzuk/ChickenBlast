# Bestenliste einrichten (Firebase)

Einmalig ca. 15 Minuten. Bis `firebase-config.js` ausgefüllt ist, läuft das Spiel normal, nur ohne Bestenliste.

## 1. Projekt und Web-App

1. <https://console.firebase.google.com> → **Projekt hinzufügen** (Google Analytics brauchst du nicht).
2. In der Projektübersicht auf **</>** (Web-App hinzufügen) klicken, Namen vergeben, *kein* Hosting.
3. Das angezeigte `firebaseConfig`-Objekt in [firebase-config.js](firebase-config.js) bei `FIREBASE_CONFIG` einsetzen.

## 2. Anonymer Login

1. **Build → Authentication → Jetzt starten**.
2. **Sign-in method → Anonym** aktivieren.
3. **Einstellungen → Autorisierte Domains**: die Domain eintragen, unter der das Spiel läuft (`localhost` ist schon drin).

## 3. Firestore

1. **Build → Firestore Database → Datenbank erstellen**, Standort `europe-west6 (Zürich)`, **Produktionsmodus**.
2. Tab **Regeln**: den Inhalt von [firestore.rules](firestore.rules) komplett hineinkopieren und **Veröffentlichen**.
3. Tab **Indexe → Zusammengesetzt → Index hinzufügen**, zweimal:

   | Sammlung | Felder |
   |---|---|
   | `scores` | `world` aufsteigend, `score` absteigend, `ts` aufsteigend |
   | `scores` | `world` aufsteigend, `score` aufsteigend |

   Der Aufbau dauert ein paar Minuten. Alternativ mit der Firebase-CLI im Projektordner:
   `firebase deploy --only firestore --project <projekt-id>` (setzt Rules und Indexe).

## 4. App Check mit reCAPTCHA v3 (unsichtbar)

1. <https://www.google.com/recaptcha/admin/create>: Typ **Punktebasiert (v3)**, Domains eintragen (deine Domain und `localhost`).
2. Den **Websiteschlüssel** in [firebase-config.js](firebase-config.js) bei `RECAPTCHA_SITE_KEY` einsetzen.
3. Firebase: **Build → App Check → Apps** → Web-App → **reCAPTCHA** → den **geheimen Schlüssel** eintragen.
4. Ein, zwei Tage im Tab **APIs** die Messwerte beobachten. Wenn dort fast nur „verifizierte“ Anfragen stehen, für **Cloud Firestore** und **Authentication** auf **Erzwingen** klicken.

**Lokal testen:** Ist `localhost` bei reCAPTCHA eingetragen, funktioniert es dort wie live. Nur falls das nicht reicht (z. B. Zugriff über eine LAN-IP): in der Browser-Konsole `localStorage.setItem('chickenblast_appcheck_debug', '1')` ausführen und neu laden. Das Spiel schreibt dann ein Debug-Token in die Konsole. Dieses Token unter **App Check → Apps → ⋮ → Debug-Tokens verwalten** eintragen.

## Gut zu wissen

- **Geheimwert:** `SECRET` steht in [firestore.rules](firestore.rules) und (rückwärts) in [highscore.js](highscore.js). Wird er geändert, dann in beiden Dateien.
- **Moderation:** Einträge löschst du in der Console unter Firestore. Für einen Spieler komplett: `players/{uid}`, `totals/{uid}` und seine Dokumente in `scores` (Filter `uid ==`).
- **Bestenliste zurücksetzen:** Sammlungen `scores` und `totals` löschen. `players` behalten, dann bleiben die Nicknames gültig.
- **Sperrliste für Namen:** steht in [highscore.js](highscore.js) (`BLOCK`) und in [firestore.rules](firestore.rules) (`nameOk`). Bei Änderungen beide Stellen anpassen.
- **Lokale Tests ohne echtes Projekt:** `firebase emulators:start --only firestore,auth --project demo-cb` und im Browser vor dem Laden `window.FIREBASE_EMULATOR = true` setzen (z. B. per Snippet). Dann die Rules gegen den Emulator prüfen.
- **Kosten:** Der Gratis-Plan (Spark) reicht weit: 50 000 Lesezugriffe und 20 000 Schreibzugriffe pro Tag.
