# 미소 브릿지 — 로드맵 (순차 진행)

코드 착수 전 **게이트**를 두고 단계별로 넘깁니다. 각 단계 산출물이 다음 단계 입력입니다.

---

## 개발 원칙 (구현 순서)

**정확한 scrape 필드·UI 셀렉터는 v0 이후에 하나씩** 잡는다. 순서는 아래를 따른다.

| 순서 | 목표 | 산출 |
|------|------|------|
| **1. 골격** | 로컬 브릿지 + 에뮬 기동 + HTTP 라우트 **껍데기** | `17891`, `/status`, stub `/extract` 등 |
| **2. CRM 연동** | 텔레CRM **미소 연동** 바 ↔ 브릿지 **연결만** (데이터는 mock·최소) | 상태 표시·버튼·lookup 계약 |
| **3. 모션 연결** | 실제 앱 자동화를 **한 동작씩** 붙임 | open-chats → extract → send → (고용 후) 연락처 … |

- Phase 1~2 PoC: **가능 여부·화면 경로**만 (지금 수준).
- Phase 3: **전부 완성**이 아니라 **골격 + `/status` 실동작** 우선.
- Phase 5: CRM UI **배선** 후, Phase 3b+에서 API 하나씩 **실구현**으로 교체.

숨고 브릿지와 동일: **포트·트레이·텔레CRM 버튼** 먼저, DOM/앱 scrape는 기능별 점진.

---

## 가상 Android 에뮬레이터 — 필수 요건 (전 Phase 공통)

상담원 PC에 깔리는 **가상 Android(에뮬)** 는 설치·첫 실행 후 **사용자가 언어/키보드를 따로 바꾸지 않아도** 아래가 모두 **한국어**여야 합니다.

| 항목 | 요구 | 검증 (PoC·배포) |
|------|------|------------------|
| **시스템 언어** | UI·설정·Play Store·미소 앱 표시 = **한국어(ko-KR)** | 설정 → 시스템 → 언어 |
| **키보드(입력)** | 채팅·검색 등 **한글 입력 가능** (가상 키보드·IME) | 미소 채팅 입력창에서 「안녕하세요」 입력 테스트 |
| **PC 키보드** | 에뮬 창 포커스 시 한글 타이핑 또는 **한국어 소프트 키보드** 노출 | `hw.keyboard=yes` + `show_ime_with_hard_keyboard` |
| **AVD 이미지** | **API 34** (또는 33) **Google Play**, **16 KB Page Size(ps16k) 금지** | `adb shell getconf PAGE_SIZE` → **4096** 권장 |

**구현 (PoC bat · Phase 4 Setup 동일 원칙):**

- AVD `config.ini`: `locale=ko-KR`, `hw.keyboard=yes`
- 에뮬 실행: `-prop persist.sys.locale=ko-KR` ([avd-config.bat](../avd-config.bat))
- 첫 부팅: [emulator-boot-helper.bat](../emulator-boot-helper.bat) — locale·키보드 확인/적용
- **배포본:** 한국어·한국어 IME가 반영된 **AVD 스냅샷** 포함 (상담원 수동 설정 금지)

상세: [07-android-studio-poc-setup.md](./07-android-studio-poc-setup.md) §한국어·키보드

---

## Phase 0 — 준비 (현재)

**목표:** 폴더·문서·역할 정리

- [x] `tools/miso-bridge/` 분리
- [x] 가이드·API·스키마 초안
- [ ] 사내 PoC용 PC 지정 (Windows, RAM 16GB+ 권장)
- [ ] 테스트용 **미소 사업자 계정** 1개 (PoC 전용)
- [ ] 가상 에뮬 **언어·키보드 한국어** 확인 (위 §필수 요건)

**게이트:** PoC 담당자·PC·계정이 정해졌는가? **에뮬 ko-KR + 한글 입력** 가능한가?

**다음:** [07-android-studio-poc-setup.md](./07-android-studio-poc-setup.md) 따라 Studio·AVD·미소 앱 설치

---

## Phase 1 — 사내 PoC (읽기)

**목표:** 에뮬 + 미소 앱에서 **수동·반자동**으로 데이터를 뽑을 수 있는지 확인

**할 일:** [02-poc-checklist.md](./02-poc-checklist.md) Phase A

**산출물:**

- `poc/notes.md` — 에뮬 종류·앱 버전·로그인 방식
- `poc/screen-map.md` — 목록 → 상세 → (고용 후) 연락처 경로
- 스크린샷 (민감 정보 마스킹)

**게이트 (Go/No-Go):**

