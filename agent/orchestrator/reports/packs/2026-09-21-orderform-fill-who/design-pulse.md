# DesignPulse — 발주서 발급 칸 표시

## Research notes
AppScout: 라벨 옆 비클릭 배지, 색+글자. 모바일 범례는 줄바꿈.

## PC
- 라벨과 배지 한 줄 `flex-wrap gap-1.5`
- 상태색 rose / amber / slate만

## Mobile / Team
- 범례 `text-fluid-2xs` 한 줄 배너, 줄바꿈 허용
- 팀 화면 해당 없음

## Files touched
- `client/src/components/orderform/OrderFormIssueFillWho.tsx`
- `client/src/pages/order/OrderFormPage.tsx`
