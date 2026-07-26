'use strict';
const logger = require('../utils/logger');

async function sendOTP(phone) {
  logger.info(`OTP SMS skipped for ${phone}; Firebase Authentication now sends login OTPs.`);
  return { success: false, skipped: true, provider: 'firebase-auth' };
}

async function sendSMS(to, body) {
  logger.info(`SMS skipped for ${to}: ${body || 'No body provided'}`);
  return { success: false, skipped: true };
}

async function sendBookingUpdate(phone, bookingNumber, statusMessage) {
  const body = `ServiceHub: Booking ${bookingNumber} - ${statusMessage}.`;
  return sendSMS(`+91${phone}`, body);
}

module.exports = { sendOTP, sendSMS, sendBookingUpdate };
