"""
채팅 목록 처리 모듈
- 채팅방 목록 가져오기 (React fiber 기반 chatItem 추출)
- 스크롤 처리
- 채팅방 검색
"""
import logging
import re
import time
from typing import List, Dict, Optional, Set

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException

from automation.selectors import CHAT_LIST, SYSTEM_MESSAGES

logger = logging.getLogger(__name__)

_JS_EXTRACT_CHAT_ITEMS = """
return (function() {
    var debug = [];
    try {
        function isFiberKey(key) {
            return key.indexOf('__reactFiber') === 0 || key.indexOf('__reactInternalInstance') === 0;
        }
        function findFiberKey(el) {
            if (!el) return null;
            var keys = Object.keys(el);
            for (var k = 0; k < keys.length; k++) {
                if (isFiberKey(keys[k])) return keys[k];
            }
            var nodes = el.querySelectorAll('*');
            for (var i = 0; i < nodes.length && i < 80; i++) {
                keys = Object.keys(nodes[i]);
                for (var k2 = 0; k2 < keys.length; k2++) {
                    if (isFiberKey(keys[k2])) return keys[k2];
                }
            }
            return null;
        }
        function collectFibers(el, fiberKey, out, limit) {
            if (!el || out.length >= limit) return;
            if (el[fiberKey]) out.push(el[fiberKey]);
            var nodes = el.querySelectorAll('*');
            for (var i = 0; i < nodes.length && out.length < limit; i++) {
                if (nodes[i][fiberKey]) out.push(nodes[i][fiberKey]);
            }
        }
        function looksLikeChatItem(obj) {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
            var id = obj.id || obj.chat_id || obj.chatId || obj.room_id || obj.roomId;
            if (id === undefined || id === null || id === '') return false;
            if (typeof id === 'string' && !/^\\d+$/.test(id)) return false;
            return (
                obj.last_message !== undefined || obj.lastMessage !== undefined ||
                obj.updated_at !== undefined || obj.updatedAt !== undefined ||
                obj.last_message_type !== undefined || obj.lastMessageType !== undefined ||
                (obj.user && typeof obj.user === 'object')
            );
        }
        function normalizeChatItem(obj) {
            var user = obj.user || obj.customer || obj.member || null;
            var userName = '';
            var userIsLeaved = false;
            if (user) {
                userName = user.name || user.nickname || user.display_name || '';
                userIsLeaved = user.is_leaved || user.isLeaved || false;
            }
            return {
                id: obj.id || obj.chat_id || obj.chatId || obj.room_id || obj.roomId,
                last_message: obj.last_message || obj.lastMessage || obj.message || '',
                last_message_type: obj.last_message_type || obj.lastMessageType || '',
                updated_at: obj.updated_at || obj.updatedAt || obj.created_at || obj.createdAt || '',
                is_favorite: obj.is_favorite || obj.isFavorite || false,
                is_leaved: userIsLeaved,
                user_name: userName,
                new_message_count: obj.new_message_count || obj.newMessageCount || 0
            };
        }
        function scanObjectForChat(obj, seen, depth) {
            if (depth > 10 || !obj || typeof obj !== 'object') return null;
            if (seen.has(obj)) return null;
            seen.add(obj);
            if (looksLikeChatItem(obj)) return normalizeChatItem(obj);
            if (Array.isArray(obj)) {
                for (var i = 0; i < obj.length && i < 80; i++) {
                    var hit = scanObjectForChat(obj[i], seen, depth + 1);
                    if (hit) return hit;
                }
                return null;
            }
            var keys = Object.keys(obj);
            for (var k = 0; k < keys.length; k++) {
                var val = obj[keys[k]];
                if (!val || typeof val !== 'object') continue;
                if (looksLikeChatItem(val)) return normalizeChatItem(val);
                var hit2 = scanObjectForChat(val, seen, depth + 1);
                if (hit2) return hit2;
            }
            return null;
        }
        function deepFindInFiber(fiber, seenFibers, depth) {
            if (!fiber || depth > 60 || seenFibers.has(fiber)) return null;
            seenFibers.add(fiber);
            var seenObjs = new WeakSet();
            var props = fiber.memoizedProps || fiber.pendingProps || {};
            var hit = scanObjectForChat(props, seenObjs, 0);
            if (hit) return hit;
            var state = fiber.memoizedState;
            while (state) {
                seenObjs = new WeakSet();
                hit = scanObjectForChat(state, seenObjs, 0);
                if (hit) return hit;
                if (state.memoizedState) {
                    seenObjs = new WeakSet();
                    hit = scanObjectForChat(state.memoizedState, seenObjs, 0);
                    if (hit) return hit;
                }
                state = state.next;
            }
            var childHit = deepFindInFiber(fiber.child, seenFibers, depth + 1);
            if (childHit) return childHit;
            return deepFindInFiber(fiber.sibling, seenFibers, depth + 1);
        }
        function buildResult(chatItem, text) {
            return {
                chat_id: String(chatItem.id),
                nickname: chatItem.user_name || '',
                last_message: chatItem.last_message || '',
                last_message_type: chatItem.last_message_type || '',
                updated_at: chatItem.updated_at || '',
                is_favorite: chatItem.is_favorite || false,
                is_leaved: chatItem.is_leaved || false,
                new_message_count: chatItem.new_message_count || 0,
                text: text || ''
            };
        }
        function extractChatIdFromLi(li) {
            var attrs = ['data-chat-id', 'data-chatid', 'data-id', 'data-room-id', 'data-testid'];
            for (var a = 0; a < attrs.length; a++) {
                var val = li.getAttribute(attrs[a]);
                if (val && /^\\d+$/.test(String(val))) return String(val);
                var child = li.querySelector('[' + attrs[a] + ']');
                if (child) {
                    val = child.getAttribute(attrs[a]);
                    if (val && /^\\d+$/.test(String(val))) return String(val);
                }
            }
            var links = li.querySelectorAll('a[href*="/pro/chats/"], a[href*="/chats/"]');
            for (var j = 0; j < links.length; j++) {
                var m = (links[j].getAttribute('href') || links[j].href || '').match(/\\/pro\\/chats\\/(\\d+)/);
                if (m) return m[1];
            }
            return null;
        }
        function findChatItemInLi(li, fiberKey) {
            var fibers = [];
            collectFibers(li, fiberKey, fibers, 80);
            var seenFibers = new Set();
            for (var f = 0; f < fibers.length; f++) {
                var chatItem = deepFindInFiber(fibers[f], seenFibers, 0);
                if (chatItem && chatItem.id) return chatItem;
            }
            return null;
        }
        function findGlobalChatArrays(rootFiber) {
            var collected = [];
            var seenFibers = new Set();
            function walk(f, depth) {
                if (!f || depth > 80 || seenFibers.has(f)) return;
                seenFibers.add(f);
                var props = f.memoizedProps || {};
                var keys = Object.keys(props);
                for (var k = 0; k < keys.length; k++) {
                    var val = props[keys[k]];
                    if (Array.isArray(val) && val.length > 0) {
                        var chats = [];
                        for (var i = 0; i < val.length; i++) {
                            if (looksLikeChatItem(val[i])) chats.push(normalizeChatItem(val[i]));
                        }
                        if (chats.length >= 2) collected.push(chats);
                    }
                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                        if (Array.isArray(val.items)) {
                            var chats2 = [];
                            for (var j = 0; j < val.items.length; j++) {
                                if (looksLikeChatItem(val.items[j])) chats2.push(normalizeChatItem(val.items[j]));
                            }
                            if (chats2.length >= 2) collected.push(chats2);
                        }
                        if (Array.isArray(val.pages)) {
                            for (var pg = 0; pg < val.pages.length; pg++) {
                                var page = val.pages[pg];
                                if (page && Array.isArray(page.items)) {
                                    var chats3 = [];
                                    for (var x = 0; x < page.items.length; x++) {
                                        if (looksLikeChatItem(page.items[x])) chats3.push(normalizeChatItem(page.items[x]));
                                    }
                                    if (chats3.length >= 2) collected.push(chats3);
                                }
                            }
                        }
                    }
                }
                walk(f.child, depth + 1);
                walk(f.sibling, depth + 1);
            }
            walk(rootFiber, 0);
            collected.sort(function(a, b) { return b.length - a.length; });
            return collected.length ? collected[0] : [];
        }
        function findLiTextByChatId(chatId) {
            for (var liIdx = 0; liIdx < lis.length; liIdx++) {
                var liId = extractChatIdFromLi(lis[liIdx]);
                if (liId === chatId) return lis[liIdx].textContent || '';
            }
            return '';
        }
        function getAppRootFiber() {
            var roots = [
                document.getElementById('__next'),
                document.querySelector('main'),
                document.body
            ];
            for (var r = 0; r < roots.length; r++) {
                var el = roots[r];
                if (!el) continue;
                var keys = Object.keys(el);
                for (var k = 0; k < keys.length; k++) {
                    if (keys[k].indexOf('__reactContainer') === 0) {
                        var root = el[keys[k]];
                        if (root && root.current) return root.current;
                    }
                    if (isFiberKey(keys[k])) return el[keys[k]];
                }
            }
            return null;
        }
        function pickChatListUl(fiberKey) {
            var candidates = [];
            var selectors = ['ul.css-19wxjby', 'main ul', 'ul[class*="css-"]'];
            for (var s = 0; s < selectors.length; s++) {
                var nodes = document.querySelectorAll(selectors[s]);
                for (var n = 0; n < nodes.length; n++) {
                    var lis = nodes[n].querySelectorAll(':scope > li');
                    if (!lis.length) continue;
                    var score = lis.length;
                    if (fiberKey) {
                        for (var i = 0; i < Math.min(lis.length, 3); i++) {
                            if (findChatItemInLi(lis[i], fiberKey)) score += 100;
                            if (extractChatIdFromLi(lis[i])) score += 50;
                        }
                    }
                    candidates.push({
                        ul: nodes[n],
                        liCount: lis.length,
                        score: score,
                        method: selectors[s] + '_li=' + lis.length + '_score=' + score
                    });
                }
            }
            if (!candidates.length) {
                var allUls = document.querySelectorAll('ul');
                for (var u2 = 0; u2 < allUls.length; u2++) {
                    var liCount2 = allUls[u2].querySelectorAll(':scope > li').length;
                    if (liCount2 > 0) {
                        candidates.push({ ul: allUls[u2], liCount: liCount2, score: liCount2, method: 'any_ul_li=' + liCount2 });
                    }
                }
            }
            candidates.sort(function(a, b) { return b.score - a.score; });
            if (!candidates.length) return { ul: null, method: '' };
            return { ul: candidates[0].ul, method: candidates[0].method };
        }

        var probeLi = document.querySelector('main ul > li, ul[class*="css-"] > li, ul.css-19wxjby > li');
        var fiberKey = findFiberKey(probeLi || document.querySelector('main') || document.body);
        var picked = pickChatListUl(fiberKey);
        var ul = picked.ul;
        var ulMethod = picked.method;
        if (!ul) {
            debug.push('FAIL:no_ul_found');
            return { items: [], debug: debug.join('|') };
        }
        debug.push('ul=' + ulMethod);
        var lis = ul.querySelectorAll(':scope > li');
        if (!lis.length) {
            debug.push('FAIL:no_li');
            return { items: [], debug: debug.join('|') };
        }
        debug.push('li_count=' + lis.length);

        var results = [];
        var seenIds = {};
        if (fiberKey) {
            debug.push('fiber=' + fiberKey.substring(0, 24));
            for (var i = 0; i < lis.length; i++) {
                var chatItem = findChatItemInLi(lis[i], fiberKey);
                var chatId = chatItem ? String(chatItem.id) : extractChatIdFromLi(lis[i]);
                if (!chatId || seenIds[chatId]) continue;
                seenIds[chatId] = true;
                if (chatItem) {
                    results.push(buildResult(chatItem, lis[i].textContent || ''));
                } else {
                    results.push({
                        chat_id: chatId,
                        nickname: '',
                        last_message: '',
                        last_message_type: '',
                        updated_at: '',
                        is_favorite: false,
                        is_leaved: false,
                        new_message_count: 0,
                        text: lis[i].textContent || ''
                    });
                }
            }
            debug.push('li_extracted=' + results.length);
        } else {
            debug.push('FAIL:no_fiber_key');
        }

        if (!results.length && fiberKey) {
            var rootFiber = getAppRootFiber();
            if (rootFiber) {
                var globalChats = findGlobalChatArrays(rootFiber);
                debug.push('global_cache=' + globalChats.length);
                for (var g = 0; g < globalChats.length; g++) {
                    var gc = globalChats[g];
                    var chatIdG = String(gc.id);
                    if (seenIds[chatIdG]) continue;
                    seenIds[chatIdG] = true;
                    var liText = findLiTextByChatId(chatIdG);
                    results.push(buildResult(gc, liText));
                }
            }
        }

        if (!results.length) {
            for (var d = 0; d < lis.length; d++) {
                var domId = extractChatIdFromLi(lis[d]);
                if (!domId || seenIds[domId]) continue;
                seenIds[domId] = true;
                results.push({
                    chat_id: domId,
                    nickname: '',
                    last_message: '',
                    last_message_type: '',
                    updated_at: '',
                    is_favorite: false,
                    is_leaved: false,
                    new_message_count: 0,
                    text: lis[d].textContent || ''
                });
            }
            debug.push('dom_fallback=' + results.length);
        }

        debug.push('extracted=' + results.length);
        return { items: results, debug: debug.join('|') };
    } catch(e) {
        debug.push('EXCEPTION:' + e.message);
        return { items: [], debug: debug.join('|') };
    }
})()
"""

