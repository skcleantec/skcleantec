# 청소비서 — Google Play 등록 가이드 (업무 앱)

> **앱 표시명:** `청소비서`  
> **Play 패키지명(applicationId):** `com.cbiseo.app`  
> **개발자:** Morgan Pyo · 계정 ID `7331486328299394690` — [`docs/GOOGLE_PLAY_CONSOLE.md`](../../../docs/GOOGLE_PLAY_CONSOLE.md)  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md)

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

---

## 1. 다른 Play 앱과 구분

| 앱 | 패키지 | 용도 |
|----|--------|------|
| **청소비서** (본 문서) | `com.cbiseo.app` | 팀장·마케터·관리자 **업무 웹** + 알림 |
| **청소비서(마케터)** | `com.cbiseo.marketer` | **전화·수신·PC dispatch** (네이티브) |

스토어 설명에 **「텔레CRM·전화는 PC 또는 청소비서(마케터) 앱」** 으로 명시한다.

---

## 2. AAB 빌드 · 업로드

```powershell
cd apps\cbiseo-android
.\scripts\build-play-bundle.ps1
```

출력: `dist/cbiseo-play-{versionName}-{versionCode}.aab`

Play Console → **테스트 → 내부 테스트** → AAB 업로드

---

## 3. 스토어 등록정보 (복붙용)

### 짧은 설명 (80자)

```
청소업체 팀장·마케터·관리자 업무와 배정 알림. 화면은 웹과 동일하게 자동 반영됩니다.
```

### 전체 설명 (요지)

- 업체 코드 + 아이디로 로그인
- 팀장: 배정·스케줄·해피콜·C/S·정산 등
- 마케터·관리자: 서비스접수·스케줄·메시지·광고비 등
- **텔레CRM(상담 CRM)은 PC 전용**
- **전화·통화 연동은 「청소비서(마케터)」 앱** 사용

---

## 4. 권한 (Play Data safety)

| 권한 | 사유 |
|------|------|
| `INTERNET` | 업무 웹 로드 |
| `POST_NOTIFICATIONS` | 배정·메시지 FCM (Phase 3+) |

**없음:** `CALL_PHONE`, `READ_CALL_LOG`, `READ_SMS` — 전화 앱과 분리

---

## 5. 앱 액세스 (심사용)

- 업체 코드 + 테스트 계정 제공 (비밀번호는 Console 전용 필드에만 입력)
- 로그인 후 역할에 따라 팀장/관리 화면 표시

---

## 6. Digital Asset Links (선택 — TWA 전환 시)

현재는 **WebView 셸**. 추후 TWA로 전환 시 `/.well-known/assetlinks.json` 에 `com.cbiseo.app` SHA256 추가.
