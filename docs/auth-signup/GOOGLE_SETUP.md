# Google OAuth — ADMIN 가입 (Phase 4)

> **대상**: Railway staging·production 운영자, 로컬 개발자  
> **코드**: `server/src/modules/auth-signup/` · `/signup` `GoogleSignupButton`

---

## 1. 무엇이 필요한가

| 항목 | 설명 |
|------|------|
| **Google Cloud OAuth 클라이언트 (Web)** | 브라우저에서 Google Identity Services(GSI)로 `id_token` 발급 |
| **Railway Variables** | 서버가 `id_token` 검증 + `/signup`에 clientId 노출 |
| **Authorized JavaScript origins** | `/signup`이 열리는 **프로토콜+호스트+포트** (redirect URI 아님) |

클라이언트는 **빌드타임 `VITE_` 변수 없음**. 페이지 로드 시  
`GET /api/public/auth-signup/oauth/google/config` 로 `clientId`를 받는다.

---

## 2. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 선택(또는 생성)
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (내부 테스트는 Testing + 테스트 사용자 추가)
   - 앱 이름·지원 이메일·개발자 연락처 입력
   - Scopes: 기본 `email`, `profile`, `openid` (GSI One Tap/버튼 기본)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: 예) `CBISEO signup staging`

### Authorized JavaScript origins (필수)

GSI는 **페이지 origin**만 검사한다. 아래를 **각 환경마다** 추가한다.

| 환경 | Origin 예시 |
|------|-------------|
| 로컬 Vite | `http://localhost:5173` (포트 바뀌면 해당 포트도 추가) |
| 로컬 API 직접 | `http://localhost:3000` (프록시 없이 테스트할 때) |
| 스테이징 | `https://clean-solution-staging.up.railway.app` |
| 운영 | `https://www.cbiseo.com` · `https://cbiseo.com` |

### Authorized redirect URIs

**Phase 4 가입(GSI `id_token`)만** 쓸 때는 redirect URI가 **필수는 아니다**.  
Phase 6 **로그인(code flow)** 를 같은 클라이언트로 쓸 계획이면 미리 추가:

- `https://www.cbiseo.com/login` (또는 콜백 전용 경로 — Phase 6 설계 시 확정)
- 스테이징 동일 패턴

4. 생성 후 **Client ID** 복사 (Client Secret은 Phase 4 verify에는 불필요, Phase 6 code flow 시 필요)

---

## 3. Railway / server `.env` Variables

| 변수 | 필수 | 설명 |
|------|------|------|
| `GOOGLE_OAUTH_CLIENT_ID` | ✅ | Web client ID (`….apps.googleusercontent.com`) |
| `AUTH_SIGNUP_OAUTH_STATE_SECRET` | 권장 | `signupToken` JWT 서명용. **미설정 시 `JWT_SECRET` 폴백** |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Phase 4 ❌ | Phase 6 Google **code exchange** 시 |

**설정 위치**: Railway → API 서비스 → Variables (staging·production 각각)  
로컬: `server/.env` (gitignore)

```env
GOOGLE_OAUTH_CLIENT_ID="123456789-xxxx.apps.googleusercontent.com"
# AUTH_SIGNUP_OAUTH_STATE_SECRET="별도-랜덤-문자열-권장"
```

변수 추가·변경 후 **API 재배포(또는 `npm run dev` 재시작)**.

---

## 4. 동작 확인 (config)

브라우저 또는 curl:

```http
GET /api/public/auth-signup/oauth/google/config
```

응답 예:

```json
{ "enabled": true, "clientId": "….apps.googleusercontent.com" }
```

- `enabled: false` 또는 `clientId: ""` → Variable 미설정 또는 API 미재시작
- `/signup`에 Google 버튼이 **안 보이면** 위 응답부터 확인

---

## 5. E2E 테스트 체크리스트 (staging)

### A. Google 가입 (Happy path)

1. `/signup` — **「Google로 시작」** 버튼 표시
2. Google 계정 선택 → 「Google 계정 연결됨」 배너, **비밀번호 필드 숨김**
3. 업체 코드·관리자 정보·담당자 이메일·휴대폰 입력
4. **담당자 이메일 OTP** 발송·입력 (Google 이메일과 **다를 수 있음** — 의도된 정책)
5. 사업자 구분·약관 → 가입 완료
6. `/login?tenant=…&signup=google` — Google 로그인 안내 문구
7. DB 확인:
   - `Tenant` / `User` (ADMIN, `passwordHash` **null**)
   - `UserAuthIdentity` (`provider=GOOGLE`, `providerSub` = Google sub)
   - `TenantSignupBusiness`

### B. 중복·에러

| 시나리오 | 기대 |
|----------|------|
| 동일 Google sub로 **두 번째** 가입 시도 | verify 또는 complete **409** |
| `signupToken` 15분 초과 후 OTP 발송 | 재인증 안내 |
| `GOOGLE_OAUTH_CLIENT_ID` 없음 | 버튼 숨김, config `enabled: false` |

### C. Phase 4 한계 (의도)

- 가입 직후 **Google 로그인 불가** — Phase 6 전
- **아이디+비밀번호 로그인도 불가** (`passwordHash` null) — Phase 6 SNS 로그인 또는 Phase 7 비밀번호 설정

---

## 6. 트러블슈팅

| 증상 | 원인·조치 |
|------|-----------|
| Google 팝업 후 「origin mismatch」 | Console **JavaScript origins**에 현재 URL origin 추가 |
| 버튼 없음 | `GET …/config` → `enabled` / Railway Variable / 재배포 |
| verify 401/400 | clientId 불일치, 만료된 id_token, 시계 skew |
| OTP 발송 「Google 인증이 만료」 | 15분 내 complete — Google 버튼 다시 |
| 가입 후 로그인 실패 | **정상(Phase 4)** — Phase 6까지 로그인 미제공 |

---

## 7. 관련 문서

- [API.md](./API.md) — verify·signupToken 계약
- [UI_FLOW.md](./UI_FLOW.md) — `/signup` 화면
- [PHASES.md](./PHASES.md) — Phase 4~6 로드맵
