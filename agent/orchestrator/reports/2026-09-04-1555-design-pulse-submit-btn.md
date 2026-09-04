# DesignPulse — 제출 바 레이아웃

**일시:** 2026-09-04 15:55 KST

- 루트: `h-dvh max-h-dvh overflow-hidden flex flex-col` — 짧은 폰에서 sticky 푸터가 버튼을 밀지 않음
- 헤더·푸터 `shrink-0`, 본문 `min-h-0 flex-1 overflow-y-auto`
- 안내 모달: 내용이 뷰보다 짧으면 즉시 동의 가능, 스크롤 끝 판정 여유 48px
- CTA 토큰 `WIZARD_CTA_CLS` 유지 (제출만 `disabled={submitting}`)
