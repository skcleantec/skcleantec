import { prisma } from '../../lib/prisma.js';

/** 검색어·이름에서 공백과 끝의 호칭을 빼 같은 손님으로 맞춘다. */
export function receiptNameKey(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/(?:고객님|고객|님)+$/u, '').toLowerCase();
}

/** 실명과 닉네임이 다르면 "홍길동 (닉네임 어머님)". */
export function receiptCustomerLabel(realName: string, nickname: string | null | undefined): string {
  const real = realName.trim();
  const nick = (nickname ?? '').trim();
  if (!nick || receiptNameKey(nick) === receiptNameKey(real)) return real;
  return `${real} (닉네임 ${nick})`;
}

export function receiptRealName(inquiryName: string, orderFormName: string | null | undefined): string {
  const submitted = (orderFormName ?? '').trim();
  return submitted || inquiryName.trim();
}

/**
 * 현금영수증·세금계산서 접수 이름 검색 — DB에서 직접 조회.
 * customerName·nickname·orderForm.customerName·주소·접수번호 contains + receiptNameKey 정규화.
 */
export async function findInquiryIdsByReceiptName(
  tenantId: string,
  rawQuery: string,
  limit = 20,
): Promise<string[]> {
  const q = rawQuery.trim().slice(0, 40);
  const key = receiptNameKey(q);
  if (q.length < 2 && key.length < 2) return [];

  const like = `%${q}%`;
  const keyLike = key.length >= 2 ? `%${key}%` : null;

  const rows = keyLike
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT i.id
        FROM inquiries i
        LEFT JOIN order_forms oform ON oform.id = i.order_form_id
        WHERE i.tenant_id = ${tenantId}
          AND i.deleted_at IS NULL
          AND (
            i.customer_name ILIKE ${like}
            OR COALESCE(i.nickname, '') ILIKE ${like}
            OR i.address ILIKE ${like}
            OR COALESCE(i.inquiry_number, '') ILIKE ${like}
            OR COALESCE(oform.customer_name, '') ILIKE ${like}
            OR regexp_replace(
                  regexp_replace(lower(i.customer_name), '\\s+', '', 'g'),
                  '(고객님|고객|님)+$',
                  ''
                ) LIKE ${keyLike}
            OR regexp_replace(
                  regexp_replace(lower(COALESCE(i.nickname, '')), '\\s+', '', 'g'),
                  '(고객님|고객|님)+$',
                  ''
                ) LIKE ${keyLike}
            OR regexp_replace(
                  regexp_replace(lower(COALESCE(oform.customer_name, '')), '\\s+', '', 'g'),
                  '(고객님|고객|님)+$',
                  ''
                ) LIKE ${keyLike}
          )
        ORDER BY i.created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT i.id
        FROM inquiries i
        LEFT JOIN order_forms oform ON oform.id = i.order_form_id
        WHERE i.tenant_id = ${tenantId}
          AND i.deleted_at IS NULL
          AND (
            i.customer_name ILIKE ${like}
            OR COALESCE(i.nickname, '') ILIKE ${like}
            OR i.address ILIKE ${like}
            OR COALESCE(i.inquiry_number, '') ILIKE ${like}
            OR COALESCE(oform.customer_name, '') ILIKE ${like}
          )
        ORDER BY i.created_at DESC
        LIMIT ${limit}
      `;

  return rows.map((row) => row.id);
}
