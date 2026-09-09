# CodeGuardian — 38 openNavi 데드엔드

## 원인
`canUseNativeStaffNavi()`가 true면 `openNavi`만 호출하고 return. R8/미구현/Intent 실패 시 폴백 없음.

## 수정
- 웹: intent:// `openExternalUrl` + 800ms 후 https
- ProGuard: CbiseoAppBridge·StaffNaviLauncher keep (다음 AAB)
- 네이티브: 패키지 없이 재시도, 지도 https

## 검증
- client `npx tsc -b --noEmit` 통과
- 실기 WebView는 이 PC에서 불가
