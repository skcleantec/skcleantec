# CodeGuardian — 마법사 하위 항목

- 선택지 UI: `OrderFormDraftOptionsEditor.tsx`
- 칸 카드: `OrderFormWizardCustomFieldCard.tsx`
- 양식 편집 페이지도 같은 편집기 재사용
- 저장은 기존 `saveOrderFormTemplateFields` + `draftsToPayload` (options 포함)
- 새 API·Prisma 없음
