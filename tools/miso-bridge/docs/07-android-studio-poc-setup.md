# Android Studio — 미소 PoC 상세 가이드

**대상:** 사내 PoC PC 1대 (상담원 PC 아님)  
**목표:** 에뮬에서 미소 앱 실행 → 화면·데이터 경로 조사 → [02-poc-checklist.md](./02-poc-checklist.md) Phase A

상담원은 Android Studio를 **설치하지 않습니다**. 본 가이드는 **개발·PoC 전용**입니다.

---

## 0. PC 사전 조건

| 항목 | 권장 |
|------|------|
| OS | Windows 10/11 64bit |
| RAM | **16GB+** (에뮬에 4GB 할당) |
| 디스크 | 여유 **20GB+** (SDK·AVD) |
| CPU | 가상화 지원 (BIOS에서 VT-x/AMD-V ON) |

### Windows 가상화

1. **작업 관리자** → 성능 → CPU → **가상화: 사용** 확인  
2. Windows 기능: **Windows Hypervisor Platform**, **가상 머신 플랫폼** 켜기 (재부팅)  
3. Android Studio 첫 실행 시 **Android Emulator** 설치·HAXM/WHPX 안내 따르기

---

## 1. Android Studio 설치

1. https://developer.android.com/studio 에서 **Android Studio** 다운로드 (최신 stable)  
2. 설치 시 기본 옵션 유지:
   - Android Studio
   - **Android SDK**
   - **Android Virtual Device**
3. 설치 완료 후 실행 → **Standard** 설정 마법사  
4. SDK 다운로드 끝날 때까지 대기

### 추가 SDK 패키지 (SDK Manager)

**Android Studio** → **Settings** (또는 File → Settings) → **Languages & Frameworks** → **Android SDK**

**SDK Platforms** 탭:

- ☑ **Android 14.0 (API 34)** — 또는 **Android 13.0 (API 33)**  
  (PoC 전체를 하나로 고정; 33·34 중 **하나만** 선택)

**SDK Tools** 탭 — 아래 **Installed** 확인, 없으면 설치:

| 패키지 | 용도 |
|--------|------|
| Android SDK Build-Tools | 빌드 |
| Android SDK Platform-Tools | **adb** |
| Android Emulator | 에뮬 엔진 |
| Android SDK Command-line Tools (latest) | CLI·AVD |

**Apply** → 다운로드 완료.

---

## 2. AVD(가상 기기) 만들기

**Tools** → **Device Manager** (또는 Welcome 화면 **Virtual Device Manager**)

1. **Create Device**
2. **Phone** → **Pixel 6** (또는 Pixel 7) → **Next**
3. **System Image** 선택 (**중요**):
   - **API 34** (권장) 또는 **33** · **x86_64**
   - **Google Play** ▶ 아이콘 있는 줄
   - **금지:** 이름에 **`16 KB Page Size`** / **`ps16k`** 가 붙은 이미지 — 네이티브 앱(미소 포함)이 **실행 직후 멈춤**하는 경우가 많음
   - **Download** 후 **Next**
4. **AVD Configuration**:
   - AVD Name: `miso-poc-api34` (예 — `avd-config.bat`의 `MISO_AVD`와 동일하게)
   - **Show Advanced Settings**:
     - **RAM:** 4096 MB  
     - **VM heap:** 512 MB  
     - **Internal Storage:** 8192 MB 이상  
     - **Custom locale:** `ko-KR` (가능하면 여기서도 설정)
     - **Graphics:** Automatic (문제 시 **Software - GLES 2.0** / bat은 `swiftshader_indirect`)
   - **Finish**

> **현재 `Pixel_7_2`(API 37.1 + ps16k)에서 미소가 멈추면** 위 조건으로 **새 AVD**를 만들고 [avd-config.bat](../avd-config.bat)의 `MISO_AVD` 이름만 바꾸세요.

---

## 3. 에뮬레이터 실행

### 권장 — 별도 창 + Software GPU (PowerShell)

Studio **Device Manager ▶ Run** 보다 아래가 **마우스·adb 연결**에 안정적인 경우가 많습니다 (PoC PC 기준).

