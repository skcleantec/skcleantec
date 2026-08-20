# 청소비서(마케터) Android — 버전별 진행 기록

> **패키지:** `com.cbiseo.marketer` · **표시명:** `청소비서(마케터)`  
> **Play 가이드:** [`GOOGLE_PLAY_TELECRM.md`](./GOOGLE_PLAY_TELECRM.md)  
> **Gradle 버전 소스:** `app/build.gradle.kts`

---

## 현재 상태 (최종 갱신: 2026-08-20)

| 항목 | 값 |
|------|-----|
| **최신 versionCode** | 26 |
| **최신 versionName** | `0.7.6-internal` |
| **Play 내부 테스트** | v25 (`0.7.5-internal`) 업로드됨 |
| **Play 비공개 테스트** | v26 AAB 빌드 완료 · 업로드 대기 |
| **Play 프로덕션** | 미출시 |
| **sideload (`/telecrm-app`)** | 레거시 `com.skcleantec.telecrm.internal` — Play 앱과 **별도 패키지** |

---

## 에이전트·개발자 — 기록 의무

`versionCode` / `versionName` 변경, AAB·APK 빌드, Play 트랙 업로드, Railway `TELECRM_APP_*` 갱신, 출시 관련 기능 완료 시 **본 파일 최상단 표·버전 로그에 반드시 한 줄(또는 섹션) 추가**한다.

- **규칙:** `.cursor/rules/telecrm-android-release.mdc`
- **새 항목은 표 맨 위(최신 first)** 에 추가
- Play에 올린 트랙·AAB 파일명·git 커밋·미완료 TODO를 함께 적는다

### 새 버전 항목 템플릿

```markdown
### v{versionCode} · `{versionName}` — YYYY-MM-DD

| 항목 | 내용 |
|------|------|
| **Play 트랙** | 내부 / 비공개 / 공개 / 프로덕션 / — |
| **AAB** | `dist/telecrm-play-{versionName}-{versionCode}.aab` |
| **SHA256** | (빌드 출력) |
| **Git** | `abcdef12` — 커밋 제목 |
| **변경 요약** | 한 줄 |
| **서버/CRM** | 해당 시 API·WS 변경 |
| **검증** | 실기기·PC CRM 체크리스트 |
| **메모** | Play 거절·이슈·다음 할 일 |
```

---

## 버전 로그 (최신 → 과거)

### v26 · `0.7.6-internal` — 2026-08-20

| 항목 | 내용 |
|------|------|
| **Play 트랙** | **비공개 테스트** 업로드용 (내부 v25와 versionCode 중복 방지) |
| **AAB** | `dist/telecrm-play-0.7.6-internal-26.aab` |
| **SHA256** | `f13f1e79a3d81d426a43e661a2fd0c67645c546979cda78320b824ce90e2f82d` |
| **Git** | `cd8de1ff` — docs(telecrm-android): RELEASE_PROGRESS 버전 기록 및 v26 bump |
| **변경 요약** | versionCode만 +1 (코드 변경 없음) · `RELEASE_PROGRESS.md` 신설 |
| **staging** | 푸시 완료 |

---

### v25 · `0.7.5-internal` — 2026-08-20

| 항목 | 내용 |
|------|------|
| **Play 트랙** | 내부 테스트 |
| **AAB** | `dist/telecrm-play-0.7.5-internal-25.aab` |
| **SHA256** | `c8967912f5390694040c35af2f8d0be416b30bc8cf78a3abbaf87213723b0e1d` |
| **Git** | `6db7b20b` — chore(telecrm-android): 청소비서 마케터 앱 아이콘 교체 (v25) |
| **변경 요약** | Play 등록 3D 전화 아이콘 → `ic_launcher_foreground` · 배경 `#DEF4E7` · `brand/marketer-app-icon-512.png` |
| **staging** | 푸시 완료 |

---

### v24 · `0.7.4-internal` — 2026-08-20

| 항목 | 내용 |
|------|------|
| **Play 트랙** | (AAB 빌드 · 내부 테스트 업로드 가능) |
| **Git** | `87d2e0cd` — fix(telecrm-android): 잠금화면 PC 통화 알림 탭 시 번호 prefill |
| **변경 요약** | 알림 **탭** 시 `CallDispatchActivity`로 진입(번호·자동통화) · `TelecrmDispatchPendingStore` · MainActivity fallback |
| **staging** | 푸시 완료 |

---

### v23 · `0.7.3-internal` — 2026-08-20

| 항목 | 내용 |
|------|------|
| **Git** | `184a1836` — feat(telecrm): 휴대폰 수신 시 PC CRM 자동 고객 조회 |
| **변경 요약** | `POST /api/crm/mobile-incoming-ring` · WS `telecrm:incoming-ring` · Android `IncomingCallRouter` · PC `useTelecrmIncomingRingRealtime` |
| **staging** | 푸시 완료 |

---

### 서버·CRM (앱 버전과 별도) — 2026-08-20

| Git | 내용 |
|-----|------|
| `9b623d9a` | CRM 전화번호 lookup 시 접수란 **추가 필드**(주소·희망일·구조·메모·유입) 일괄 자동 채움 · `crmLookupApply.ts` · inquiry brief 필드 확장 |

> 다음 앱 빌드에 CRM 변경이 포함된 경우 버전 로그 **변경 요약**에 함께 적을 것.

---

### v18~22 · Play 전환기 (요약)

| versionCode | versionName | 메모 |
|-------------|-------------|------|
| — | — | `applicationId` → **`com.cbiseo.marketer`** (구 sideload `com.skcleantec.telecrm.internal` 와 별개) |
| 17 | `0.6.7-internal` | Railway sideload 매니페스트 bump |
| 18 | `0.6.8-internal` | 앱 내 업데이트 확인 버튼 · Play Protect 안내 |

---

### v0.6.x 이전 (sideload 중심 · 요약)

| 영역 | 주요 내용 |
|------|-----------|
| PC ↔ 폰 | `telecrm:dispatch` 통화·문자 · Foreground Service · 잠금화면 fullScreenIntent |
| CRM | customer-lookup · 작업 브랜드 · 90초 통화 추적 |
| 설치 | `/telecrm-app` · GitHub Release APK · Railway `TELECRM_APP_*` |

상세 커밋: `git log --oneline -- apps/telecrm-android/`

---

## Play 출시 로드맵 (체크)

- [x] Play Console 앱 생성 (`com.cbiseo.marketer`)
- [x] 스토어 아이콘 512 등록
- [x] 내부 테스트 AAB (v25)
- [ ] 비공개 테스트 AAB (v26) 업로드·테스터 초대
- [ ] 앱 콘텐츠 전 항목 완료 (개인정보처리방침 URL · 데이터 보안 · 앱 액세스 테스트 계정)
- [ ] 프로덕션 심사·출시
- [ ] (선택) sideload `/telecrm-app` 안내를 Play 설치로 전환

---

## AAB 빌드 명령

```powershell
cd apps\telecrm-android
.\scripts\build-play-bundle.ps1
```

출력: `dist/telecrm-play-{versionName}-{versionCode}.aab` — **빌드 후 SHA256을 위 로그에 기록**.