_JS_VISIBLE_CHAT_IDS = """
return (function() {
    function extractChatIdFromLi(li) {
        var links = li.querySelectorAll('a[href*="/pro/chats/"]');
        for (var j = 0; j < links.length; j++) {
            var m = (links[j].getAttribute('href') || links[j].href || '').match(/\\/pro\\/chats\\/(\\d+)/);
            if (m) return m[1];
        }
        return null;
    }
    var ul = document.querySelector('ul.css-19wxjby');
    if (!ul) {
        var uls = document.querySelectorAll('main ul, ul[class*="css-"]');
        var maxLi = 0;
        for (var u = 0; u < uls.length; u++) {
            var c = uls[u].querySelectorAll(':scope > li').length;
            if (c > maxLi) { maxLi = c; ul = uls[u]; }
        }
    }
    if (!ul) return [];
    var lis = ul.querySelectorAll(':scope > li');
    if (!lis.length) return [];
    var fk = null;
    for (var i = 0; i < Math.min(lis.length, 5); i++) {
        fk = Object.keys(lis[i]).find(function(k) {
            return k.indexOf('__reactFiber') === 0 || k.indexOf('__reactInternalInstance') === 0;
        });
        if (fk) break;
        var nodes = lis[i].querySelectorAll('*');
        for (var n = 0; n < nodes.length && n < 20; n++) {
            fk = Object.keys(nodes[n]).find(function(k) {
                return k.indexOf('__reactFiber') === 0 || k.indexOf('__reactInternalInstance') === 0;
            });
            if (fk) break;
        }
        if (fk) break;
    }
    function findCI(f, d) {
        if (d > 20 || !f) return null;
        var p = f.memoizedProps || f.pendingProps || {};
        if (p.chatItem && p.chatItem.id) return p.chatItem;
        if (p.chatRoom && p.chatRoom.id) return p.chatRoom;
        if (p.item && p.item.id && p.item.last_message !== undefined) return p.item;
        if (p.data && p.data.id && p.data.last_message !== undefined) return p.data;
        var c = findCI(f.child, d + 1);
        if (c) return c;
        return findCI(f.sibling, d + 1);
    }
    var ids = [];
    for (var i = 0; i < lis.length; i++) {
        var ci = null;
        if (fk && lis[i][fk]) ci = findCI(lis[i][fk], 0);
        if (!ci && fk) {
            var nodes2 = lis[i].querySelectorAll('*');
            for (var n2 = 0; n2 < nodes2.length && n2 < 20; n2++) {
                if (nodes2[n2][fk]) {
                    ci = findCI(nodes2[n2][fk], 0);
                    if (ci) break;
                }
            }
        }
        if (ci) ids.push(String(ci.id));
        else {
            var domId = extractChatIdFromLi(lis[i]);
            if (domId) ids.push(String(domId));
        }
    }
    return ids;
})()
"""

