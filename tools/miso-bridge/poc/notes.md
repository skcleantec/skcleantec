# 미소 PoC 일지

**PC:** PoC PC  
**담당:**  
**기간:** 2026-07-23 ~  

---

## 환경

| 항목 | 값 |
|------|-----|
| 에뮬레이터 | Android Emulator (SDK) |
| AVD / 인스턴스명 | `Pixel_7_2` (Play Store) — `avd-config.bat` |
| System image | Google APIs PlayStore, API 37.1 |
| **실행 방법 (확정)** | `run-emulator.bat` — 한국어(ko-KR) 자동 |
| 미소 앱 버전 | **4.2603.4** (versionCode 442) |
| APK 출처 | Play Store |
| 미소 계정 | (PoC 전용, ID만 기록) |
| 패키지 | `com.miso.cleaner` / `MainActivity` |

### 에뮬 실행 (PoC PC)

Studio ▶ Run 대신 아래만 안정적으로 동작함 (2026-07-23 확인):

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_2 -gpu swiftshader_indirect
```

또는 `tools/miso-bridge/run-emulator.bat` 더블클릭.

- `-gpu swiftshader_indirect` — Windows에서 마우스 입력·`adb offline` 회피
- Cold boot: `-no-snapshot-load -no-boot-anim` 추가 가능
- 부팅 후 `adb devices` → **`device`** 확인 (30~90초)

---

## 일별 기록

### 2026-07-23

- **한 일:** 에뮬 부팅·한국어·Play Store → 미소 파트너 설치·로그인. adb UI 덤프로 화면 구조 1차 수집.
- **결과:** … **대화하기** = 숨고 채팅리스트와 동급. adb로 **목록·상세·send** 추출 가능 확인 (`probe_chat_ui.py`).
- **이슈:** … **고용 후 고객 실번호** 건 재테스트 필요. chatId 안정키 미확정. 구앱 종료 배너.
- **다음:** **헤더 박스 탭 → 요청 정보 scrape → ← 복귀** (`probe_extract_request.py`). 고용 후 **고객** 실번호·Phase B 전송.

---

## Phase A/B/C 체크

[../docs/02-poc-checklist.md](../docs/02-poc-checklist.md) 완료율:

- Phase A: / 
- Phase B: / 
- Phase C: / 

---

## PoC 종료 요약 (Go / No-Go)

**판정:**  

**구현 순서 (합의):** 골격 → CRM 연동 → scrape·모션 **하나씩**

1. 에뮬 + 앱 버전:
2. 쉬웠던 것:
3. 어려웠던 것:
4. 브릿지 v0 우선 API:
5. 공식 API 문의 필요:
