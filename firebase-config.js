'use strict';
/* =========================================================================
   Firebase-Konfiguration für die Bestenliste (siehe HIGHSCORE-SETUP.md).
   Diese Werte sind NICHT geheim – sie stehen bei jeder Firebase-Web-App im Client.
   Solange FIREBASE_CONFIG null ist, läuft das Spiel normal, nur ohne Bestenliste.
   ========================================================================= */
const FIREBASE_CONFIG = null;
/* Beispiel:
const FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'chickenblast-xxxx.firebaseapp.com',
  projectId: 'chickenblast-xxxx',
  storageBucket: 'chickenblast-xxxx.firebasestorage.app',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};
*/

// reCAPTCHA-v3-Site-Key für App Check. null = App Check aus.
const RECAPTCHA_SITE_KEY = null;
