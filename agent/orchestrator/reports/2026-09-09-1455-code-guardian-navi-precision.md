# CodeGuardian — 길안내 v38

## 범위

웹 `staffFieldNavi` + `TeamNaviLaunchButton` · Android `StaffNaviLauncher`/`openNavi` · `POST …/navi-destination` · 매니페스트 폴백 38.

## 룰

- **tenantId:** `resolveTeamNaviDestination` — `inquiry.findFirst({ tenantId, assignments.teamLeaderId })`. id-only 없음.
- **FCM:** `com.google.firebase.MESSAGING_EVENT` 유지.
- **넓은 화면:** `resizeableActivity` + `supports-screens` 유지 (v37 회귀 금지).
- **모듈화:** 런처는 `navi/` 분리. 페이지에 시트 미추가.
- **tsc:** `client` `tsc -b --noEmit` 통과 · `server` `tsc --noEmit` 통과.

## 연관

좌표 API는 이미 원격(`544b37e`/`0b0e440`). 이번 커밋은 **브릿지+38+구앱 가드**.

## 위험

Railway `STAFF_APP_LATEST_VERSION_CODE=36`이 있으면 배포 후에도 공개 매니페스트가 36. 폴백만 38로 바꿔서는 안 바뀜.
