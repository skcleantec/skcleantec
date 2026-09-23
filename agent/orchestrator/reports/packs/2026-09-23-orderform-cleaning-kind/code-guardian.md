# CodeGuardian — 발주서 청소 종류 (`feat/orderform-cleaning-kind`)

**Worktree:** `c:\skcleantec\.push-cleaning-kind`  
**Branch:** `feat/orderform-cleaning-kind` @ `5a5d608d` (origin/staging)  
**Date:** 2026-09-23  
**Scope:** uncommitted `git diff` + untracked cleaning-kind files (코드만; agent 리포트·마케팅 JSON은 동작 리뷰 제외)

**PUSH: no** — BLOCKER(테넌트 유출·인증·share)는 없음. **HIGH:** 서버가 템플릿과 무관하게 `cleaningKind`를 필수(400)로 걸어 **에어컨 등 기존 공개 제출 계약을 깨뜨림.** 게이트 전까지 staging 푸시 비권장.

---

## Files reviewed

### New
- `shared/orderFormCleaningKind.ts`
- `server/src/lib/orderFormCleaningKind.ts`
- `client/src/components/orderform/OrderFormCleaningKindPicker.tsx`
- `client/public/orderform/cleaning-kind/{move-in,move,handover,occupied,special}.jpg`

### Changed (feature)
- `client/src/api/orderform.ts`
- `client/src/pages/order/orderFormModel.types.ts`
- `client/src/pages/order/OrderFormPage.tsx` (+47 / 총 3482줄)
- `client/src/components/orderform/customer-wizard/OrderFormCustomerWizard.tsx`
- `client/src/components/orderform/customer-wizard/orderFormCustomerSteps.ts`
- `client/src/components/orderform/customer-wizard/validateCustomerStep.ts`
- `client/src/components/orderform/customer-wizard/steps/WelcomeAndInputSteps.tsx`
- `client/src/components/orderform/customer-wizard/steps/CompoundSteps.tsx`
- `client/src/components/orderform/orderFormSubmissionSnapshot.tsx`
- `client/src/components/orderform/OrderFormTemplateInfo.tsx`
- `server/src/modules/orderform/orderform.routes.ts` (`POST /submit/:token`)
- `server/src/modules/orderform/orderFormPrefill.ts`
- `server/src/modules/orderform/orderFormSubmissionEmail.snapshot.ts`
- `server/src/lib/orderFormListSnapshot.ts` + `shared/orderFormListSnapshot.ts`

### Related checked (not in diff)
- `orderFormListSnapshot.service.ts` — 목록 스냅샷은 **promoted 커스텀 필드만**. `cleaningKind`는 시스템 키가 아니라 목록 칸에 안 올라감(상세 「발주서 추가 정보」로만 보임).
- `orderFormPrefill.ts` overlay / `PREFILL_STANDARD_KEYS`
- `shared/orderFormServiceKind.ts` · `airconOrderFormTemplate.catalog.ts` — 에어컨 양식은 입주 전용 칸을 이미 제거함
- `assertPublicOrderFormAccess` + `submitTenantId = form.tenantId` 제출 경로
- 접수 상세 `OrderFormCustomAnswers` (스케줄·목록 공통 표시)
- `orderFormFillRules` — `cleaningKind` 키 없음

---

## Rules applied

- `project-standards` — 마무리 tsc, 모듈 분리, 공개 고객 UI
- `multitenant-safety` — 공개 토큰 → `form.tenantId`, slug/SUSPENDED, id-only mutate 신설 여부
- `client-page-modularization` — `OrderFormPage` 거대 파일 + 추출
- `public-customer-ui-design` / UI 가이드 §4
- `prisma-migrate-and-deploy` — 스키마 변경 없음(JSON 키만)
- `tenant-inquiry-share-status` — share/revoke 경로 미터치
- `inquiry-edit-dual-surface-sync` — 표시는 `OrderFormCustomAnswers` 한곳

---

## Checklist

| 항목 | 결과 |
|------|------|
| `tenantId` on tenant mutations | **통과.** 신규 Prisma 조회 없음. 제출은 기존 토큰 + `assertPublicOrderFormAccess` + `submitTenantId`. |
| Dual surfaces | **부분.** 손님 마법사 + 마케터 클래식 둘 다 피커. 접수 상세 라벨은 공통 컴포넌트. |
| URL persistence | 해당 없음(손님 마법사 단계는 원래 URL 없음). |
| SKCleantec 브랜딩 | 없음. |
| Page file growth | `OrderFormPage` +47줄, 피커는 추출. 레거시 3482줄에 래퍼 JSX는 잔류. |
| WS `notifyInboxRefresh` | 제출 알림 경로 미변경. |
| Share REVOKED | 미터치. |

---

## Findings

### BLOCKER

없음. 테넌트 교차 조회·DEFAULT 폴백·인증 우회 없음. `cleaningKind`는 `parseOrderFormCleaningKind` 허용 집합만 `customerAnswers`에 기록.

### HIGH

