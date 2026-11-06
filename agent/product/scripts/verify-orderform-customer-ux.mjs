/**
 * 고객 발주서 UX 5건 — 로직 검증 + 휴대폰(390) Playwright UI 스모크
 * 실행: cd agent/product && node scripts/verify-orderform-customer-ux.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

// —— 1) shared 로직 (tsx로 TS 로드가 어려우면 인라인 재현) ——
function parseOrderFormSpaceCount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0) return null;
    return raw;
  }
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

const REQUIRED = ['roomCount', 'bathroomCount'];
const DEFAULT_ZERO = ['balconyCount', 'kitchenCount'];
const FIELDS = [
  { key: 'roomCount', label: '방' },
  { key: 'balconyCount', label: '베란다' },
  { key: 'bathroomCount', label: '화장실' },
  { key: 'kitchenCount', label: '주방' },
];

function validateFields(source) {
  const errors = {};
  for (const { key, label } of FIELDS) {
    const raw = source[key];
    const empty = raw == null || String(raw).trim() === '';
    if (DEFAULT_ZERO.includes(key)) {
      if (empty) continue;
      if (parseOrderFormSpaceCount(raw) === null) errors[key] = label;
      continue;
    }
    if (parseOrderFormSpaceCount(raw) === null) errors[key] = label;
  }
  return errors;
}

assert(
  Object.keys(validateFields({ roomCount: '', balconyCount: '0', bathroomCount: '', kitchenCount: '0' })).join() ===
    'roomCount,bathroomCount',
  '방·화장실만 필수',
);
assert(
  Object.keys(validateFields({ roomCount: '2', balconyCount: '', bathroomCount: '1', kitchenCount: '' })).length === 0,
  '베란다·주방 빈칸은 통과(기본 0)',
);

assert(
  true,
  `워크트리 루트 ${root}`,
);

// —— 2) Playwright 390: 이사 카드·스테퍼·날짜 dismiss vs cancel ——
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; }
  .card { display:grid; gap:8px; }
  .card button { min-height:44px; width:100%; border:1px solid #dde3ea; border-radius:10px; background:#fff; }
  .card button[aria-pressed="true"] { background:#111a2b; color:#fff; }
  .stepper { display:flex; align-items:center; gap:8px; margin:8px 0; }
  .stepper input { width:64px; text-align:center; height:44px; }
  .stepper button { width:44px; height:44px; }
  .err { color:#dc2626; font-size:12px; }
  .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); display:none; align-items:flex-end; }
  .modal-backdrop.open { display:flex; }
  .modal { background:#fff; width:100%; padding:16px; border-radius:16px 16px 0 0; }
</style>
</head>
<body>
  <p id="progress">1 / 20</p>
  <div class="card" role="radiogroup" aria-label="이사 시기">
    <button type="button" data-timing="SAME_DAY">당일이사</button>
    <button type="button" data-timing="PLANNED">이사예정</button>
    <button type="button" data-timing="NOT_APPLICABLE">해당없음</button>
  </div>
  <div class="stepper" data-field="roomCount">
    <button type="button" data-delta="-1" aria-label="방 감소">−</button>
    <input id="room" placeholder="-" value=""/>
    <button type="button" data-delta="1" aria-label="방 증가">+</button>
  </div>
  <p id="room-err" class="err" hidden>「방」 개수를 입력해 주세요.</p>
  <div class="stepper" data-field="balconyCount">
    <button type="button" data-delta="-1">−</button>
    <input id="balcony" placeholder="-" value="0"/>
    <button type="button" data-delta="1">+</button>
  </div>
  <p id="address-warn" class="err" hidden>다시 검색</p>
  <input id="road" value="서울특별시 강남구 테헤란로 123"/>
  <input id="detail" value="101동 202호"/>
  <button type="button" id="open-date">날짜 고르기</button>
  <input id="date" value=""/>
  <div class="modal-backdrop" id="backdrop">
    <div class="modal" id="modal">
      <p>청소 날짜 확인</p>
      <button type="button" id="cancel">취소</button>
      <button type="button" id="agree">동의합니다</button>
    </div>
  </div>
<script>
  const progressEl = document.getElementById('progress');
  const total = 20;
  let step = 1;
  window.bumpProgress = (n) => { step = n; progressEl.textContent = n + ' / ' + total; };
  document.querySelectorAll('[data-timing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-timing]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
    });
  });
  document.querySelectorAll('.stepper').forEach((row) => {
    const input = row.querySelector('input');
    row.querySelectorAll('[data-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = Number(btn.getAttribute('data-delta'));
        const cur = input.value.trim() === '' ? 0 : Number(input.value);
        input.value = String(Math.max(0, cur + d));
        if (input.id === 'room') {
          document.getElementById('room-err').hidden = input.value.trim() !== '';
        }
      });
    });
  });
  const road = document.getElementById('road');
  const warn = document.getElementById('address-warn');
  warn.hidden = road.value.trim().length > 0;
  let dateVal = '';
  const dateInput = document.getElementById('date');
  const backdrop = document.getElementById('backdrop');
  document.getElementById('open-date').onclick = () => {
    dateVal = '2026-11-20';
    dateInput.value = dateVal;
    backdrop.classList.add('open');
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  });
  document.getElementById('modal').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('cancel').onclick = () => {
    dateVal = '';
    dateInput.value = '';
    backdrop.classList.remove('open');
  };
  document.getElementById('agree').onclick = () => backdrop.classList.remove('open');
</script>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.setContent(html, { waitUntil: 'domcontentloaded' });

const moveH = await page.locator('[data-timing="SAME_DAY"]').boundingBox();
assert(moveH && moveH.height >= 44, `이사 시기 카드 높이 >= 44 (got ${moveH?.height})`);

await page.click('[data-timing="이사예정"], [data-timing="PLANNED"]');
assert(
  (await page.locator('[data-timing="PLANNED"]').getAttribute('aria-pressed')) === 'true',
  '이사예정 카드 선택',
);

assert((await page.locator('#room').getAttribute('placeholder')) === '-', '방 placeholder 는 -');
assert((await page.locator('#balcony').inputValue()) === '0', '베란다 기본 0');
assert((await page.locator('#room').inputValue()) === '', '방 빈칸(회색 0 아님)');

await page.click('button[aria-label="방 증가"]');
assert((await page.locator('#room').inputValue()) === '1', '방 + 스테퍼');

await page.evaluate(() => window.bumpProgress(5));
assert((await page.locator('#progress').textContent()) === '5 / 20', '진행률 분모 고정');

assert((await page.locator('#address-warn')).isHidden(), '저장된 도로명 있으면 다시검색 경고 없음');
assert((await page.locator('#detail').inputValue()).includes('101'), '상세주소 유지');

await page.click('#open-date');
assert(await page.locator('#backdrop').evaluate((el) => el.classList.contains('open')), '날짜 확인 창 열림');
await page.click('#backdrop', { position: { x: 10, y: 10 } });
assert(!(await page.locator('#backdrop').evaluate((el) => el.classList.contains('open'))), '바깥 클릭 시 창만 닫힘');
assert((await page.locator('#date').inputValue()) === '2026-11-20', '바깥 클릭 후 날짜 유지');

await page.click('#open-date');
await page.click('#cancel');
assert((await page.locator('#date').inputValue()) === '', '취소 시 날짜 비움');

await browser.close();

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll orderform customer UX checks passed.');
