# SK클린텍 텔레CRM Android (사무실 내부용)

> **Play Store 심사 전** — 사무실 직원 sideload( APK 직접 설치 ) 테스트용입니다.

## 요구 사항

- Android Studio Ladybug (2024.2+) 또는 최신 stable
- JDK 17
- Android SDK 35
- SK클린텍 솔루션 계정 (업체 코드 + 아이디 + 비밀번호)
- `mod_telecrm` + `crm.view` 권한

## 1. API 주소 설정

`apps/telecrm-android/local.properties` (gitignore — 각 PC에서 생성):

```properties
sdk.dir=C\:\\Users\\user\\AppData\\Local\\Android\\Sdk
telecrm.apiBaseUrl=https://YOUR-RAILWAY-STAGING-OR-PROD-HOST
```

`https://` 포함, 끝 슬래시 없음. 앱·WebView·API가 **동일 호스트**여야 JWT·CRM이 동작합니다.

## 2. Android Studio에서 열기

1. **File → Open** → `apps/telecrm-android`
2. Gradle Sync (wrapper jar 없으면 Studio가 자동 생성)
3. 실기기 USB 디버깅 또는 에뮬레이터
4. **Run ▶ app**

## 3. Debug APK 빌드 (사무실 배포)

```bash
cd apps/telecrm-android
./gradlew assembleDebug
```

산출물: `app/build/outputs/apk/debug/app-debug.apk`

직원 폰에 **출처를 알 수 없는 앱** 허용 후 설치.

## 4. Phase 1 기능

| 기능 | 상태 |
|------|------|
| 솔루션 동일 로그인 | ✅ |
| CRM WebView (`/admin/crm?mobile=1&app=1`) | ✅ |
| 통화 (ACTION_DIAL) + CRM 연동 기록 | ✅ |
| 문자 (smsto prefill) | ✅ |
| 통화 자동 CallLog / 녹음 / FCM | 🔜 Phase 2~3 |

## 5. 서버 API (신규)

- `GET /api/crm/mobile-config`
- `POST /api/crm/call-sessions`
- `GET /api/crm/call-sessions/summary?day=YYYY-MM-DD`

## 6. JS 브릿지 (웹 CRM)

```javascript
window.TelecrmApp.call(phone, inquiryId)
window.TelecrmApp.sms(phone, body)
window.TelecrmApp.isNativeApp()
```

클라이언트 헬퍼: `client/src/utils/telecrmNativeBridge.ts`

## 7. 다음 단계 (내부 테스트 후)

- CallLog 자동 수집 · 통화 시간
- FCM 푸시 (접수·변동·메시지)
- 웹 → 앱 SMS 큐
- Play Console 내부 테스트 → 프로덕션 심사
