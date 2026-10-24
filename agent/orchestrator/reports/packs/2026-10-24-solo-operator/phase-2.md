# Phase 2 — 가계부 메인 메뉴 (1인)

여기서 멈춘다. Phase 3 잠금 메뉴는 하지 않았다.

## AppScout

캐시노트·이지샵은 장부를 앞에 두고, 월 손익 아래 날짜별 수입·비용 줄을 보여 준다. 이지샵은 하단 「장부」에서 일자별·월별 요약을 연다.
편한가계부 하단은 가계부·통계·자산·설정이다. 1인 사장은 돈 화면을 홈 옆 고정 탭에 둔다.
청소비서는 팀장 가계부(월 합계 → 기간 → 접수 연결 줄)를 재사용하고, 1인 관리자 휴대폰 하단은 접수·스케줄·가계부·메시지로 둔다.

## 구현

- 서버: 가계부 API는 팀장 또는 1인 ADMIN 본인(`teamLeaderId` = 그 userId)만. 그 외 403.
- 자동 기입: 1인은 배정 대신 `resolveFieldOwnerIds`. 금액을 고치면 기존처럼 `amountLocked`.
- 화면: `/admin/my-ledger`가 `TeamHouseholdLedgerPage`를 재사용. 복제 없음. 불러오기 버튼 글자는 「내 접수 불러오기」.
- 1인 GNB에 가계부. 왼쪽에서 월정산표·팀장 가계부 조회를 뺀다. 본사는 그대로.
- 휴대폰 하단 탭은 1인 ADMIN만.

## DesignPulse

팀 하단 독 스타일을 재사용. 탭 4개, 글자는 `text-fluid-2xs`, 터치 높이는 최소 36px. 360px 실기기 겹침은 배포 후 확인. 이번 세션에서 브라우저로 열지는 않았다.

## ConfigCurator

가계부 메뉴는 배정이 꺼진 업체 ADMIN에게만. 기능 목록이 오기 전에는 숨긴다. 본사에 가계부 GNB가 잠깐 보이지 않게 했다.

## MarketingAgency

`CATALOG.md`, `menus/admin.md`, `catalog.json`, `CHANGELOG.md`에 1인 가계부 경로와 slate-900 `#0f172a`를 적었다.

## RoleQA

| 경우 | 기대 |
|---|---|
| 본사 팀장 `/team/household-ledger` | 역할 가드가 팀장을 그대로 통과 |
| 본사 관리자 팀장 가계부 조회 | admin 라우트 미변경 |
| 본사 관리자가 `/admin/my-ledger` | 대시보드로 이동, API는 403 |
| 1인 관리자 | GNB·하단 가계부, 본인 userId로 기입 |
| 접수 수정 후 | 기존 `queueHouseholdLedgerInquirySync`가 1인 사장에게도 prefill |

## 관문

tsc 통과. 스테이징 화면 클릭은 이 작업이 푸시된 뒤에 한다. 푸시는 하지 않았다.
