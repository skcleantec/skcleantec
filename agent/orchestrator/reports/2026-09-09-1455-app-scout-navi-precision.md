# AppScout — 팀장 길안내 정밀점검

**일시:** 2026-09-09 14:55 KST  
**요청:** 메인·스테이징 푸시 여부 + 길안내 실패 원인 문서·테스트

## 타 앱 최신 작동방식

- **카카오내비(공식 Android):** `NaviClient.navigateIntent(Location, NaviOption(WGS84))`. **웹 길안내 종료** — 미설치 시 설치 페이지만. 스킴+패키지 Intent는 SDK와 동일 효과.
- **카카오내비 패키지:** `com.locnall.KimGiSa` (Play 확인).
- **TMAP:** Android `tmap://route?goalx=경도&goaly=위도&goalname=` + 패키지 `com.skt.tmap.ku`. (iOS 일부 글은 `rGoX` — 우리 앱은 Android만.)
- **배달·현장 앱 공통:** 시트에서 앱 고름 → 네이티브 Intent. WebView `intent://`만 쓰면 Chrome으로 넘어가거나 셸이 닫힌 것처럼 보임.

## 인기 모바일 UI

- 하단 시트 + 최근 사용 표시. 시스템 홈/뒤로와 겹치지 않게 **하단 여백**.
- 설치 없으면 지도 선택(`geo:`) 또는 스토어.

## CBISEO에 가져올 것

1. **네이티브 Intent만** (v38 `openNavi`). 구 앱은 폴백 대신 업데이트 안내.
2. 시트는 이미 `z-[130]` + safe-area — 유지.
3. Play 번호는 **올린 값보다 큰 수만** (37 다음 38).

## 라이브 대조

| 환경 | gitSha | 매니페스트 latest | navi API 무토큰 |
|------|--------|-------------------|-----------------|
| 운영 www.cbiseo.com | `544b37e` (main) | **36** (Railway 변수) | 401 (라우트 있음) |
| 스테이징 Railway | `0b0e440` (staging) | **36** | 401 |

**결론:** 원격에는 시트·좌표 API만 있고 `openNavi`/v38은 **아직 없음**. 웹만 배포돼도 폰 구 앱에서는 내비가 안 열림.
