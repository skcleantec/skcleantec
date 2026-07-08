const API = '/api/crm';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type TelecrmMobileDispatchInput = {
  action: 'call' | 'sms' | 'prefill';
  phone: string;
  body?: string;
  imageUrl?: string | null;
  inquiryId?: string | null;
  customerMatch?: 'new' | 'existing' | 'pick' | 'unknown' | null;
};

/** PC CRM → 로그인한 마케터 휴대폰 앱으로 통화·문자 지시 (WebSocket + 큐) */
export async function postTelecrmMobileDispatch(
  token: string,
  input: TelecrmMobileDispatchInput,
): Promise<{ ok: boolean; id: string; wsDelivered?: boolean }> {
  const res = await fetch(`${API}/mobile-dispatch`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      action: input.action,
      phone: input.phone.replace(/\D/g, ''),
      body: input.body,
      imageUrl: input.imageUrl ?? null,
      inquiryId: input.inquiryId ?? null,
      customerMatch: input.customerMatch ?? null,
    }),
  });
  const data = (await res.json()) as { error?: string; ok?: boolean; id?: string; wsDelivered?: boolean };
  if (!res.ok) throw new Error(data.error ?? '휴대폰 앱 전송에 실패했습니다.');
  return { ok: Boolean(data.ok), id: data.id ?? '', wsDelivered: data.wsDelivered };
}
