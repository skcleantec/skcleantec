# CodeGuardian — 주소창 「앱에서 열기」 칩

**일시:** 2026-09-06 09:35 KST

## 정밀 검사

| 경로 | 결과 |
|------|------|
| `client/index.html` | 매니페스트 링크 + `apple-mobile-web-app-capable=yes` → 크롬이 설치 가능 앱으로 인식 |
| `client/public/manifest.webmanifest` | `display: standalone` 이 칩의 직접 원인 |
| 서비스워커 | 없음 |
| `assetlinks.json` | 없음 — Play 앱 딥링크 칩이 아님 |
| 랜딩 `marketing/index.html` | 매니페스트 링크 없음. 같은 도메인이라 **이미 설치된 웹앱**이면 칩이 남음 |
| Play CTA | `PlayStoreStaffAppLink` — Android만, 올바른 경로 |

## 수정

- 매니페스트 `display: browser` (설치 불가)
- iOS/Android 웹앱 메타 제거
- `isStandalonePwa()` 유지 (예전에 깐 웹앱 safe-area)
- 서비스워커·스키마 없음

## 검증

TS 변경 없음. 배포 후 시크릿 창에서 칩이 없어야 함.
