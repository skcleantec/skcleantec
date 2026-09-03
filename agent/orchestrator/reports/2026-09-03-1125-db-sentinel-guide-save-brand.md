# DbSentinel — 안내사항 브랜드별 저장

## Legal watch
- 취소·위약·예약금 문구는 고객 고지. 브랜드마다 다르면 **그 브랜드 발주서에만** 나와야 함. 잘못된 브랜드 문구 = 약관 불일치 리스크.
- 법률 자문 아님. 저장 필터가 예약금 조항을 지우면 고지가 빠질 수 있음 (이번 버그).

## Isolation
- `OrderFormConfig`: `tenantId` unique. 타 업체 유출 경로 아님.
- 브랜드 덮어쓰기는 `OperatingCompany` (`tenantId` + id) JSON에 두면 기존 격리와 동일.
- 공개 `/public-guide`: `resolvePublicTenantIdFromRequest` + `brandSlug`로만 조회. slug 없이 DEFAULT 테넌트 폴백 금지 유지.

## Exchange / mirror
- 해당 없음 (테넌트 간 교환 필드 아님).

## Migration notes
- **P0 (필터 수정):** 스키마 없음.
- **P2 권장:** `OperatingCompany.config`에 `cancellationGuideItems?: string[]` (줄 수·글자 상한). `prisma migrate` 불필요. 파서는 `operatingCompany.schema.ts`.
- 대안: `OrderFormBrandCustomerLinkConfig`에 `infoCancellationItems` 컬럼 — 그때는 migrate + `tenantId` unique 유지.
- 공유 DB `db push` 금지.

## Action items
1. P0는 코드만.
2. P2 JSON이면 migrate 승인 불필요. 컬럼이면 사용자 승인 후 migrate.
3. 로그에 안내 전문·전화 찍지 말 것.
