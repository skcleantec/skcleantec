import '../src/env.js';
import { resolveBarobillEnv, SERVICE_BRIDGE_CORP_NUM } from '../src/lib/barobill/env.js';
import { maskCorpNum } from '../src/lib/barobill/mask.js';
import { BarobillCallError } from '../src/lib/barobill/soap.js';
import { checkCorpIsMember, getPartnerBalanceKrw } from '../src/lib/barobill/ti.js';

function printFailure(label: string, err: unknown): void {
  if (err instanceof BarobillCallError) {
    console.info(`[barobill-ping] ${label} code=${err.code} message=${err.message}`);
    if (err.detail && err.detail !== err.message) {
      console.info(`[barobill-ping] ${label} detail=${err.detail}`);
    }
    return;
  }
  const message = err instanceof Error ? err.message : '호출 실패';
  console.info(`[barobill-ping] ${label} error=${message}`);
}

async function main(): Promise<void> {
  const env = resolveBarobillEnv();
  if (env !== 'test') {
    console.error('[barobill-ping] BAROBILL_ENV=test 만 호출합니다.');
    process.exit(1);
  }
  console.info('[barobill-ping] env=test');
  console.info(`[barobill-ping] partnerCorp=${maskCorpNum(SERVICE_BRIDGE_CORP_NUM)}`);

  try {
    const balance = await getPartnerBalanceKrw();
    console.info(`[barobill-ping] GetBalanceCostAmountOfInterOPEx balanceKrw=${Math.round(balance)}`);
  } catch (err) {
    printFailure('GetBalanceCostAmountOfInterOPEx', err);
    process.exitCode = 1;
  }

  try {
    const member = await checkCorpIsMember(SERVICE_BRIDGE_CORP_NUM);
    console.info(`[barobill-ping] CheckCorpIsMember result=${member} (1=회원, 0=비회원)`);
  } catch (err) {
    printFailure('CheckCorpIsMember', err);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  printFailure('fatal', err);
  process.exit(1);
});