1. **모든 공개 제출에 청소 종류 필수 — 에어컨(및 비입주) 양식 회귀**  
   `orderform.routes.ts` 제출은 `getPublicTemplateForForm` **이전**에 `if (!cleaningKind) 400`을 건다. 마법사 welcome·클래식 피커도 템플릿/`isAirconOrderFormTemplate`/`isStdFieldOn` 게이트가 없다.  
   **기존:** 에어컨 발주서는 입주 전용 칸을 빼고 기종·대수부터 받았다.  
   **이번:** 손님이 입주/이사/준공/거주/특수 중 하나를 고르지 않으면 제출 불가. 고르면 무관한 enum이 `customerAnswers`에 남는다.  
   **수정 방향:** `isAirconOrderFormTemplate(submitTemplate)` (또는 `isDefault`만 필수)일 때 검증·welcome·피커를 건너뛴다. 서버 체크는 `submitTemplate` 로드 뒤로 옮긴다.

### MEDIUM

2. **선입력은 enum 파싱 없이 아무 문자열이나 잠금**  
   `buildPrefillFromPayload`는 `cleaningKind`를 일반 문자열로 저장. 비어 있지 않으면 welcome이 숨겨지고, `parseOrderFormCleaningKind` 실패 시 손님은 고칠 수 없는데 서버는 400. UI 피커만 쓰면 재현 어려움. API/오타 시 막힘. `parseOrderFormCleaningKind`로만 prefill 저장할 것.

3. **클라·서버 동시 배포 필수**  
   예전 번들이 `cleaningKind` 없이 POST하면 400. 해시 에셋이면 보통 같이 갱신됨. 서버만 먼저 올리면 작성 중 링크가 깨진다.

4. **예약 키 `cleaningKind`와 템플릿 커스텀 필드 충돌**  
   sanitize 후 `customAnswers.cleaningKind`를 enum으로 덮어씀. 같은 `fieldKey` 커스텀 칸이 있으면 손님 답이 사라진다. 템플릿 저장 시 예약 키 거부가 없음.

5. **거대 페이지에 필드 래퍼 잔류**  
   피커 추출은 맞음. `OrderFormPage`에 라벨·확인·스크롤 래퍼 ~25줄이 남음. 레거시 3482줄 기준 허용선(+150 미만)이나, 룰은 신규 UI를 `components/orderform/`로 더 빼라고 함.

### LOW

6. **shared / `server/src/lib` 라벨 이중 정의** — `orderFormAcUnits` 패턴과 같음. 한쪽만 고치면 메일/목록 한글이 어긋남.  
7. **목록 promoted 스냅샷에 종류가 안 올라감** — 의도(커스텀 3칸 한도)로 보임. 상세·메일에는 한글 라벨.  
8. **클래식 `classicKindConfirmed`는 제출과 무관** — 손님 경로는 마법사. 폴백 클래식은 선택만 되면 제출 가능.  
9. **이미지 5장 합 ~602KB** — 배포 컨텍스트에 문제 없는 크기.

---

## Commands run

```
cd c:\skcleantec\.push-cleaning-kind\client
& "c:\skcleantec\client\node_modules\.bin\tsc.cmd" -b --noEmit
```

- **client tsc:** 성공 (exit 0)

```
cd c:\skcleantec\.push-cleaning-kind\server
tsc --noEmit
```

- **server tsc:** 실패. **이번 파일(`orderFormCleaningKind.ts` 등) 오류 없음.**  
  기존 Prisma 클라이언트 불일치: `intakeTemplateId`, `intakeCustomAnswers`, `industryPackId`, `optionLayout`, `issueFillRules`, `monthlyFreeUnlimited`, `LandingContactLink*`, `platformSupportThread` 등. worktree가 origin/staging 대비 코드는 새데 generate된 클라이언트는 구버전인 전형적인 junction.

`prisma generate` / `migrate deploy` — 스키마 변경 없음. 실행하지 않음.

---

## Balance

| 파일 | 줄 | 비고 |
|------|-----|------|
| `OrderFormPage.tsx` | 3482 | +47. 피커 추출됨. 추가 추출 권장. |
| `orderform.routes.ts` | 3617 | 제출 블록에 가드·스냅샷만. 신규 도메인 파일 분리 불필요. |
| `OrderFormCleaningKindPicker.tsx` | 90 | 적절. |
| `OrderFormCustomerWizard.tsx` | 354 | welcome CTA만. |

---

## Fixes applied

없음 (BLOCKER 없음).

---

## Verdict

- **테넌트/인증/share:** 안전. JSON enum, 마이그레이션 없음.  
- **기존 동작:** 기본 입주청소 마법사·선입력 잠금·상세/메일 한글은 일관.  
- **PUSH:** **no** — 에어컨(및 동등 비입주) 양식에 종류 필수(400) + 1페이지 강제. `isAirconOrderFormTemplate` 또는 default-only 게이트 후 재검토.  
- 게이트를 제품이 **모든 발주서에 강제**로 확정하면 HIGH를 수용하고 staging 가능. RoleQA 표에는 에어컨이 없음.
