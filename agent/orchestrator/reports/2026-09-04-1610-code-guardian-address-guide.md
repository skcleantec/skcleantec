# CodeGuardian — 상세주소 질문 · 안내 전 제출 잠금

**일시:** 2026-09-04 16:10 KST

## Files

- `orderFormFieldVisibility.ts` — `shouldShowCustomerAddressWizardStep`
- `orderFormCustomerSteps.ts` — 도로명만 잠기면 주소 스텝 유지
- `CompoundSteps.tsx` — 잠긴 도로명 표시 + 상세 입력
- `OrderFormCustomerWizard.tsx` — 미동의 시 제출 비활성
- `OrderFormPage.tsx` — 자동 제출 제거, 선입력 안내

## Findings

없음. 스텝 노출은 **prefill** 기준이라 상세를 적은 뒤에도 질문이 사라지지 않음.

## Commands

- `cd client; npx tsc -b --noEmit` 통과
- `node scripts/build-help-data.mjs` 통과
