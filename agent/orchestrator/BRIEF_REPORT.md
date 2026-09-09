# Maestro 요약 레포트

**일시:** 2026-09-09 16:15 KST **요청:** TMAP을 전혀 호출하지 않음, 문서 전부 조사 후 수정 **상태:** ✅

## 한 줄 결론
TMAP은 `tmap://`만내면 거절합니다. 지원/실사용 문서대로 **BROWSABLE Intent** + `referrer=com.skt.Tmap` + `goalx/goaly/goalname`으로 앱 밖에서 엽니다.

## 근거
- TMAP 지원(Flutter): `tmap://route?referrer=com.skt.Tmap&goalx&goaly&goalname`, 패키지 `com.skt.tmap.ku`
- TMAP API: `invokeRoute` / `rGoX`·`rGoY`·`rGoName`
- 실사용: Intent에 `CATEGORY_BROWSABLE` 없으면 ActivityNotFound

## 할 일
운영 배포 후 앱 완전 종료→재실행 후 TMAP 버튼. 네이티브 보강은 다음 Play 빌드에 포함, **이번 웹 intent는 38에서도 동작**.
