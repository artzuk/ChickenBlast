'use strict';
/* =========================================================================
   Firebase-Konfiguration für die Bestenliste (siehe HIGHSCORE-SETUP.md).
   Diese Werte sind NICHT geheim – sie stehen bei jeder Firebase-Web-App im Client.
   Nur die Werte eintragen – KEIN import/initializeApp (das macht highscore.js).
   ========================================================================= */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB8cPRvppRgSkAYeEuJCsv6DnqaxQXnYLg',
  authDomain: 'chickenblast-f2227.firebaseapp.com',
  projectId: 'chickenblast-f2227',
  storageBucket: 'chickenblast-f2227.firebasestorage.app',
  messagingSenderId: '178949667086',
  appId: '1:178949667086:web:22a10cc5d541c789227f5f',
};

// reCAPTCHA-Enterprise-Schlüssel-ID (Google Cloud Fraud Defense) für App Check. null = App Check aus.
const RECAPTCHA_SITE_KEY = '6LdT9yMuAAAAACdEnSA0P_YU9I-HfvfpN0NTH6dG';
