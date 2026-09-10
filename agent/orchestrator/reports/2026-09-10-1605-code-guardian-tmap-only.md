# CodeGuardian — 길안내 TMAP만

## Files reviewed
- `client/src/components/team/TeamNaviLaunchButton.tsx`
- `client/src/utils/staffFieldNavi.ts`
- `apps/cbiseo-android/.../StaffNaviLauncher.kt`
- `server/src/modules/team/teamNavi.routes.ts`

## Related checked
- 관리 스케줄 카카오**맵** (`buildKakaoMapHttpsUrl`) — 길안내와 별개, 유지
- `POST /navi-destination` — `tenantId`+담당 가드 변경 없음
- `launchStaffFieldNavi` 호출처 — 버튼 1곳

## Rules
- 멀티테넌트: 좌표 API 기존 스코프 유지
- 페이지 비대화: 시트 JSX 제거로 버튼 파일 축소
- 브랜드: 사용자 문구는 TMAP/길안내만

## Findings
없음

## Commands
- `cd client; npx tsc -b --noEmit` — 통과
