# 텔레CRM Android 앱 — 제품·기술 전략

> **목적**: 마케터가 **휴대폰(SIM)** 으로 전화·SMS를 걸면서, **동일 CRM 데이터**(고객 검색·상담 요약·스크립트·가격)를 보는 **Android 전용 동반 앱**을 전제로 한다.  
> **웹 텔레CRM**(` /admin/crm`)과 **API 계약**을 공유하며, 서버 CTI·자동 SMS는 1차 범위 밖이다.

---

## 1. 한 줄 요약

| 항목 | 방향 |
|------|------|
| 플랫폼 | **Android (Google Play)** 1차 — iOS는 별도 Phase |
| 통화·SMS | **OS(전화 앱·문자 앱)** 경유 — 회사 SIM·요금은 단말·통신사 |
| CRM | 기존 **`/api/crm/*`** + JWT(테넌트·마케터) |
| UI | **하이브리드 권장** — CRM WebView + 통화/SMS 네이티브 브릿지 |
| 서버 | Railway 단일 API 유지 — **모바일 전용 BFF는 필요 시만** |

---

## 2. 사용자 시나리오 (MVP)

1. 앱 로그인 (업체 코드 + 아이디 — 웹과 동일)
2. **기존 고객** — **전화번호** 또는 **이름** 검색
3. 동명이인이면 **연락처·주소**로 선택 (`match: pick`)
4. 선택한 접수 **상담 요약** — 발주서 금액·메모·특이사항·안내·추가 항목
5. **[통화]** — 번호 prefill 후 **셀룰러 발신**
6. **[문자]** — 스크립트/안내 문구 prefill 후 **문자 앱**으로 전달 (직원이 전송)
7. (선택) 통화 후 **상담 메모**·접수/부재 저장

**2차 이후**: 통화 시작·종료 **활동 로그**, 클릭투콜 서버 중계, 자동 SMS, iOS.

---

## 3. 기술 아키텍처

```
┌─────────────────────────────────────┐
│  Android 앱                          │
│  ├─ Auth (JWT, tenantId)            │
│  ├─ CRM UI (WebView 또는 RN 화면)    │
│  ├─ NativeBridge.call(phone)        │
│  └─ NativeBridge.sms(phone, body)   │
└──────────────┬──────────────────────┘
               │ HTTPS  /api/crm/*  /api/auth/*
               ▼
┌─────────────────────────────────────┐
│  SK클린텍 서버 (기존 Railway)         │
│  server/src/modules/telecrm/        │
└─────────────────────────────────────┘
```

### 3.1 하이브리드 vs 네이티브

| 방식 | 장점 | 단점 |
|------|------|------|
| **WebView + 브릿지 (권장 1차)** | 웹 CRM 재사용·배포 빠름 | 통화 중 UX·오프라인 제한 |
| **React Native / Flutter** | 통화 오버레이·푸시 확장 | CRM UI 이중 유지 비용 |
| **PWA만** | 개발 최소 | Play 정책·백그라운드·SMS 약함 — **주 앱으로 부적합** |

### 3.2 네이티브 브릿지 (Android)

| 동작 | 구현 | Play Store |
|------|------|------------|
| 전화 걸기 | `Intent.ACTION_CALL` / `tel:` | `CALL_PHONE` — 업무용 사유 명시 |
| 문자 보내기 | `Intent` + `smsto:` (본문 prefill) | **권장** — `SEND_SMS` 불필요 |
| 자동 SMS 발송 | `SmsManager` | **1차 금지** — 기본 SMS 앱 아니면 심사 거절 위험 |
| 통화 기록 읽기 | `READ_CALL_LOG` | 2차 — 사유·심사 필요 |

---

## 4. API·데이터 계약 (웹 ↔ 앱 공유)

모바일 앱은 **웹 전용 DOM·쿼리스트링에 의존하지 않는** JSON API만 사용한다.

### 4.1 인증

- `POST /api/auth/login` — `tenantSlug` + email + password
- JWT에 **`tenantId`** 포함 — 모든 CRM API는 `authMiddleware` + `requireTelecrmTenant`
- 앱: Secure Storage에 토큰 — 만료·401 시 재로그인 (웹 `from` 복귀 패턴과 별개)

### 4.2 CRM 핵심 API (현재·유지 대상)

| API | 앱 용도 |
|-----|---------|
| `GET /api/crm/customer-lookup?phone=` \| `?name=` | 고객 검색·동명이인 `pick` |
| (응답 `inquiries[]`) | **상담 brief** — memo, specialNotes, orderForm, customAnswers |
| `GET /api/crm/script-categories?scope=work` | 상담 스크립트 |
| `GET /api/crm/pricing/catalog` | 가격·평당 견적 |
| 접수·부재 POST/PATCH | 상담 후 저장 (기존 intake API 재사용) |

**DTO 단일 소스**: `client/src/api/telecrm.ts` 타입 ↔ 서버 serialize 함수 (`telecrmInquiryBrief.helpers.ts` 등).  
앱(RN/Kotlin) 추가 시 **동일 필드명·null 규칙**을 문서·OpenAPI(선택)로 맞춘다.