**AVD 이름**은 [avd-config.bat](../avd-config.bat)의 `MISO_AVD` 한 곳에서 관리합니다 (현재 PoC: **`Pixel_7_2`**, Play Store 포함).

**PowerShell:**

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_2 -gpu swiftshader_indirect
```

**또는 저장소 배치 (더블클릭):**

PoC PC 기본 AVD는 **`Pixel_7_2`** (Google Play). 이름 변경 시 [avd-config.bat](../avd-config.bat)만 수정.

| 파일 | 용도 |
|------|------|
| [avd-config.bat](../avd-config.bat) | **AVD 이름** + **로케일** (`MISO_AVD`, `MISO_LOCALE=ko-KR`) |
| [run-emulator.bat](../run-emulator.bat) | **에뮬 켜기** (한국어 자동 적용) |
| [run-emulator-cold.bat](../run-emulator-cold.bat) | cold boot (문제 시만) |
| [emulator-korean.bat](../emulator-korean.bat) | 수동 재적용 (보통 불필요) |

바탕화면에 두려면 `run-emulator.bat` **바로 가기** 만들어 두면 됩니다.

- **별도 창**으로 Pixel 7만 뜸 (Studio 안에 끼지 않음)
- `-gpu swiftshader_indirect` = Software GPU (입력·offline 문제 예방)
- 부팅 **1~3분** → Android 홈·잠금 해제까지

`offline`이면 1분 더 기다린 뒤 `adb devices` 재확인, 또는 `-no-snapshot-load` 추가:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_2 -no-snapshot-load -gpu swiftshader_indirect -no-boot-anim
```

### 대안 — Android Studio Device Manager

1. **Tools → Device Manager** → **Pixel 7** ▶ **Run**
2. AVD **Edit** → **Launch in tool window** **끄기** → Graphics **Software - GLES 2.0**
3. 문제 시 ▼ → **Cold Boot Now**

### 동작 확인

**Android Studio** 하단 **Terminal** 또는 **PowerShell**:

