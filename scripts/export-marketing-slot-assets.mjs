#!/usr/bin/env node
/**
 * .image-slots.state.json 의 base64 이미지를
 * client/public/marketing/assets/slots/*.webp 로 내보냅니다.
 * 랜딩 image-slot src 속성과 함께 쓰면 운영에서 sidecar 없이도 표시됩니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, 'client/public/marketing/.image-slots.state.json');
const outDir = path.join(root, 'client/public/marketing/assets/slots');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

for (const [id, val] of Object.entries(state)) {
  const u = val?.u;
  if (!u || !u.startsWith('data:image/')) continue;
  const m = u.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) continue;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  fs.writeFileSync(path.join(outDir, `${id}.${ext}`), buf);
  console.log(`${id}.${ext}`, buf.length);
}
