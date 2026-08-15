# 숨고 연동 — CRM 「정보 갖고오기」 추출 장애 정리

> **대상:** 텔레CRM `POST /extract` → 숨고 Chrome **고객 요청 모달** 파싱  
> **해결 버전:** **v2.2.42** (2026-08-13)  
> **구현:** `tools/soomgo-bridge/automation/customer_request.py`, `selectors.py`, `chat_room.py`

---

## 1. 정상 동작 요약

「정보 갖고오기」는 **채팅 메시지가 아니라** 숨고 채팅방에서 **고객 요청 모달**을 연 뒤, 그 안의 Q&A를 읽어 CRM 접수란에 채웁니다.

### 흐름

1. 채팅방 헤더 **`button[aria-label*="프로필 보기"]`** (또는 「고객 요청 보기」 등 폴백) 클릭
2. BootstrapVue 모달 **`[id*="BV_modal_body"]`** 대기
3. **`li[data-name="request-item"]`** 목록에서 `question` / `answer` 추출
4. 모달 닫기 → (필요 시) 안심번호·전화상담 처리
5. 브릿지 `/extract` 응답 → CRM `handleSoomgoImport`

### 스크래핑 DOM (숨고 UI 기준 — 2026-08)

```
.modal-body
  └ .content-modal-body
      └ .request-view
          ├ [data-type="user"]     → h4 고객명, h6 대략 지역
          └ [data-type="request"]  → 「요청 상세」
              └ ul
                  └ li[data-name="request-item"]
                      ├ p[data-name="question"]
                      └ p[data-name="answer"]
```

### CRM 필드 매핑 (예)

| 모달 Q&A | CRM |
|----------|-----|
| 방/화/베 개수 | `roomCount`, `bathroomCount`, `balconyCount` |
| 공급면적 | `pyeong` |
| 지역을 선택해주세요 | `address` / `region` |
| 청소 희망일 = 「협의 가능해요」 | `preferredDate` **비움** (ISO 날짜 없음 — 정상) |
| 나머지 Q&A | `requestMemo` |

---

## 2. 못 가져왔던 이유 (누적 — 여러 겹)

한 가지 원인만이 아니라 **버전마다 다른 병목**이 겹쳤습니다.

### A. DOM 구조 불일치 (v2.2.36 이하)

| 실제 숨고 UI | 옛 코드 |
|--------------|---------|
| `li[data-name="request-item"]` + `p[data-name="question/answer"]` | `.row`, `.col` 레거시 행 파싱 |

→ 모달은 열렸어도 **`pairs=0`** → 평수 regex만 잡히거나, 채팅 메모 폴백으로 오염.

### B. 모달 열기 전략 (v2.2.39 이하)

| 실제 진입 | 옛 우선순위 |
|-----------|-------------|
| 헤더 **`프로필 보기`** 버튼 | 「고객 요청 보기」「전체보기」→ 이름 클릭 |

→ 잘못된 패널·사이드바가 열리거나, 모달 대기 실패.

### C. 「추출 성공 = 모달 열림」 순환 (v2.2.41)

- `open_request_modal` 성공 조건이 **`extract_request_modal()` 결과**에 묶여 있었음.
- 추출 JS가 한 번이라도 `null`이면 → **「모달 열기 실패」** → 빈 dict 반환 → CRM 「가져올 정보 없음」.

### D. **`visible()` 과도 조건** (v2.2.41)

- `li`, `requestRoot`에 `width/height ≥ 40px` 요구 → 일부 레이아웃에서 항목 스킵.

### E. 희망일·필터 혼선 (v2.2.38~39)

- 모달 전체 텍스트·채팅 타임스탬프에서 **무관한 ISO 날짜**를 희망일로 사용.
- `is_garbage_request_extract`가 **pairs=0 + region만** 있어도 전체 폐기.

### F. ⭐ **결정적 장애 — JS 문법 오류 (v2.2.41, 로그로 확인)**

트레이 로그:

```
ERROR extract_request_modal: javascript error: Invalid or unexpected token
WARNING open_request_modal failed; header=None
```

**원인:** `automation/selectors.py`의 `SOOMGO_DISPLAY_NAME_JS` 안 `SOOMGO_NAME_CAPTURE` 한 줄.

```javascript
// ❌ 작은따옴표 문자열 안에 ' 가 또 있어 문자열이 중간에 끊김
var SOOMGO_NAME_CAPTURE = '([...\\s\\-'.·]{1,11})';
//                              ↑ 여기서 문자열 종료 → `.·]` 가 Invalid token
```

이 문자열은 **모든 추출·헤더·모달 열기 스크립트 앞에 붙는 공통 prefix** (`SOOMGO_DISPLAY_NAME_JS + ...`) 이라,

- `extract_request_modal` **파싱 전 전체 실패**
- `get_header_customer_name` 실패 → **`header=None`**
- CRM에 **이름·평수·주소 전부 빈 값**

→ **DOM·숨고 UI 문제가 아니라, Selenium에 넘긴 JS가 컴파일조차 안 되던 상태.**

---

## 3. 디버깅 중 실수·교훈 (에이전트·개발자)