- 가상 에뮬 **시스템 언어·키보드(IME) 한국어** (미소 채팅 한글 입력 1회)
- 채팅/문의 **목록** 10건 이상 안정적으로 확인
- **상세**에서 고객명·요청 요약·**상태(견적/고용/예약)** 텍스트 확인
- **고용된 건**에서 **실전화번호** 노출 위치·형식 확인
- 동일 시나리오 **3회 연속** 재현

**No-Go 시:** 에뮬/앱 버전 변경, 또는 공식 API 문의(06)로 전환 검토

---

## Phase 2 — 사내 PoC (쓰기)

**목표:** 채팅 전송 1통 + CRM에 넣을 JSON 형태 확정

**할 일:** [02-poc-checklist.md](./02-poc-checklist.md) Phase B·C

**산출물:**

- [04-data-schema.md](./04-data-schema.md) 실측값 반영·수정
- 샘플 extract JSON 1~2건 (가명)

**게이트:**

- 테스트 채팅 **전송 성공** (상대방/테스트 계정)
- extract 필드가 텔레CRM lookup에 **매핑 가능** (표 작성)

---

## Phase 3 — 브릿지 골격 (로컬 API)

**목표:** `127.0.0.1:17891` **서버·에뮬 런처·라우트 골격** (숨고 v0 1단계)

**1차 (골격):**

- Python(또는 동일 스택) HTTP 서버
- `GET /status` — 에뮬·미소 로그인·버전 (**실동작**)
- `POST /open-chats`, `/extract`, `/send-message` — **stub** (200 + mock JSON 또는 `NOT_IMPLEMENTED`)

**2차 이후 (모션 연결, CRM 연동 뒤):** PoC·screen-map 기준으로 **한 API씩** 실구현 교체

**게이트 (1차):** curl로 `/status` + stub 호출 성공. **전 시나리오 E2E는 3b 이후.**

---

## Phase 4 — 데스크톱 패키지

**목표:** 트레이 앱 + Setup (숨고 브릿지 패턴)

- `%LOCALAPPDATA%\Cbiseo\MisoBridge`
- 트레이 「청소비서 미소 연동」
- `GET /api/public/miso-bridge/manifest` (Railway 변수는 추후)
- **에뮬 한국어 기본:** AVD `locale=ko-KR`, `hw.keyboard=yes` + `emulator-boot-helper` (locale·IME)
- **배포 스냅샷:** 언어·키보드 **한국어 적용 완료** 상태로 동봉 — 상담원 수동 설정 **불필요**

**게이트:** 비개발 PC 1대에서 설치 → **한국어 UI·한글 입력** → 텔레CRM 없이 API 호출 성공

---

## Phase 5 — 텔레CRM 연동 UI

**목표:** 텔레CRM **미소 연동** 바 **배선** (숨고 연동과 병행, 충돌 없음)

**1차:** 브릿지 `/status` · stub `/extract` 호출 → UI에 상태·mock 데이터 표시 (lookup 계약 검증)

**2차:** 브릿지 모션이 붙을 때마다 버튼·필드 **실데이터**로 교체

- 정보 가져오기 → `/extract` (실구현 후)
- 채팅 보내기 → `/send-message`
- 연락처 → 고용 후 번호

**게이트 (1차):** 상담사 PC에서 미소 바 보임 + `/status` 연동. **(1차) 파일럿 1주**는 실모션 2개 이상 붙은 뒤.

---

## Phase 6 — (나중) 공식 채널

**목표:** [06-partner-inquiry.md](./06-partner-inquiry.md) 로 미소 B2B/API 가능성 확인

- API 있으면 Phase 3~5의 **앱 자동화 축소** 로드맵 별도 작성

---

## 타임라인 (대략, 담당·일정은 팀 조율)

| Phase | 기간 가이드 |
|-------|-------------|
| 0 | 1일 |
| 1 | 3~5일 |
| 2 | 2~3일 |
| 3 | 1~2주 |
| 4 | 1~2주 |
| 5 | 1~2주 |
| 6 | 병행 가능 (PoC 후) |

---

## 리스크 (상시)

| 리스크 | 대응 |
|--------|------|
| 미소 앱 업데이트로 UI 변경 | 앱 버전 고정·호환표·빠른 패치 |
| 에뮬 RAM/CPU | 최소 사양 가이드·경량 AVD |
| 에뮬 영어 UI·영문 키보드 | §필수 요건 — locale·IME·스냅샷 검증 |
| **16KB(ps16k) AVD / API 37** | **API 34 Google Play(일반)** AVD로 교체 — 미소 멈춤 다발 |
| 이용약관 | PoC 단계 기록 → 제휴/API 우선 |
| 숨고 브릿지와 동시 실행 | **포트·프로세스 분리** (이미 설계) |
