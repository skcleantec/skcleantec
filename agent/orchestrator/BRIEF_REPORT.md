# BRIEF — 팀장 C/S 처리완료 상태바 겹침

**한 줄:** 팀장 C/S 상세 헤더가 모바일 상태바(시계·안테나) 아래로 내려가 「처리완료」를 누를 수 있게 함. **main 푸시.**

- 원인: 팀 상세가 `100dvh` 풀스크린인데 상단 safe-area 없음. 앱 WebView는 `env(safe-area-inset-top)=0`.
- 수정: 오버레이 `modal-mobile-safe-overlay` + 최소 1.5rem / `--cbiseo-safe-area-top`. 패널은 flex fill.
- 앱: `--cbiseo-safe-area-top` 주입(다음 APK). 웹 CSS만으로도 기존 앱 즉시 여백.
- 점검: 접수 상세는 하단 시트라 동일 증상 없음. 관리자 C/S는 가운데 모달 유지.
