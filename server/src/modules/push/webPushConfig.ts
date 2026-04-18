export function isWebPushConfigured(): boolean {
  const pub = process.env.WEBPUSH_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.WEBPUSH_VAPID_PRIVATE_KEY?.trim();
  return Boolean(pub && priv);
}

export function getWebPushSubject(): string {
  return process.env.WEBPUSH_VAPID_SUBJECT?.trim() || 'mailto:admin@localhost';
}

export function getVapidPublicKey(): string {
  return process.env.WEBPUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
}
