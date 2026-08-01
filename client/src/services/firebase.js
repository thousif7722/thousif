import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const isFirebaseConfigured = requiredKeys.every((key) => Boolean(firebaseConfig[key]));

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const analytics = app ? getAnalytics(app) : null;

if (auth && import.meta.env.VITE_FIREBASE_DISABLE_APP_VERIFICATION === 'true') {
  auth.settings.appVerificationDisabledForTesting = true;
}

let recaptchaVerifier = null;
let confirmationResult = null;

function ensureFirebaseReady() {
  if (!auth) {
    throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* environment variables.');
  }
}

function ensureRecaptcha(containerId = 'firebase-recaptcha') {
  ensureFirebaseReady();
  if (recaptchaVerifier) return recaptchaVerifier;

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      resetRecaptcha();
    },
  });
  return recaptchaVerifier;
}

function resetRecaptcha() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

export async function sendPhoneOtp(phone) {
  try {
    const verifier = ensureRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
    return { verificationId: confirmationResult.verificationId };
  } catch (err) {
    resetRecaptcha();
    throw err;
  }
}

export async function confirmPhoneOtp(code) {
  ensureFirebaseReady();
  if (!confirmationResult) {
    throw new Error('Please request an OTP first.');
  }
  const credential = await confirmationResult.confirm(code);
  return credential.user.getIdToken();
}

export async function signOutFirebase() {
  if (auth) await signOut(auth);
  confirmationResult = null;
  resetRecaptcha();
}

export async function signInWithGoogleService() {
  ensureFirebaseReady();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user.getIdToken();
}

export { auth, analytics, isFirebaseConfigured, resetRecaptcha };
