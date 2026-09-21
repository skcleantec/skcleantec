# CodeGuardian — 발주서별 시간대

- tsc: client `npx tsc -b --noEmit` · server `npx tsc --noEmit` 통과
- Prisma 변경 없음
- 손님·선입력·제출: 양식 options → `buildTimeSlotOptionsForForm` / `isAllowedPreferredTimeValue`
- `POST /` 발급 생성은 시간대 화이트리스트를 원래도 안 검. 제출·선입력만 검(기존과 같음, 양식 기준으로 교체)
- 페이지 거대화: `OrderFormPage`에 옵션 해석만 추가. 신규 거대 JSX 없음
- 양면 동기화: 목록·스케줄 수정은 **둘 다** 전역 4칸(동일). 손님 화면과 어긋남
- 멀티테넌트: 기존 `getPublicTemplateForForm(tenantId, …)` 재사용
- 브랜딩·WS·share 상태: 해당 없음

## 남은 구멍

1. 접수 수정 UI가 양식 시간대를 안 읽음
2. 엑셀 임포트가 커스텀 칸을 모름
