export const PLATFORM_SUPPORT_MAX_BODY = 4000;
export const PLATFORM_SUPPORT_PREVIEW_LEN = 80;
export const PLATFORM_SUPPORT_EMAIL_DEBOUNCE_MS = 3 * 60 * 1000;
export const PLATFORM_SUPPORT_THREAD_KEY = 'platform-support';

export function previewSupportBody(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= PLATFORM_SUPPORT_PREVIEW_LEN) return flat;
  return `${flat.slice(0, PLATFORM_SUPPORT_PREVIEW_LEN)}…`;
}
