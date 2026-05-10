import { API } from './apiPrefix';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

/** DB `AdditionalReceiptSettlementChannel` 와 동일 */
export type AdditionalReceiptSettlementChannel = 'COMPANY_DEPOSIT' | 'FIELD_RECEIVED';

export interface InquiryAdditionalReceipt {
  id: string;
  inquiryId: string;
  description: string;
  amount: number;
  settlementChannel: AdditionalReceiptSettlementChannel;
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

export async function listTeamInquiryAdditionalReceipts(
  token: string,
  inquiryId: string,
): Promise<InquiryAdditionalReceipt[]> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts`,
    ),
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(await parseError(res, '목록을 불러올 수 없습니다.'));
  const j = (await res.json()) as { items: InquiryAdditionalReceipt[] };
  return Array.isArray(j.items) ? j.items : [];
}

export async function createTeamInquiryAdditionalReceipt(
  token: string,
  inquiryId: string,
  input: {
    description: string;
    amount: number;
    settlementChannel: AdditionalReceiptSettlementChannel;
  },
): Promise<InquiryAdditionalReceipt> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts`,
    ),
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '추가에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryAdditionalReceipt };
  return j.item;
}

export async function patchTeamInquiryAdditionalReceipt(
  token: string,
  inquiryId: string,
  receiptId: string,
  input: {
    description?: string;
    amount?: number;
    settlementChannel?: AdditionalReceiptSettlementChannel;
  },
): Promise<InquiryAdditionalReceipt> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts/${encodeURIComponent(receiptId)}`,
    ),
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '수정에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryAdditionalReceipt };
  return j.item;
}

export async function deleteTeamInquiryAdditionalReceipt(
  token: string,
  inquiryId: string,
  receiptId: string,
): Promise<void> {
  const res = await fetch(
    withTeamPreviewQuery(
      `${API}/team/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts/${encodeURIComponent(receiptId)}`,
    ),
    {
      method: 'DELETE',
      headers: headers(token),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '삭제에 실패했습니다.'));
}

export async function listAdminInquiryAdditionalReceipts(
  token: string,
  inquiryId: string,
): Promise<InquiryAdditionalReceipt[]> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await parseError(res, '목록을 불러올 수 없습니다.'));
  const j = (await res.json()) as { items: InquiryAdditionalReceipt[] };
  return Array.isArray(j.items) ? j.items : [];
}

export async function createAdminInquiryAdditionalReceipt(
  token: string,
  inquiryId: string,
  input: {
    description: string;
    amount: number;
    settlementChannel?: AdditionalReceiptSettlementChannel;
  },
): Promise<InquiryAdditionalReceipt> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, '추가에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryAdditionalReceipt };
  return j.item;
}

export async function patchAdminInquiryAdditionalReceipt(
  token: string,
  inquiryId: string,
  receiptId: string,
  input: {
    description?: string;
    amount?: number;
    settlementChannel?: AdditionalReceiptSettlementChannel;
  },
): Promise<InquiryAdditionalReceipt> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts/${encodeURIComponent(receiptId)}`,
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '수정에 실패했습니다.'));
  const j = (await res.json()) as { item: InquiryAdditionalReceipt };
  return j.item;
}

export async function deleteAdminInquiryAdditionalReceipt(
  token: string,
  inquiryId: string,
  receiptId: string,
): Promise<void> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/additional-receipts/${encodeURIComponent(receiptId)}`,
    {
      method: 'DELETE',
      headers: headers(token),
    },
  );
  if (!res.ok) throw new Error(await parseError(res, '삭제에 실패했습니다.'));
}
