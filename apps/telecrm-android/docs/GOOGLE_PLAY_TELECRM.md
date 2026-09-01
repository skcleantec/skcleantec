# 청소비서(마케터) — Google Play 등록 가이드

> **앱 표시명:** `청소비서(마케터)`  
> **Play 패키지명(applicationId):** `com.cbiseo.marketer`  
> **브랜드:** 사용자·Play·설치 화면에 **skcleantec 사용 금지** — `.cursor/rules/no-skcleantec-branding.mdc`  
> **Play 개발자 계정:** Morgan Pyo · 계정 ID `7331486328299394690` — [`docs/GOOGLE_PLAY_CONSOLE.md`](../../../docs/GOOGLE_PLAY_CONSOLE.md)

---

## 0. Play Console에 넣을 값 (복붙)

| 항목 | 값 |
|------|-----|
| **앱 이름** | `청소비서(마케터)` |
| **패키지명** | `com.cbiseo.marketer` |
| **기본 언어** | 한국어 |
| **앱 / 게임** | 앱 |
| **무료 / 유료** | 무료 |
| **카테고리** | 비즈니스 |
| **앱 아이콘 (512)** | `apps/telecrm-android/brand/marketer-app-icon-512.png` — Play·`ic_launcher` 공통 원본 |

> 패키지명은 **한 번 정하면 변경 불가**. AAB의 `applicationId`와 **완전히 동일**해야 합니다.

---

## 1. skcleantec 패키지와의 관계

| | 구버전 sideload | Play (신규) |
|--|-----------------|---------------|
| 패키지 | `com.skcleantec.telecrm.internal` | **`com.cbiseo.marketer`** |
| Gradle flavor | `sideload` (`assembleSideloadRelease`) | **`play`** (`bundlePlayRelease`) |
| APK 자동 업데이트 | `/api/public/telecrm-app/manifest` | **없음** (Play Store) |
| `REQUEST_INSTALL_PACKAGES` | sideload APK에 포함 (`app/src/sideload/AndroidManifest.xml`) | **Play AAB에 없음** (main manifest 미포함) |
| 표시명 | 청소비서 전화 | **청소비서(마케터)** |
| 덮어쓰기 | — | **불가** (패키지가 다름 → 기존 앱 삭제 후 새로 설치) |

Play 등록 **전**에 Gradle `applicationId`를 `com.cbiseo.marketer`로 맞춘 뒤 AAB를 빌드하세요.

---

## 2. Play Console — 앱 만들기

1. **모든 앱** → **앱 만들기**
2. 위 §0 표 그대로 입력
3. **패키지명:** `com.cbiseo.marketer` (오타 주의 — `skcleantec` 넣지 않음)

---

## 3. AAB 빌드 · 업로드

Play 배포본은 **`play` product flavor** 로 빌드합니다. sideload APK 자동 업데이트·`REQUEST_INSTALL_PACKAGES` 권한은 **Play AAB에 포함되지 않습니다** (`sideload` flavor manifest 전용).

```powershell
cd apps\telecrm-android
.\scripts\build-play-bundle.ps1
```

Gradle 직접 실행: `.\gradlew.bat bundlePlayRelease`

출력: `dist/telecrm-play-{versionName}-{versionCode}.aab`

Play Console → **테스트 → 내부 테스트** → **새 버전 만들기** → AAB 업로드

| 항목 | 확인 위치 |
|------|-----------|
| applicationId | `app/build.gradle.kts` → **`com.cbiseo.marketer`** |
| versionCode / Name | 동일 파일 |

### Play 거절 — `REQUEST_INSTALL_PACKAGES` (시정 조치)

Google 메일에 **버전 코드 19** 등 **구버전**이 적히면, **최신 AAB(v28+)는 이미 권한이 없을 수 있습니다.** 예전 번들이 **어떤 트랙에든** 남아 있으면 전체 제출이 거절됩니다.

1. **출시 → App Bundle 탐색기** — 위반 버전 코드(19 등) 확인
2. **내부·비공개·공개·프로덕션** 각 트랙 → 구버전 **제거** 또는 **포함되지 않음**
3. **v28** (`0.7.8-internal`) AAB만 포함 — `dist/telecrm-play-0.7.8-internal-28.aab`
4. 임시보관 초안에 위반 번들만 있으면 **초안 삭제** 후 v28만 재업로드
5. **게시 개요** → **검토 제출**

