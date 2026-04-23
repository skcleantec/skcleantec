import { API } from './apiPrefix';

export interface InquiryExtraCharge {
  id: string;
  inquiryId: string;
  description: string;
  amount: number;
  sortOrder: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

function headers(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return typeof j?.error === 'string' ? j.error : fallback;
  } catch {
    return fallback;
  }
}

/** 팀장: 추가/할인 항목 목록 */
export async function listTeamInquiryExtraCharges(
  token: string,
  inquiryId: string,
): Promise<InquiryExtraCharge[]> {
  const res = await fetch(
    `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/extra-charges`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(await parseError(res, '목록을 불러올 수 없습니다.'));
  const j = (await res.json()) as { items: InquiryExtraCharge[] };
  return Array.isArray(j.items) ? j.items : [];
}

/** 팀장: 항목 추가 */
export async function createTeamInquiryExtraCharge(
  token: string,
  inquiryId: string,
  input: { description: string; amount: number },
): Promise<InquiryExtraCharge> {
  const res = await fetch(
    `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/extra-charges`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '추가에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryExtraCharge };
  return j.item;
}

/** 팀장: 항목 수정 */
export async function patchTeamInquiryExtraCharge(
  token: string,
  inquiryId: string,
  chargeId: string,
  input: { description?: string; amount?: number },
): Promise<InquiryExtraCharge> {
  const res = await fetch(
    `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/extra-charges/${encodeURIComponent(chargeId)}`,
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '수정에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryExtraCharge };
  return j.item;
}

/** 팀장: 항목 삭제 */
export async function deleteTeamInquiryExtraCharge(
  token: string,
  inquiryId: string,
  chargeId: string,
): Promise<void> {
  const res = await fetch(
    `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/extra-charges/${encodeURIComponent(chargeId)}`,
    {
      method: 'DELETE',
      headers: headers(token),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '삭제에 실패했습니다.'));
}

/** 관리자·마케터: 목록 */
export async function listAdminInquiryExtraCharges(
  token: string,
  inquiryId: string,
): Promise<InquiryExtraCharge[]> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/extra-charges`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(await parseError(res, '목록을 불러올 수 없습니다.'));
  const j = (await res.json()) as { items: InquiryExtraCharge[] };
  return Array.isArray(j.items) ? j.items : [];
}

/** 관리자·마케터: 항목 추가 */
export async function createAdminInquiryExtraCharge(
  token: string,
  inquiryId: string,
  input: { description: string; amount: number },
): Promise<InquiryExtraCharge> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/extra-charges`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '추가에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryExtraCharge };
  return j.item;
}

/** 관리자·마케터: 항목 수정 */
export async function patchAdminInquiryExtraCharge(
  token: string,
  inquiryId: string,
  chargeId: string,
  input: { description?: string; amount?: number },
): Promise<InquiryExtraCharge> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/extra-charges/${encodeURIComponent(chargeId)}`,
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '수정에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryExtraCharge };
  return j.item;
}

/** 관리자·마케터: 항목 삭제 */
export async function deleteAdminInquiryExtraCharge(
  token: string,
  inquiryId: string,
  chargeId: string,
): Promise<void> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/extra-charges/${encodeURIComponent(chargeId)}`,
    {
      method: 'DELETE',
      headers: headers(token),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '삭제에 실패했습니다.'));
}
