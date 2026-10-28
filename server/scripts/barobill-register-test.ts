import '../src/env.js';
import { resolveBarobillEnv } from '../src/lib/barobill/env.js';
import { maskCorpNum, normalizeCorpNum } from '../src/lib/barobill/mask.js';
import { BAROBILL_ALREADY_MEMBER_CODE } from '../src/lib/barobill/policy.js';
import { BarobillCallError } from '../src/lib/barobill/soap.js';
import { checkCorpIsMember, newBarobillPassword, newBarobillUserId, registCorp } from '../src/lib/barobill/ti.js';
import { getCorpTaxType } from '../src/lib/barobill/corpState.js';

function need(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) throw new Error(`환경변수 ${name} 가 없습니다.`);
  return value;
}

async function main(): Promise<void> {
  if (resolveBarobillEnv() !== 'test') {
    console.error('[barobill-register-test] BAROBILL_ENV=test 만 호출합니다.');
    process.exit(1);
  }
  const corpNum = normalizeCorpNum(need('BAROBILL_TEST_CORP_NUM'));
  if (!corpNum) {
    console.error('[barobill-register-test] BAROBILL_TEST_CORP_NUM 은 숫자 10자리여야 합니다.');
    process.exit(1);
  }
  if (corpNum === '1388704035') {
    console.error('[barobill-register-test] 서비스브릿지 사업자번호는 가입 테스트에 쓰지 않습니다.');
    process.exit(1);
  }

  const password = newBarobillPassword();
  const userId = newBarobillUserId();
  console.info(`[barobill-register-test] env=test corp=${maskCorpNum(corpNum)}`);

  const flag = await checkCorpIsMember(corpNum);
  console.info(`[barobill-register-test] CheckCorpIsMember result=${flag}`);
  if (flag > 0) {
    console.info('[barobill-register-test] status=LINK_REQUIRED reason=already_partner_member');
    return;
  }

  try {
    const code = await registCorp({
      corpNum,
      corpName: need('BAROBILL_TEST_CORP_NAME'),
      ceoName: need('BAROBILL_TEST_CEO_NAME'),
      bizType: need('BAROBILL_TEST_BIZ_TYPE'),
      bizClass: need('BAROBILL_TEST_BIZ_CLASS'),
      addr1: need('BAROBILL_TEST_ADDR1'),
      addr2: (process.env.BAROBILL_TEST_ADDR2 ?? '').trim(),
      memberName: need('BAROBILL_TEST_CONTACT_NAME'),
      id: userId,
      password,
      tel: need('BAROBILL_TEST_CONTACT_TEL'),
      email: need('BAROBILL_TEST_CONTACT_EMAIL'),
    });
    const tax = await getCorpTaxType(corpNum).catch(() => null);
    console.info(
      `[barobill-register-test] status=ACTIVE code=${code} userIdLen=${userId.length} taxType=${tax?.taxType ?? '-'}`,
    );
  } catch (err) {
    if (err instanceof BarobillCallError && err.code === BAROBILL_ALREADY_MEMBER_CODE) {
      console.info(`[barobill-register-test] status=LINK_REQUIRED code=${err.code} message=${err.message}`);
      return;
    }
    if (err instanceof BarobillCallError) {
      console.info(`[barobill-register-test] status=FAILED code=${err.code} message=${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : '호출 실패';
  console.info(`[barobill-register-test] error=${message}`);
  process.exit(1);
});
