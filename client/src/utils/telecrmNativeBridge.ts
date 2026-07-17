/** PC CRM ↔ Android 앱 연동 (WebView 브릿지 + PC→폰 dispatch) */
import { postTelecrmMobileDispatch } from '../api/telecrmMobileDispatch';
import { getToken } from '../stores/auth';

declare global {
  interface Window {
    TelecrmApp?: {
      call: (phone: string, inquiryId?: string) => void;
      prefillPhone?: (phone: string, inquiryId?: string) => void;
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
  imageUrl?: string | null;
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export type TelecrmBridgeMode = 'native' | 'dispatch' | 'fallback';

export type TelecrmBridgeResult = {
  mode: TelecrmBridgeMode;
  /** PC→앱 dispatch 시 앱 WebSocket 즉시 수신 여부 */
  wsDelivered?: boolean;
  /** 동일 서버에 연결된 텔레CRM 앱 수 */
  telecrmAppsConnected?: number;
  /** dispatch 실패 등 사용자 안내용 */
  errorMessage?: string;
};

/** 휴대폰 앱 다이얼에 번호만 채우기 (자동 발신 없음) */
export async function telecrmPrefillPhone(
  phone: string,
  opts: TelecrmCallOptions = {},
): Promise<TelecrmBridgeResult> {
  const digits = normalizePhone(phone);
  if (digits.length < 4) {
    return { mode: 'fallback', errorMessage: '전화번호(4자 이상)를 입력해 주세요.' };
  }
  if (window.TelecrmApp?.prefillPhone) {
    window.TelecrmApp.prefillPhone(digits, opts.inquiryId ?? '');
    return { mode: 'native' };
  }
  const token = getToken();
  if (!token) {
    return { mode: 'fallback', errorMessage: '로그인이 필요합니다.' };
  }
  try {
    const res = await postTelecrmMobileDispatch(token, {
      action: 'prefill',
      phone: digits,
      inquiryId: opts.inquiryId ?? null,
      customerMatch: opts.customerMatch ?? 'unknown',
    });
    return { mode: 'dispatch', wsDelivered: res.wsDelivered, telecrmAppsConnected: res.telecrmAppsConnected };
  } catch (e) {
    const message = e instanceof Error ? e.message : '휴대폰 앱 전송에 실패했습니다.';
    return { mode: 'fallback', errorMessage: message };
  }
}

function dispatchNoticeForPrefill(result: TelecrmBridgeResult): string | null {
  if (result.mode === 'native') return '휴대폰 앱 다이얼에 번호를 넣었습니다.';
  if (result.errorMessage) return result.errorMessage;
  if (result.mode !== 'dispatch') return null;
  if (result.wsDelivered === false) {
    return '휴대폰 앱 대기열에 넣었습니다. 앱이 켜져 있으면 곧 번호가 전달됩니다.';
  }
  return '휴대폰 앱 다이얼에 번호를 넣었습니다.';
}

/** 통화 — 네이티브 WebView 또는 PC→휴대폰 dispatch */
export async function telecrmCall(
  phone: string,
  opts: TelecrmCallOptions = {},
): Promise<TelecrmBridgeResult> {
  const digits = normalizePhone(phone);
  if (digits.length < 4) {
    return { mode: 'fallback', errorMessage: '전화번호(4자 이상)를 입력해 주세요.' };
  }
  if (window.TelecrmApp?.call) {
    window.TelecrmApp.call(digits, opts.inquiryId ?? '');
    return { mode: 'native' };
  }
  const token = getToken();
  if (!token) {
    window.location.href = `tel:${digits}`;
    return { mode: 'fallback' };
  }
  try {
    const res = await postTelecrmMobileDispatch(token, {
      action: 'call',
      phone: digits,
      inquiryId: opts.inquiryId ?? null,
      customerMatch: opts.customerMatch ?? 'unknown',
    });
    return { mode: 'dispatch', wsDelivered: res.wsDelivered, telecrmAppsConnected: res.telecrmAppsConnected };
  } catch (e) {
    const message = e instanceof Error ? e.message : '휴대폰 앱 전송에 실패했습니다.';
    return { mode: 'fallback', errorMessage: message };
  }
}

/** 문자 — 네이티브 WebView 또는 PC→휴대폰 dispatch (본문·이미지) */
export async function telecrmSms(
  phone: string,
  body: string,
  opts: TelecrmCallOptions & { imageUrl?: string | null } = {},
): Promise<TelecrmBridgeResult> {
  const digits = normalizePhone(phone);
  if (!digits) return { mode: 'fallback', errorMessage: '전화번호를 입력해 주세요.' };
  const text = body.trim();
  const imageUrl = opts.imageUrl?.trim() || null;
  if (!text && !imageUrl) return { mode: 'fallback', errorMessage: '문자 내용을 입력해 주세요.' };
  if (window.TelecrmApp?.sms) {
    window.TelecrmApp.sms(digits, text);
    return { mode: 'native' };
  }
  const token = getToken();
  if (!token) {
    const q = encodeURIComponent(text);
    window.location.href = `sms:${digits}?body=${q}`;
    return { mode: 'fallback' };
  }
  try {
    const res = await postTelecrmMobileDispatch(token, {
      action: 'sms',
      phone: digits,
      body: text,
      imageUrl,
      inquiryId: opts.inquiryId ?? null,
      customerMatch: opts.customerMatch ?? 'unknown',
    });
    return { mode: 'dispatch', wsDelivered: res.wsDelivered, telecrmAppsConnected: res.telecrmAppsConnected };
  } catch (e) {
    const message = e instanceof Error ? e.message : '휴대폰 앱 전송에 실패했습니다.';
    const q = encodeURIComponent(text);
    window.location.href = `sms:${digits}?body=${q}`;
    return { mode: 'fallback', errorMessage: message };
  }
}

function dispatchNoticeForCall(result: TelecrmBridgeResult): string | null {
  if (result.mode === 'native') return '휴대폰 앱으로 통화를 요청했습니다.';
  if (result.errorMessage) return result.errorMessage;
  if (result.mode !== 'dispatch') return null;
  const host = typeof window !== 'undefined' ? window.location.host : '';
  if (result.telecrmAppsConnected === 0) {
    const serverHint = host ? ` (현재 PC: ${host})` : '';
    return `이 서버에 연결된 텔레CRM 앱이 없습니다${serverHint}. 앱 로그인 화면에서 PC CRM과 같은 서버(운영/스테이징)를 선택했는지, 업체코드·아이디가 PC와 같은지 확인해 주세요.`;
  }
  if (result.wsDelivered === false) {
    return '연결된 휴대폰 앱 대기열에 넣었습니다. 앱이 켜져 있으면 곧 통화가 시작됩니다.';
  }
  return '휴대폰 앱으로 통화 요청을 보냈습니다.';
}

function dispatchNoticeForSms(result: TelecrmBridgeResult): string | null {
  if (result.mode !== 'dispatch') return result.errorMessage ?? null;
  if (result.wsDelivered === false) {
    return '휴대폰 앱 대기열에 넣었습니다. 앱이 켜져 있으면 곧 문자 요청이 전달됩니다.';
  }
  return '휴대폰 앱으로 문자를 보냈습니다.';
}

/** dispatch 결과를 사용자 안내 문구로 변환 */
export function telecrmDispatchNotice(
  result: TelecrmBridgeResult,
  kind: 'call' | 'sms' | 'prefill',
): string | null {
  if (kind === 'prefill') return dispatchNoticeForPrefill(result);
  return kind === 'call' ? dispatchNoticeForCall(result) : dispatchNoticeForSms(result);
}

/** @deprecated telecrmCall 사용 */
export function telecrmNativeCall(phone: string, inquiryId?: string): void {
  void telecrmCall(phone, { inquiryId });
}

/** @deprecated telecrmSms 사용 */
export function telecrmNativeSms(phone: string, body: string): void {
  void telecrmSms(phone, body);
}