_JS_SCROLL_CHAT_LIST = """
return (function(deltaY, toTop) {
    function pickUl() {
        var selectors = ['ul.css-19wxjby', 'main ul', 'ul[class*="css-"]'];
        var best = null;
        var bestScore = 0;
        for (var s = 0; s < selectors.length; s++) {
            var nodes = document.querySelectorAll(selectors[s]);
            for (var n = 0; n < nodes.length; n++) {
                var lis = nodes[n].querySelectorAll(':scope > li');
                if (lis.length > bestScore) {
                    bestScore = lis.length;
                    best = nodes[n];
                }
            }
        }
        return best;
    }
    function isScrollable(el) {
        if (!el) return false;
        var st = window.getComputedStyle(el);
        var oy = st.overflowY;
        return (
            (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
            el.scrollHeight > el.clientHeight + 4
        );
    }
    function findScrollable(start) {
        var el = start;
        while (el) {
            if (isScrollable(el)) return el;
            el = el.parentElement;
        }
        var main = document.querySelector('main');
        if (main) {
            var nodes = main.querySelectorAll('div, section, aside, nav');
            var best = null;
            var bestExtra = 0;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (!isScrollable(n)) continue;
                var extra = n.scrollHeight - n.clientHeight;
                if (extra > bestExtra) {
                    bestExtra = extra;
                    best = n;
                }
            }
            if (best) return best;
        }
        return null;
    }
    function snapshot(target, ul) {
        var lis = ul ? ul.querySelectorAll(':scope > li') : [];
        var lastId = '';
        if (lis.length) {
            var last = lis[lis.length - 1];
            var links = last.querySelectorAll('a[href*="/pro/chats/"]');
            for (var j = 0; j < links.length; j++) {
                var m = (links[j].getAttribute('href') || links[j].href || '').match(/\\/pro\\/chats\\/(\\d+)/);
                if (m) { lastId = m[1]; break; }
            }
        }
        return {
            scrollTop: target ? target.scrollTop : window.scrollY,
            lastId: lastId,
            liCount: lis.length
        };
    }
    var ul = pickUl();
    if (!ul) {
        if (toTop) { window.scrollTo(0, 0); return { ok: true, moved: true }; }
        window.scrollBy(0, deltaY);
        return { ok: true, moved: true };
    }
    var target = findScrollable(ul) || ul;
    if (toTop) {
        if (target && target.scrollTop !== undefined) target.scrollTop = 0;
        window.scrollTo(0, 0);
        return { ok: true, moved: true };
    }
    var before = snapshot(target, ul);
    var prevTop = target && target.scrollTop !== undefined ? target.scrollTop : window.scrollY;
    if (target && target.scrollTop !== undefined) {
        target.scrollTop = Math.min(target.scrollTop + deltaY, target.scrollHeight);
    }
    if (target) {
        try {
            target.dispatchEvent(new WheelEvent('wheel', {
                deltaY: deltaY,
                bubbles: true,
                cancelable: true
            }));
        } catch (e) {}
    }
    var lis = ul.querySelectorAll(':scope > li');
    if (lis.length) {
        try {
            lis[lis.length - 1].scrollIntoView({ block: 'end', behavior: 'auto' });
        } catch (e2) {}
    }
    var afterTop = target && target.scrollTop !== undefined ? target.scrollTop : window.scrollY;
    var after = snapshot(target, ul);
    var moved = (
        afterTop !== prevTop ||
        after.lastId !== before.lastId ||
        after.liCount !== before.liCount
    );
    var atBottom = false;
    if (target && target.scrollTop !== undefined) {
        atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 12;
    }
    return { ok: true, moved: moved, atBottom: atBottom, before: before, after: after };
})(arguments[0], arguments[1]);
"""

