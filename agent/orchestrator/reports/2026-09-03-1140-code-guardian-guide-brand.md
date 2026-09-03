# CodeGuardian — 안내 저장 · 브랜드 덮어쓰기 구현

## 파일
- `shared/orderFormGuidePlaceholders.ts` · 서버 미러
- `operatingCompany.schema.ts` / `operatingCompanyConfig.ts`
- `orderform.routes.ts` PUT `/form-config/brand-cancellation-guide` + `/public-guide` overlay
- `AdminOrderFormNoticePage.tsx` · `OrderInfoPage.tsx`

## 점검
- tenantId: 브랜드 저장 `findFirst({ id, tenantId })` 후 update
- 공개 API: slug 있을 때만 덮어쓰기. 없으면 공통
- 권한: `orderform.formConfig` (마케터도 안내 저장과 동일)
- tsc server/client `--noEmit` 통과
- `verify-order-guide-cancellation: ok`

## Findings
- 없음 (BLOCKER/HIGH)
