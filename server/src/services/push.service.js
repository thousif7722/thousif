'use strict';
const logger = require('../utils/logger');
const { getFirebaseAdmin } = require('./firebase.service');

// Firebase Admin SDK (optional — falls back gracefully)
let firebaseAdmin;
function getFirebase() {
  firebaseAdmin = firebaseAdmin || getFirebaseAdmin();
  return firebaseAdmin;
}

async function send(fcmToken, title, body, data = {}) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[DEV PUSH] To: ${fcmToken?.slice(0, 10)}... | ${title}: ${body}`);
    return true;
  }
  const admin = getFirebase();
  if (!admin) {
    logger.warn('Firebase not configured — push not sent');
    return false;
  }
  try {
    const result = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default', channelId: 'servicehub_main' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    logger.debug(`Push sent: ${result}`);
    return true;
  } catch (err) {
    logger.warn('Push notification failed:', err.message);
    return false;
  }
}

async function sendToMultiple(tokens, title, body, data = {}) {
  if (!tokens?.length) return;
  const admin = getFirebase();
  if (!admin) return;
  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
  });
  logger.debug(`Multicast push: ${result.successCount}/${tokens.length} sent`);
  return result;
}

module.exports = { send, sendToMultiple };
