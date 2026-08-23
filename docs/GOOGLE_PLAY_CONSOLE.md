# Google Play Console — 개발자 계정 (청소비서)

> **목적:** Play Console 로그인·앱 등록·심사 대응 시 팀이 동일 계정을 참조한다.  
> **비밀번호·2FA·결제 카드** 등은 이 문서에 적지 않는다 — Play Console 또는 비밀 관리 도구에만 둔다.

---

## 개발자 등록 (완료)

| 항목 | 값 |
|------|-----|
| **등록 상태** | ✅ 완료 |
| **개발자 이름 (표시)** | **Morgan Pyo** |
| **계정 ID** | **`7331486328299394690`** |
| **Console URL** | [Google Play Console](https://play.google.com/console) |

Play Console **설정 → 개발자 계정** 등에서 위 **계정 ID**로 동일 계정인지 확인할 수 있다.

---

## Play 앱 정책 (2개 — 고정)

| Play 표시명 | applicationId | 용도 | 가이드 |
|-------------|---------------|------|--------|
| **청소비서** | **`com.cbiseo.app`** | 팀장·마케터·관리자 **업무 웹** + FCM 알림 | [`CBISEO_ANDROID_APP.md`](./CBISEO_ANDROID_APP.md) · [`apps/cbiseo-android/docs/GOOGLE_PLAY_CBISEO.md`](../apps/cbiseo-android/docs/GOOGLE_PLAY_CBISEO.md) |
| **청소비서(마케터)** | `com.cbiseo.marketer` | 상담실 **전화·수신·PC dispatch** (네이티브) | [`apps/telecrm-android/docs/GOOGLE_PLAY_TELECRM.md`](../apps/telecrm-android/docs/GOOGLE_PLAY_TELECRM.md) |

**앱에 넣지 않음:** 텔레CRM `/admin/crm` — **PC 전용**  
**폐기:** `com.cbiseo.team` 팀장 전용 분리 앱 — **`com.cbiseo.app` 통합**으로 대체

---

## 에이전트·릴리스 시

- Play 앱 생성·AAB 업로드·트랙 출시는 **위 Morgan Pyo 계정** 기준으로 진행한다.
- **업무 앱** 버전 이력: `apps/cbiseo-android/docs/RELEASE_PROGRESS.md` (생성 후)
- **전화 앱** 버전 이력: [`apps/telecrm-android/docs/RELEASE_PROGRESS.md`](../apps/telecrm-android/docs/RELEASE_PROGRESS.md)
- 브랜드·패키지명: `.cursor/rules/no-skcleantec-branding.mdc`
