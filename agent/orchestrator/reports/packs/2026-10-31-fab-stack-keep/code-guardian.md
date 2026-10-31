# CodeGuardian — 즐겨찾기 스택 유지

## 원인
`role=dialog` + `aria-modal` 시트가 `useBodyHasModalOverlay()`를 켜고, 관리·팀장 레이아웃이 FAB 스택을 언마운트했다. 시트 상태를 가진 `MobileNavFavoritesAccess`가 스택 안에 있어 시트가 같이 사라졌다. click은 없었다.

## 수정
- 스택은 `invisible pointer-events-none` + `aria-hidden`으로만 숨긴다.
- 즐겨찾기 시트·변경 이력 창에 `data-fab-sheet`. 모달 선택자는 `:not([data-fab-sheet])`.
- 같은 탭 배경 닫기만 400ms 무시. `backdropArmed`·시트 전체 `pointer-events-none`은 제거.
- 열림 상태는 스택 안에 유지. 시트는 기존처럼 `document.body` 포털.

## 확인
클라이언트 `tsc -p tsconfig.app.json --noEmit --incremental false` 통과.
