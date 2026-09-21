# CodeGuardian — 발주서설정 한 화면

## 파일
- 신규: `order-form-settings/*`, `OrderFormTemplateEditorPanel`, `OrderFormTemplateFieldDraftList`
- 변경: `AdminOrderFormCustomerPreviewPage`, `AdminOrderFormTemplatesPage`(비작성은 미리보기로 이동), nav
- 서버·Prisma 없음

## 규칙
- 페이지 오케스트레이션: 미리보기 페이지는 섹션 조합만. 편집 UI는 컴포넌트.
- URL: `previewForm` + `guideForm` + `section` 유지. 옛 `panel=` 호환.
- tenant 쿼리 변경 없음.

## 결과
- client `tsc -b --noEmit` 통과
- BLOCKER/HIGH 없음
- MEDIUM: 양식 페이지에 목록/편집 JSX가 남아 있으나 `?new=1`이 아니면 Navigate로 안 그림. 이후 정리 가능.
