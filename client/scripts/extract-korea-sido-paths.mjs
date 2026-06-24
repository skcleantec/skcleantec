import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '../src/components/admin/dashboard/south-korea-source.svg');
const outPath = path.join(__dirname, '../src/components/admin/dashboard/koreaSidoPaths.ts');

const svg = fs.readFileSync(svgPath, 'utf8');

const SVG_ID_TO_SIDO = {
  seoul: '서울특별시',
  busan: '부산광역시',
  daegu: '대구광역시',
  incheon: '인천광역시',
  gwangju: '광주광역시',
  daejeon: '대전광역시',
  ulsan: '울산광역시',
  sejong: '세종특별자치시',
  gyeonggi: '경기도',
  gangwon: '강원특별자치도',
  'north-chungcheong': '충청북도',
  'south-chungcheong': '충청남도',
  'north-jeolla': '전북특별자치도',
  'south-jeolla': '전라남도',
  'north-gyeongsang': '경상북도',
  'south-gyeongsang': '경상남도',
  jeju: '제주특별자치도',
};

const paths = {};
for (const [svgId, sidoKey] of Object.entries(SVG_ID_TO_SIDO)) {
  const re = new RegExp(`id="${svgId}"[\\s\\S]*?d="([^"]+)"`);
  const m = svg.match(re);
  if (!m) {
    console.error('missing path for', svgId);
    process.exit(1);
  }
  paths[sidoKey] = { svgId, d: m[1] };
}

const header = `/** @svg-maps/south-korea (CC BY 4.0) — vendored paths, do not edit by hand */\nimport type { KoreaSidoKey } from '@shared/regionMatch';\n\nexport type SidoMapPath = { svgId: string; d: string };\n\nexport const KOREA_SIDO_MAP_VIEWBOX = '0 0 524 631';\n\nexport const KOREA_SIDO_PATHS: Record<KoreaSidoKey, SidoMapPath> = `;
fs.writeFileSync(outPath, `${header}${JSON.stringify(paths, null, 2)} as const satisfies Record<KoreaSidoKey, SidoMapPath>;\n`);
console.log('Wrote', outPath, Object.keys(paths).length, 'regions');
