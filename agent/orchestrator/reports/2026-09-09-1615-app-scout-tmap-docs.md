# AppScout — TMAP 길안내 호출 문서

## 추천 방법
1. `intent://route?referrer=com.skt.Tmap&goalx&goaly&goalname#Intent;scheme=tmap;category=BROWSABLE`
2. 패키지 `com.skt.tmap.ku` (구버전 `com.skt.skaf.l001mtm091`)
3. 구글지도·WebView 이동 금지

## 타 앱·문서
| 출처 | 형식 |
|------|------|
| TMAP 지원→Flutter | tmap://route?referrer=com.skt.Tmap&goalx&goaly&goalname |
| TMAP API TMapTapi | invokeRoute / rGoX rGoY rGoName |
| Android 실사용 | ACTION_VIEW + CATEGORY_BROWSABLE |
| TMAP API 사이트 | TMAPApp 길안내 = 앱 연동 (SDK) |
