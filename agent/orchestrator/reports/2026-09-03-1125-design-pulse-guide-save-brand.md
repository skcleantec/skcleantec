# DesignPulse — 안내사항 저장 · 브랜드별 취소·변경

## Research notes
- 설정 화면에서 **공통 기본 + 브랜드 덮어쓰기**는 고객링크 메시지(`AdminOrderFormCustomerLinkSettingsPage` 브랜드 셀렉트 + URL `?brand=`)와 같게 맞춘다.
- 공개 `/info`는 `docs/UI_DESIGN_GUIDE.md` §4. 관리 편집은 §6 슬레이트 카드.

## PC
- 안내사항 패널 상단: 브랜드 세그먼트(공통 / 브랜드A / 브랜드B). `bg-slate-900` 선택.
- **공통**: 지금처럼 전 섹션 편집.
- **브랜드**: 취소·변경 카드만 활성. 나머지 섹션은 읽기 전용 + 「공통 문구를 씁니다」.
- 미리보기: 선택한 브랜드 위약 구간 + 그 브랜드 추가 줄. 지금처럼 에메랄드 박스.
- 저장: 기존 「이 섹션 저장」. 브랜드 모드면 그 브랜드만 씀.

## Mobile / Team
- 세그먼트 `px-2 py-1 text-fluid-2xs`, `flex-nowrap overflow-x-auto`.
- textarea `useModalScrollKeyboardAvoidance` 또는 페이지면 `useLoginScrollSurface` (이미 풀페이지면 후자).
- 팀장 화면 아님. `/team` h1 중복 해당 없음.

## Recommendations
1. 저장 잘림 고친 뒤, 필터가 줄을 지우면 **저장 직후 토스트에 “위약 코드와 겹쳐 N줄을 빼었습니다”**를 띄우지 말고, 아예 빼지 않는 쪽으로 (P0).
2. 브랜드 셀렉트는 고객링크와 **같은 위치·같은 URL 키 `brand`**.
3. `/info` 미리보기 링크에 `?brand=` 붙여 관리자가 방금 고른 브랜드를 보게.

## Files touched (if any)
- 플랜만. 구현 시: `AdminOrderFormNoticePage.tsx`, `OrderGuideCancellationPreview.tsx`, `OrderInfoPage.tsx`
