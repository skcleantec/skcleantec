/** PC CRM ↔ Android 앱 연동 (WebView 브릿지 + PC→폰 dispatch) */
import { postTelecrmMobileDispatch } from '../api/telecrmMobileDispatch';
import { getToken } from '../stores/auth';

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

export type TelecrmCallOptions = {
  inquiryId?: string | null;
  customerMatch?: 'new' | 'existing' | 'pick' | 'unknown' | null;
  smsBody?: string;
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export type TelecrmBridgeMode = 'native' | 'dispatch' | 'fallback';

/** 통화 — 네이티브 WebView 또는 PC→휴대폰 dispatch */
export async function telecrmCall(phone: string, opts: TelecrmCallOptions = {}): Promise<TelecrmBridgeMode> {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return 'fallback';
  if (window.TelecrmApp?.call) {
    window.TelecrmApp.call(digits, opts.inquiryId ?? '');
    return 'native';
  }
  const token = getToken();
  if (!token) {
    window.location.href = `tel:${digits}`;
    return 'fallback';
  }
  try {
    await postTelecrmMobileDispatch(token, {
      action: 'call',
      phone: digits,
      inquiryId: opts.inquiryId ?? null,
      customerMatch: opts.customerMatch ?? 'unknown',
    });
    return 'dispatch';
  } catch {
    window.location.href = `tel:${digits}`;
    return 'fallback';
  }
}

/** 문자 — 네이티브 WebView 또는 PC→휴대폰 dispatch (본문 prefill) */
export async function telecrmSms(phone: string, body: string, opts: TelecrmCallOptions = {}): Promise<TelecrmBridgeMode> {
  const digits = normalizePhone(phone);
  if (!digits) return 'fallback';
  const text = body.trim();
  if (window.TelecrmApp?.sms) {
    window.TelecrmApp.sms(digits, text);
    return 'native';
  }
  const token = getToken();
  if (!token || !text) {
    const q = encodeURIComponent(text);
    window.location.href = `sms:${digits}?body=${q}`;
    return 'fallback';
  }
  try {
    await postTelecrmMobileDispatch(token, {
      action: 'sms',
      phone: digits,
      body: text,
      inquiryId: opts.inquiryId ?? null,
      customerMatch: opts.customerMatch ?? 'unknown',
    });
    return 'dispatch';
  } catch {
    const q = encodeURIComponent(text);
    window.location.href = `sms:${digits}?body=${q}`;
    return 'fallback';
  }
}

/** @deprecated telecrmCall 사용 */
export function telecrmNativeCall(phone: string, inquiryId?: string): void {
  void telecrmCall(phone, { inquiryId });
}

/** @deprecated telecrmSms 사용 */
export function telecrmNativeSms(phone: string, body: string): void {
  void telecrmSms(phone, body);
}
