/** CRM API·조회에 작업 브랜드 스코프 쿼리 부착 */
export function appendCrmWorkBrandQuery(
  params: URLSearchParams,
  operatingCompanyId?: string | null,
): void {
  const id = operatingCompanyId?.trim();
  if (id) params.set('operatingCompanyId', id);
}

export function crmWorkBrandQueryString(operatingCompanyId?: string | null): string {
  const params = new URLSearchParams();
  appendCrmWorkBrandQuery(params, operatingCompanyId);
  const q = params.toString();
  return q ? `?${q}` : '';
}

/** @deprecated userId 스코프 저장으로 대체 — clearCrmWorkBrandStoredSlug에서 함께 제거 */
export const CRM_WORK_BRAND_SLUG_STORAGE_KEY = 'crmWorkBrandSlug';

const CRM_WORK_BRAND_SELECTION_STORAGE_KEY = 'crmWorkBrandSelection';

type CrmWorkBrandStoredSelection = {
  userId: string;
  slug: string;
};

/** 동일 브라우저·다른 계정 로그인 시 이전 마케터/관리자 브랜드가 섞이지 않도록 userId와 함께 저장 */
export function readCrmWorkBrandStoredSlug(userId: string | null | undefined): string | null {
  const uid = userId?.trim();
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(CRM_WORK_BRAND_SELECTION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CrmWorkBrandStoredSelection;
      const slug = parsed.slug?.trim().toLowerCase();
      if (parsed.userId === uid && slug) return slug;
      return null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCrmWorkBrandStoredSlug(userId: string | null | undefined, slug: string): void {
  const uid = userId?.trim();
  const normalized = slug.trim().toLowerCase();
  if (!uid || !normalized) return;
  try {
    sessionStorage.setItem(
      CRM_WORK_BRAND_SELECTION_STORAGE_KEY,
      JSON.stringify({ userId: uid, slug: normalized } satisfies CrmWorkBrandStoredSelection),
    );
    sessionStorage.removeItem(CRM_WORK_BRAND_SLUG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearCrmWorkBrandStoredSlug(): void {
  try {
    sessionStorage.removeItem(CRM_WORK_BRAND_SELECTION_STORAGE_KEY);
    sessionStorage.removeItem(CRM_WORK_BRAND_SLUG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
