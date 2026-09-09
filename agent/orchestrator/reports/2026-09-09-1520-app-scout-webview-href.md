# AppScout — WebView 버튼 무반응

통용 해법: JS `onClick`+브릿지 대신 **https `<a href>`**. WebView `shouldOverrideUrlLoading`이 play.google.com·map.kakao.com을 외부 앱으로 연다. 커스텀 스킴(kakaonavi://)은 구 셸에서 ERR_UNKNOWN_URL_SCHEME.

포털+전체화면 투명 버튼은 히트테스트를 망가뜨림. 본문 카드·링크가 정답.