```powershell
# platform-tools 경로 (예시 — 사용자명·버전은 환경마다 다름)
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

기대 출력:

```
List of devices attached
emulator-5554   device
```

`device`가 보이면 PoC 준비 완료. `offline`이면 에뮬 재시작.

**PATH 편의 (선택):**  
시스템 환경 변수 Path에 추가:

`%LOCALAPPDATA%\Android\Sdk\platform-tools`

이후 `adb devices`만 입력 가능.

---

## 4. 미소 앱 설치

**앱 이름:** 미소 파트너 (사업자용) · 패키지 `com.miso.cleaner`  
Play Store: https://play.google.com/store/apps/details?id=com.miso.cleaner

PoC PC `Pixel_7`은 **Google APIs** 이미지라 **Play Store가 없습니다.** 아래 **A(권장)** 또는 **B** 중 하나를 쓰면 됩니다.

### 방법 A — APK 파일 (Play 없이, PoC 기본)

1. APK 확보 (택 1):
   - **파트너 폰**에 이미 설치됨 → USB 디버깅 → [export-apk-from-phone.bat](../export-apk-from-phone.bat) → `apk/miso-partner-from-phone.apk` 생성
   - 미소 파트너 센터·담당자에게 **공식 설치 파일** 요청
   - PC에 받은 APK를 `tools/miso-bridge/apk/` 폴더에 넣기
2. 에뮬 **device** 상태 확인 → [install-miso-apk.bat](../install-miso-apk.bat) 실행

```powershell
adb install -r C:\path\to\miso-partner.apk
```

- `-r` : 이미 있으면 재설치(덮어쓰기)  
- 실패 시: `adb uninstall com.miso.cleaner` 후 재시도  
- **`INSTALL_FAILED_NO_MATCHING_ABIS`** → APK가 ARM 전용일 수 있음 → **방법 B**(Play AVD) 사용

### 방법 B — Play Store (Google Play 포함 AVD 새로 만들기)

Play에서 받고 싶으면 **새 AVD**를 만듭니다 (기존 `Pixel_7`과 병행 가능).

1. **Device Manager** → **Create Device** → Pixel 7 → **Next**
2. System Image: **API 34** (또는 35) **x86_64**, **Google Play** ▶ 아이콘 있는 줄 선택 → Download → Next
3. RAM **4096 MB**, Graphics **Software - GLES 2.0** (또는 run-emulator와 동일하게 CLI `-gpu swiftshader_indirect`)
4. AVD 이름 예: `Pixel_7_Play`
5. 에뮬 실행 → **Play Store** 로그인 → 「미소 파트너」 검색 → 설치
6. **설정 → 앱 → 미소 파트너 → 버전**을 [poc/notes.md](../poc/notes.md)에 기록

> PoC 계정은 **테스트 전용** Google·미소 계정 권장.

### 방법 A/B 공통 — 설치 확인

```powershell
adb shell pm list packages | findstr miso
```

앱 서랍에서 **「미소 파트너」** 실행 → 사업자 로그인.

---

## 5. Android Studio에서 **직접 할 일** (PoC Phase A)

Studio는 **자동화 코드 작성 전**, 사람이 앱을 탐색하는 도구입니다.

### 5-1. 미소 로그인

1. 에뮬에서 미소 앱 실행  
2. 사업자(파트너) 계정으로 로그인  
3. OTP·기기 인증 있으면 [poc/notes.md](../poc/notes.md)에 절차 기록  

### 5-2. 화면 경로 조사 → [poc/screen-map.md](../poc/screen-map.md)

아래를 **손으로** 따라가며 표를 채웁니다.

| 순서 | 할 일 | 기록 |
|------|--------|------|
| 1 | **채팅/문의 목록** 탭 찾기 | 탭 이름·아이콘·경로 |
| 2 | 목록 한 줄에 뭐가 보이는지 | 이름, 미리보기, 시간, 상태 |
| 3 | 항목 하나 **탭 → 상세** | 전환 애니메이션·뒤로가기 |
| 4 | 상세에서 **고객명·요청·상태** | 견적/고용/예약 문구 그대로 |
| 5 | **고용 전** 건 | 전화번호 있는지 |
| 6 | **고용 후** 건 | 번호 위치·복사·통화 버튼 |
| 7 | **채팅 입력** | 입력창·전송·테스트 1통 |

스크린샷: **이름·전화번호 마스킹** 후 PC 폴더에만 보관 (repo 커밋 금지 권장).

### 5-3. [02-poc-checklist.md](./02-poc-checklist.md) 체크

Phase A 항목 ☐ 처리 → **3회 연속** 같은 경로 재현.

### 5-4. (선택) UI 요소 미리 보기 — Layout Inspector

자동화 준비용 **선택** 단계 (Phase 3 전):

1. 에뮬 실행 + 미소 **상세 화면** 열어 둠  
2. Android Studio → **View** → **Tool Windows** → **App Inspection**  
   (버전에 따라 **Layout Inspector** / **Running Devices** 패널)  
3. 실행 중 프로세스 **미소 앱** 선택  
4. 화면 트리에서 버튼·텍스트 **resource-id**, **content-desc**, **text** 메모 → `screen-map.md`

> 미소가 id를 난독화했으면 **text 기반** 자동화만 가능할 수 있음 — PoC에서 미리 확인.

---

## 6. adb로 할 수 있는 유용한 명령 (PoC)

```powershell
# 설치된 미소 패키지 찾기
adb shell pm list packages | findstr -i miso

# 현재 포그라운드 액티비티 (화면 전환 기록용)
adb shell dumpsys window | findstr -i mCurrentFocus

# 앱 버전
adb shell dumpsys package (패키지명) | findstr versionName

