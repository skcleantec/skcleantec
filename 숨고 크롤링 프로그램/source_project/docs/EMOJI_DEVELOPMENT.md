# 이모지(통합) 기능 — 개발·수정 참고 가이드

> **목적:** 이모지·견적조회 통합 기능(기능 2+3)의 **메시지 전송·설정·빌드**를 수정할 때마다 이 문서를 기준으로 삼습니다.  
> **현재 안정 버전:** `1.0.22` (`source_project/version_info.py`의 `APP_VERSION`)

---

## 1. 한 줄 요약

| 항목 | 내용 |
|------|------|
| **무엇을 하나** | 채팅 목록에서 설정한 **이모지 문자**가 포함된 대화를 찾아, **이미지 + 텍스트**를 순서대로 전송 |
| **숨고 입력창** | React **contenteditable** (일반 `textarea` 아님) |
| **짧은 글** | JS `execCommand('insertText')` + `send_message()` (채팅 DOM 검증) |
| **긴·다줄 글** | **CDP** `Input.insertText` + 줄마다 **Shift+Enter** + `send_message_sequential()` |
| **절대 금지** | GUI(Tk) 실행 중 **Tk 클립보드** / Enter 단독으로 줄바꿈 |

---

## 2. 개발 환경

### 2.1 필수

| 항목 | 권장 |
|------|------|
| OS | Windows 10/11 |
| Python | 3.13.x (빌드 기준) / 3.12+ |
| 브라우저 | Google Chrome (최신) |
| 패키지 | `source_project/requirements.txt` — `selenium>=4.26`, `urllib3`, `requests`, `tzdata` |
| 빌드 | PyInstaller 6.x (`build_exe.ps1`) |

### 2.2 로컬 실행 (소스)

```powershell
cd source_project
pip install -r requirements.txt
python main.py
```

- Selenium 4.x는 ChromeDriver를 자동 관리합니다.
- **설정 파일:** `source_project/config.json` (소스 실행 시)

### 2.3 EXE 배포 구조

```
숨고 크롤링 프로그램/
├── SoomgoAutomation.exe      ← 실행 파일
├── _internal/                ← PyInstaller 번들
├── config.json               ← 실제 사용 설정 (GUI 저장·로드)
├── images/                   ← 이미지폴더1, 2, 3 …
│   ├── 1/
│   ├── 2/
│   └── ...
└── source_project/           ← 개발 소스
```

- **EXE 실행 시 `config.json` 경로:** `SoomgoAutomation.exe`와 **같은 폴더** (`config.py` → `_get_config_file()`)
- **이미지 경로:** EXE와 같은 폴더의 `images/` (`get_base_path()`)
- **빌드:** `source_project/build_exe.ps1`  
  - 기존 `config.json`은 `_internal` 백업 후 **복원** (덮어쓰지 않음)
  - 배포 전 **실행 중인 EXE 종료** 필수

### 2.4 버전 올리기

1. `source_project/version_info.py` → `APP_VERSION` 수정  
2. `source_project/build_exe.ps1` 실행  
3. 채팅에서 **짧은 글·긴 글·줄바꿈·이모지** 스모크 테스트

---

## 3. 설정 구조 (`config.json` → `combined`)

GUI: **통합 설정** 팝업 → 탭 **「이모지 조건」**

```json
{
  "combined": {
    "emoji_enabled": true,
    "emoji": "💕",
    "emoji_texts": {
      "텍스트1": "첫 번째 본문...\n두 번째 줄...",
      "텍스트2": "..."
    },
    "emoji_send_order": [
      "이미지폴더1",
      "이미지폴더2",
      "텍스트1",
      "텍스트2"
    ],
    "quote_enabled": true,
    "quote_texts": { "...": "..." },
    "quote_send_order": [ "..." ],
    "max_count": 100
  }
}
```

