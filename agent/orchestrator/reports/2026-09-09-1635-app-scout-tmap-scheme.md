# AppScout — TMAP·카카오내비 호출

**일시:** 2026-09-09 16:35  
**요청:** [Flutter 티맵·카카오내비](https://hanarotg.tistory.com/365) 참조해 길안내가 앱 밖으로 열리게

## 한 줄
Android는 `tmap://route?referrer=com.skt.Tmap&goalx=경도&goaly=위도&goalname=이름`을 `ACTION_VIEW`로 연다. WebView `target=_blank`는 창 핸들러가 없으면 클릭이 사라진다.

## 레퍼런스
| 출처 | 가져올 패턴 |
|------|-------------|
| [hanarotg 365](https://hanarotg.tistory.com/365) | Android TMAP URL + queries 두 패키지 + 실패 시 Play `com.skt.tmap.ku` |
| [velog 동일 URL](https://velog.io/@leona/Flutter-%EC%9A%B0%EB%8B%B9%ED%83%95%ED%83%95-%EA%B0%9C%EB%B0%9C-%EC%9D%BC%EC%A7%805-%ED%8B%B0%EB%A7%B5-%EC%8B%A4%ED%96%89%ED%95%98%EA%B8%B0) | iOS는 `rGoX`/`rGoY`, Android는 `goalx`/`goaly` + `referrer` |
| 카카오 | 글은 공식 SDK. 우리 앱은 앱키 없음 → `kakaonavi://` Intent 유지 |

## CBISEO에 맞게
- 웹: 같은 창 `href=tmap://` → WebView `shouldOverride` → `ACTION_VIEW`
- `_blank` 제거 (StaffWebActivity에 `onCreateWindow` 없음)
- 네이티브: `launchUrl`처럼 `startActivity`만, `resolveActivity` 가드 없음
