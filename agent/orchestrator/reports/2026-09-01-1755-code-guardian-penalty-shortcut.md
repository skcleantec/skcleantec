# CodeGuardian — 위약 알림 단순화 · 바로가기

**일시:** 2026-09-01 17:55 KST

## 범위

- `client/src/constants/operatingCompanyNav.ts` (신규)
- `client/src/components/admin/AlimtalkScheduleD2SendHint.tsx` (신규)
- `OperatingCompanyCancellationPolicyFields.tsx`
- `AdminAlimtalkPage.tsx` · `AdminOperatingCompaniesPage.tsx`
- `shared/alimtalkTemplateHelp.ts`

## 룰

- URL `?tab=cancellation` — routing-url-persistence
- 알림톡 페이지에서 N일 전 블록을 컴포넌트로 추출 — page modularization
- 발송 시각·마감일 계산은 기존 shared (`computeFreeChangeDeadlineYmd`, offset null = 마감일 당일)
- 서버·Prisma 변경 없음
- `npx tsc -b --noEmit` (client) 통과

## 회귀

- 고급 N일 전 저장 경로 (`scheduleD2DaysBeforePenalty`) 유지
- 해피콜 18:00 FCM 미변경
- share REVOKED / mirror CANCELLED 무관
