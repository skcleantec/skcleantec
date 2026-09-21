# DesignPulse — 안내사항 스크롤 후 서명

## Research notes
AppScout: Autohost 스크롤 끝 서명, UX Patterns 패드+지우기, 건너뛰기 금지.

## PC
- 모달 `max-w-lg`, 스크롤 본문 + 하단 힌트만. 「모두 동의합니다」 제거.
- 서명칸 `h-44`, Primary `slate-900` 「서명으로 동의」.

## Mobile / Team
- 모달·`/info` `100dvh` 풀스크린, 본문 스크롤. 서명칸 `h-36`.
- `LineMdIcon pencil`. `text-fluid-*`. 터치 타깃 `min-h-11`.
- 날짜·시간대 안내는 서명 없음.

## Recommendations
1. 끝내지 않은 서명은 임시저장하지 않음 (반영됨).
2. 스테이징에서 손가락 서명·짧은 안내(즉시 패드 활성) 확인.

## Files touched
- `OrderFormGuideAgreeModal.tsx`, `OrderFormGuideSignatureBlock.tsx`, `OrderInfoPage.tsx`
