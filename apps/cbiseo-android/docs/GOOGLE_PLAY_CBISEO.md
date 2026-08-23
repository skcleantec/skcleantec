# 청소비서 — Google Play 등록 가이드 (업무 앱)

> **앱 표시명:** `청소비서`  
> **Play 패키지명(applicationId):** `com.cbiseo.app`  
> **개발자:** Morgan Pyo · 계정 ID `7331486328299394690` — [`docs/GOOGLE_PLAY_CONSOLE.md`](../../../docs/GOOGLE_PLAY_CONSOLE.md)  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md)  
> **Console URL:** [Google Play Console](https://play.google.com/console)

---

## 0. Play Console에 넣을 값 (복붙)

| 항목 | 값 |
|------|-----|
| **앱 이름** | `청소비서` |
| **패키지명** | `com.cbiseo.app` |
| **기본 언어** | 한국어 |
| **앱 / 게임** | 앱 |
| **무료 / 유료** | 무료 |
| **카테고리** | 비즈니스 |
| **앱 아이콘 (512×512)** | `client/public/brand/clean-secretary-logo.png` (PNG, 검정 배경 포함) |

> 패키지명은 **한 번 정하면 변경 불가**. AAB의 `applicationId`와 **완전히 동일**해야 합니다.

---

## 1. 다른 Play 앱과 구분

| 앱 | 패키지 | 용도 |
|----|--------|------|
| **청소비서** (본 문서) | `com.cbiseo.app` | 팀장·마케터·관리자 **업무 웹** + 알림 |
| **청소비서(마케터)** | `com.cbiseo.marketer` | **전화·수신·PC dispatch** (네이티브) |

스토어 설명에 **「텔레CRM·상담 CRM은 PC 전용」** · **「전화·통화 연동은 청소비서(마케터) 앱」** 으로 명시합니다.

---

## 2. Play Console — 앱 만들기 (1회)

1. [Google Play Console](https://play.google.com/console) → Morgan Pyo 계정 로그인
2. **모든 앱** → **앱 만들기**
3. 아래 표 그대로 입력:

| 필드 | 값 |
|------|-----|
| 앱 이름 | `청소비서` |
| 기본 언어 | 한국어 |
| 앱 / 게임 | **앱** |
| 무료 / 유료 | **무료** |

4. **선언** 체크 → **앱 만들기**
5. **대시보드**에서 아래 **앱 콘텐츠**·**스토어 설정**을 순서대로 채웁니다 (내부 테스트 업로드 전 필수).

> 이미 `com.cbiseo.app` 앱이 있으면 **새로 만들지 말고** 기존 앱에서 §4~§7만 진행합니다.

---

## 3. 업로드 키 (keystore) 준비

Play AAB는 **release 서명**이 필요합니다. (Play **앱 서명** ON 권장 — Google이 배포 키 관리)

### 3.1 keystore 생성 (최초 1회)

**Android Studio:**

1. `apps/cbiseo-android` 열기
2. **Build → Generate Signed App Bundle / APK…**
3. **Android App Bundle** → **Create new…**
4. 저장 예: `apps/cbiseo-android/keystore/cbiseo-release.jks`
5. **Alias:** `cbiseo` · 비밀번호는 팀 비밀 관리 도구에만 보관

### 3.2 `keystore.properties` (로컬, git 커밋 금지)

```powershell
cd apps\cbiseo-android
.\scripts\init-keystore-properties.ps1
```

또는 `keystore.properties.example` → `keystore.properties` 복사 후 비밀번호 입력.

### 3.3 Firebase (FCM, 권장)

`app/google-services.json` — [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md)  
없어도 AAB 빌드는 가능하나, **알림 권한·FCM 등록** 테스트는 Firebase 설정 후.

---

## 4. AAB 빌드 · 업로드

```powershell
cd apps\cbiseo-android
.\scripts\build-play-bundle.ps1
```

출력: `dist/cbiseo-play-{versionName}-{versionCode}.aab`

| 항목 | 확인 위치 |
|------|-----------|
| applicationId | `app/build.gradle.kts` → **`com.cbiseo.app`** |
| versionCode / Name | 동일 파일 (현재 `1` / `1.0.0`) |

**Play Console 업로드:**

1. **테스트 → 내부 테스트** (또는 **비공개 테스트**)
2. **새 버전 만들기**
3. **App Bundle 업로드** → `dist/cbiseo-play-….aab`
4. 출시 노트 예: `v1.0.0 — WebView 업무 셸, 네이티브 로그인, FCM 준비`
5. **검토 → 내부 테스트 시작**

첫 업로드 시 **Play 앱 서명** 등록 안내 → **Google Play 앱 서 signing 사용(권장)** 선택.

---

## 5. 스토어 등록정보 (복붙용)

**Play Console → 성장 → 스토어 설정 → 기본 스토어 등록정보**

### 짧은 설명 (80자 이내)

```
청소업체 팀장·마케터·관리자 업무와 배정 알림. 화면은 웹과 동일하게 자동 반영됩니다.
```

### 전체 설명

```
청소비서는 입주·이사 청소 업체를 위한 B2B SaaS(운영 콘솔)의 공식 Android 앱입니다.

[주요 기능]
· 업체 코드 + 아이디로 로그인
· 팀장: 배정·스케줄·해피콜·C/S·정산·정보공유 등
· 마케터·관리자: 서비스접수·스케줄·메시지·광고비 등
· 업무 화면은 www.cbiseo.com 웹과 동일 — 서버 배포만으로 기능이 갱신됩니다
· 배정·메시지 등 푸시 알림(FCM)

[다른 앱·PC와의 구분]
· 상담 CRM(텔레CRM)은 PC 브라우저 전용입니다 — 본 앱에서 해당 메뉴는 안내만 표시됩니다
· 전화·통화·수신 연동은 「청소비서(마케터)」 앱을 사용하세요

본 앱은 가입 업체 직원 전용 B2B 업무용이며, 일반 소비자용이 아닙니다.
```

### 연락처

| 항목 | 값 |
|------|-----|
| 이메일 | `cbiseo@service-bridges.com` |
| 웹 | `https://www.cbiseo.com` |

### 개인정보처리방침 URL (필수)

```
https://www.cbiseo.com/legal/member-privacy
```

> 스토어 등록정보 · 데이터 보안 · 개인정보처리방침 **세 곳 모두 동일 URL**.

### 그래픽 자산

| 자산 | 권장 |
|------|------|
| **앱 아이콘** | 512×512 PNG — `client/public/brand/clean-secretary-logo.png` |
| **스크린샷 (휴대전화)** | 최소 2장 — 로그인 화면 + 팀장/관리 대시보드(WebView) |
| **기능 그래픽** | 1024×500 (선택, 프로덕션 전 권장) |

---

## 6. 앱 콘텐츠 (심사·내부 테스트 전)

### 6.1 개인정보처리방침

| 항목 | 값 |
|------|-----|
| **URL** | `https://www.cbiseo.com/legal/member-privacy` |

### 6.2 앱 액세스 (로그인 필요)

**선택:** 「앱의 모든 기능을 사용하려면 로그인이 필요합니다」

**지침 — 복붙:**

```
본 앱은 청소비서(Cbiseo) SaaS 가입 업체의 팀장·마케터·관리자 전용 B2B 업무 앱입니다.

[Android 앱 로그인]
· 서버: https://www.cbiseo.com
· 업체 코드: cbiseo
· 아이디: cbiseo
· 비밀번호: (Play Console 전용 필드에만 입력 — 문서·git에 비밀번호 금지)

[테스트 순서]
1) 앱 설치 → 위 계정으로 로그인
2) 알림 권한 허용(표시 시)
3) 역할에 따라 팀장(/team) 또는 관리(/admin) 대시보드 표시
4) CRM(/admin/crm) 메뉴는 앱에서 PC 전용 안내 — 정상 동작

계정 문의: cbiseo@service-bridges.com
```

> **SNS(Google/카카오)만 가입한 ADMIN**은 네이티브 로그인(아이디+비밀번호) 불가 → **웹 브라우저 /login** 사용 안내.

### 6.3 광고

**앱에 광고 포함:** **아니오**

### 6.4 콘텐츠 등급

설문: **유틸리티·생산성·비즈니스** · 폭력·성적 콘텐츠 없음 → 보통 **전체이용가** 또는 **3세+**

### 6.5 대상층 및 콘텐츠

| 항목 | 답변 |
|------|------|
| 대상 연령 | **18세 이상** (B2B 업무) |
| Play 정책·아동 대상 | 아동 대상 아님 |

### 6.6 데이터 보안 (Data safety)

#### 수집·암호화

| 질문 | 답변 |
|------|------|
| 사용자 데이터 수집·공유? | **예** (자사 서버 업무 목적) |
| 전송 중 암호화 | **예** (HTTPS) |
| 사용자 데이터 삭제 요청 | **예** — `cbiseo@service-bridges.com` |

#### 수집 유형 (체크)

**✅ 개인 정보**

| 하위 | 체크 | 이유 |
|------|------|------|
| 이름 | ✓ | 로그인·업무 화면 |
| 이메일 | ✓ | 계정·업무 연락 |
| 사용자 ID | ✓ | JWT·업무 계정 |
| 전화번호 | ✓ | 접수·업무 데이터(웹 폼) |

**✅ 앱 활동**

| 하위 | 체크 | 이유 |
|------|------|------|
| 앱 상호작용 | ✓ | WebView 업무 사용 |

**✅ 기기 또는 기타 ID** (해당 시)

| 하위 | 체크 | 이유 |
|------|------|------|
| 기기 ID | ✓ | FCM 토큰(푸시) |

**❌ 체크하지 않음**

통화기록·SMS·연락처 주소록·위치·사진·건강·금융·광고 ID

> **본 앱은 `INTERNET`·`POST_NOTIFICATIONS`만 사용** — 전화 권한 없음.

각 항목 공통: **수집함** · 제3자 광고 SDK **공유 안 함** · 목적 **앱 기능** · 필수 **예**

---

## 7. 권한 (Manifest)

| 권한 | 사유 |
|------|------|
| `INTERNET` | `www.cbiseo.com` 업무 웹 |
| `POST_NOTIFICATIONS` | 배정·메시지 FCM |

**없음:** `CALL_PHONE`, `READ_CALL_LOG`, `READ_SMS`, `READ_CONTACTS`

---

## 8. 내부 테스트 체크리스트

| # | 작업 | 완료 |
|---|------|------|
| 1 | Play Console **앱 만들기** (`com.cbiseo.app`) | ☐ |
| 2 | 스토어 등록정보 · 아이콘 · 스크린샷 | ☐ |
| 3 | 앱 콘텐츠 (개인정보·앱 액세스·등급·데이터 보안) | ☐ |
| 4 | keystore + `build-play-bundle.ps1` → AAB | ☐ |
| 5 | **내부 테스트** 트랙 업로드 | ☐ |
| 6 | 테스터 이메일 추가 → 링크로 설치 | ☐ |
| 7 | 로그인 · WebView · (선택) FCM | ☐ |

완료 후 [`RELEASE_PROGRESS.md`](./RELEASE_PROGRESS.md) **최상단 표** 갱신.

---

## 9. Digital Asset Links (선택 — TWA 전환 시)

현재는 **WebView 셸**. 추후 TWA로 전환 시 `/.well-known/assetlinks.json` 에 `com.cbiseo.app` SHA256 추가.

---

## 10. 관련 문서

- [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md)
- [`RELEASE_PROGRESS.md`](./RELEASE_PROGRESS.md)
- [`docs/GOOGLE_PLAY_CONSOLE.md`](../../../docs/GOOGLE_PLAY_CONSOLE.md)
- [`apps/telecrm-android/docs/GOOGLE_PLAY_TELECRM.md`](../../telecrm-android/docs/GOOGLE_PLAY_TELECRM.md) — 전화 앱(별도 패키지)