### 4.3 API 변경 원칙 (모바ile-safe)

1. **Breaking change 금지** — 필드 삭제·이름 변경 시 **deprecated 기간** + 앱 최소 버전 공지
2. **추가 필드는 optional** — 구 앱이 무시 가능하게
3. **목록·brief는 서버에서 완결** — 앱이 `/inquiries/:id` 전체 상세를 또 부르지 않게 (모바일 왕복 최소화)
4. **검색 파라미터 명시** — `phone` / `name` / `scope` (work \| personal \| shared) 문서화
5. **에러 메시지** — `{ error: string }` 한글, HTTP 코드 일관 (400/403/404)
6. **멀티테넌트** — 모든 쿼리 `tenantId` — `.cursor/rules/multitenant-safety.mdc` 필수
7. **권한** — `crm.view` / `crm.settings` / `inquiry.create` — 앱도 동일 게이트

### 4.4 향후 모바일 전용 API (필요 시)

| 후보 | 설명 |
|------|------|
| `POST /api/crm/call-sessions` | 통화 시작·종료·메모 (CTI 없이 수동/타이머) |
| `GET /api/crm/mobile-config` | SMS 템플릿·딥링크·최소 앱 버전 |
| `POST /api/crm/sms-log` | 문자 앱에서 돌아온 후 발송 기록(선택) |

새 엔드포인트는 **`server/src/modules/telecrm/`** 에만 추가 — inquiries 라우트에 CRM 로직 흩뿌리지 않는다.

---

## 5. UI·UX (앱 관점)

| 웹 CRM | 앱에서의 기대 |
|--------|----------------|
| 3열 PC 팝업 | **1열 스택** — 검색 → 요약 → 통화/문자 FAB |
| `ScheduleInquiryDetailModal` | 요약은 **brief 패널**, 전체 수정은 WebView 또는 딥링크 |
| 스크립트 `{고객명}` 치환 | 통화 전후 동일 — **서버 본문 + 클라 치환** |
| 개인/공통 스크립트·가격 | `scope=work` 병합 — **개인 우선** (현행 유지) |
| localStorage 초안 | 앱: **Secure Storage** 또는 서버-side draft(미래) |

---

## 6. 보안·운영

- 토큰·테넌트 ID를 로그·크래시 리포트에 남기지 않는다
- 분실 단말 — 짧은 JWT 만료 + 원격 로그아웃(미래)
- Play Console — **데이터 수집·권한 선언** (전화·연락처·인터넷)
- 앱과 웹 **동일 staging → production** DB/API 순서 배포

---

## 7. 개발 Phase

| Phase | 범위 | CRM 쪽 선행 |
|-------|------|-------------|
| **0 (현재)** | 웹 lookup·brief·개인 카탈로그 | ✅ 대부분 완료 |
| **1 MVP** | Android 셸 + 로그인 + lookup + 통화/SMS intent | API凍結·타입 문서 |
| **2** | WebView CRM 또는 RN 주요 화면 | 모바일 레이아웃 토큰(선택) |
| **3** | 통화 세션 로그·푸시 | `call-sessions` API |
| **4** | iOS | 별도 스토어·Intent 정책 |

---

## 8. 텔레CRM 수정 시 체크리스트 (필수)

웹·서버에서 **`server/src/modules/telecrm/`**, **`client/src/**/crm/`**, **`client/src/api/telecrm.ts`** 를 건드릴 때마다:

- [ ] 변경이 **`/api/crm/*` JSON 계약**에 영향 있는가? → optional 추가만, breaking 없음
- [ ] **`TelecrmCustomerLookupDto` / brief 필드**가 앱 상담 화면에 필요한가? → 서버 serialize + `telecrm.ts` 타입 동시 갱신
- [ ] **전화·이름 검색**·`match: pick` 동작을 깨지 않는가?
- [ ] **모바일 왕복** — 상세 API 추가 호출 없이 brief로 충분한가?
- [ ] **권한·tenantId** — multitenant 규칙 준수
- [ ] **문서** — 이 파일 §4·§8 또는 `docs/TELECRM.md` API 표 갱신
- [ ] (앱 출시 후) **최소 앱 버전** 필요 시 `mobile-config` 검토

에이전트·개발자 트리거: **`.cursor/rules/telecrm-mobile-app.mdc`**

---

## 9. 관련 파일

| 구분 | 경로 |
|------|------|
| 웹 CRM | `client/src/pages/admin/crm/CrmPage.tsx` |
| API 타입 | `client/src/api/telecrm.ts` |
| 고객 lookup | `server/src/modules/telecrm/telecrmCustomerLookup.service.ts` |
| 접수 brief | `server/src/modules/telecrm/telecrmInquiryBrief.helpers.ts` |
| 웹 CRM 문서 | `docs/TELECRM.md` |
| Cursor 규칙 | `.cursor/rules/telecrm-mobile-app.mdc` |

---

## 10. 의도적 미구현 (1차)

- 서버 CTI·WebRTC 소프트폰
- SMS 자동 발송(사용자 확인 없음)
- iOS
- 통화 녹음

이 항목은 **Phase 3+** 또는 별도 RFP로 분리한다.
