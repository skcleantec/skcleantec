# CodeGuardian — 취소·변경 안내 저장 잘림 · 브랜드별

## 범위
- `shared/orderFormGuidePlaceholders.ts` (`isLineCoveredByCancellationPolicyToken`, `ensureCancellationPolicyPlaceholderInSections`)
- `server/src/lib/orderFormGuidePlaceholders.ts` (미러)
- `client/src/pages/admin/AdminOrderFormNoticePage.tsx` (`persistSections` → ensure)
- `client/src/utils/orderGuideParse.ts` (로드 시 ensure)
- `server/src/modules/orderform/orderform.routes.ts` (`parseGuideSectionsFromDb` · `/public-guide`)
- 연관: `OrderInfoPage.tsx`, `OrderFormGuideAgreeModal.tsx`, `OperatingCompany.config.cancellationPolicy`

## 룰
- 멀티테넌트: 안내 본문은 `OrderFormConfig.tenantId` 1행. 위약 구간만 `OperatingCompany` JSON.
- 스키마 변경 없음(이번 점검). 브랜드별 추가 문구를 넣으면 JSON config 또는 별도 테이블 결정 필요.

## 저장이 잘리는 원인 (HIGH)

저장 API·DB 길이 제한이 아니라, **저장·다시 읽기 때마다** 아래가 한글 줄을 지운다.

`persistSections` → `ensureCancellationPolicyPlaceholderInSections` → `isLineCoveredByCancellationPolicyToken`

살아남는 예 (사용자 제보와 동일):

- `-----예약금 없이 예약시 위약사항----`
- `{{cancellationPolicy}}`
- `-----예약금 입금시 위약사항-----`
- `예약일 7일 이내 취소 시 예약금반환이 가능합니다` (`14일` 예외와 비슷한 예약금 문장, 위약 정규식 비매칭)

지워지는 예 (이후 줄로 흔히 쓰는 문장):

| 줄 | 매칭 |
|----|------|
| `당일 취소 시 위약금 50%` | `^(당일\|전일\|\d+일 전).+위약금` |
| `고객님 사정으로 … 위약금 … 적용됩니다` | startsWith + 위약금 |
| `… 취소 또는 변경이 불가합니다.` | 끝부분 정규식 |
| `… 취소 또는 변경 시 예약금은 반환되지 않습니다.` | 끝부분 정규식 |

의도는 **코드와 겹치는 옛 한글 위약만** 빼는 것이었으나, 예약금 구역에 새로 쓰는 문장까지 잡아 낸다.

서버 GET `/public-guide`·클라 로드도 같은 `ensure`를 타서, 한 번 저장되면 **다시 열어도 복구 불가**.

## 브랜드별 (현재)

| 내용 | 동작 |
|------|------|
| 위약 구간(전일·당일 % 등) | **됨** — `OperatingCompany.config.cancellationPolicy` → `{{cancellationPolicy}}` |
| 발주서 동의 모달 | **됨** — `OrderFormGuideAgreeModal`이 `brandSlug` 전달 |
| `/info` 단독 페이지 | **기본 브랜드만** — `getPublicOrderGuide()`에 브랜드 없음 |
| 예약금 헤더·7일 반환·추가 문장 | **안 됨** — 업체 공통 `infoContent` 한 벌 |
| 고객링크 메시지 | 브랜드별 있음 (`OrderFormBrandCustomerLinkConfig`). 안내사항과 별개 |

## 권장 수정 (구현 전 승인)

1. **P0** 필터를 좁힘: 토큰·기본 템플릿 2문장만 제거. `불가합니다`/`반환되지 않습니다` 광역 정규식 폐기.
2. **P1** `/info`에 Host·`?brand=` 전달 (모달과 동일).
3. **P2** 취소·변경 **추가 문구만** 브랜드 덮어쓰기. 다른 섹션은 공통 유지. 저장은 `OperatingCompany.config` JSON (마이그레이션 없이 가능) 또는 고객링크와 같은 브랜드 설정 테이블.

## 검증
- 구현 후 `verify-order-guide-cancellation.ts`에 「예약금 입금 후 … 반환되지 않습니다」가 **남아야** 하는 케이스 추가.
- `cd client; npx tsc -b --noEmit` / `cd server; npx tsc --noEmit` — 플랜 단계 미실행.
