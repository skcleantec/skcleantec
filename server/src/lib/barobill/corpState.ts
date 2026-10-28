import { callBarobill } from './soap.js';

export type CorpStateSnapshot = {
  taxType: string | null;
  state: string | null;
};

function readField(row: unknown, name: string): string | null {
  if (!row || typeof row !== 'object') return null;
  const value = (row as Record<string, unknown>)[name];
  if (value == null || value === '') return null;
  return String(value);
}

/** 회원사 사업자번호로 과세유형을 읽는다. 업체 지갑에서는 차감하지 않는다. */
export async function getCorpTaxType(corpNum: string): Promise<CorpStateSnapshot> {
  const value = await callBarobill(
    'CORPSTATE',
    'GetCorpState',
    { CorpNum: corpNum, CheckCorpNum: corpNum },
    { corpNum },
  );
  return {
    taxType: readField(value, 'TaxType'),
    state: readField(value, 'State'),
  };
}
