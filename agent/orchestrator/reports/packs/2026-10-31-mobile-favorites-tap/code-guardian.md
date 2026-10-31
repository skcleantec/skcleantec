# CodeGuardian — 모바일 즐겨찾기 탭

## 범위
- `client/src/components/layout/MobileNavFavoritesFab.tsx`
- `client/src/components/layout/NavFavoriteStar.tsx`
- `client/src/components/layout/mobileStaffDockStyles.ts`
- 관리·팀장 레이아웃은 같은 FAB 컴포넌트를 쓴다. 서버·DB 변경 없음.

## 점검
- 시트 시각은 `setState` 전에 찍는다. 예전 450ms 가드는 effect 안에서 찍혀, 같은 탭의 click보다 늦었다.
- 배경은 그 위에서 pointerdown이 시작된 뒤에만 닫는다. 키보드(detail 0)와 Escape·닫기는 그대로다.
- 오른쪽 FAB 공통 버튼은 `touch-none`이다. 스크롤이 짧은 탭의 click을 취소하지 않게 한다. 길게 눌러 옮기는 동작은 pointer 이벤트라 유지된다.
- 제목 옆 별은 터치 pointerup과 click이 한 번만 반영된다. 마우스는 click만 쓴다.
- 클라이언트 `tsc -p tsconfig.app.json --noEmit --incremental false` 통과.

## 회귀
- 발주서·스케줄·변경 이력 종 FAB도 같은 네모 히트 클래스를 쓴다. 탭이 스크롤에 먹히지 않는 쪽으로만 바뀐다.
- 즐겨찾기 색·문구·경로는 그대로다.
