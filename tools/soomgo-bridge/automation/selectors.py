"""숨고(Soomgo) URL·셀렉터 상수"""
URLS = {
    'LOGIN': 'https://soomgo.com/login',
    'CHAT_LIST': 'https://soomgo.com/pro/chats',
    'CHAT_ROOM': 'https://soomgo.com/pro/chats/{chat_id}?from=chatroom',
}

LOGIN = {
    'EMAIL_INPUT': "input[type='email'], input[name='email'], input[placeholder*='이메일']",
    'PASSWORD_INPUT': "input[type='password'], input[name='password']",
    'LOGIN_BUTTON': "button[type='submit']",
}