| 실수 | 교훈 |
|------|------|
| 숨고 UI DOM만 의심하고 **JS 문법 검증을 늦게 함** | 로그에 `Invalid or unexpected token`이면 **먼저 `node --check`로 스크립트 검증** |
| `.row` 파싱만 고치고 **실제 `request-item` 셀렉터를 1순위로 두지 않음** | DevTools로 **`data-name="request-item"`** 확인 후 코드와 **1:1 매칭** |
| `open_request_modal` 성공 = 추출 완료로 묶음 | **모달 DOM 존재**와 **파싱 성공**을 분리 |
| 채팅 메모·평수 regex 폴백 유지 | 요청 모달 실패 시 **채팅으로 메모 채우지 않음** (오염) |
| v2.2.37~41 릴리스만 반복, **로그의 JS error를 사용자 로그로 받기 전까지 F) 미발견** | 상담사 PC **트레이 로그 20줄**이 최우선 증거 |
| `SOOMGO_NAME_CAPTURE`의 `'.·` 문자 클래스 | JS **작은따옴표 문자열** 안에 `'` 넣을 때는 **큰따옴표로 감싸거나 `\'` 이스케이프** |
| `.modal-body.content-modal-body` 단일 클래스 가정 | 실제 DOM은 **형제/중첩** — `modal-body` 안의 `.content-modal-body` |

---

## 4. 잘 끌고오게 된 수정 (v2.2.37 → v2.2.42)

| 버전 | 내용 |
|------|------|
| **2.2.37** | `[data-type="request"]`·BV 모달 경로, 채팅 메모 폴백 제거 |
| **2.2.38** | 모달 준비 대기·폴링 강화, 조기 닫기 방지 |
| **2.2.39** | 희망일 request-only, garbage 필터 완화, 부분 추출 유지 |
| **2.2.40** | `li[data-name="request-item"]` 1순위, `프로필 보기` 버튼 1순위 |
| **2.2.41** | request-item 전역 탐색, `visible()` 완화, 모달 열림/추출 분리 *(JS bug로 현장 무력)* |
| **2.2.42** | ✅ **`SOOMGO_NAME_CAPTURE` JS 문법 수정** — **실제 복구 버전** |

### v2.2.42 핵심 패치

**파일:** `tools/soomgo-bridge/automation/selectors.py`

```javascript
// ✅ 큰따옴표로 감싸 문자열 중간 ' 파괴 방지
var SOOMGO_NAME_CAPTURE = "([\\uAC00-\\uD7A3A-Za-z\\u4E00-\\u9FFF][\\uAC00-\\uD7A3A-Za-z0-9\\u4E00-\\u9FFF\\s\\-'.·]{1,11})";
```

**검증 (릴리스·수정 후 필수):**

```powershell
cd tools\soomgo-bridge
python -c "from automation.selectors import SOOMGO_DISPLAY_NAME_JS; from automation.customer_request import _EXTRACT_BV_REQUEST_MODAL_JS; import subprocess,tempfile,os; p=os.path.join(tempfile.gettempdir(),'t.js'); open(p,'w',encoding='utf-8').write(_EXTRACT_BV_REQUEST_MODAL_JS); subprocess.run(['node','--check',p], check=True); print('OK')"
```

---

## 5. 재발 시 진단 체크리스트

### 1) 상담사 PC

- [ ] 트레이 버전 **≥ 2.2.42** (`manifest ok: ... v2.2.42`)
- [ ] Chrome **채팅방 URL** (`/pro/chats/{id}`) 에서 실행
- [ ] 「정보 갖고오기」 중 Chrome **건드리지 않음**

### 2) 트레이 로그 패턴

| 로그 | 의미 | 조치 |
|------|------|------|
| `Invalid or unexpected token` | **JS 문법** | `selectors.py` / `customer_request.py` → `node --check` |
| `open_request_modal failed; header=None` | 모달·헤더 모두 실패 | 채팅방 진입·프로필 버튼 DOM 변경 여부 |
| `extract_request_modal ok pairs=N` | 정상 | N≥2 기대 |
| `discarding request extract` | garbage 필터 | `soomgo_text_filters.py` |
| `숨고에서 가져올 정보가 없습니다` (CRM) | 브릿지 응답 빈 값 | 위 로그부터 역추적 |

### 3) 숨고 UI 변경 시

1. DevTools에서 **`li[data-name="request-item"]`** 존재 확인  
2. `customer_request.py` → `_EXTRACT_BV_REQUEST_MODAL_JS` 셀렉터 갱신  
3. 모달 열기 → `_OPEN_PROFILE_REQUEST_MODAL_JS` 우선  
4. **`node --check`** 후 semver bump · `.cursor/rules/soomgo-bridge-auto-update.mdc` 릴리스

### 4) CRM 쪽 (브릿지 정상인데 UI만 비어 보일 때)

- `summarizeSoomgoImport` — `filled` 0이면 브릿지 payload 문제  
- 「주소·희망일 등 추가」 접기 — 평수·방/화/베는 **펼쳐야** 보임  
- 희망일 「협의 가능해요」→ 날짜 필드 빈 값 **정상**

---

## 6. 관련 파일

| 역할 | 경로 |
|------|------|
| 모달 열기·파싱 | `tools/soomgo-bridge/automation/customer_request.py` |
| 공통 JS·닉네임 (`SOOMGO_NAME_CAPTURE`) | `tools/soomgo-bridge/automation/selectors.py` |
| `/extract` 조립 | `tools/soomgo-bridge/automation/chat_room.py` |
| 오염·garbage 필터 | `tools/soomgo-bridge/automation/soomgo_text_filters.py` |
| CRM import | `client/src/utils/crmSoomgoImport.ts`, `CrmPage.tsx` `handleSoomgoImport` |
| 릴리스 | `.cursor/rules/soomgo-bridge-auto-update.mdc` |

---

## 7. 한 줄 요약

**2026-08 장애:** 숨고 UI와 파서 불일치 + 모달/추출 로직 꼬임이 있었지만, **현장에서 「아무것도 안 옴」의 직접 원인은 `SOOMGO_NAME_CAPTURE` JS 문법 오류로 execute_script 전체가 죽은 것(v2.2.42 수정).**  
다음번에는 로그에 **`Invalid or unexpected token`** 이 보이면 DOM 전에 **JS 검증**부터 한다.
