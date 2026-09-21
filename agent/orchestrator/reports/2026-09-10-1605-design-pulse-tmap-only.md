# DesignPulse — 길안내 TMAP만

## Research notes
- AppScout: 현장 앱은 내비 앱이 하나면 선택 시트 없이 바로 실행
- 기존 시트(카카오내비/TMAP)는 한 번 더 탭해야 해서 모바일 밀도에 불리

## Findings
- **PC:** 접수 상세 하단 `길안내` 한 버튼 유지. 시트 제거로 레이아웃 단순화
- **모바일·앱:** `min-h-11` 터치, `text-fluid-*`, `map-marker` 아이콘 유지. 풀스크린 시트 없음
- **카카오맵:** 관리 스케줄 위치 보기와 무관 — 유지

## Severity
없음

## Suggested / applied
- `TeamNaviLaunchButton` — 클릭 → 좌표 API → TMAP만
