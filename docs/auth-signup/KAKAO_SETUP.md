# Kakao OAuth — ADMIN 가입 (Phase 5)

> **대상**: Railway staging·production 운영자, 로컬 개발자  
> **코드**: `server/src/modules/auth-signup/signupOAuthKakao.service.ts` · `/signup` `KakaoSignupButton`  
> **공식 문서**: [카카오 로그인 설정하기](https://developers.kakao.com/docs/ko/kakaologin/prerequisite) · [앱·앱 키 변경 사항(2025)](https://developers.kakao.com/docs/ko/getting-started/app-key-migration)

---

## 1. Google과 무엇이 다른가

| 항목 | Google (Phase 4) | Kakao (Phase 5) |
|------|------------------|-----------------|
| 클라이언트 | GSI 버튼 → `id_token` | **카카오 로그인 redirect** → `/signup?code=` |
| Console (구) | JavaScript **원본** | ~~제품 설정 > 카카오 로그인 Redirect URI~~ |
| Console (**2025 개편**) | (동일) | **`플랫폼 키` > REST API 키 > 리다이렉트 URI** |
| 환경 변수 | `GOOGLE_OAUTH_CLIENT_ID` | `KAKAO_REST_API_KEY` + (보통) `KAKAO_OAUTH_CLIENT_SECRET` |

청소비서 가입은 **REST API 방식** (`client_id` = REST API 키, authorize → code → 서버 token 교환)입니다.  
**JavaScript 키·JS SDK 도메인은 이 흐름에 필요 없습니다.**

---

## 2. Kakao Developers 설정 (2025 콘솔 기준)

> 예전 **`앱 > 플랫폼 > Web > 사이트 도메인`** 메뉴는 **개편으로 사라졌습니다.**  
> **`제품 링크 관리 > 웹 도메인`** 은 카카오톡 공유용 — **OAuth 가입과 무관**합니다.

### Step 1 — 카카오 로그인 ON (필수)

```text
제품 설정 → 카카오 로그인 → 일반 → 사용 설정 → ON
```

OFF면 `KOE004` 에러.

### Step 2 — REST API 키 + Redirect URI (필수 · **최대 10개**)

```text
앱 설정 → 앱 → 플랫폼 키 → Default REST API 키 (대표) → 수정/상세
```

카카오 Developers는 **REST API 키당 Redirect URI를 최대 10개**까지만 등록할 수 있습니다.  
10칸이 꽉 차면 **`+`로 더 추가되지 않습니다** — 기존 항목을 **`−`로 삭제**한 뒤 다시 저장해야 합니다.

**앱 코드**는 브라우저 `{origin}` 기준으로 아래 **3종 경로**만 redirect 합니다. 등록 URI는 **한 글자도** 같아야 합니다 (`KOE006` = 불일치, 끝 `/` 금지).

| 경로 | 용도 |
|------|------|
| `{origin}/signup` | 신규 ADMIN 카카오 가입 |
| `{origin}/login` | 카카오 로그인 |
| `{origin}/admin/account/kakao-link` | 기존 ADMIN 계정 카카오 **연결** |

#### ✅ 운영 표준 — Redirect URI 10칸 (2026-03 적용)

청소비서 Kakao 앱에 **아래 10개만** 등록하는 것을 표준으로 합니다. (스크린샷·콘솔과 동일)

```text
 1. https://clean-solution-staging.up.railway.app/signup
 2. https://www.cbiseo.com/signup
 3. https://cbiseo.com/signup
 4. http://localhost:5173/signup
 5. https://cbiseo.com/login
 6. https://www.cbiseo.com/login
 7. https://www.cbiseo.com/admin/account/kakao-link
 8. https://clean-solution-staging.up.railway.app/login
 9. https://clean-solution-staging.up.railway.app/admin/account/kakao-link
10. http://localhost:5173/admin/account/kakao-link
```

| 환경 | signup | login | kakao-link |
|------|:------:|:-----:|:----------:|
| **스테이징** (`clean-solution-staging…`) | ✅ #1 | ✅ #8 | ✅ #9 |
| **운영 www** (`www.cbiseo.com`) | ✅ #2 | ✅ #6 | ✅ #7 |
| **운영 non-www** (`cbiseo.com`) | ✅ #3 | ✅ #5 | ❌ (10칸 한도) |
| **로컬** (`localhost:5173`) | ✅ #4 | ❌ (10칸 한도) | ✅ #10 |

**의도적으로 빼 둔 것 (10칸 한도)**

| 제외 URI | 이유 |
|----------|------|
| `skcleantec.com` · `www.skcleantec.com` | 레거시 도메인 — cbiseo.com 기준 운영 |
| `http://localhost:5174/*` | 로컬은 **5173 포트만** 사용 (`npm run dev` 기본) |
| `https://cbiseo.com/admin/account/kakao-link` | 10칸 한도 — **연결·로그인은 `www.cbiseo.com`에서** 진행 |
| `http://localhost:5173/login` | 10칸 한도 — 로컬 **카카오 로그인**이 필요하면 아래 「칸 교체」 참고 |

**10칸을 바꿔야 할 때 (칸 교체)**

- 로컬에서 **카카오 로그인**까지 테스트: `#10` `…/admin/account/kakao-link` 를 **`http://localhost:5173/login`** 으로 **일시 교체** (연결 E2E는 스테이징·운영 www에서 검증).
- `cbiseo.com`(www 없음)에서 **카카오 계정 연결** 필요: `#4` 로컬 signup 등 **덜 쓰는 칸**과 `https://cbiseo.com/admin/account/kakao-link` **교체**.
- 새 도메인·경로 추가 시: **반드시 기존 1칸 삭제** 후 추가 — 목록 전체를 위 표준 10개와 맞춰 유지.

등록 후 콘솔에서 **저장** → ADMIN **카카오 계정 연결** 또는 **카카오 로그인**으로 `{origin}`이 위 표와 일치하는지 확인합니다.

### Step 3 — 클라이언트 시크릿 (거의 필수)

같은 화면 **REST API 키 상세 → 클라이언트 시크릿**

- 2025 개편 후 REST API 키는 **클라이언트 시크릿이 기본 활성**인 경우가 많음
- **ON** 이면 토큰 교환 시 `client_secret` **필수** — 서버 `KAKAO_OAUTH_CLIENT_SECRET`에 넣어야 함
- OFF면 Railway에 secret 불필요

### Step 4 — REST API 키 → Railway

**플랫폼 키** 목록에 보이는 **REST API 키** 값(예: `b1b5bb0…`)을:

```env
KAKAO_REST_API_KEY="…"
KAKAO_OAUTH_CLIENT_SECRET="…"   # Step 3 ON일 때
```

| 키 종류 | 가입에 쓰나? |
|---------|-------------|
| **REST API 키** | ✅ `client_id` + Railway |
| JavaScript 키 | ❌ (JS SDK 쓸 때만) |
| 네이티브 앱 키 | ❌ |

### Step 5 — 동의항목 (선택)

`제품 설정 → 카카오 로그인 → 동의항목` — 카카오 이메일(`account_email`)은 동의·심사 후에만 참고용 저장. **없어도 가입 가능.**

---

## 3. 메뉴对照 (헷갈리기 쉬운 것)

| 메뉴 | OAuth 가입 |
|------|------------|
| **제품 링크 관리 > 웹 도메인** | ❌ 공유 링크용 |
| ~~앱 > 플랫폼 > Web~~ | ❌ 구 콘솔 (폐지) |
| **플랫폼 키 > REST API 키 > Redirect URI** | ✅ **여기** |
| **플랫폼 키 > JavaScript 키 > JS SDK 도메인** | ❌ REST 가입 불필요 |
| **제품 설정 > 카카오 로그인 > 사용 ON** | ✅ 필수 |

---

## 4. Railway / server `.env`

| 변수 | 필수 | 설명 |
|------|------|------|
| `KAKAO_REST_API_KEY` | ✅ | 플랫폼 키 화면 REST API 키 |
| `KAKAO_OAUTH_CLIENT_SECRET` | 보통 ✅ | REST API 키 상세, secret ON일 때 |
| `KAKAO_OAUTH_REST_API_KEY` | | 가입 전용 키 분리 시 (있으면 REST API 키보다 우선) |
| `KAKAO_ADMIN_KEY` | | (선택) 연결 해제 시 카카오 Developers 쪽 연동 끊기 — 없으면 DB만 해제 |

변경 후 **redeploy** / `npm run dev` 재시작.

---

## 4.1 기존 ADMIN 계정 카카오 연결 (Phase 6+)

- **경로**: 로그인 후 프로필 메뉴 → **카카오 계정 연결** (`/admin/account/kakao-link`)
- **API**: `POST /api/auth/oauth/kakao/link` · `POST /api/auth/oauth/kakao/unlink` (비밀번호 확인 필수)
- **Redirect URI**: Step 2 **운영 표준 10칸** 중 `#7` · `#9` · `#10` (`{origin}/admin/account/kakao-link`)
- **대상**: ADMIN만 (마케터·팀장은 2차)
- **권장 접속 URL**: `https://www.cbiseo.com` (www) — non-www·로컬은 10칸 한도로 kakao-link URI가 없을 수 있음

**E2E**

1. **`https://www.cbiseo.com`** (또는 스테이징)에서 ADMIN 아이디·비밀번호 로그인
2. 프로필 → **카카오 계정 연결** → 카카오 인증 → 비밀번호 확인 → **연결 완료**
3. 로그아웃 후 **카카오로 로그인** 성공

**연결 해제 (선택 — 카카오 앱 목록까지 끊기)**

- Railway·`server/.env`에 **`KAKAO_ADMIN_KEY`** (Kakao Developers **Admin 키**, REST API 키와 다름) 설정
- 없으면 청소비서 DB만 해제 — 기능상 문제 없음

---

## 5. 동작 확인

```http
GET /api/public/auth-signup/oauth/kakao/config
```

```json
{ "enabled": true, "restApiKey": "…" }
```

**E2E**

1. `/signup` → **카카오로 시작**
2. 카카오 로그인 → **`/signup?code=…`** → 「카카오 계정 연결됨」
3. 담당자 이메일 OTP · 사업자 · complete
4. `/login?signup=kakao` — Phase 6 전 로그인 불가 (정상)

---

## 6. 트러블슈팅

| 증상 | 조치 |
|------|------|
| Redirect URI **더 추가 안 됨** | **10칸 한도** — Step 2 표준 목록·「칸 교체」 참고, `−`로 삭제 후 추가 |
| 카카오 버튼 없음 | `KAKAO_REST_API_KEY` + redeploy |
| `KOE006` / redirect_uri mismatch | 접속 `{origin}`+경로가 Step 2 **10칸 목록과 한 글자도 동일**한지 확인 (`www`·`http`·포트·끝 `/`) |
| `KOE004` | 카카오 로그인 **사용 설정 OFF** |
| token 실패 / invalid_client | **클라이언트 시크릿** ON → Railway `KAKAO_OAUTH_CLIENT_SECRET` |
| 「인증 상태가 올바르지 않음」 | state 만료 — 다시 「카카오로 시작」·「연결하기」 |
| 409 재가입 / 이미 연결 | 동일 카카오 id 정책 |
| non-www·로컬에서 **계정 연결** `KOE006` | kakao-link URI 없음(한도) — **`www.cbiseo.com` 또는 스테이징**에서 연결 |
| 로컬 **카카오 로그인** `KOE006` | `localhost:5173/login` 미등록(한도) — 스테이징에서 로그인 테스트 또는 Step 2 「칸 교체」 |

---

## 7. 관련 문서

- [GOOGLE_SETUP.md](./GOOGLE_SETUP.md)
- [API.md](./API.md) · [PHASES.md](./PHASES.md)
- [앱·앱 키 변경 사항](https://developers.kakao.com/docs/ko/getting-started/app-key-migration)
