#!/usr/bin/env node
/**
 * UI 규칙 v2 위반 개수 검사 (docs/design/ui-rules.md)
 *   node scripts/ui-audit.mjs            → 규칙별 개수와 기준값 비교. 늘어나면 실패(exit 1)
 *   node scripts/ui-audit.mjs --update   → 지금 개수를 기준값으로 저장(줄였을 때만 쓰기)
 *   node scripts/ui-audit.mjs --files    → 규칙별 위반이 많은 파일 상위 목록
 * 새 코드가 위반을 늘리지 못하게 막고, 화면을 고칠 때마다 기준값을 낮춘다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'src');
const baselinePath = join(here, 'ui-audit-baseline.json');

const RULES = [
  { id: 'raw-button', desc: '<button> 직접 작성 (components/ui 의 Button 사용)', re: /<button\b/g, skip: (f) => f.includes('/components/ui/') },
  { id: 'px-font', desc: 'text-[Npx]·text-[N.rem] 숫자 글자 크기', re: /\btext-\[(?:\d+(?:\.\d+)?)(?:px|rem)\]/g },
  { id: 'plain-font', desc: 'text-xs·text-sm·text-base 등 (text-fluid-* 5단계 사용)', re: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl)\b/g },
  { id: 'gray-palette', desc: 'gray-* 회색 (slate-* 로 통일)', re: /\b(?:text|bg|border|ring|divide|placeholder)-gray-\d{2,3}\b/g },
  { id: 'off-radius', desc: 'rounded·rounded-md·rounded-sm (lg·xl·2xl·full 만)', re: /\brounded(?:-md|-sm)?(?![\w-])/g },
  { id: 'accent-bg', desc: '파랑·보라·초록 등 진한 바탕 버튼색', re: /\bbg-(?:blue|indigo|violet|purple|sky|emerald|teal|green|cyan|fuchsia|pink|rose)-(?:5|6|7|8|9)00\b/g },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const files = walk(root);
const counts = {};
const perFile = {};
for (const rule of RULES) {
  counts[rule.id] = 0;
  perFile[rule.id] = [];
}
for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const text = readFileSync(file, 'utf8');
  for (const rule of RULES) {
    if (rule.skip?.('/' + rel)) continue;
    const n = (text.match(rule.re) || []).length;
    if (n) {
      counts[rule.id] += n;
      perFile[rule.id].push([rel, n]);
    }
  }
}

const args = new Set(process.argv.slice(2));
if (args.has('--files')) {
  for (const rule of RULES) {
    console.log(`\n■ ${rule.id} — ${rule.desc} (${counts[rule.id]})`);
    for (const [f, n] of perFile[rule.id].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${f}`);
  }
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
let failed = false;
console.log('UI 규칙 v2 위반 개수 (기준값 → 지금)');
for (const rule of RULES) {
  const base = baseline[rule.id];
  const now = counts[rule.id];
  const mark = base == null ? '  ' : now > base ? '▲ ' : now < base ? '▼ ' : '= ';
  if (base != null && now > base) failed = true;
  console.log(`${mark}${rule.id.padEnd(14)} ${String(base ?? '-').padStart(6)} → ${String(now).padStart(6)}   ${rule.desc}`);
}
if (args.has('--update')) {
  const next = { ...baseline };
  for (const rule of RULES) {
    if (next[rule.id] == null || counts[rule.id] < next[rule.id]) next[rule.id] = counts[rule.id];
  }
  writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n');
  console.log('\n기준값을 저장했습니다(줄어든 항목만 낮춤).');
  process.exit(0);
}
if (failed) {
  console.error('\n▲ 표시된 규칙의 위반이 기준값보다 늘었습니다. 새로 쓴 코드를 규칙(docs/design/ui-rules.md)에 맞춰 주세요.');
  process.exit(1);
}
