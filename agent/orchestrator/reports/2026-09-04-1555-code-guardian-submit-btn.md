# CodeGuardian — 발주서 제출하기 클릭 불가

**일시:** 2026-09-04 15:55 KST

## Files reviewed

- `client/src/components/orderform/customer-wizard/OrderFormCustomerWizard.tsx`
- `client/src/components/orderform/OrderFormGuideAgreeModal.tsx`
- `client/src/pages/order/OrderFormPage.tsx`
- `client/src/components/orderform/customer-wizard/orderFormCustomerSteps.ts`
- `client/src/components/orderform/customer-wizard/customerStepTypes.ts`
- `client/src/components/orderform/customer-wizard/validateCustomerStep.ts` (guide = `guideTermsAt`)

## Related

- 마케터 선입력: 긴 폼 `type="submit"` + `disabled={submitting}` 만 — 이번 잠금과 무관
- 이중 화면(접수 수정) 해당 없음

## Findings

없음 (BLOCKER/HIGH 없음).

## Commands

- `cd client; npx tsc -b --noEmit` — 통과
