/**
 * 스테이징 읽기 전용 스모크.
 * 필요 env:
 *   SMOKE_ADMIN_TOKEN  — Bearer 관리자 토큰 (필수, 로컬에서만 설정)
 *   SMOKE_BASE_URL     — 기본 https://clean-solution-staging.up.railway.app
 *
 * 하나라도 HTTP 200이 아니거나 3초 초과면 exit 1.
 */
const BASE = (process.env.SMOKE_BASE_URL || 'https://clean-solution-staging.up.railway.app').replace(
  /\/$/,
  '',
);
const TOKEN = process.env.SMOKE_ADMIN_TOKEN?.trim() || '';
const TIMEOUT_MS = 3000;

if (!TOKEN) {
  console.error('SMOKE_ADMIN_TOKEN is required');
  process.exit(1);
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(start), end: ymd(end) };
}

const { start, end } = thisMonthRange();

const PATHS = [
  `/api/schedule?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&lite=1`,
  '/api/inquiries?limit=5',
  '/api/order-followups?limit=5',
  '/api/orderforms',
  '/api/cashbill/issues?limit=5',
  '/api/tax-invoices?limit=5',
];

async function getOnce(path) {
  const url = `${BASE}${path}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
      },
      signal: ac.signal,
    });
    const ms = Date.now() - t0;
    return { path, status: res.status, ms, ok: res.status === 200 && ms <= TIMEOUT_MS };
  } catch (err) {
    const ms = Date.now() - t0;
    const aborted = err?.name === 'AbortError';
    return {
      path,
      status: aborted ? 'TIMEOUT' : 'ERROR',
      ms,
      ok: false,
      error: aborted ? `exceeded ${TIMEOUT_MS}ms` : String(err?.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
for (const path of PATHS) {
  const r = await getOnce(path);
  results.push(r);
  const mark = r.ok ? 'OK' : 'FAIL';
  const detail = r.error ? ` ${r.error}` : '';
  console.log(`${mark} ${r.status} ${r.ms}ms ${r.path}${detail}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`smoke-staging failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`smoke-staging ok: ${results.length}/${results.length} @ ${BASE}`);
