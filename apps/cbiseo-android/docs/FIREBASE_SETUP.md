# 청소비서 업무 앱 — Firebase · FCM 설정 가이드

> **패키지:** `com.cbiseo.app` · **Play 표시명:** `청소비서`  
> **계정:** Morgan Pyo · Play 계정 ID `7331486328299394690`

Firebase·FCM은 **앱 백그라운드 알림**용입니다. 웹 화면·업무 로직은 기존 Railway 배포만으로 갱신됩니다.

---

## 0. 체크리스트 (순서)

| # | 작업 | 위치 |
|---|------|------|
| 1 | Firebase 프로젝트 생성 | [Firebase Console](https://console.firebase.google.com/) |
| 2 | Android 앱 등록 `com.cbiseo.app` | Firebase → 프로젝트 설정 |
| 3 | `google-services.json` 다운로드 → `apps/cbiseo-android/app/` | 로컬 (git **커밋 금지**) |
| 4 | 서비스 계정 JSON → Railway `FIREBASE_SERVICE_ACCOUNT_JSON` | staging · production |
| 5 | Android Studio 빌드·실기기 테스트 | 알림 권한 → 토큰 등록 |
| 6 | Play Console 앱 생성 + 내부 테스트 AAB | [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md) |

---

## 1. Firebase 프로젝트

1. [Firebase Console](https://console.firebase.google.com/) → **프로젝트 추가**
2. 프로젝트 ID 예: `cbiseo-staff` (팀 내부 기록용 — 자유)
3. Google Analytics: **켜도/꺼도 무방** (FCM만 쓸 경우 꺼도 됨)

---

## 2. Android 앱 등록

1. Firebase 프로젝트 → ⚙ **프로젝트 설정** → **내 앱** → **Android 앱 추가**
2. **Android 패키지 이름:** `com.cbiseo.app` (오타 주의 — Play와 동일)
3. 앱 닉네임: `청소비서`
4. **디버그 SHA-1** (선택, Play 내부 테스트 전 로컬 빌드용):

```powershell
cd apps\cbiseo-android
.\gradlew.bat signingReport
```

`Variant: playDebug` 의 SHA-1을 Firebase Android 앱에 추가.

5. **google-services.json** 다운로드 → 아래 경로에 저장:

```
apps/cbiseo-android/app/google-services.json
```

> ⚠️ 이 파일은 **`.gitignore`** 처리됨 — 저장소에 올리지 않습니다.

6. Android Studio **Sync / Run** — Gradle이 Google Services 플러그인을 자동 적용합니다.

**Android Studio Run:** debug·release 모두 패키지 **`com.cbiseo.app`** (Firebase 등록과 동일). debug·release APK는 폰에 **동시 설치 불가** — Play AAB 테스트 전 debug 앱을 지우고 설치.

---

## 3. 서버 FCM 발송 (Railway)

### 3.1 서비스 계정 키

1. Firebase Console → ⚙ **프로젝트 설정** → **서비스 계정**
2. **Firebase Admin SDK** → **새 비공개 키 생성** → JSON 다운로드
3. JSON **전체 내용**을 **한 줄**로 Railway Variables에 넣습니다.

| Variable | 값 |
|----------|-----|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account","project_id":"...",...}` 전체 JSON |

- **staging** Railway 환경에 먼저 추가 → redeploy
- **production** 은 스테이징에서 알림 테스트 후 동일 키(또는 별도 프로젝트) 적용

> 로컬 `server/.env` 테스트 시에도 동일 변수명 사용 (값은 git·채팅에 붙여넣지 않음).

### 3.2 동작 확인

1. 앱 로그인 → 홈 진입 → 알림 권한 허용
2. DB `staff_app_fcm_tokens` 에 해당 user 행 생성 확인
3. 배정 등으로 `notifyInboxRefresh` 발생 시 푸시 수신

서버 로그: Firebase 미설정 시 FCM은 **조용히 skip**, WS `inbox:refresh`는 그대로 동작.

---

## 4. 앱 측 FCM 흐름 (구현됨)

| 단계 | 설명 |
|------|------|
| 로그인 후 홈 로드 | `StaffFcmRegistrar` — 알림 권한 + FCM 토큰 |
| `POST /api/push/staff-app/register` | JWT + 토큰 저장 |
| 서버 `notifyInboxRefresh` | FCM `sendEach` — data `staff-app:navigate` (수신자별 title/body/path) |
| 앱 포그라운드 | `cbiseo:inbox-refresh` + (path 있으면) `cbiseo:navigate` |
| 앱 백그라운드 | `StaffPushNotificationHelper` 시스템 알림 → 탭 시 `EXTRA_PUSH_PATH` |

---

## 5. Play Console (Firebase 연동)

1. Play Console → **청소비서** (`com.cbiseo.app`) 앱 생성 — [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md)
2. **앱 무결성** · **Firebase 연결** (선택): Play Console에서 Firebase 프로젝트 연결하면 FCM·Crashlytics 연동이 쉬움
3. **내부 테스트** 트랙에 AAB 업로드 후 실기기 설치 테스트

릴리스 AAB 빌드:

```powershell
cd apps\cbiseo-android
.\scripts\build-play-bundle.ps1
```

---

## 6. 문제 해결

| 증상 | 확인 |
|------|------|
| Gradle «google-services.json 없음» | `app/google-services.json` 경로 |
| 토큰 DB에 없음 | JWT 유효·알림 권한·스테이징 URL(pyo 계정) |
| 푸시 없음·WS만 됨 | Railway `FIREBASE_SERVICE_ACCOUNT_JSON` · redeploy |
| `registration-token-not-registered` | 서버가 stale 토큰 자동 삭제 — 앱 재로그인 |

---

## 7. 보안

- 서비스 계정 JSON·`google-services.json` → **git 커밋 금지**
- Firebase 키 유출 시 Console에서 **키 폐기·재발급** 후 Railway 갱신
