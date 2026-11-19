import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('견적 도우미 금액·면적', () => {
  it('만원·전용률·금액 강조', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
        import { manwonDigitsToWon, exclusiveSqmToSupplySqm, supplySqmToExclusiveSqm, sqmToPyeong, formatArea1, QUOTE_EXCLUSIVE_RATIOS } from './shared/quickQuoteArea.ts';
        import { quotePreviewSegments } from './shared/quickQuotePreview.ts';
        const checks = [];
        const eq = (a, b) => { if (a !== b) checks.push(String(a) + ' !== ' + String(b)); };
        eq(manwonDigitsToWon('15'), 150000);
        eq(manwonDigitsToWon('15만'), 150000);
        eq(manwonDigitsToWon(''), null);
        eq(manwonDigitsToWon('0'), null);
        const exclusive = 25.7 * 3.305785;
        const supply = exclusiveSqmToSupplySqm(exclusive, QUOTE_EXCLUSIVE_RATIOS.apartment);
        eq(formatArea1(sqmToPyeong(supply)), '33.8');
        eq(formatArea1(supplySqmToExclusiveSqm(supply, QUOTE_EXCLUSIVE_RATIOS.apartment)), formatArea1(exclusive));
        eq(QUOTE_EXCLUSIVE_RATIOS.mixed, 0.7);
        eq(QUOTE_EXCLUSIVE_RATIOS.officetel, 0.53);
        const parts = quotePreviewSegments('견적 150,000원 이고 끝');
        eq(parts.filter((p) => p.emphasis).map((p) => p.text).join(','), '150,000원');
        if (checks.length) {
          console.error(checks.join('\\n'));
          process.exit(1);
        }
        `,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  });
});
