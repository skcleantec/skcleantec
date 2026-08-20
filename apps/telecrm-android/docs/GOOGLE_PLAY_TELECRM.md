# 청소비서(마케터) — Google Play 등록 가이드

> **앱 표시명:** `청소비서(마케터)`  
> **Play 패키지명(applicationId):** `com.cbiseo.marketer`  
> **브랜드:** 사용자·Play·설치 화면에 **skcleantec 사용 금지** — `.cursor/rules/no-skcleantec-branding.mdc`

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

```powershell
cd apps\telecrm-android
.\scripts\build-play-bundle.ps1
```

출력: `dist/telecrm-play-{versionName}-{versionCode}.aab`

Play Console → **테스트 → 내부 테스트** → **새 버전 만들기** → AAB 업로드

| 항목 | 확인 위치 |
|------|-----------|
| applicationId | `app/build.gradle.kts` → **`com.cbiseo.marketer`** |
| versionCode / Name | 동일 파일 |

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

공개 HTTPS URL — cbiseo.com 정책 페이지

---

## 5. 데이터 보안 · 권한

`GOOGLE_PLAY_TELECRM.md` 이전 버전 §5·§6과 동일 (통화·통화기록 선언 + 화면 녹화 준비).

권한 선언 한 줄:

```
상담 업무 중 PC CRM에서 고객에게 전화를 걸고, 수신 통화 기록을 CRM 고객 정보와 연결하기 위해 사용합니다.
```

---

## 6. 테스트 트랙

1. **내부 테스트** — 사무실 Gmail
2. **비공개 테스트** — 상담사
3. **프로덕션** — 심사 후 공개

---

## 7. 관련 파일

| 항목 | 경로 |
|------|------|
| applicationId · 버전 | `app/build.gradle.kts` |
| 런처 표시명 | `app/src/main/res/values/strings.xml` → `app_name` |
| AAB 빌드 | `scripts/build-play-bundle.ps1` |
| **버전별 진행 기록 (필수)** | `apps/telecrm-android/docs/RELEASE_PROGRESS.md` |
| sideload (레거시) | `README.md` — 패키지 변경 전 APK와 별개 |
