/**
 * 도움말 markdown 의 {{ui:…}} 토큰이 registry 에 모두 있는지 검사
 * node scripts/verify-help-ui-tokens.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_RE = /\{\{ui:([^}|]+)(?:\|[^}]+)?\}\}/g;

function loadRegisteredTokens() {
  const src = fs.readFileSync(path.join(root, 'shared', 'helpUiTokens.ts'), 'utf8');
  const m = src.match(/export const HELP_UI_TOKENS = \[([\s\S]*?)\] as const/);
  if (!m) throw new Error('HELP_UI_TOKENS not found');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function collectMarkdownFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...collectMarkdownFiles(full));
    else if (name.endsWith('.mjs') || name.endsWith('.md')) out.push(full);
  }
  return out;
}

const sources = [
  ...collectMarkdownFiles(path.join(root, 'scripts', 'help-content')),
  path.join(root, 'scripts', 'detailed-help-inquiries.mjs'),
];

const used = new Set();
for (const file of sources) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    used.add(m[1].trim());
  }
}

const registered = new Set(loadRegisteredTokens());

const unknown = [...used].filter((id) => !registered.has(id));
const unused = [...registered].filter((id) => !used.has(id));

if (unknown.length) {
  console.error('Unknown help UI tokens in markdown:', unknown.join(', '));
  process.exit(1);
}

console.log(`OK: ${used.size} token(s) used in help markdown.`);
if (unused.length) {
  console.log(`Note: unused registry tokens (${unused.length}): ${unused.join(', ')}`);
}
