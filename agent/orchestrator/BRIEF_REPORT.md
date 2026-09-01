# Maestro 브리프 — SK 스케줄 40평+ 캘린더 표시

**일시:** 2026-09-01  
**요청:** SK클린텍 테넌트만 — 스케줄 캘린더에 40평대 이상 접수가 있으면 원룸(태극기) 표시처럼 아이콘 노출, 해당 접수 **팀원 배정 완료** 시 사라짐.

## 완료

- **SK 전용 게이트:** 기존 `useSkCleantecOpsUi()` (`custom_skcleanteck_ops_ui` + slug `sk`/`skcleanteck`)
- **캘린더 셀:** `40` 배지 + `40평+` 라벨 + 미완 건수 (원룸 태극기 행 바로 아래)
- **표시 조건:** 당일 활성 일정 중 ≥40평 · 자사 일정(정보공유·파트너·타업체 이관 제외) · **팀원 배정 미완**
- **제거 조건:** 팀장 배정 + (팀장 단독 또는 `crewMemberCount`만큼 팀원 이름 입력 완료)
- **ConfigCurator:** `display-indicator-registry.json`에 `schedule.skLargeArea40` 등록

## 변경 파일

| 파일 | 내용 |
|------|------|
| `shared/custom/skcleantecOpsUi.ts` | `SK_LARGE_AREA_PYEONG_MIN`, `SK_LARGE_AREA_LABEL` |
| `client/src/utils/scheduleLargeAreaDisplay.ts` | 평수·배정 완료·캘린더 집계 |
| `client/src/utils/scheduleOneRoomDisplay.ts` | `scheduleItemCountsAsOwnInternalSchedule` 공통화 |
| `client/src/components/admin/SkCleantecScheduleLargeAreaIndicator.tsx` | 캘린더 UI |
| `client/src/pages/admin/AdminSchedulePage.tsx` | 캘린더·모바일 범례 연동 |

## 검증

- `cd client; npx tsc -b --noEmit` ✅

## 수동 확인 (SK 업체)

1. 스케줄 → 40평 이상 접수가 있는 날 → 캘린더 셀에 **40 / 40평+ / 건수** 표시
2. 해당 접수 상세에서 팀장·팀원 배정 저장 → 셀 아이콘 건수 감소·0이면 사라짐
3. 다른 테넌트(cbiseo 등)에서는 표시 없음

## 에이전트

| 역할 | 결과 |
|------|------|
| CodeGuardian | SK 게이트·원룸 패턴 재사용, diff 최소 |
| DesignPulse | 원룸 행과 동일 밀도·amber 구분 |
| ConfigCurator | 레지스트리 반영 |
| DbSentinel | DB 변경 없음 |
| RoleQA | SK 관리자 스케줄 시나리오 위 수동 체크 권장 |

**푸시:** 미요청 — `staging` 반영 필요 시 알려 주세요.