> sideload APK(`assembleSideloadRelease`)는 Play에 업로드하지 않습니다.

---

## 4. 스토어 등록정보 (복붙용)

### 짧은 설명 (80자)

```
청소 업체 마케터·상담사용 — PC CRM과 연동해 고객 조회·통화·문자·메시지를 처리합니다.
```

### 전체 설명

```
청소비서(마케터)는 청소비서(Cbiseo) SaaS를 사용하는 상담·마케터용 동반 앱입니다.

· PC CRM과 동일 계정으로 로그인
· 고객 이름·전화번호 검색 및 접수 요약 확인
· PC에서 요청한 통화·문자를 휴대폰에서 실행
· 사무실 내부 메시지(1:1) 수신

본 앱은 B2B 업무용이며, 청소비서 가입 업체 직원만 사용합니다.
```

### 연락처

- 이메일: `cbiseo@service-bridges.com`
- 웹: `https://www.cbiseo.com`

### 개인정보처리방침 URL (필수)

```
https://www.cbiseo.com/legal/member-privacy
```

> 공개 API: `GET /api/public/legal/documents/member-privacy` · slug 상수: `shared/platformLegalSlugs.ts`  
> 2026-08-20 기준 HTTPS **200** 확인. Play **스토어 등록정보**·**데이터 보안**·**개인정보처리방침** 메뉴에 **동일 URL** 입력.

---

## 5. SMS 및 통화 기록 권한 (Play Console)

앱은 **`READ_CALL_LOG`만** 사용합니다. SMS **읽기·저장·전송 권한 없음** (문자는 `smsto:`로 기본 문자 앱에 위임).

### 5.1 핵심 기능 — 체크 (1개만)

| 체크 | 이유 |
|------|------|
| **기업 아카이브, CRM** | B2B CRM 동반 앱 — 통화 시간·수신 이력을 PC CRM과 연동 |

**체크하지 않음:** 기본 SMS/전화/Assistant, SMS 금융·OTP·피싱, 통화기록 쓰기, 발신자 ID·스팸 전용 등

### 5.2 추가 정보 (500자) — 복붙

```
청소비서(마케터)는 청소 업체 상담·마케터 전용 B2B CRM 동반 앱입니다. 일반 소비자용이 아니며, 가입 업체 직원만 로그인해 사용합니다.

READ_CALL_LOG 용도:
1) 앱 「수신」 탭에서 최근 수신 통화 목록 표시
2) 통화 종료 후 통화 시간(90초 이상 연결)을 PC CRM 통화 현황과 동기화
3) PC CRM에서 요청한 발신 통화와 휴대폰 CallLog를 매칭

SMS 읽기·저장·전송 권한은 사용하지 않습니다. 문자 발송은 smsto: 인텐트로 사용자 기본 문자 앱에 위임합니다.

데이터는 당사 CRM 서버(www.cbiseo.com) 업무 연동에만 사용하며 판매·광고 목적으로 제3자에게 제공하지 않습니다.
```

### 5.3 동영상 (YouTube 비공개 링크)

**2~3분** 화면 녹화 권장 순서:

1. 앱 로그인 (업체코드 + 테스트 계정)
2. 통화·통화기록 권한 허용
3. **수신** 탭 — 통화기록 목록
4. 통화 선택 → CRM 고객 정보
5. PC CRM (`https://www.cbiseo.com/admin/crm`) 동일 계정 → 통화 → 폰에서 실행
6. (가능 시) 수신 시 CRM 알림

YouTube **비공개(unlisted)** 업로드 후 URL을 Play에 붙여넣기.

### 5.4 하단 선언 — 4개 전부 체크

정보 정확함 · 변경 시 재제출 · 부적절 판매·공유 안 함 · Prominent Disclosure 준수

### 5.5 권한 설명 한 줄 (기타 메뉴용)

```
상담 업무 중 PC CRM에서 고객에게 전화를 걸고, 수신 통화 기록을 CRM 고객 정보와 연결하기 위해 사용합니다.
```

---

## 6. 앱 콘텐츠 — 앱 액세스 · 데이터 보안 · 개인정보처리방침

> Play Console **앱 콘텐츠** 메뉴 3종. 아래를 **그대로 복붙**하거나, 심사용 계정만 실제 값으로 바꿉니다.

