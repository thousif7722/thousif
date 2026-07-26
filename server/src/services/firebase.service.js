'use strict';
const admin  = require('firebase-admin');
const fs     = require('fs');
const logger = require('../utils/logger');

let firebaseAdmin = null;

function parseServiceAccount() {
  // Method 1: JSON file path on disk (RECOMMENDED for EC2)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!fs.existsSync(filePath)) {
      logger.error(`❌ Firebase JSON file not found at: ${filePath}`);
      return null;
    }
    logger.info(`✅ Firebase JSON loaded from: ${filePath}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // Method 2: Base64 encoded string in env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  // Method 3: Raw JSON string in env
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
        logger.info('✅ Firebase Admin initialized successfully');
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
        logger.info('✅ Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS');
      } else {
        logger.error('❌ Firebase Admin not initialized — no credentials provided!');
        return null;
      }
    }

    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (err) {
    logger.error('❌ Firebase Admin initialization error:', err.message);
    return null;
  }
}

module.exports = { getFirebaseAdmin };
