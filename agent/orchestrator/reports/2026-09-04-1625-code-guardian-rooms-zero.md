# CodeGuardian — 공간 개수 0·빈 칸 수정

**일시:** 2026-09-04 16:25 KST

## Cause

- 위저드가 `roomCount`만 잠기면 방·화장실·베란다·주방 질문을 통째로 숨김
- 네 칸 모두 `lockKey('roomCount')`로 비활성
- `0`은 선입력으로 잠김 → 칸 없음 + 제출 검증 실패

## Fix

- `isOrderFormSpaceCountLocked`: 1 이상만 잠금
- `shouldShowCustomerRoomsWizardStep`: 0·빈 칸이 하나라도 있으면 질문 표시
- 칸별 잠금, `order-field-*` 스크롤
- 입주: 하나라도 잠기지 않으면 질문 유지

## Commands

- `npx tsc -b --noEmit` 통과
- `node scripts/build-help-data.mjs` 통과
