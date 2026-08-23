# Kakao OAuth — ADMIN 가입 (Phase 5)

> **대상**: Railway staging·production 운영자, 로컬 개발자  
> **코드**: `server/src/modules/auth-signup/signupOAuthKakao.service.ts` · `/signup` `KakaoSignupButton`

---

## 1. Google과 무엇이 다른가

| 항목 | Google (Phase 4) | Kakao (Phase 5) |
|------|------------------|-----------------|
| 클라이언트 | GSI 버튼 → `id_token` | **카카오 로그인 페이지 redirect** → `code` |
| 서버 verify | `POST …/oauth/google/verify` `{ idToken }` | `POST …/oauth/kakao/verify` `{ code, redirectUri }` |
| Console 설정 | JavaScript origins | **Redirect URI** (필수) |
| 환경 변수 | `GOOGLE_OAUTH_CLIENT_ID` | `KAKAO_REST_API_KEY` (또는 `KAKAO_OAUTH_REST_API_KEY`) |

가입 이후 흐름(담당자 이메일 OTP · 사업자 구분 · `signupToken` · `UserAuthIdentity`)은 **Google과 동일**합니다.

---

## 2. Kakao Developers 설정

1. [Kakao Developers](https://developers.kakao.com/) → 내 애플리케이션 → 앱 선택(또는 생성)
2. **앱 설정 → 플랫폼** → **Web** 사이트 도메인 등록  
   - `https://clean-solution-staging.up.railway.app`  
   - `https://www.cbiseo.com` · `https://cbiseo.com`  
   - `https://skcleantec.com` · `https://www.skcleantec.com`  
   - 로컬: `http://localhost:5173` 등
3. **제품 설정 → 카카오 로그인** → **활성화 ON**
4. **Redirect URI** — **아래 전부** 등록 (경로 `/signup` 포함, **끝 슬래시 없음**)

```text
https://clean-solution-staging.up.railway.app/signup
https://www.cbiseo.com/signup
https://cbiseo.com/signup
https://skcleantec.com/signup
https://www.skcleantec.com/signup
http://localhost:5173/signup
http://localhost:5174/signup
```

5. **동의항목** (선택) — 카카오 계정 이메일은 `account_email` 동의 시에만 `providerEmail`에 저장 (없어도 가입 가능)

6. **앱 키 → REST API 키** 복사 → Railway / `server/.env`

> **Client Secret**: 카카오 앱 유형에 따라 선택. 설정돼 있으면 Railway에 `KAKAO_OAUTH_CLIENT_SECRET` 추가.

---

## 3. Railway / server `.env`

| 변수 | 필수 | 설명 |
|------|------|------|
| `KAKAO_REST_API_KEY` | ✅ | REST API 키 (지도·가입 **공용** 가능) |
| `KAKAO_OAUTH_REST_API_KEY` | | 가입 전용 키를 쓸 때 (있으면 REST API 키보다 우선) |
| `KAKAO_OAUTH_CLIENT_SECRET` | | Client Secret 사용 시 |

```env
KAKAO_REST_API_KEY="your-rest-api-key"
# KAKAO_OAUTH_CLIENT_SECRET=
```

변경 후 **API 재배포** 또는 `npm run dev` 재시작.

---

## 4. 동작 확인

```http
GET /api/public/auth-signup/oauth/kakao/config
```

```json
{ "enabled": true, "restApiKey": "…" }
```

**E2E**

1. `/signup` → **카카오로 시작**
2. 카카오 로그인 → **`/signup?code=…`** 로 돌아옴 → 「카카오 계정 연결됨」
3. 담당자 이메일 OTP · 사업자 · complete
4. `/login?signup=kakao` — Phase 6 전 로그인 불가 (정상)

---

## 5. 트러블슈팅

| 증상 | 조치 |
|------|------|
| 카카오 버튼 없음 | `GET …/kakao/config` → `enabled` / `KAKAO_REST_API_KEY` |
| redirect_uri mismatch | Kakao Redirect URI와 **`{origin}/signup`** 정확히 일치 |
| `/signup` 복귀 후 「인증 상태가 올바르지 않음」 | state 만료·다른 탭 — 다시 「카카오로 시작」 |
| KOE101 / invalid_grant | code 1회용·만료 — 다시 시도 |
| 이미 가입된 카카오 409 | 동일 카카오 id로 재가입 불가 (정책) |

---

## 6. 관련 문서

- [GOOGLE_SETUP.md](./GOOGLE_SETUP.md) — Google origins (별도)
- [API.md](./API.md) · [PHASES.md](./PHASES.md)
