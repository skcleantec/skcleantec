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

### Step 2 — REST API 키 + Redirect URI (필수 · 가입의 핵심)

```text
앱 설정 → 앱 → 플랫폼 키 → Default REST API 키 (대표) → 수정/상세
```

**「카카오 로그인 리다이렉트 URI」** (또는 **리다이렉트 URI**)에 **전부** 등록 — **`/signup` 포함**, 끝 `/` 없음:

```text
https://clean-solution-staging.up.railway.app/signup
https://www.cbiseo.com/signup
https://cbiseo.com/signup
https://skcleantec.com/signup
https://www.skcleantec.com/signup
http://localhost:5173/signup
http://localhost:5174/signup
```

앱 코드의 redirect는 **`{현재 origin}/signup`** 과 **한 글자도 같아야** 합니다 (`KOE006` = 불일치).

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

변경 후 **redeploy** / `npm run dev` 재시작.

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
| 카카오 버튼 없음 | `KAKAO_REST_API_KEY` + redeploy |
| `KOE006` / redirect_uri mismatch | **REST API 키** 하위 Redirect URI에 `{origin}/signup` 추가 |
| `KOE004` | 카카오 로그인 **사용 설정 OFF** |
| token 실패 / invalid_client | **클라이언트 시크릿** ON → Railway `KAKAO_OAUTH_CLIENT_SECRET` |
| 「인증 상태가 올바르지 않음」 | state 만료 — 다시 「카카오로 시작」 |
| 409 재가입 | 동일 카카오 id 정책 |

---

## 7. 관련 문서

- [GOOGLE_SETUP.md](./GOOGLE_SETUP.md)
- [API.md](./API.md) · [PHASES.md](./PHASES.md)
- [앱·앱 키 변경 사항](https://developers.kakao.com/docs/ko/getting-started/app-key-migration)
