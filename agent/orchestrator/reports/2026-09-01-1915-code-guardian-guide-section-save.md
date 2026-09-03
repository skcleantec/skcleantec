# CodeGuardian — 안내사항 중복·엔터·섹션 저장

**원인**

1. `updateItemsText`가 Enter로 생긴 빈 줄을 즉시 `filter` → 줄바꿈 불가
2. `{{cancellationPolicy}}` + 저장된 「전일 30%」 한글이 함께 펼쳐짐 → 2번
3. 저장 버튼이 페이지 하단 1개뿐

**수정**

- 편집 중 빈 줄 유지, 저장 시에만 정리
- 위약 코드와 겹치는 옛 한글(전일·당일 위약) 제거
- 고객 화면 동일 문장 중복 제거
- 섹션별 저장 (서버는 해당 칸만 갈아끼움)

**검증:** `npx tsx scripts/verify-order-guide-cancellation.ts` ok · client tsc ok