_JS_CHAT_LIST_SCROLL_STATE = """
return (function() {
    function pickUl() {
        var selectors = ['ul.css-19wxjby', 'main ul', 'ul[class*="css-"]'];
        var best = null;
        var bestScore = 0;
        for (var s = 0; s < selectors.length; s++) {
            var nodes = document.querySelectorAll(selectors[s]);
            for (var n = 0; n < nodes.length; n++) {
                var lis = nodes[n].querySelectorAll(':scope > li');
                if (lis.length > bestScore) {
                    bestScore = lis.length;
                    best = nodes[n];
                }
            }
        }
        return best;
    }
    function isScrollable(el) {
        if (!el) return false;
        var st = window.getComputedStyle(el);
        var oy = st.overflowY;
        return (
            (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
            el.scrollHeight > el.clientHeight + 4
        );
    }
    function findScrollable(start) {
        var el = start;
        while (el) {
            if (isScrollable(el)) return el;
            el = el.parentElement;
        }
        var main = document.querySelector('main');
        if (main) {
            var nodes = main.querySelectorAll('div, section, aside, nav');
            var best = null;
            var bestExtra = 0;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (!isScrollable(n)) continue;
                var extra = n.scrollHeight - n.clientHeight;
                if (extra > bestExtra) {
                    bestExtra = extra;
                    best = n;
                }
            }
            if (best) return best;
        }
        return null;
    }
    var ul = pickUl();
    if (!ul) {
        return { ok: false, atBottom: true, scrollTop: 0, scrollHeight: 0, clientHeight: 0, remaining: 0 };
    }
    var target = findScrollable(ul) || ul;
    if (!target || target.scrollTop === undefined) {
        return { ok: false, atBottom: true, scrollTop: 0, scrollHeight: 0, clientHeight: 0, remaining: 0 };
    }
    var scrollTop = target.scrollTop;
    var scrollHeight = target.scrollHeight;
    var clientHeight = target.clientHeight;
    var remaining = scrollHeight - scrollTop - clientHeight;
    var atBottom = remaining <= 12;
    return {
        ok: true,
        atBottom: atBottom,
        scrollTop: scrollTop,
        scrollHeight: scrollHeight,
        clientHeight: clientHeight,
        remaining: remaining
    };
})();
"""


