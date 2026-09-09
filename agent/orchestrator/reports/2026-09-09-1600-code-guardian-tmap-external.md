# CodeGuardian — TMAP이 구글지도 WebView로 열리던 문제

## 원인
- 버튼 href·800ms 폴백이 Google Maps https
- `location.assign` 이 WebView 안에서 지도를 연다
- TMAP `referrer`가 `com.cbiseo.app` 이라 앱이 거부될 수 있음

## 수정
- `tmap://` / `kakaonavi://` + `openExternalUrl`만
- referrer `com.skt.Tmap`
- location.assign·지도 https 제거
- client tsc 통과