| 키 | 설명 |
|----|------|
| `emoji` | 채팅 **목록 미리보기**에 이 문자가 있으면 이모지 매칭 |
| `emoji_texts` | 키 `텍스트N` → 채팅방 안에서 보낼 본문 (`\n` = 줄바꿈) |
| `emoji_send_order` | `이미지폴더N` / `텍스트N` 순서 (GUI에서 드래그·동기화) |
| `max_count` | 한 사이클에 스캔할 채팅 **상위 N개** |

### 3.1 텍스트 작성 규칙

- **줄바꿈:** JSON에서 `\n` 사용 (GUI 텍스트 편집기에서 Enter)
- **마크다운 `**볼드**`:** 숨고 채팅에 표시되지 않음 → 전송 전 `normalize_message_for_send()`가 `**` 제거
- **빈 텍스트:** `텍스트N` 내용이 비어 있으면 **건너뜀** (로그: `내용 없음 — 건너뜀`)
- **같은 전화번호 여러 본문:** 허용 — 중복 판정에 **전화번호만** 쓰지 않음 (아래 §6)

### 3.2 이미지 폴더

- 경로: `{실행폴더}/images/{번호}/`
- 지원 확장자: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`
- `emoji_send_order`의 `이미지폴더3` → `images/3/` 안 파일을 **이름순** 업로드

---

## 4. 코드 지도 (수정 시 볼 파일)

| 역할 | 파일 |
|------|------|
| 통합 기능 진입·매칭·사이클 | `features/combined_feature.py` |
| 전송 순서·텍스트 정규화 | `features/content_sender.py` |
| **메시지 입력·CDP·전송** | `automation/chat_room.py` |
| 채팅 목록·이모지 검색 | `automation/chat_list.py` |
| 닉네임별 처리 기록(당일) | `automation/processed_tracker.py` |
| 설정 UI | `gui_widgets.py` (`CombinedSettingsDialog`) |
| 설정 로드/저장 | `config.py` |
| 버전 | `version_info.py` |

### 4.1 실행 흐름

```
CombinedFeature.run()
  → _collect_matching_chats()     # 목록 스캔, emoji in text
  → _process_collected_chats()
       → match_type == 'emoji'
            → _process_chat_content(emoji_texts, emoji_send_order)
                 → process_send_order()   # content_sender.py
                      → _send_order_text()  # 텍스트마다
                           → CDP 조건이면 send_message_sequential()
                           → 아니면 send_message()
