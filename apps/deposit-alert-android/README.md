# 청소비서 입금 알림 (사업자폰)

갤럭시 같은 안드로이드 폰에 직접 설치하는 사내 앱입니다. Play 스토어에는 올리지 않습니다.
농협 입금 문자만 청소비서 서버로 보내고, 잔액은 폰에서 지운 뒤 나갑니다.

패키지: `com.cbiseo.depositalert` · 최소 안드로이드 8 (API 26)

## 서버

기본 주소는 운영 `https://www.cbiseo.com` 입니다. 첫 화면에서 스테이징을 고를 수 있습니다.

| 동작 | 주소 |
|---|---|
| 연결 | `POST /api/bank-deposits/devices/register` |
| 입금 전달 | `POST /api/bank-deposits/ingest` |
| 살아 있음 | `POST /api/bank-deposits/heartbeat` (15분) |

연결 본문은 `{ "code": "123456", "deviceName": "samsung SM-G991N", "appVersion": "0.1.0" }` 입니다.
응답의 `token` 은 암호화해서 폰에만 두고, 화면과 로그에는 찍지 않습니다.
입금 본문에는 `dedupeKey`, `sender`, `text`(잔액을 지운 문자), `receivedAt` 을 넣습니다.
서버가 `stored` · `duplicate` · `skipped` 로 답하면 그 건은 대기열에서 뺍니다.

## 디버그 APK

`local.properties` 에 SDK 경로만 적습니다. 이 파일은 커밋하지 않습니다.

```properties
sdk.dir=C\:\\Users\\user\\AppData\\Local\\Android\\Sdk
```

```powershell
cd apps\deposit-alert-android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest
```

Windows 에서는 결과물이 저장소 밖 이 폴더에 생깁니다.

`%LOCALAPPDATA%\DepositAlertAndroidBuild\app\outputs\apk\debug\app-debug.apk`

디버그 패키지 이름은 `com.cbiseo.depositalert.debug` 입니다.

## 서명한 릴리스 APK

1. `keystore.properties.example` 을 `keystore.properties` 로 복사하고 비밀번호를 채웁니다.
2. `keystore.properties` 와 `.jks` 파일은 커밋하지 않습니다.
3. 빌드합니다.

```powershell
cd apps\deposit-alert-android
.\gradlew.bat :app:assembleRelease
```

서명 파일이 있으면 서명이 붙습니다. 결과물:

`%LOCALAPPDATA%\DepositAlertAndroidBuild\app\outputs\apk\release\app-release.apk`

Android Studio 에서는 이 폴더를 열고 **Build → Generate Signed Bundle / APK → APK → release** 를 써도 됩니다.

## 시험

단위 테스트는 입금/출금/광고 구분, 잔액 삭제, 문자 조각 합치기, dedupeKey 를 확인합니다.

에뮬레이터가 켜져 있을 때:

```powershell
adb emu sms send 15882100 "-농협 입금20,000원`n11/24 09:04 301-****-9047-01 김명희 잔액4,041,585원"
```

실제 은행 문자는 쓰지 않습니다. 앱의 **시험 문자 넣기** 는 서버로 보내지 않고, 거를지와 잔액을 지운 결과만 보여 줍니다.

## 갤럭시 S21 설치 순서

1. 설정 → 보안 → 출처를 알 수 없는 앱 설치를, APK 를 여는 앱(내 파일 또는 Chrome)에 허용
2. APK 를 눌러 설치
3. 앱을 열고 문자 받기 · 알림 · 배터리 절약 제외를 누름
4. 삼성 절전 예외 앱에 「청소비서 입금 알림」을 넣음
5. 관리자 화면에서 받은 6자리 코드로 연결하고, 입금 문자 받기를 켬

삼성 Play 프로텍트가 설치를 막으면, USB 디버깅을 켠 뒤 PC 에서 `adb install -r` 로 넣습니다.