### 6.1 개인정보처리방침

| 항목 | 값 |
|------|-----|
| **URL** | `https://www.cbiseo.com/legal/member-privacy` |
| **문서명** | 청소비서 회원사 개인정보 처리방침 |

스토어 등록정보·데이터 보안·개인정보처리방침 **세 곳 모두 동일 URL**.

---

### 6.2 앱 액세스 (로그인 필요)

**선택:** 「앱의 모든 기능을 사용하려면 로그인이 필요합니다」

**지침 / 추가 정보 — 복붙:**

```
본 앱은 청소비서(Cbiseo) SaaS 가입 업체의 마케터·상담사 전용 B2B 업무 앱입니다. 일반 소비자용이 아닙니다.

[Android 앱 로그인]
· 서버: https://www.cbiseo.com (운영)
· 업체 코드: cbiseo
· 아이디: cbiseo
· 비밀번호: (Play Console에만 입력 — 채팅·저장소에 비밀번호 커밋 금지)

[PC CRM — 통화·고객 조회 연동 확인용]
· URL: https://www.cbiseo.com/admin/crm
· 동일 업체 코드·아이디·비밀번호로 로그인
· PC에서 「통화」 요청 시 Android 앱이 수신·실행됩니다.

[테스트 순서]
1) Android 앱 설치 → 위 계정으로 로그인
2) 통화·통화기록·알림 권한 허용
3) 발신 탭 — 고객 검색 / 수신 탭 — 통화기록
4) PC CRM 동일 계정 로그인 → 고객 조회 → 통화 버튼 → 폰에서 통화 실행

계정 문제 시: cbiseo@service-bridges.com
```

> **운영 팁:** Play Console **앱 액세스** 전용 비밀번호 필드에만 실제 비밀번호 입력. 위 문서·git에는 `(Play Console에만 입력)` 으로 둡니다.  
> 내부 테스트용 다른 계정을 쓸 경우 **업체 코드·아이디·비번**만 바꿉니다.

---

### 6.3 데이터 보안 (Data safety)

#### 1~2단계 — 수집 여부 · 암호화

| 질문 | 답변 |
|------|------|
| 앱에서 사용자 데이터를 수집·공유하나요? | **예** |
| 전송 중 데이터 암호화 | **예** (HTTPS / TLS) |
| 사용자가 데이터 삭제를 요청할 수 있나요? | **예** — 업체 관리자·`cbiseo@service-bridges.com` 문의 (회원 탈퇴·CRM 정책에 따름) |

#### 3단계 — 수집하는 데이터 유형 (체크)

**✅ 개인 정보 (Personal info)**

| 하위 | 체크 | 이유 |
|------|------|------|
| 이름 | ✓ | 로그인 표시명, CRM 고객 조회 결과 |
| 전화번호 | ✓ | 통화·CallLog 동기화, 고객 검색 |
| 사용자 ID | ✓ | JWT·업무 계정 식별 |
| 이메일 | ✓ | 로그인 아이디(이메일 형식) |

**✅ 메시지 (Messages)**

| 하위 | 체크 | 이유 |
|------|------|------|
| 앱 내 기타 메시지 | ✓ | 사무실 1:1 메시지 탭 |

**✅ 앱 활동 (App activity)**

| 하위 | 체크 | 이유 |
|------|------|------|
| 앱 상호작용 | ✓ | 통화 세션 동기화, CRM 조회 |
| 앱 내 검색 기록 | ✓ | 고객 이름·전화 검색이 서버로 전송 |

**✅ 연락처 (Contacts)** — **v29 Play 검수 필수**

| 하위 | 체크 | 이유 |
|------|------|------|
| **연락처** | ✓ | `READ_CALL_LOG`로 읽은 **통화 상대 전화번호**·CRM 고객 조회 번호를 서버로 전송. Play 자동 검사가 **「연락처」** 로 분류 — **미선언 시 v29 거절** |

> **주소록(`READ_CONTACTS`)은 사용하지 않습니다.** 다만 Google Play 데이터 보안 양식의 「연락처」 항목은 통화기록·업무용 고객 번호 전송도 여기에 **선언**해야 합니다. (개인정보 > 전화번호와 **둘 다** 체크)

**❌ 체크하지 않음**

