# Google OAuth — ADMIN 가입·로그인 (Phase 4·6)

> **대상**: Railway staging·production 운영자, 로컬 개발자  
> **코드**: `server/src/modules/auth-signup/` · `/signup` `GoogleSignupButton` · `/login` Google 로그인  
> **Play 앱 등록(별도)**: [`docs/GOOGLE_PLAY_CONSOLE.md`](../GOOGLE_PLAY_CONSOLE.md) · [`apps/cbiseo-android/docs/GOOGLE_PLAY_CBISEO.md`](../../apps/cbiseo-android/docs/GOOGLE_PLAY_CBISEO.md)

---

## 1. 무엇이 필요한가

| 항목 | 설명 |
|------|------|
| **OAuth 동의 화면 (Consent screen)** | Google 로그인 팝업에 **「청소비서」** 이름·로고·개인정보 URL 표시 |
| **Google Cloud OAuth 클라이언트 (Web)** | GSI `id_token`(가입) + code flow(로그인) |
| **Railway Variables** | `GOOGLE_OAUTH_CLIENT_ID` (+ Phase 6 code flow 시 `GOOGLE_OAUTH_CLIENT_SECRET`) |
| **Authorized JavaScript origins** | `/signup`·`/login`이 열리는 **프로토콜+호스트+포트** |

클라이언트는 **빌드타임 `VITE_` 변수 없음**. 페이지 로드 시  
`GET /api/public/auth-signup/oauth/google/config` 로 `clientId`를 받는다.

**현재 Railway**: staging·production 모두 `GOOGLE_OAUTH_CLIENT_ID` 설정됨 → **Console 동의 화면·origins만 맞추면** `/signup`·`/login` Google 버튼 동작.

---

## 2. OAuth 동의 화면 — 「청소비서」 등록 (필수)

> **Google Play 앱 등록과 다름.** 여기는 **Google Cloud → OAuth consent screen** 이다.  
> Play Console 앱 생성은 [`GOOGLE_PLAY_CBISEO.md`](../../apps/cbiseo-android/docs/GOOGLE_PLAY_CBISEO.md) 참고.

### Step 1 — 프로젝트·동의 화면 진입

1. [Google Cloud Console](https://console.cloud.google.com/) 로그인
2. 상단에서 **OAuth Web client가 있는 프로젝트** 선택 (없으면 **새 프로젝트** 생성 — 예: `CBISEO Production`)
3. **APIs & Services → OAuth consent screen** (한국어: **Google Auth Platform → 브랜딩** / **대상** 메뉴로 이름이 바뀌었을 수 있음)

### Step 2 — User type

| 선택 | 용도 |
|------|------|
| **External** | 일반 Google 계정(업체 ADMIN) 가입·로그인 — **필수** |
| Internal | Google Workspace 조직 내부만 — **사용 안 함** |

External 선택 후 **만들기** → 앱 정보 입력.

### Step 3 — 앱 정보 (브랜딩) — 복사·붙여넣기

| 필드 | 입력값 |
|------|--------|
| **앱 이름** | `청소비서` |
| **사용자 지원 이메일** | Play·운영 담당 Google 계정 이메일 (Console 로그인 계정) |
| **앱 로고** | `client/public/brand/clean-secretary-logo.png` 업로드 (120×120 권장, PNG) |
| **앱 도메인 → 홈페이지** | `https://www.cbiseo.com` |
| **앱 도메인 → 개인정보처리방침** | `https://www.cbiseo.com/legal/member-privacy` |
| **앱 도메인 → 서비스 약관** | `https://www.cbiseo.com/legal/member-terms` |
| **승인된 도메인** | `cbiseo.com` 추가 (www·apex는 자동 연관) |
| **개발자 연락처 이메일** | 팀 공용 이메일 1개 (Console 알림 수신) |

> 약관·개인정보는 공개 URL: `GET /api/public/legal/documents/member-privacy` 등으로도 제공됨. slug: `shared/platformLegalSlugs.ts`

### Step 4 — 범위(Scopes)

**Add or remove scopes** 에서 아래만 유지 (GSI·로그인 기본):

| Scope | 용도 |
|-------|------|
| `…/auth/userinfo.email` | Google 이메일 (계정 연결) |
| `…/auth/userinfo.profile` | 이름·프로필 |
| `openid` | OpenID Connect |

**민감·제한 범위(Drive, Gmail 등) 추가 금지** — 심사·검증 지연.

### Step 5 — 테스트 사용자 (Publishing 전)

동의 화면 **게시 상태 = Testing** 일 때:

- **Test users** 에 팀 Google 계정 **이메일** 추가
- Testing 상태에서는 **목록에 있는 계정만** Google 가입·로그인 가능

### Step 6 — 게시 (Production) — 운영 오픈 시

1. **OAuth consent screen → Publish app** (또는 **앱 게시**)
2. **모든 Google 사용자**에게 「청소비서」 동의 화면 표시
3. Google이 **브랜드 확인·앱 검증**을 요청할 수 있음 (홈페이지·개인정보 URL이 실제로 열리는지, 로고와 앱명 일치 등)

| 상태 | 누가 로그인 가능 |
|------|------------------|
| **Testing** | 테스트 사용자만 |
| **In production** | 모든 Google 계정 |

> **스테이징만** 팀 내부 검증: Testing + 테스트 사용자로 충분.  
> **www.cbiseo.com** 일반 업체 ADMIN 오픈: **Production 게시** 필요.

---

## 3. OAuth 클라이언트 (Web) — Credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**  
   (이미 Web client가 있으면 **편집**만 하면 됨)
   - Application type: **Web application**
   - Name: 예) `CBISEO signup staging`