```

---

## 5. 메시지 전송 전략 (핵심)

### 5.1 CDP 사용 조건 — `_should_use_cdp_input()`

`automation/chat_room.py`:

- **150자 이상** 이거나
- **줄바꿈(`\n`) 2개 이상** (3줄 이상)

→ `True`이면 CDP 경로 우선.

### 5.2 전송 함수 비교

| 함수 | 입력 방식 | 전송 후 검증 | 용도 |
|------|-----------|--------------|------|
| `send_message()` | JS / CDP / 붙여넣기 | **채팅 DOM** 말풍선 확인 | 짧은 글 |
| `send_message_sequential()` | **CDP** (긴 글) | 입력창 비움 + 대기만 | **이모지·재접촉 순차 전송** |
| `send_message_paste()` | PowerShell 클립보드 + Ctrl+V | 대기만 | 보조 (GUI와 충돌 주의) |

**이모지 순차 전송** (`content_sender._send_order_text`):

1. CDP 조건 → `send_message_sequential()` (최대 3회)
2. 실패 시 → `send_message()` 폴백

### 5.3 CDP 입력 상세 — `_input_message_via_cdp()`

1. 입력창 포커스 + Ctrl+A → Backspace 로 비우기  
2. `message.split('\n')` 으로 **줄 단위** 처리  
3. 각 줄: `Input.insertText` 로 텍스트 삽입  
4. 줄 사이: **`_composer_newline()` = Shift+Enter** (CDP `modifiers: 8`)  
5. 입력 길이 검증 (공백 제외 15% 이상)

### 5.4 줄바꿈 — 반드시 Shift+Enter

| 키 | 숨고 채팅 동작 |
|----|----------------|
| **Enter** | 메시지 **전송** (또는 전송 시도) |
| **Shift+Enter** | **줄바꿈** |

**회귀 이력 (v1.0.20):** 줄 사이에 Enter만 보내 → 글이 한 줄로 붙거나 중간 전송됨  
**수정 (v1.0.21):** `_composer_newline()` 에 Shift+Enter 적용

> 이모지·긴 본문 수정 후 **반드시** 채팅 UI에서 줄바꿈이 보이는지 확인할 것.

### 5.5 React contenteditable 함정

| 방식 | 문제 |
|------|------|
| `execCommand('insertText')` 만 | DOM은 채워지나 React state 미반영 → **전송 버튼 비활성** |
| Ctrl+V / 클립보드 (Tk `Tk()`) | **GUI(Tkinter)와 충돌** → v1.0.19 회귀 |
| CDP `Input.insertText` | 브라우저 입력 파이프라인 경유 → **전송 버튼 활성** |
| Enter로 줄바꿈 시도 | **전송**으로 처리됨 → Shift+Enter 사용 |

클립보드 복사가 필요할 때는 `_copy_text_to_clipboard()` — **PowerShell `Set-Clipboard`** (Tk 사용 안 함).

---

## 6. 중복 전송·스킵 로직

### 6.1 `send_message()` 진입 시

- `_message_already_sent()` → 최근 말풍선에 동일 본문 있으면 **스킵**

### 6.2 긴 글 중복 판정 — `_long_message_present_in_recent()`

- 최근 말풍선들의 **앞(head) + 뒤(tail)** 시그니처가 모두 있으면 “이미 전송”
- **연락처(010-…)만 같다고 스킵하지 않음** — 텍스트11·12·15처럼 같은 번호·다른 본문 연속 전송 허용

### 6.3 닉네임 처리 기록

- `ProcessedTracker`: **당일** 같은 닉네임은 재처리 안 함 (자정 리셋)
- 성공 후 `mark_processed(nickname, 'emoji')`

### 6.4 채팅 목록 매칭

- `has_emoji = emoji_enabled and emoji and emoji in text`  
- 목록 **미리보기 텍스트**에 설정 이모지가 포함되어야 수집됨

---

## 7. 로그로 상태 확인

| 로그 | 의미 |
|------|------|
| `텍스트N CDP 입력 방식 (10줄)` | CDP + Shift+Enter 경로 사용 |
| `[CDP 입력] 완료 (xxx자, 기준 yyy+)` | 입력창 반영 성공 |
| `[순차 전송] 전송 후 N초 대기` | 전송 클릭 후 대기 |
| `텍스트N 전송 완료` | 해당 항목 성공 |
| `CDP 순차 전송 실패 — 일반 방식 재시도` | CDP 실패 → `send_message` 폴백 |
| `[메시지 전송] 동일 본문이 이미 채팅에 있음 — 스킵` | 중복 스킵 |
| `내용 없음 — 건너뜀` | 빈 `텍스트N` |

---

## 8. 수정 체크리스트

이모지·전송 로직을 건드린 뒤:

- [ ] `version_info.py` 버전 bump
- [ ] **짧은 글** (1~2줄, ~50자): 정상 전송
- [ ] **긴 글** (150자+, 텍스트14·15급): CDP 로그 + **줄바꿈** 유지
- [ ] **이모지·한글·URL·전화번호** 포함 본문
- [ ] **같은 번호·다른 본문** 연속 전송 시 두 번째도 전송되는지
- [ ] **빈 텍스트**는 건너뛰는지
- [ ] GUI 실행 중 **클립보드/Tk 회귀** 없는지
- [ ] `build_exe.ps1` 후 EXE 종료 상태에서 배포
- [ ] `config.json` 덮어쓰지 않았는지

---

## 9. 자주 하는 실수 (회귀 방지)

| 실수 | 결과 |
|------|------|
| 줄바꿈에 Enter 사용 | 한 줄로 붙거나 중간 전송 |
| Tk 클립보드로 붙여넣기 | GUI와 충돌, 8~10번까지 전부 실패 |
| 전화번호만으로 “이미 전송” | 15번 등 후속 본문 미전송 |
| `max_attempts=1` + DOM 검증만 | 긴 글 “포기”처럼 보임 |
| `**마크다운**` 그대로 기대 | 채팅에 볼드 미표시 (제거됨) |
| EXE 켜 둔 채 빌드 | `Copy-Item` 실패 |

---

## 10. CDP / Shift+Enter 수정 시 참고 코드 위치

```
automation/chat_room.py
├── _should_use_cdp_input()      # CDP 분기 조건
├── _input_message_via_cdp()     # 줄 split + insertText + newline
├── _composer_newline()          # Shift+Enter (modifiers: 8)
├── send_message_sequential()    # 이모지·재접촉용
└── _long_message_present_in_recent()  # 중복 판정

