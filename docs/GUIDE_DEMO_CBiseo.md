# cbiseo 가이드·데모 DB 시드

> **용도**: [cbiseo.com](https://cbiseo.com) 메인 데모 환경 — 가이드 캡처·시연  
> **테넌트**: SK클린텍 (`slug: skcleanteck`, 로그인 업체코드 `sk`)  
> **태그**: `[가이드데모 cbiseo]` — 재실행 시 태그 건만 purge 후 재생성

---

## 실행

```powershell
cd c:\skcleantec\server
$env:SEED_GUIDE_DEMO="1"
npm run db:seed:guide-demo-cbiseo
```

| 옵션 | 설명 |
|------|------|
| `--purge-only` | 태그 데이터만 삭제 |
| `--phase=admin` | 관리자 (Phase 1) |
| `--phase=team` | 팀장 도움말 20건 + 확장 12건 |
| `--phase=crew` | 크루 그룹·현장 일정 |
| `--phase=cs` | C/S 6건 |
| `--phase=marketplace` | 정보공유 DB 마켓 5건 |
| `--phase=external` | 타업체·정산 샘플 |
| `--phase=public` | 공개 발주서 URL 2건 |
| `--phase=all` | 위 전체 (기본) |
| `--phase=external,marketplace` | 콤마로 여러 phase 지정 가능 |

원격 DB에서 `all` 한 번에 실행 시 트랜잭션 타임아웃(P2028)이 날 수 있습니다. 그때는 phase를 나눠 실행하세요.

```powershell
npm run db:seed:guide-demo-cbiseo -- --phase=admin
npm run db:seed:guide-demo-cbiseo -- --phase=team
npm run db:seed:guide-demo-cbiseo -- --phase=external,marketplace,crew,cs,public
```

환경 변수:

| 변수 | 설명 |
|------|------|
| `SEED_GUIDE_DEMO=1` | 실행 확인 (없어도 동작하나 경고 출력) |
| `SEED_CBiseo_PASSWORD` | cbiseo 팀장 비밀번호 (기본 `1234`) |

---

## 계정

| 역할 | 로그인 ID | 비고 |
|------|-----------|------|
| 관리자 | `admin` | `/admin/*` |
| 팀장(데모) | `cbiseo` | `/team/*` |
| 마케터 | `marketer@skcleanteck.com` | 집계 drill-down |
| 팀장 | `team1@skcleanteck.com` … `team3` | 다중 배정 데모 |
| 크루 | `guide-crew` | `/crew/*` (cbiseo 팀원 명단 연동) |
| 타업체 | `guide-external@demo` | EXTERNAL_PARTNER |

업체 코드: **`sk`** · 기본 비밀번호: **`1234`**

---

## Phase 1 시나리오 ↔ 화면

### A1 — 미제출 pin (`ORDER_FORM_PENDING`)

| 코드 | 고객명 | 확인 화면 |
|------|--------|-----------|
| A1-01 | 윤미제출 | `/admin/inquiries` — 당일 필터·최상단 pin |
| A1-02 | 장미제출 | 어제 발급·필터 밖에도 pin |
| A1-03~05 | 임/한/오미제출 | 발주서 미제출 다양화 |

### A2 — 예약완료 + 접수일/예약일

| 코드 | 고객명 | 포인트 |
|------|--------|--------|
| A2-01 | 김예약 | 접수 오늘 · 예약 내일 |
| A2-02 | 이예약 | 접수 어제 · 예약 오늘 |
| A2-04 | 정고양 | **경기 고양** — 대시보드 지역 |
| A2-06 | 강부산 | 부산 지역 분포 |

**화면**: `/admin/inquiries`, `/admin/dashboard` (지역·접수일/예약일 토글)

### A3 — 마케터 집계

| 코드 | 고객명 | 포인트 |
|------|--------|--------|
| A3-01, A3-08 | 홍집계, 송집계 | **오늘** 접수 |
| A3-02~07 | 서/신/유/권/황/안집계 | 이번 달 · `marketer@` 귀속 |

**화면**: `/admin/inquiries` 상단 마케터 표 → 숫자 클릭 drill-down

### A4 — 미분배

| 코드 | 고객명 | 포인트 |
|------|--------|--------|
| A4-01~04 | 노/류/배/표미분배 | RECEIVED · 팀장 배정 없음 |

**화면**: `/admin/dashboard` 이번달 미분배, `/admin/schedule`

### A5 — 다중 배정 / 타업체 수수료

| 코드 | 고객명 | 포인트 |
|------|--------|--------|
| A5-01 | 양팀장 | cbiseo + team1 |
| A5-02 | 구팀장 | team2 + team3 |
| A5-03 | 타업체 | `externalTransferFee` 8만 |
| A5-04 | 최배정 | cbiseo 단독 |

**화면**: 접수 수정 · 스케줄 · 정산 필드

### A6 — 변경이력

| 코드 | 고객명 |
|------|--------|
| A6-01~03 | 변경일정 / 변경금액 / 변경복합 |

**화면**: 접수 상세 → 변경이력 탭

### A7 — 부재·보류 (follow-up)

| 코드 | 고객명 | 상태 |
|------|--------|------|
| A7-01 | 부재고객 | ABSENT |
| A7-02 | 부재반복 | ABSENT (3회) |
| A7-03 | 보류고객 | ON_HOLD |
| A7-04 | 골드고객 | DEPOSIT_PENDING · 골드DB |

**화면**: `/admin/inquiries/followup`

### A8 — 발주서 제출

| 코드 | 고객명 | 토큰 |
|------|--------|------|
| A8-01~03 | 제출완료/제출미배/제출전문 | `guide_demo_of_10` … `12` |

**화면**: `/admin/inquiries/order-forms`, 고객 `/order/:token`

---

## Phase 2 — 팀장·크루

### 팀장 도움말 (20건) — 태그 `[팀장도움말 cbiseo]`

cbiseo 팀장 계정 + 오늘/내일/완료/취소/C/S/검수/해피콜 등 기존 시나리오.

### 팀장 확장 (12건) — 태그 `[가이드데모 cbiseo 팀장]`

| 코드 | 고객명 | 포인트 |
|------|--------|--------|
| B-01 | 해피콜초과 | 마감 초과(예약 오늘·미완료) |
| B-02 | 해피콜전 | 마감 전 |
| B-03 | 추가결재 | extraCharges 2건 |
| B-04~05 | 전사진만 / 전후완료 | 청소 전·후 사진 |
| B-06~07 | 검수중 / 검수완료 | 검수 체크리스트 |
| B-08 | 이중배정 | cbiseo + team1 |
| B-09 | 크루없음 | noCrew |
| B-10 | 변경알림 | 변경이력 |

**화면**: `/team/assignments`, `/team/dashboard`, `/team/schedule`

### 크루 (C1~C2)

| 로그인 | 화면 |
|--------|------|
| `guide-crew` / `1234` | `/crew/schedule` — 오늘 **크루현장1·2** |

---

## Phase 3 — C/S·마켓·타업체

### C/S (A10) — `/admin/inquiries/cs`

| 코드 | 고객명 | 상태 |
|------|--------|------|
| A10-01, A10-05, A10-06 | CS접수/신규/긴급 | RECEIVED / CS_PROCESSING |
| A10-03, A10-04 | CS완료/별점3 | DONE |

### 정보공유 DB 마켓 (A11) — `/admin/inquiries/db-marketplace`

| 코드 | 상태 |
|------|------|
| M-01 | DRAFT (장바구니) |
| M-02, M-03 | OPEN · 만료 임박 |
| M-04 | OPEN · 검토 예약 |
| M-05 | PENDING_SELLER |

### 타업체 (A12)

| 항목 | 값 |
|------|-----|
| 업체 | 가이드데모 협력청소 |
| 파트너 로그인 | `guide-external@demo` |
| 접수 | 타업체진행 / 타업체완료 |

**화면**: `/admin/team-leaders/external-companies`, 타업체 정산

---

## Phase 5 — 공개 URL

| 라벨 | URL |
|------|-----|
| 발주서 작성 중 | `https://cbiseo.com/order/guide_demo_of_pub_01?tenant=sk` |
| 발주서 제출 완료 | `https://cbiseo.com/order/guide_demo_of_pub_02?tenant=sk` |

---

## Phase 4 — Premium (광고·급여·전자계약)

`--phase=premium` (또는 `all`에 포함). **cbiseo 팀장·팀원**이 있어야 하므로 `team` phase 선행을 권장합니다.

| 시나리오 | 내용 |
|----------|------|
| A14 광고비 | 마케터 2회·관리자 1회 **종료 세션** + 채널별 지출 4줄 |
| A15 급여 | cbiseo 팀원 **민수·지현** 이번 달 정산 + **marketer@** 월급 정산 |
| A16 전자계약 | 팀원 대상 발급 3건 — **PENDING / OPENED / SIGNED** |

실행 시 **`mod_advertising` · `mod_payroll` · `mod_e_contract`** 자동 ON.

| 라벨 | URL |
|------|-----|
| 전자계약 · 서명 대기 | `https://cbiseo.com/e-contract/sign/guide_demo_ec_01?tenant=sk` |
| 전자계약 · 열람 완료 | `https://cbiseo.com/e-contract/sign/guide_demo_ec_02?tenant=sk` |
| 전자계약 · 체결 완료 | `https://cbiseo.com/e-contract/sign/guide_demo_ec_03?tenant=sk` |

```bash
cd server
SEED_GUIDE_DEMO=1 npm run db:seed:guide-demo-cbiseo -- --phase=premium
```

---

## 팀장 Phase (요약)

`--phase=team` 시 도움말 20건 + 확장 12건을 purge 후 재생성합니다.

---

## 주의

1. **실데이터 memo에 `[가이드데모 cbiseo]` 사용 금지** — purge 대상입니다.
2. **KST 상대 날짜** — 분기마다 재시드 권장.
3. main(cbiseo.com) DB 실행 시 팀과 합의 후 진행.
4. **`mod_db_marketplace`** — marketplace phase 실행 시 자동 ON.

---

## 파일 구조

```
server/scripts/
  seed-guide-demo-cbiseo.ts
  seed-guide-demo-cbiseo.logic.ts
  seed-guide-demo-admin.logic.ts
  seed-guide-demo-team.logic.ts
  seed-guide-demo-crew.logic.ts
  seed-guide-demo-cs.logic.ts
  seed-guide-demo-marketplace.logic.ts
  seed-guide-demo-external.logic.ts
  seed-guide-demo-premium.logic.ts
  seed-guide-demo-public.logic.ts
  guide-demo/
    constants.ts, purge.ts, scenarios.admin.ts
```

---

## 검증 체크리스트

**Phase 1**
- [ ] admin — 미제출 pin, 마케터 집계, 대시보드 지역·미분배
- [ ] admin — 부재·보류, 발주서 제출

**Phase 2**
- [ ] cbiseo — 해피콜초과 배지, 추가결재, 검수·사진
- [ ] guide-crew — 오늘 현장 일정 2건

**Phase 3**
- [ ] C/S 목록 6건
- [ ] DB마켓 DRAFT/OPEN/PENDING
- [ ] 타업체 정산·guide-external@demo

**Phase 4**
- [ ] 광고비 — 마케터·관리자 종료 세션 + 채널 지출
- [ ] 급여 — 팀원·마케터 이번 달 정산
- [ ] 전자계약 — PENDING/OPENED/SIGNED + 공개 URL 3개

**Phase 5**
- [ ] 공개 발주서 URL 2개 고객 화면
