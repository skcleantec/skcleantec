# CodeGuardian — 길안내 WebView 오탐

## 범위
- `client/src/utils/staffFieldNavi.ts`
- `client/src/utils/cbiseoNativeApp.ts`
- `client/src/utils/staffAppUpdate.ts`
- `client/src/components/team/TeamNaviLaunchButton.tsx`
- `docs/CBISEO_ANDROID_APP.md` §3.3

## 점검
- [x] 네이티브 가드를 versionCode >= 38 로 변경 (typeof 금지)
- [x] 클릭 시 항상 launch 경로 — dest 없으면 return
- [x] navi-destination API는 tenantId + 담당 배정 유지 (이번 미변경)
- [x] `npx tsc -b --noEmit` (client) 통과
- [x] 페이지 파일 비대화 — 유틸만 수정
- [x] SK 브랜드 미노출

## 잔여
- 실기 WebView(폰 37) 터치는 이 PC에서 불가
- 카카오내비·TMAP 앱 직접 실행은 Play 38 설치 후
