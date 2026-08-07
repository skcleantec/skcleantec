/** 목록·상세 include의 orderForm._count.photos → orderFormPhotoCount 로 평탄화 */

type OrderFormWithCount = {
  _count?: { photos: number };
} & Record<string, unknown>;

export function attachOrderFormPhotoCount<T extends { orderForm?: OrderFormWithCount | null }>(
  row: T,
): T & { orderFormPhotoCount: number } {
  const raw = row.orderForm;
  if (!raw) {
    return { ...row, orderFormPhotoCount: 0 };
  }
  const { _count, ...orderForm } = raw;
  return {
    ...row,
    orderForm: orderForm as T['orderForm'],
    orderFormPhotoCount: _count?.photos ?? 0,
  };
}

export function attachOrderFormPhotoCounts<T extends { orderForm?: OrderFormWithCount | null }>(
  rows: T[],
): Array<T & { orderFormPhotoCount: number }> {
  return rows.map((row) => attachOrderFormPhotoCount(row));
}

/** Prisma orderForm select — 사진 건수만 */
export const orderFormPhotoCountSelect = {
  _count: { select: { photos: true } },
} as const;
