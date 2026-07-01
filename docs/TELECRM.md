# 텔레CRM (TeleCRM)

전화 상담 전용 3열 작업 화면입니다. PC 팝업 창(`?popup=1`)으로 GNB에서 엽니다.

## 활성화

1. **기능 모듈** — 플랫폼/테넌트에서 `mod_telecrm` ON
2. **권한** — 마케터 권한 `crm.view`(화면), `crm.settings`(설정 허브)
3. **접수 저장** — `inquiry.create` 필요

## 화면 구성

| 열 | 역할 |
|---|---|
| 좌 | 접수·고객 (신규/기존, lookup, 이력, 저장) |
| 중 | 상담 스크립트 (읽기 전용, `{고객명}` `{평수}` `{예상가}` 치환) |
| 우 | 가격 안내·평수 견적 |

## 설정

`/admin/crm/settings/scripts` · `…/pricing` · `…/general` — 별도 탭에서 CRUD.

## UX

- **초안 자동 저장** — 접수 입력은 `localStorage`에 저장됩니다. 창을 닫기 전 미저장 시 브라우저 경고가 뜰 수 있습니다. 저장 성공 시 초안은 삭제됩니다.
- **스크립트** — `Ctrl+1~5` 카테고리, `Ctrl+Shift+←→` 탭, 「스크립트 복사」 버튼
- **가격** — 항목 클릭 시 금액 클립보드 복사
- **기존 고객** — 연락처 lookup 후 이력 행 클릭 → `ScheduleInquiryDetailModal`로 접수 수정

## API

`/api/crm/*` — `server/src/modules/telecrm/`

## 배포·DB

스키마는 Prisma migrate로만 반영합니다. 공유 DB에 `db push` 금지.
