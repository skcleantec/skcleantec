/** Android WebView ↔ 텔레CRM JS 브릿지 (apps/telecrm-android TelecrmAppInterface) */
declare global {
  interface Window {
    TelecrmApp?: {
      call: (phone: string, inquiryId?: string) => void;
      sms: (phone: string, body: string) => void;
      isNativeApp?: () => boolean;
    };
  }
}

export function isTelecrmNativeApp(): boolean {
  return typeof window.TelecrmApp?.call === 'function';
}

export function telecrmNativeCall(phone: string, inquiryId?: string): void {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return;
  if (window.TelecrmApp?.call) {
    window.TelecrmApp.call(digits, inquiryId ?? '');
    return;
  }
  window.location.href = `tel:${digits}`;
}

export function telecrmNativeSms(phone: string, body: string): void {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return;
  if (window.TelecrmApp?.sms) {
    window.TelecrmApp.sms(digits, body);
    return;
  }
  const q = encodeURIComponent(body);
  window.location.href = `sms:${digits}?body=${q}`;
}