# 스크린샷 (민감정보 주의)
adb exec-out screencap -p > C:\temp\miso-screen.png
```

패키지명·액티비티는 `poc/notes.md`에 적어 두면 브릿지 개발 시 참고.

---

## 7. Android Studio에서 **하지 않아도 되는 것**

| 하지 않음 | 이유 |
|-----------|------|
| Kotlin/Java 앱 개발 | 미소 앱 소스 없음 |
| 새 Android 프로젝트 생성 | PoC는 **미소 앱 + adb** 만 |
| 상담원 PC에 Studio 설치 | Setup.exe로 대체 (나중) |
| BlueStacks 등 별도 에뮬 | 브릿지 표준은 **이 AVD** |

---

## 8. Play Store·설정·언어가 없을 때

### Play Store가 없음 (정상일 수 있음)

현재 PoC PC `Pixel_7` AVD는 **Google APIs** 이미지입니다 (`PlayStore.enabled=false`, Play **없음**).

| 이미지 | Play Store | 미소 PoC |
|--------|------------|----------|
| **Google APIs** | 없음 | **APK `adb install`** (권장) |
| **Google Play** (▶ 아이콘 있는 이미지) | 있음 | Play에서 설치 가능 |

미소는 **사업자 APK**로 넣는 경우가 많아 Play 없어도 PoC 가능합니다.  
Play가 꼭 필요하면 Device Manager → **Create Device** → System Image에서 **Google Play** 표시된 **API 34 x86_64** 등으로 **새 AVD**를 만드세요 (기존 `Pixel_7`과 병행 가능).

### 한국어 · 키보드 (기본 ko-KR — 필수)

로드맵 **§가상 Android 에뮬레이터 필수 요건**과 동일. 상담원 Setup·PoC bat 모두 **언어 + 키보드(IME) 한국어**.

| 계층 | 내용 |
|------|------|
| AVD | `config.ini`: `locale=ko-KR`, `hw.keyboard=yes` |
| 에뮬 실행 | `-prop persist.sys.locale=ko-KR` ([avd-config.bat](../avd-config.bat)) |
| 첫 부팅 | [emulator-boot-helper.bat](../emulator-boot-helper.bat) — `system_locales` ko-KR, 소프트 키보드(IME) 활성 |
| PoC 검증 | 미소 앱 채팅 입력창에서 **한글 1줄** 입력 (Phase A 게이트) |

수동: [emulator-korean.bat](../emulator-korean.bat) (재적용용)

설정 앱만 열기: [emulator-settings.bat](../emulator-settings.bat)

---

## 9. 자주 막히는 것

| 증상 | 조치 |
|------|------|
| 에뮬이 안 켜짐 | BIOS 가상화, Hyper-V/WHPX, RAM 4GB 할당 확인 |
| `adb devices` 빈 목록 | 에뮬 재시작, `adb kill-server` → `adb start-server` |
| APK install 실패 | ABI 맞는 APK(x86_64/arm64), 구버전 uninstall |
| Play Store 없음 | Google APIs AVD — APK 설치 또는 Play 포함 AVD 새로 생성 |
| Play Store 로그인 실패 | Play 포함 system image 사용, Google 계정 2FA |
| 미소 앱 크래시 | API 33↔34 변경, RAM 늘리기 |
| **미소 앱 켜지고 멈춤(로딩·터치 무응답)** | **① AVD가 API 37·16KB(ps16k)이면 API 34 Google Play(일반) AVD 새로 생성** ② Play 서비스 업데이트 ③ 앱 데이터 삭제 ④ [miso-diagnose.bat](../miso-diagnose.bat) |
| Play Store 로그인 실패 | Play 포함 system image 사용, Google 계정 2FA |

---

## 10. PoC 완료 후 Studio 역할

- **Go** → [01-roadmap.md](./01-roadmap.md) Phase 2 (채팅 전송·JSON 샘플)  
- **Go** → Phase 3: `tools/miso-bridge/` Python 브릿지 + **동일 AVD 스펙** 문서화  
- 상담원 배포용 **AVD 스냅샷·에뮬 런타임만** 추출하는 건 Phase 4 (Studio 없이 설치)

---

## 11. notes.md에 반드시 적을 값 (체크리스트)

PoC 시작 시 [../poc/notes.md](../poc/notes.md) 환경 표:

- [ ] Android Studio 버전  
- [ ] API level (33 or 34)  
- [ ] AVD 이름  
- [ ] System image (Google Play / Google APIs)  
- [ ] 미소 앱 버전  
- [ ] 미소 패키지명  
- [ ] 로그인 방식 (OTP Y/N)  

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-23 | PoC용 상세 가이드 작성 |
