# AppScout — 팀장 앱에서 카카오내비·TMAP이 안 열리는 문제

## 추천 방법
1. 웹 커스텀 스킴(`kakaonavi://`, `tmap://`, `intent://`)만으로 WebView에서 내비 앱을 열지 않는다.
2. 설치된 셸 버전이 네이티브 브릿지를 가질 때만 Intent로 연다.
3. 구 셸은 https 지도(카카오맵 길찾기 / Google Maps dest)로 연다.

## 타 앱 작동방식
| 앱·출처 | 최신 흐름 | 우리에게 쓸 점 |
|---------|-----------|----------------|
| 카카오 공식 | 웹 길안내 API 종료, 앱 Intent | 웹만으로 카카오내비 실행 불가 |
| Android WebView | 외부 http(s)는 브라우저/외부 앱 | `openExternalUrl` + shouldOverride |
| JS 브릿지 | 없는 메서드 typeof가 function인 경우 있음 | versionCode로 가드 |

## 모바일 인기 디자인 레퍼런스
| 순위 | 출처 | 왜 인기인가 | 가져올 패턴 |
|------|------|-------------|-------------|
| 1 | 카카오맵/네이버지도 공유 | 실서비스 길찾기 | 큰 터치, 앱 선택 후 바로 실행 |
| 2 | 배달·택시 앱 길안내 | 현장 이동 | 선호 앱 기억, 실패 시 지도 |

## 하지 말 것
- `typeof CbiseoApp.openNavi === 'function'` 으로 네이티브 여부 판단
- preventDefault 후 빈 호출로 href까지 막기

## DesignPulse / 구현에 넘길 한 줄
버튼 UI는 유지하고, 클릭은 versionCode 가드 + https 폴백만 고친다.
