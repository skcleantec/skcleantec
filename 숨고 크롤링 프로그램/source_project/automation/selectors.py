# Source Generated with Decompyle++
# File: selectors.pyc (Python 3.12)

'''
숨고(Soomgo) 웹사이트 CSS/XPath 셀렉터 상수
'''
URLS = {
    'LOGIN': 'https://soomgo.com/login',
    'CHAT_LIST': 'https://soomgo.com/pro/chats',
    'CHAT_ROOM': 'https://soomgo.com/pro/chats/{chat_id}?from=chatroom' }
LOGIN = {
    'EMAIL_INPUT': "input[type='email'], input[name='email'], input[placeholder*='이메일']",
    'PASSWORD_INPUT': "input[type='password'], input[name='password']",
    'LOGIN_BUTTON': "button[type='submit'], button:has-text('로그인')" }
CHAT_LIST = {
    'TAB_ALL': "[role='tab']:has-text('전체'), li:has-text('전체')",
    'TAB_UNREAD': "[role='tab']:has-text('안 읽음'), li:has-text('안 읽음')",
    'SEARCH_INPUT': "input[type='search'], input[placeholder*='검색']",
    'CHAT_LIST_CONTAINER': 'ul.css-19wxjby',
    'CHAT_LIST_CONTAINER_FALLBACK': 'main ul',
    'CHAT_ITEM': 'ul.css-19wxjby > li',
    'CHAT_ITEM_ALT': 'main ul > li',
    'CUSTOMER_NAME': 'h5',
    'LAST_MESSAGE': 'p',
    'MESSAGE_TIME': 'p, span',
    'DATE_SEPARATOR': "[class*='date'], [class*='separator']",
    'PAGE_READY_INDICATOR': 'ul.css-19wxjby > li, main ul > li, ul[class*="css-"] > li, a[href*="/pro/chats/"]' }
CHAT_ROOM = {
    'BACK_BUTTON': "button[aria-label*='뒤로'], button:has(img[alt*='뒤로'])",
    'FAVORITE_BUTTON': "button[aria-label*='즐겨찾기'], button:has(svg[class*='heart']), button:has([class*='favorite'])",
    'MESSAGE_INPUT': "textarea, [contenteditable='true'], input[placeholder*='메시지']",
    'SEND_BUTTON': ".btn-submit, button[type='submit']:has-text('전송'), img.btn-submit",
    'FILE_INPUT': "input[type='file']",
    'FILE_ATTACH_ICON': "img[alt*='파일 첨부'], button:has(img[alt*='파일'])",
    'MESSAGE_LIST': "[role='list'], .message-list",
    'MESSAGE_ITEM': "[role='listitem'], .message-item",
    'QUOTE_VIEW_MESSAGE': "*:has-text('고객님이 견적을 조회하였습니다')",
    'SYSTEM_MESSAGE': ".system-message, [class*='system']",
    'DATE_SEPARATOR': "*:has-text('년'):has-text('월'):has-text('일')" }
SYSTEM_MESSAGES = {
    'QUOTE_VIEW': '고객님이 견적을 조회하였습니다',
    'HIRED_OTHER': '다른 고수를 고용함',
    'HIRED_ME': '내 고용',
    'YESTERDAY': '어제' }