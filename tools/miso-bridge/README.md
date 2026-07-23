# 청소비서 미소 연동 (미소 브릿지)

마케터 PC에서 실행하는 **로컬 브릿지** — [숨고 브릿지](../soomgo-bridge/README.md)와 **별도 제품·별도 포트**로 동작합니다.

| 항목 | 숨고 브릿지 | 미소 브릿지 (예정) |
|------|-------------|-------------------|
| 대상 | 숨고 **웹** (Chrome) | 미소 **Android 앱** (에뮬/가상 Android) |
| 로컬 API | `http://127.0.0.1:17890` | `http://127.0.0.1:17891` (초안) |
| 설치명 | 청소비서 숨고 연동 | 청소비서 미소 연동 |
| 설정 폴더 | `%LOCALAPPDATA%\Cbiseo\SoomgoBridge` | `%LOCALAPPDATA%\Cbiseo\MisoBridge` |
| 텔레CRM UI | 숨고 연동 | 미소 연동 (추가 예정) |

## 미소 채널 특성

- **안심번호 없음** — 고객이 고용(매칭)하면 **실전화번호**가 노출됩니다.
- 숨고의 「안심번호 감시」에 대응하는 기능은 **「고용 후 연락처 추출·CRM 반영」** 입니다.
- 견적·예약(고용) **상태**까지 숨고 연동과 **유사한 수준**을 목표로 합니다.
- **가상 Android 에뮬:** 설치 시 **언어·키보드 모두 한국어** (로드맵 §필수 요건).

## 문서 (순서대로)

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | [docs/01-roadmap.md](./docs/01-roadmap.md) | 전체 단계·게이트·산출물 |
| 2 | [docs/02-poc-checklist.md](./docs/02-poc-checklist.md) | **사내 PC 1대** PoC 절차 |
| 3 | [docs/03-api-draft.md](./docs/03-api-draft.md) | 로컬 HTTP API 초안 (숨고 브릿지 대응) |
| 4 | [docs/04-data-schema.md](./docs/04-data-schema.md) | extract JSON · 텔레CRM 필드 매핑 |
| 5 | [docs/05-soomgo-parity.md](./docs/05-soomgo-parity.md) | 숨고 ↔ 미소 기능 대응표 |
| 6 | [docs/06-partner-inquiry.md](./docs/06-partner-inquiry.md) | (나중) 미소 공식 API·제휴 문의 초안 |
| — | [docs/07-android-studio-poc-setup.md](./docs/07-android-studio-poc-setup.md) | **PoC PC** Android Studio·AVD·adb·미소 설치 상세 |

## PoC 기록

PoC 진행 중 발견·스크린샷·앱 버전은 아래에 누적합니다.

- [avd-config.bat](./avd-config.bat) — AVD + locale (`ko-KR`)
- [run-emulator.bat](./run-emulator.bat) — 에뮬 실행 (한국어 자동)
- [install-miso-apk.bat](./install-miso-apk.bat) — APK → 에뮬 설치
- [export-apk-from-phone.bat](./export-apk-from-phone.bat) — 파트너 폰에서 APK 추출
- [poc/notes.md](./poc/notes.md) — 일지·이슈·앱/에뮬 버전
- [poc/screen-map.md](./poc/screen-map.md) — 화면 경로·UI 요소 (자동화 후보)

## 로컬 실행 (골격 v0.1)

1. Android Studio AVD 실행 — `run-emulator.bat` (또는 Device Manager)
2. 미소 파트너 앱 설치·로그인
3. 브릿지 기동 — **`run-bridge.bat`**
4. 확인 — 브라우저 또는 curl: `http://127.0.0.1:17891/status`

| API | 골격 단계 |
|-----|-----------|
| `GET /status` | **동작** — adb·미소 설치·포그라운드 등 |
| `POST /open-chats` | **동작** |
| `POST /extract` | **동작** |
| `POST /send-message` | **동작** |
| `POST /emulator/start` | 에뮬 detached 시작 (PoC용) |

상세 계약: [docs/03-api-draft.md](./docs/03-api-draft.md)

## 에뮬레이터 마우스가 안 먹을 때

**원인:** 브릿지 **자동화**(목록/추출/전송)는 `uiautomator dump`·adb 입력을 씁니다. 실행 중에는 에뮬 **마우스·터치가 잠시 막히는 것이 정상**입니다.  
텔레CRM **미소 연동 바**가 켜져 있으면 예전에는 4초마다 무거운 `/status` 조회(`dumpsys`)가 겹쳐 더 답답해질 수 있었습니다.

**조치 (v0.2.3+):**

- 폴링은 **`GET /status?lite=1`** (12초 간격) — 에뮬에 거의 손대지 않음
- 자동화 직후 **`uiautomator` 프로세스 정리** — dump 후 마우스 복구
- 연동 바에 **「자동화 실행 중」** 안내 표시

**수동으로 에뮬 조작할 때:** 목록 열기·정보 가져오기·메시지 전송이 **끝난 뒤** 마우스를 쓰세요.  
그래도 안 되면 에뮬 **Cold Boot** (`run-emulator-cold.bat`) 또는 브릿지·텔레CRM 탭을 잠시 닫았다가 다시 여세요.

## 현재 상태

| 단계 | 상태 |
|------|------|
| 가이드·초안 | **진행 중** |
| 사내 PoC | **진행 중** (화면·추출 경로 확인됨) |
| 브릿지 골격 | **v0.1** (`server.py`, `automation/`) |
| 자동화 모션 | 미착수 (스텁) |
| 텔레CRM UI | 미착수 |
| Setup·매니페스트 | 미착수 |

## 참고 (저장소 내)

- 숨고 브릿지 구현: `tools/soomgo-bridge/`
- 텔레CRM API: `docs/TELECRM.md`, `docs/TELECRM_ANDROID_APP.md`
- 숨고 릴리스 규칙: `.cursor/rules/soomgo-bridge-auto-update.mdc`, `telecrm-android-release.mdc` (미소는 추후 동일 패턴 검토)