### Authorized JavaScript origins (필수 — Phase 4 가입·Phase 6 GSI 로그인)

GSI는 **페이지 origin**만 검사한다. **한 번에 전부 등록**해 두면 스테이징→운영·로컬 전환 시 Console 재작업·전파 대기를 줄일 수 있다.

**Google Console → Credentials → Web client → 「승인된 JavaScript 원본」** 에 아래 **6개**를 각각 한 줄씩 추가:

```text
https://clean-solution-staging.up.railway.app
https://www.cbiseo.com
https://cbiseo.com
https://skcleantec.com
https://www.skcleantec.com
http://localhost:5173
http://localhost:5174
http://localhost:3000
```

| Origin | 용도 |
|--------|------|
| `https://clean-solution-staging.up.railway.app` | Railway **staging** `/signup` · `/login` |
| `https://www.cbiseo.com` | **운영(main)** canonical |
| `https://cbiseo.com` | 운영 apex (www 없이 접속 시) |
| `https://skcleantec.com` | **레거시 alias apex** — 여기서 `/signup` 열면 Google이 이 origin 검사 |
| `https://www.skcleantec.com` | alias www (리다이렉트·직접 접속 대비) |
| `http://localhost:5173` | 로컬 Vite 기본 |
| `http://localhost:5174` | Vite 포트 충돌 시 자동 증가 |
| `http://localhost:3000` | API 직접·프록시 없이 테스트할 때 |

> **형식**: `https://호스트` 또는 `http://localhost:포트` — **끝에 `/`·경로(`/signup`) 금지**

### Authorized redirect URIs (Phase 6 로그인 code flow — 미리 등록 권장)

**Phase 4 가입(GSI `id_token`)만** 쓸 때는 redirect URI가 **필수는 아니다**.  
Phase 6 **로그인**·code exchange를 같은 Web client로 쓸 계획이면 **지금 함께** 넣어 둔다.

**「승인된 리디렉션 URI」** 에 아래 **5개**:

```text
https://www.cbiseo.com/login
https://cbiseo.com/login
https://skcleantec.com/login
https://www.skcleantec.com/login
https://clean-solution-staging.up.railway.app/login
http://localhost:5173/login
http://localhost:5174/login
```

| URI | 용도 |
|-----|------|
| `https://www.cbiseo.com/login` | 운영 Google 로그인 콜백(Phase 6) |
| `https://cbiseo.com/login` | apex 도메인 |
| `https://clean-solution-staging.up.railway.app/login` | 스테이징 |
| `http://localhost:5173/login` · `5174` | 로컬 |

> Phase 6에서 콜백 경로를 `/auth/google/callback` 등으로 바꾸면 **그때 URI 한 줄 추가**하면 된다. `/login` 은 현재 UI 기준 placeholder.

### Railway Variables (환경별 Client ID)

