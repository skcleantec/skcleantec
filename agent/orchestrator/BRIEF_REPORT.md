# Maestro 요약 레포트

**일시:** 2026-09-09 16:40 **요청:** [티맵·카카오내비 글](https://hanarotg.tistory.com/365) 참조 **상태:** ✅ (웹 반영 대기)

## 한 줄 결론
글과 같은 Android TMAP URL을 **같은 창**에서 연다. `target="_blank"`가 WebView에서 클릭을 삼켜 TMAP·토스트가 둘 다 안 나왔다.

## 글에서 가져온 것
- `tmap://route?referrer=com.skt.Tmap&goalx=경도&goaly=위도&goalname=이름`
- queries: `com.skt.tmap.ku` · `com.skt.skaf.l001mtm091`
- 실패 시 Play `com.skt.tmap.ku`
- 카카오는 글의 SDK 대신 기존 `kakaonavi://` (앱키 없음)

## 확인
- 클라이언트 `tsc` 통과
- 폰 WebView는 이 PC에서 미검증
- 운영 반영은 `main` 푸시 + 앱 완전 종료 후 재실행
