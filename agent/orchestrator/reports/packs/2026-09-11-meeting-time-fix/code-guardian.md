# CodeGuardian — 미팅시간 수정

**범위:** `crewFieldSchedule.service.ts` · `inquiryCrewLeaderAssignment.helpers.ts` · `inquiryCrewMemberMeetingTime.service.ts` · `team.routes.ts` · `TeamInquiryMeetingTimeBlock.tsx` · `teamInquiryShared.tsx` · `crewMeetingTime.ts`

## 반영
- 크루 일정: `tenantId` + `resolveCrewFieldMeetingForMember` (공용 / Assignment / 팀원별)
- 이름 매칭: `name` OR `nameTh` (where AND 유지, OR 덮어쓰기 금지)
- 오후: 칸 유지·비활성. 저장 API는 기존 오전·종일만
- 드래프트: `item.id` 리셋 + dirty/saving 아니면 서버값 동기화
- time input: `timeInputValueFromStored`
- 페이지에 JSX 100줄 이상 추가하지 않음 — 블록 분리

## 명령
- `cd client; npx tsc -b --noEmit` 통과
- `cd server; npx tsc --noEmit` 통과

## 유지
- `filterCrewNamesForLeader` — 다른 팀장 담당은 안 보여 줌 (안내만)
- 오후 PATCH 허용하지 않음
