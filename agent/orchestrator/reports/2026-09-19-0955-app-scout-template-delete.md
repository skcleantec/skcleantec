# AppScout — 안 쓰는 발주서는 지우고, 기본은 끄기만

## 추천 방법
1. 목록 **안 쓰는 발주서** 카드에 **삭제**를 바로 둔다. 양식 안으로 들어가지 않아도 된다.
2. **입주청소 기본**은 삭제 버튼을 아예 숨긴다. 사용 끄기만.
3. 쓰는 중인 양식은 먼저 끈 뒤 삭제. 비밀번호 확인은 기존과 같다.
4. 스와이프 삭제는 쓰지 않는다. 비밀번호 모달이 필요하고, 실수 삭제를 막는다.

## 타 앱 작동방식
| 앱·출처 | 최신 흐름 | 우리에게 쓸 점 |
|---------|-----------|----------------|
| Jobber Requests | 목록 옆 메뉴에서 Delete. 기본 폼은 하나만 두고 다른 폼만 지움 | 목록에서 바로 지움, 기본은 보호 |
| Housecall Pro Templates | More → Delete → 확인 창 | 확인 후 삭제. 이미 쓴 건은 남김 |
| Typeform | 메뉴 Delete + 확인. 권한 없으면 버튼 숨김 | 못 지우는 건 버튼 자체를 숨김 |

## 모바일 인기 디자인 레퍼런스
| 순위 | 출처 URL | 왜 인기인가 | 가져올 패턴 |
|------|----------|-------------|-------------|
| 1 | https://help.getjobber.com/hc/en-us/articles/39026037947543-Requests-and-Bookings-Settings | 현장 SaaS 실화면 도움말 | 목록 액션 + 기본 폼 보호 |
| 2 | https://developer.apple.com/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:) | iOS 표준 스와이프 삭제 | 가져오지 않음 — 비밀번호 확인과 안 맞음 |
| 3 | https://help.typeform.com/hc/en-us/articles/360040196472-What-happens-to-deleted-responses-forms-and-accounts | 삭제 전 확인·복구 불가 | 비밀번호 + 이미 보낸 서류는 유지 |

## 하지 말 것
- 기본 발주서 삭제(비활성 버튼으로라도 시도 유도)
- 사용 중인 양식을 목록에서 바로 지움
- 스와이프로 비밀번호 없이 삭제

## DesignPulse / 구현에 넘길 한 줄
안 쓰는 카드에만 「삭제」를 두고, 기본은 끄기만 보이게.
