/**
 * 테스트 바로빌에서 수정세금계산서 3종을 발급한다.
 * BAROBILL_ENV 가 test 가 아니거나 WSDL 이 testws 가 아니면 바로 종료한다. 운영은 호출하지 않는다.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { resolveBarobillEnv } from '../src/lib/barobill/env.js';
import { maskCorpNum } from '../src/lib/barobill/mask.js';
import { barobillWsdlUrl } from '../src/lib/barobill/soap.js';
import { fetchTaxInvoiceStates, registAndIssueTaxInvoice } from '../src/modules/taxinvoice/taxInvoice.barobill.js';

function mgt(): string {
  return `t${randomBytes(11).toString('hex')}`.slice(0, 24);
}

function today(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10).replace(/-/g, '');
}

async function main(): Promise<void> {
  const env = resolveBarobillEnv();
  const wsdl = barobillWsdlUrl('TI');
  if (env !== 'test' || !wsdl.startsWith('https://testws.baroservice.com/')) {
    console.error('REFUSE: test server only');
    process.exit(2);
  }

  const member = await prisma.barobillMember.findFirst({
    where: { env: 'test', status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: {
      corpNum: true,
      corpName: true,
      ceoName: true,
      bizType: true,
      bizClass: true,
      addr1: true,
      addr2: true,
      contactName: true,
      contactTel: true,
      contactEmail: true,
      barobillUserId: true,
    },
  });
  if (!member || !member.barobillUserId.trim() || !member.contactEmail.includes('@')) {
    console.error('FAIL: no ACTIVE test member with barobill user id');
    process.exit(1);
  }

  const writeDate = today();
  const base = {
    corpNum: member.corpNum,
    userId: member.barobillUserId.trim(),
    corpName: member.corpName,
    ceoName: member.ceoName,
    addr: `${member.addr1} ${member.addr2 ?? ''}`.trim(),
    bizType: member.bizType,
    bizClass: member.bizClass,
    email: member.contactEmail,
    tel: member.contactTel,
    contactName: member.contactName,
    buyerCorpNum: member.corpNum,
    buyerCorpName: member.corpName,
    buyerCeoName: member.ceoName,
    buyerAddr: `${member.addr1} ${member.addr2 ?? ''}`.trim(),
    buyerEmail: member.contactEmail,
    buyerContactName: member.contactName,
    buyerBizType: member.bizType,
    buyerBizClass: member.bizClass,
    writeDate,
    purposeType: 2 as const,
    taxType: 1 as const,
    taxInvoiceType: 1 as const,
  };

  const parentKey = mgt();
  console.info(`member ${maskCorpNum(member.corpNum)} parent ${parentKey}`);
  await registAndIssueTaxInvoice({
    ...base,
    mgtKey: parentKey,
    supply: 1000,
    tax: 100,
    total: 1100,
    lines: [{ name: '청소', supply: 1000, tax: 100 }],
  });
  const states = await fetchTaxInvoiceStates({ corpNum: member.corpNum, mgtKeys: [parentKey] });
  const parent = states[0];
  const remark = parent?.ntsSendKey?.trim() || parentKey;
  console.info(`parent state barobill=${parent?.barobillState ?? '-'} nts=${parent?.ntsSendState ?? '-'} remark=${remark === parentKey ? 'mgt' : 'nts'}`);

  const jobs: { label: string; modifyCode: string; supply: number; tax: number; total: number; buyerCorpName?: string }[] = [
    { label: 'release', modifyCode: '4', supply: -1000, tax: -100, total: -1100 },
    { label: 'supply', modifyCode: '2', supply: -100, tax: -10, total: -110 },
    { label: 'correction-minus', modifyCode: '1', supply: -1000, tax: -100, total: -1100 },
    { label: 'correction-new', modifyCode: '1', supply: 1000, tax: 100, total: 1100, buyerCorpName: `${member.corpName} 정정` },
  ];

  for (const job of jobs) {
    const key = mgt();
    try {
      await registAndIssueTaxInvoice({
        ...base,
        mgtKey: key,
        modifyCode: job.modifyCode,
        remark,
        supply: job.supply,
        tax: job.tax,
        total: job.total,
        buyerCorpName: job.buyerCorpName ?? base.buyerCorpName,
        lines: [{ name: '청소', supply: job.supply, tax: job.tax }],
      });
      console.info(`PASS ${job.label} ${key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error';
      console.error(`FAIL ${job.label} ${message}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : 'error');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
