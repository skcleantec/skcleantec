# CodeGuardian

파일: `OrderFormPage.tsx`, `orderFormPreferredTimeDetail.ts`

- 로더 deps에서 `createCrmSeed` 제거. 양식·대기접수 바뀔 때만 재로드.
- 시드 오버레이는 빈칸만. `preferredTime` / `preferredTimeDetail` 건드리지 않음.
- 재로드 시 이미 고른 시간대는 유지.
- 구체적 시각 표시는 `resolvePreferredTimeSlotForDetail`.
- `tenantId` 변경 없음. 페이지 줄 수 증가(오버레이 이펙트) — 추후 훅 추출 가능.
- `client` tsc `--noEmit` 통과.

BLOCKER/HIGH 없음.
