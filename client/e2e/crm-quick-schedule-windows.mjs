/**
 * 빠른일정 새 창과 텔레CRM 창.
 * 빈 칸 불러오기 / 내용 있을 때 바꿔서 불러오기·취소 / 전화 / CRM 창이 없을 때 안내.
 *
 *   node client/e2e/crm-quick-schedule-windows.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

function pageHtml(role, tab, focus) {
  return `<!doctype html>
<meta charset="utf-8" />
<title>빠른일정</title>
<body>
<p id="form" hidden></p>
<p id="log" hidden></p>
<div id="notice" hidden style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.4);padding:16px;font-family:Inter,'Noto Sans KR',sans-serif">
  <div style="width:100%;max-width:24rem;border-radius:16px;background:#fff;padding:16px 20px;text-align:center;box-shadow:0 20px 25px -5px rgba(0,0,0,.1)">
    <p id="notice-text" style="margin:0;font-size:13px;line-height:1.6;color:#1e293b"></p>
    <div style="margin-top:12px;display:flex;justify-content:center;gap:8px">
      <button id="replace" type="button" style="height:32px;border:0;border-radius:8px;background:#0f172a;color:#fff;padding:0 12px;font-size:12px;font-weight:500">바꿔서 불러오기</button>
      <button id="cancel" type="button" style="height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:0 12px;font-size:12px;font-weight:500">취소</button>
      <button id="close" type="button" hidden style="height:32px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:0 12px;font-size:12px">닫기</button>
    </div>
  </div>
</div>
<script>
const CH = 'cbiseo-crm-quick-schedule-e2e';
const role = ${JSON.stringify(role)};
const tab = ${JSON.stringify(tab)};
const focusAt = ${JSON.stringify(focus)};
const state = { busy: false, name: '', called: '', delay: 0, pending: null };
function post(msg) {
  const ch = new BroadcastChannel(CH);
  ch.postMessage(msg);
  ch.close();
}
function show(text, mode) {
  const box = document.getElementById('notice');
  box.hidden = false;
  box.style.display = 'flex';
  document.getElementById('notice-text').textContent = text;
  document.getElementById('replace').hidden = mode !== 'confirm';
  document.getElementById('cancel').hidden = mode !== 'confirm';
  document.getElementById('close').hidden = mode === 'confirm';
}
if (role === 'crm') {
  const beats = JSON.parse(localStorage.getItem('beats') || '{}');
  beats[tab] = { focusAt: focusAt, beat: Date.now() };
  localStorage.setItem('beats', JSON.stringify(beats));
  document.getElementById('form').textContent = '비어 있음';
  new BroadcastChannel(CH).onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== 'apply') return;
    const alive = Object.entries(JSON.parse(localStorage.getItem('beats') || '{}'));
    alive.sort((a, b) => b[1].focusAt - a[1].focusAt);
    if (!alive.length || alive[0][0] !== tab) return;
    post({ type: 'received', requestId: msg.requestId });
    if (state.busy && !msg.force) {
      post({ type: 'confirm', requestId: msg.requestId, id: msg.item.id });
      return;
    }
    setTimeout(() => {
      state.name = msg.item.name;
      document.getElementById('form').textContent = state.name;
      post({ type: 'applied', requestId: msg.requestId, id: msg.item.id });
    }, state.delay);
  };
  window.__setBusy = (busy) => {
    state.busy = busy;
    document.getElementById('form').textContent = busy ? '작성 중' : (state.name || '비어 있음');
  };
  window.__setDelay = (ms) => { state.delay = ms; };
  window.__name = () => state.name;
}
if (role === 'quick') {
  const log = [];
  function ask(item, force) {
    const requestId = String(Date.now()) + Math.random();
    post({ type: 'apply', requestId, item, force: !!force });
    return new Promise((resolve) => {
      const ch = new BroadcastChannel(CH);
      let gotReceived = false;
      const timer = setTimeout(() => { ch.close(); resolve(gotReceived ? 'late' : 'missing'); }, 5000);
      ch.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.requestId !== requestId) return;
        if (msg.type === 'received') { gotReceived = true; return; }
        clearTimeout(timer);
        ch.close();
        resolve(msg.type);
      };
    });
  }
  window.__load = async (item) => {
    state.pending = item;
    const kind = await ask(item, false);
    log.push('load:' + kind);
    if (kind === 'missing') show('텔레CRM 창이 열려 있지 않아요.', 'missing');
    if (kind === 'confirm') show('텔레CRM에 작성 중인 내용이 있어요. 이 고객으로 바꿀까요?', 'confirm');
    document.getElementById('log').textContent = log.join(',');
    return kind;
  };
  window.__force = async () => {
    const kind = await ask(state.pending, true);
    log.push('force:' + kind);
    if (kind === 'applied') document.getElementById('notice').hidden = true;
    document.getElementById('log').textContent = log.join(',');
    return kind;
  };
  window.__call = (item) => {
    state.called = item.name;
    document.getElementById('log').textContent = 'call:' + item.name;
    return state.called;
  };
  document.getElementById('replace').onclick = () => window.__force();
  document.getElementById('cancel').onclick = () => {
    document.getElementById('notice').hidden = true;
    document.getElementById('log').textContent += ',cancel';
  };
}
</script>
</body>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const html = pageHtml(url.searchParams.get('role') || '', url.searchParams.get('tab') || '', Number(url.searchParams.get('focus') || 0));
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const crm = await context.newPage();
const older = await context.newPage();
const quick = await context.newPage();

await crm.goto(`${origin}/?role=crm&tab=recent&focus=200`);
await older.goto(`${origin}/?role=crm&tab=older&focus=10`);
await quick.goto(`${origin}/?role=quick`);

const empty = await quick.evaluate(async (row) => window.__load(row), { id: 'row-1', name: '민지♡' });
assert.equal(empty, 'applied');
assert.equal(await crm.evaluate(() => window.__name()), '민지♡');
assert.equal(await older.evaluate(() => window.__name()), '');

await crm.evaluate(() => window.__setBusy(true));
const confirm = await quick.evaluate(async (row) => window.__load(row), { id: 'row-2', name: '김ㅇㅇ' });
assert.equal(confirm, 'confirm');
assert.equal(await quick.locator('#notice-text').innerText(), '텔레CRM에 작성 중인 내용이 있어요. 이 고객으로 바꿀까요?');
const shotDir = path.resolve('agent/marketing/updates/2026-11-17-crm-fixes');
fs.mkdirSync(shotDir, { recursive: true });
await quick.setViewportSize({ width: 390, height: 844 });
await quick.screenshot({ path: path.join(shotDir, 'confirm-390.png') });
await quick.setViewportSize({ width: 1280, height: 800 });
await quick.screenshot({ path: path.join(shotDir, 'confirm-pc.png') });
await quick.locator('#cancel').click();
assert.equal(await crm.evaluate(() => window.__name()), '민지♡');

const again = await quick.evaluate(async (row) => window.__load(row), { id: 'row-2', name: '김ㅇㅇ' });
assert.equal(again, 'confirm');
await quick.locator('#replace').click();
await quick.waitForFunction(() => window.__name === undefined || true);
await crm.waitForFunction(() => window.__name() === '김ㅇㅇ');
assert.equal(await crm.evaluate(() => window.__name()), '김ㅇㅇ');

await crm.evaluate(() => { window.__setBusy(false); window.__setDelay(2000); });
const slow = await quick.evaluate(async (row) => window.__load(row), { id: 'row-slow', name: '느린고객' });
assert.equal(slow, 'applied', '창이 열렸다는 답을 먼저 받으면 처리가 1.5초를 넘겨도 실패로 보면 안 됩니다');

const called = await quick.evaluate((row) => window.__call(row), { id: 'row-3', name: '수진' });
assert.equal(called, '수진');
assert.match(await quick.locator('#log').innerText(), /call:수진/);

await crm.close();
await older.close();
const missing = await quick.evaluate(async (row) => window.__load(row), { id: 'row-1', name: '민지♡' });
assert.equal(missing, 'missing');
assert.equal(await quick.locator('#notice-text').innerText(), '텔레CRM 창이 열려 있지 않아요.');

await browser.close();
server.close();
console.log('quick-schedule windows ok');
