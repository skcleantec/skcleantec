# CodeGuardian — 작성 규칙 플랜

**일시:** 2026-09-04 16:50 KST

## 현재

- 면적: 발급 시 넣으면 `isOrderFormAreaLockedFromOrder`로 고객 잠금. **비우면 고객이 공급/전용을 고름** (최근 점검에서 기준 칩도 열림).
- 청소일: 발급마다 「고객 작성」 체크(`dateByCustomer`) — 업체 정책이 아님.
- 양식: `CUSTOMER` / `ADMIN_LOCKED` / `ADMIN_PREFILL` — 칸 모양이지 **발급 차단**이 아님.

## 권장 구현

1. `OrderFormConfig.issueFillPolicy` JSON (`tenantId` unique).
2. 키: `areaPyeong`(공급+전용+평수 한 세트), `preferredDate`, `address`, `roomCount`, …  
   값: `MARKETER_REQUIRED` | `CUSTOMER_OK`.
3. 기본: `areaPyeong = MARKETER_REQUIRED`, 나머지 `CUSTOMER_OK`.
4. `handleCreateAndPrefill` / 선저장: REQUIRED인데 비면 400 + 해당 칸으로 스크롤.
5. 고객 위저드: REQUIRED면 질문 숨김(값 있으면 읽기만). 레거시 링크에 면적 없으면 **고객이 추측 금지** — 제출 거부 + 「상담사에게 면적을 확인해 주세요」.
6. 단일 헬퍼: `issueFillPolicy.ts` (shared) — 클라 위저드·서버 발급 동일.
7. `AdminOrderFormPage` 탭 `fillPolicy` + URL `?tab=`.

## 금지

- 양식 fillMode만 바꾸고 발급을 안 막는 것.
- 페이지에 100줄+ 인라인 설정 표 — `components/admin/order-issue/IssueFillPolicyPanel.tsx`.
