import admin from 'firebase-admin';

let messaging: admin.messaging.Messaging | null | undefined;

/** FIREBASE_SERVICE_ACCOUNT_JSON 미설정 시 null */
export function getStaffAppFcmMessaging(): admin.messaging.Messaging | null {
  if (messaging !== undefined) return messaging;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw || !raw.startsWith('{')) {
    messaging = null;
    return null;
  }

  try {
    const credential = admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount);
    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }
    messaging = admin.messaging();
    return messaging;
  } catch (e) {
    console.error('[fcm] Firebase Admin init failed:', e instanceof Error ? e.message : e);
    messaging = null;
    return null;
  }
}