금융·건강·사진·동영상·파일·캘린더·위치·웹 브라우징·광고 ID·SMS 본문

#### 4단계 — 유형별 세부 (공통 패턴)

각 체크한 항목에 대해:

| 질문 | 답변 |
|------|------|
| 수집·공유 | **수집함** (제3자 광고·분석 SDK와 **공유하지 않음**) |
| 일시적 처리만 | **아니오** (CRM 서버에 업무 목적으로 저장) |
| 필수 여부 | **사용자가 기능을 쓰려면 필수** |
| 수집 목적 | **앱 기능** (App functionality) |

**전화번호·통화기록·연락처:** 기기 CallLog·업무 CRM에서 **전화번호**를 읽어 `POST /api/crm/call-sessions/sync` 등으로 **자사 서버**에만 전송 (판매·광고 목적 없음). **연락처(Contacts)** 항목도 동일 — 제3자 **공유 없음**.

#### 4b. 「연락처(Contacts)」 세부 — Play Console 복붙용

| 질문 | 답변 |
|------|------|
| 이 데이터를 **수집**하나요? | **예** |
| 이 데이터를 **공유**하나요? | **아니오** (광고·분석 SDK 없음) |
| 일시적으로만 처리? | **아니오** |
| 사용자가 기능 사용에 **필수**? | **예** (통화·CRM 연동) |
| 수집 목적 | **앱 기능** (App functionality) |

Play 스토어에 표시될 설명(한국어 예시):

> 통화 기록 및 CRM 업무 연동을 위해 통화 상대 전화번호를 수집합니다. 연락처 주소록 전체를 읽지 않으며, 제3자와 공유하지 않습니다.

#### 5단계 — 미리보기

| 항목 | 값 |
|------|-----|
| 개인정보처리방침 URL | `https://www.cbiseo.com/legal/member-privacy` |
| 데이터 삭제 | 앱 내 문의 또는 `cbiseo@service-bridges.com` |
| 광고 SDK | **없음** (앱 콘텐츠 → 광고: **아니오**) |

저장 후 대시보드 **앱 설정**에 데이터 보안 ✅ 표시 확인.

#### 6.3.1 v29 거절 — 「연락처 데이터 유형」 (시정 조치)

**증상:** `버전 코드 29` · `데이터 보안 선언` · **연락처(Contacts) 미선언**

**원인:** APK 문제 아님. 양식에서 「연락처」를 빼 두었는데, 앱이 `READ_CALL_LOG`·CRM 통화 연동으로 **전화번호를 서버에 전송** → Play 자동 검사가 **Contacts 선언 누락**으로 거절.

**조치 (새 AAB 불필요 — v29 그대로 재제출):**

1. Play Console → **앱 콘텐츠** → **데이터 보안**
2. **「앱에서 사용자 데이터를 수집하거나 공유하나요?」** → **예** (「아니오」면 전부 거절)
3. **데이터 유형** → **연락처(Contacts)** → **연락처** 체크
4. §4b 표대로 **수집=예, 공유=아니오, 목적=앱 기능** 입력
5. **개인 정보 > 전화번호** 등 기존 항목도 유지 (연락처와 **중복 체크 정상**)
6. **저장** → **게시 개요** → 변경사항 **검토 제출** (v29 AAB 재업로드 없음)

---

## 7. 테스트 트랙

1. **내부 테스트** — 사무실 Gmail
2. **비공개 테스트** — 상담사 (v28 AAB · targetSdk 36)
3. **프로덕션** — 심사 후 공개

> **versionCode**는 트랙 간 **전역 유일** — 내부에 올린 번호와 같으면 비공개 업로드 거부 → 매번 +1.

---

## 8. 관련 파일

| 항목 | 경로 |
|------|------|
| applicationId · 버전 · flavor | `app/build.gradle.kts` (`play` / `sideload`) |
| Play 권한 (sideload 전용) | `app/src/sideload/AndroidManifest.xml` |
| 런처 표시명 | `app/src/main/res/values/strings.xml` → `app_name` |
| AAB 빌드 | `scripts/build-play-bundle.ps1` |
| **버전별 진행 기록 (필수)** | `apps/telecrm-android/docs/RELEASE_PROGRESS.md` |
| sideload (레거시) | `README.md` — 패키지 변경 전 APK와 별개 |
