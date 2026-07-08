"""숨고(Soomgo) URL·셀렉터 상수"""
URLS = {
    'LOGIN': 'https://soomgo.com/login',
    'CHAT_LIST': 'https://soomgo.com/pro/chats',
    'CHAT_ROOM': 'https://soomgo.com/pro/chats/{chat_id}?from=chatroom',
    'PRO_HOME': 'https://soomgo.com/pro',
}

# 받은요청·견적 등 채팅이 아닌 고수 업무 경로 (로그인 후 기본 랜딩에 자주 나타남)
NON_CHAT_PRO_PATH_HINTS = (
    '/pro/requests',
    '/pro/request',
    '/pro/received',
    '/pro/quotes',
    '/pro/quote',
    '/pro/estimate',
    '/pro/incoming',
)

LOGIN = {
    'EMAIL_INPUT': "input[type='email'], input[name='email'], input[placeholder*='이메일']",
    'PASSWORD_INPUT': "input[type='password'], input[name='password']",
    'LOGIN_BUTTON': "button[type='submit']",
}

CHAT_NAV = {
    'LINK': "a[href*='/pro/chats']",
}