features/content_sender.py
├── normalize_message_for_send() # ** 제거
├── _send_order_text()           # CDP vs send_message 분기
└── process_send_order()         # 이미지+텍스트 순서
```

### 10.1 Shift+Enter가 안 될 때 다음 시도 (미구현 시 검토)

1. ActionChains `Shift+Enter`만 사용 (CDP 대신)
2. `document.execCommand('insertParagraph')` JS 폴백
3. `\n\n` 단위로 **말풍선 여러 개**로 분할 전송 (줄바꿈 대신)

---

## 11. 견적조회와의 관계

- 같은 `CombinedFeature` / `process_send_order()` 공유
- 견적조회는 목록에 **시스템 문구**(견적 관련)로 매칭
- 이미지·텍스트 전송 로직은 **동일** — 이모지 쪽 수정 시 견적조회도 함께 영향

---

## 12. 관련 문서·파일

| 파일 | 설명 |
|------|------|
| `source_project/README.md` | 프로젝트 개요 |
| `source_project/build_exe.ps1` | EXE 빌드·배포 |
| `source_project/config.json.example` | 설정 예시 (민감 정보 없음) |
| `version_info.py` | `APP_VERSION` 단일 소스 |

---

## 13. 변경 이력 (메시지 전송)

| 버전 | 변경 |
|------|------|
| 1.0.18 | 전화번호 단독 스kip 제거, `send_message_direct` 등 |
| 1.0.19 | 클립보드 붙여넣기 회귀 (Tk 충돌) |
| 1.0.20 | CDP `Input.insertText` + Enter 줄바꿈 (문제) |
| **1.0.21** | **Shift+Enter 줄바꿈** |
| **1.0.22** | **재접촉·통합 중지 후 「이어하기」** (JSON 큐) |

---

## 14. 중지 후 이어하기 (v1.0.22+)

설정을 바꾼 뒤 남은 채팅만 이어서 처리합니다. 상세: **`docs/FEATURE_RESUME.md`**

| 단계 | 동작 |
|------|------|
| 중지 | 미처리 채팅 → `%LOCALAPPDATA%\Cbiseo\SoomgoAutomation\combined_queue.json` |
| 설정 저장 | GUI 저장 시 `config.json` 즉시 반영 (`persist_app_config`) |
| 이어하기 | **현재** `emoji_texts` / `emoji_send_order` / `images/` 적용 |

- 통합 기능: `ProcessedTracker`도 큐에 저장 — 같은 닉네임 중복 전송 방지
- 채팅 **한 건 처리 중** 중지 시, 이미 보낸 말풍선은 수동 정리 필요

---

*마지막 갱신: v1.0.22 기준. 이모지 전송·이어하기 로직 변경 시 이 문서와 `FEATURE_RESUME.md`를 함께 업데이트하세요.*
