import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'client', 'public', 'help', 'data.json');

const raw = await readFile(DATA_PATH, 'utf8');
const data = JSON.parse(raw);

const groups = {};
data.forEach((item, idx) => {
  const key = `${item.role}:${item.module}:${item.title}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push({ idx, path: item.path, hasMarkdown: !!item.markdown && item.markdown.trim().length > 0 });
});

console.log('\n=== 중복 검사 결과 ===\n');

let foundDuplicates = false;
Object.entries(groups).forEach(([key, items]) => {
  if (items.length > 1) {
    foundDuplicates = true;
    console.log(`❌ 중복 ${items.length}개: ${key}`);
    items.forEach(item => {
      console.log(`   - 인덱스 ${item.idx}, path: ${item.path}, 마크다운: ${item.hasMarkdown ? '있음' : '없음'}`);
    });
    console.log();
  }
});

if (!foundDuplicates) {
  console.log('✅ 중복 없음\n');
}

console.log(`총 ${data.length}개 항목`);