| 환경 | `GOOGLE_OAUTH_CLIENT_ID` |
|------|---------------------------|
| **staging** | 동일 Web client ID (위 origins에 staging 포함) |
| **production (main)** | **같은 ID** 써도 됨 — origins에 `cbiseo.com` 이미 있으면 추가 Console 작업 없음 |
| **로컬** `server/.env` | 동일 ID |

운영·스테이징을 **OAuth 클라이언트 파일로 분리**하고 싶으면 staging용·prod용 Web client 2개를 만들고, 각 Railway 환경에 **다른** `GOOGLE_OAUTH_CLIENT_ID`를 넣는다. (Console origins는 각 client에 해당 환경만 넣어도 됨)

4. 생성 후 **Client ID** 복사 (Client Secret은 Phase 4 verify에는 불필요, Phase 6 code flow 시 필요)

---

## 4. Railway / server `.env` Variables

| 변수 | 필수 | 설명 |
|------|------|------|
| `GOOGLE_OAUTH_CLIENT_ID` | ✅ | Web client ID (`….apps.googleusercontent.com`) |
| `AUTH_SIGNUP_OAUTH_STATE_SECRET` | 권장 | `signupToken` JWT 서명용. **미설정 시 `JWT_SECRET` 폴백** |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Phase 4 ❌ | Phase 6 Google **code exchange** 시 ✅ |

**설정 위치**: Railway → API 서비스 → Variables (staging·production 각각)  
로컬: `server/.env` (gitignore)

```env
GOOGLE_OAUTH_CLIENT_ID="123456789-xxxx.apps.googleusercontent.com"
# AUTH_SIGNUP_OAUTH_STATE_SECRET="별도-랜덤-문자열-권장"
```

변수 추가·변경 후 **API 재배포(또는 `npm run dev` 재시작)**.

---

## 5. 동작 확인 (config)

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

## 6. E2E 테스트 체크리스트 (staging)

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

### C. Google-only ADMIN (Phase 6 이후)

- Google 가입 직후 **`/login` Google 로그인**으로 진입 가능 (Phase 6)
- **아이디+비밀번호 로그인 불가** (`passwordHash` null) — Google·카카오 로그인 또는 [`/forgot-password`](../forgot-password) 이메일 OTP로 비밀번호 **설정** (Phase 7)

### D. Android 앱 (Phase 8)

WebView에서는 Google GSI가 막히므로 **네이티브 Google Sign-In**을 사용한다.

| 항목 | 값 |
|------|-----|
| 코드 | `apps/cbiseo-android/.../NativeGoogleSignInHelper.kt` |
| Web client ID | `GET /api/public/auth-signup/oauth/google/config` → `requestIdToken` |
| 로그인 API | 웹과 동일 `POST /api/auth/oauth/google` (WebView 콜백) |
| Console | **동일 Web OAuth client** — 별도 Android client 불필요 (Web client ID로 id_token 발급) |

앱 `/login`에서 Google 버튼 탭 → 네이티브 계정 선택 → 업체 코드 없이 ADMIN JWT.

---

## 7. 트러블슈팅

| 증상 | 원인·조치 |
|------|-----------|
| Google 팝업 `origin_mismatch` · `origin=https://skcleantec.com` | **JavaScript origins**에 `https://skcleantec.com` (및 `www`) 추가 — cbiseo만 넣고 skcleantec에서 테스트한 경우 |
| 버튼 없음 | `GET …/config` → `enabled` / Railway Variable / 재배포 |
| verify 401/400 | clientId 불일치, 만료된 id_token, 시계 skew |
| OTP 발송 「Google 인증이 만료」 | 15분 내 complete — Google 버튼 다시 |
| `access_denied` · 「앱이 확인되지 않음」 | 동의 화면 **Testing** 인데 테스트 사용자에 본인 Gmail 미등록 |
| 가입 후 로그인 실패 | `/login` Google 버튼·redirect URI·`GOOGLE_OAUTH_CLIENT_SECRET` 확인 (Phase 6) |
| 심사·검증 요청 메일 | 홈·개인정보 URL 404 없는지, 앱명 **청소비서**·로고 일치 확인 |

---

## 8. 관련 문서

- [API.md](./API.md) — verify·signupToken 계약
- [UI_FLOW.md](./UI_FLOW.md) — `/signup` 화면
- [PHASES.md](./PHASES.md) — Phase 4~6 로드맵
