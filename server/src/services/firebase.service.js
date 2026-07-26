'use strict';
const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseAdmin = null;

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  return null;
}

function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;

  try {
    if (!admin.apps.length) {
      const serviceAccount = parseServiceAccount();
      if (serviceAccount) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      } else {
        return null;
      }
    }
    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (err) {
    logger.warn('Firebase Admin not initialized:', err.message);
    return null;
  }
}

module.exports = { getFirebaseAdmin };