class ChatListManager:
    """채팅 목록 관리 클래스"""

    def __init__(self, driver, delay: float = 1.5):
        self.driver = driver
        self.delay = delay
        self.processed_chat_ids: Set[str] = set()
        self.last_extraction_debug: str = ''
        self._click_fallback_data: Optional[List[Dict]] = None

    def _parse_js_result(self, raw_result) -> tuple:
        """JS 추출 결과 파싱. {items, debug} 형식과 레거시 list 형식 모두 지원."""
        if raw_result is None:
            return [], 'result_is_None'
        if isinstance(raw_result, dict):
            items = raw_result.get('items', [])
            debug = raw_result.get('debug', '')
            return items or [], debug
        if isinstance(raw_result, list):
            return raw_result, ''
        return [], f'unexpected_type={type(raw_result).__name__}'

    def _find_chat_list_elements(self) -> List:
        """채팅 목록 li 요소 찾기"""
        for selector in (
            CHAT_LIST['CHAT_ITEM'],
            CHAT_LIST['CHAT_ITEM_ALT'],
            'ul[class*="css-"] > li',
            'main ul > li',
        ):
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if len(elements) >= 1:
                    return elements
            except Exception:
                continue
        return []

    def _extract_via_click_fallback(self, max_items: int = 15) -> List[Dict]:
        """fiber/DOM 추출 실패 시 목록 클릭으로 chat_id 수집"""
        if self._click_fallback_data is not None:
            return list(self._click_fallback_data)

        chat_items = []
        list_url = self.driver.current_url
        if '/pro/chats' not in list_url:
            return chat_items

        li_count = len(self._find_chat_list_elements())
        if li_count == 0:
            return chat_items

        seen_ids: Set[str] = set()
        limit = min(li_count, max_items)
        logger.info(f'[click_fallback] {limit}개 항목 클릭으로 chat_id 수집 시도')

        for idx in range(limit):
            try:
                li_elements = self._find_chat_list_elements()
                if idx >= len(li_elements):
                    break
                li = li_elements[idx]
                preview_text = (li.text or '').strip()
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({block: 'center'});",
                    li,
                )
                time.sleep(0.3)
                li.click()
                time.sleep(self.delay)

                match = re.search(r'/pro/chats/(\d+)', self.driver.current_url)
                if match:
                    chat_id = match.group(1)
                    if chat_id not in seen_ids:
                        seen_ids.add(chat_id)
                        chat_items.append({
                            'chat_id': chat_id,
                            'nickname': '',
                            'last_message': '',
                            'last_message_type': '',
                            'updated_at': '',
                            'is_favorite': False,
                            'is_leaved': False,
                            'new_message_count': 0,
                            'text': preview_text,
                        })
                self.driver.get(list_url)
                self._wait_for_page_ready(timeout=15)
                time.sleep(0.5)
            except StaleElementReferenceException:
                try:
                    self.driver.get(list_url)
                    self._wait_for_page_ready(timeout=15)
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f'[click_fallback] {idx + 1}번째 항목 실패: {type(e).__name__}: {e}')
                try:
                    self.driver.get(list_url)
                    self._wait_for_page_ready(timeout=15)
                except Exception:
                    pass

        logger.info(f'[click_fallback] {len(chat_items)}개 chat_id 수집 완료')
        self._click_fallback_data = list(chat_items)
        return chat_items

    def _finalize_extraction(
        self,
        all_data: List[Dict],
        debug_info: str,
        attach_elements: bool = False,
    ) -> List[Dict]:
        """추출 결과 후처리 및 클릭 폴백"""
        if not all_data and self.get_chat_count() > 0:
            all_data = self._extract_via_click_fallback()
            if all_data:
                debug_info = f'{debug_info}|click_fallback={len(all_data)}'
                logger.info(f'[채팅 목록] 클릭 폴백으로 {len(all_data)}개 chat_id 수집')
        self.last_extraction_debug = debug_info

        if not all_data:
            return []

        li_elements = self._find_chat_list_elements() if attach_elements else []
        chat_items = []
        for idx, item in enumerate(all_data):
            chat_id = item.get('chat_id')
            if not chat_id:
                continue
            element = li_elements[idx] if attach_elements and idx < len(li_elements) else None
            chat_items.append(self._build_chat_item(item, element=element))
        return chat_items

    def get_visible_chat_ids(self) -> set:
        """현재 DOM에 보이는 채팅방 ID 세트 반환"""
        return set(self.get_visible_chat_id_list())

    def get_visible_chat_id_list(self) -> List[str]:
        """현재 DOM에 보이는 채팅방 ID 목록 (순서 유지)"""
        try:
            result = self.driver.execute_script(_JS_VISIBLE_CHAT_IDS)
            if not result:
                return []
            return [str(chat_id) for chat_id in result if chat_id]
        except Exception:
            return []

    def get_chat_count(self) -> int:
        """채팅방 개수만 빠르게 반환"""
        for selector in (
            CHAT_LIST['CHAT_ITEM'],
            CHAT_LIST['CHAT_ITEM_ALT'],
            'ul[class*="css-"] > li',
            'a[href*="/pro/chats/"]',
        ):
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    return len(elements)
            except Exception:
                continue
        return 0

    def _wait_for_page_ready(self, timeout: int = 10) -> bool:
        """페이지 로드 및 JavaScript 렌더링 완료 대기"""
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, CHAT_LIST['PAGE_READY_INDICATOR'])
                )
            )
            time.sleep(0.5)
            return True
        except TimeoutException:
            logger.warning(f'[페이지 대기] {timeout}초 타임아웃 - 채팅방 요소 없음')
            return False
        except Exception as e:
            logger.warning(f'[페이지 대기] 오류: {type(e).__name__}: {e}')
            return False

    def get_chat_items(
        self,
        wait_for_load: bool = True,
        exclude_ids: Optional[Set[str]] = None,
    ) -> List[Dict]:
        """현재 화면에 보이는 채팅방 목록 가져오기"""
        if exclude_ids:
            return self._get_chat_items_batch(exclude_ids)
        return self._get_chat_items_legacy(wait_for_load)

    def _get_chat_items_batch(self, exclude_ids: Set[str]) -> List[Dict]:
        """React fiber 기반 배치 처리 (exclude_ids 필터링)"""
        try:
            raw_result = self.driver.execute_script(_JS_EXTRACT_CHAT_ITEMS)
            all_data, debug_info = self._parse_js_result(raw_result)
            if debug_info:
                logger.info(f'[get_chat_items_batch] JS디버그: {debug_info}')

            chat_items = self._finalize_extraction(all_data, debug_info, attach_elements=False)
            if not chat_items:
                logger.warning(f'[get_chat_items_batch] 채팅방 데이터 없음 | 디버그: {self.last_extraction_debug}')
                return []

            return [
                item for item in chat_items
                if item.get('chat_id') not in exclude_ids
            ]
        except Exception as e:
            logger.error(f'[get_chat_items_batch] 오류: {type(e).__name__}: {e}')
            return []

    def _get_chat_items_legacy(self, wait_for_load: bool = True) -> List[Dict]:
        """React fiber 기반 (element 참조 포함)"""
        try:
            if wait_for_load and not self._wait_for_page_ready():
                logger.warning('[채팅 목록] 페이지 로드 대기 실패, 현재 상태로 진행')

            raw_result = self.driver.execute_script(_JS_EXTRACT_CHAT_ITEMS)
            all_data, debug_info = self._parse_js_result(raw_result)
            if debug_info:
                logger.info(f'[get_chat_items_legacy] JS디버그: {debug_info}')

            chat_items = self._finalize_extraction(all_data, debug_info, attach_elements=True)
            if not chat_items:
                logger.warning(f'[채팅 목록] 채팅방 요소를 찾을 수 없음 | 디버그: {self.last_extraction_debug}')
            return chat_items
        except Exception as e:
            logger.error(f'채팅 목록 가져오기 오류: {e}')
            return []

    def _build_chat_item(self, item: dict, element=None) -> dict:
        chat_id = item.get('chat_id')
        return {
            'chat_id': chat_id,
            'href': f'/pro/chats/{chat_id}',
            'text': item.get('text', ''),
            'last_message': item.get('last_message', ''),
            'last_message_type': item.get('last_message_type', ''),
            'message_time': item.get('updated_at', ''),
            'nickname': item.get('nickname', ''),
            'is_favorite': item.get('is_favorite', False),
            'is_leaved': item.get('is_leaved', False),
            'new_message_count': item.get('new_message_count', 0),
            'element': element,
        }

    def find_chat_by_keyword(self, keyword: str) -> List[Dict]:
        """특정 키워드가 포함된 채팅방 찾기"""
        matching = []
        for item in self.get_chat_items():
            text = item.get('text', '')
            last_message = item.get('last_message', '')
            if keyword in text or keyword in last_message:
                matching.append(item)
        return matching

    def find_chat_by_emoji(self, emoji: str) -> List[Dict]:
        return self.find_chat_by_keyword(emoji)

    def find_chat_by_quote_inquiry(self) -> List[Dict]:
        return self.find_chat_by_keyword(SYSTEM_MESSAGES['QUOTE_VIEW'])

    def is_yesterday_message(self, text: str) -> bool:
        return SYSTEM_MESSAGES['YESTERDAY'] in text

    def _focus_chat_list_for_scroll(self) -> None:
        """원본 프로그램과 동일하게 목록 영역에 포커스 후 휠 스크롤이 먹게 한다."""
        li_elements = self._find_chat_list_elements()
        if not li_elements:
            return
        try:
            target_idx = min(len(li_elements) - 1, max(0, len(li_elements) // 2))
            ActionChains(self.driver).move_to_element(li_elements[target_idx]).perform()
            time.sleep(0.05)
        except Exception:
            pass

    def get_scroll_state(self) -> dict:
        """채팅 목록 스크롤 위치·바닥 여부."""
        try:
            result = self.driver.execute_script(_JS_CHAT_LIST_SCROLL_STATE)
            if isinstance(result, dict):
                return result
        except Exception as e:
            logger.debug('[get_scroll_state] %s', e)
        return {'ok': False, 'atBottom': True, 'remaining': 0}

    def is_at_bottom(self, tolerance: int = 12) -> bool:
        state = self.get_scroll_state()
        if not state.get('ok'):
            return True
        if state.get('atBottom'):
            return True
        remaining = state.get('remaining')
        if isinstance(remaining, (int, float)) and remaining <= tolerance:
            return True
        return False

    def scroll_down_detailed(self, scroll_amount: int = 500) -> dict:
        """아래로 스크롤 — moved·atBottom 포함."""
        result: dict = {'ok': False, 'moved': False, 'atBottom': True}
        try:
            raw = self.driver.execute_script(_JS_SCROLL_CHAT_LIST, scroll_amount, False)
            if isinstance(raw, dict):
                result = raw
        except Exception as e:
            logger.debug('[scroll_down_detailed] JS: %s', e)

        if not result.get('moved') and not result.get('atBottom'):
            try:
                self._focus_chat_list_for_scroll()
                ActionChains(self.driver).scroll_by_amount(0, scroll_amount).perform()
                time.sleep(0.08)
                state = self.get_scroll_state()
                result['atBottom'] = bool(state.get('atBottom'))
                result['moved'] = not result['atBottom'] and bool(state.get('ok'))
            except Exception as e:
                logger.debug('[scroll_down_detailed] fallback: %s', e)

        time.sleep(0.12)
        result['ok'] = True
        return result

    def scroll_down(self, scroll_amount: int = 500) -> bool:
        """
        채팅 목록 아래로 스크롤.
        원본: ActionChains scroll_by_amount 우선. 가상 목록은 JS wheel + scrollIntoView 보조.
        """
        info = self.scroll_down_detailed(scroll_amount)
        return bool(info.get('moved'))

    def scroll_to_top(self) -> bool:
        try:
            self.driver.execute_script(_JS_SCROLL_CHAT_LIST, 0, True)
            time.sleep(self.delay * 0.5)
            return True
        except Exception:
            try:
                self.driver.execute_script('window.scrollTo(0, 0);')
                time.sleep(self.delay * 0.5)
                return True
            except Exception as e:
                logger.error(f'최상단 스크롤 오류: {e}')
                return False

    def click_chat_item(self, chat_item: dict) -> bool:
        """채팅방 클릭하여 입장"""
        try:
            element = chat_item.get('element')
            if element:
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
                    element,
                )
                time.sleep(self.delay * 0.3)
                element.click()
                time.sleep(self.delay)
                return True

            chat_id = chat_item.get('chat_id')
            if chat_id:
                self.driver.get(f'https://soomgo.com/pro/chats/{chat_id}')
                time.sleep(self.delay)
                return True

            href = chat_item.get('href')
            if href:
                full_url = href if href.startswith('http') else f'https://soomgo.com{href}'
                self.driver.get(full_url)
                time.sleep(self.delay)
                return True
            return False
        except StaleElementReferenceException:
            chat_id = chat_item.get('chat_id')
            if chat_id:
                self.driver.get(f'https://soomgo.com/pro/chats/{chat_id}')
                time.sleep(self.delay)
                return True
            return False
        except Exception as e:
            logger.error(f'채팅방 클릭 오류: {e}')
            return False

    def mark_as_processed(self, chat_id: str):
        self.processed_chat_ids.add(chat_id)

    def is_processed(self, chat_id: str) -> bool:
        return chat_id in self.processed_chat_ids

    def clear_processed(self):
        self.processed_chat_ids.clear()

    def refresh(self):
        try:
            self._click_fallback_data = None
            self.driver.refresh()
            time.sleep(self.delay * 2)
        except Exception as e:
            logger.error(f'새로고침 오류: {e}')
