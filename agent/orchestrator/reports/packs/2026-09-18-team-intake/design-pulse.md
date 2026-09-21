# DesignPulse — 팀장 발주서 칸

## Research notes
- 목록 카드 3줄 유지. 추가 칸은 `sky-50` 칩(`text-fluid-2xs`).
- 상세는 기존 「발주서 추가 정보」 섹션. compact는 `createPortal` 모달 안.

## PC
- 배정 표 구조 열: 양식에 있는 방/욕만 + 칩. 기본 입주청소는 예전과 같음.

## Mobile / Team
- 평수 배지는 양식에 면적이 있을 때만.
- 칩은 `TEAM_CHIP_SCROLL` 줄에 둠. 임의 `text-[10px]` 없음.

## Files touched
- `TeamInquiryIntakeAnswers.tsx`, 배정/스케줄/대시보드 카드, `teamInquiryShared` 상세
