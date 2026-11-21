/**
 * 숨고 면적 글을 견적 평수로 바꾼다.
 * 아파트는 공급평, 그 외는 전용평. 1평 = 3.305785㎡.
 * 순서: 표시 없는 단지만 사례·기준 > 건축물대장 > 고객이 적은 공급·전용 > 평수만 있을 때 사장님 기준 > 기본 규칙.
 */
export type TelecrmAreaStatus = '확정' | '확인 필요';
export type TelecrmAreaSource = '건축물대장' | '사장님 기준' | '사례' | '기본 규칙';
export type TelecrmAreaCandidate = { label: string; pyeong: number };
export type TelecrmAreaResolveResult = {
  pyeong: number | null;
  status: TelecrmAreaStatus;
  candidates: TelecrmAreaCandidate[];
  reason: string;
  source: TelecrmAreaSource;
  customerValue: number | null;
  customerMark: string | null;
};
export type TelecrmAreaRuleSpec = {
  kind: 'assume' | 'confirmBand' | 'complex' | 'ratio' | 'basis';
  summary: string;
  buildingType?: string;
  pyeongMin?: number;
  pyeongMax?: number;
  assume?: '전용' | '공급';
  requireConfirm?: boolean;
  address?: string;
  customerValue?: number;
  supplyPyeong?: number;
  exclusiveRatio?: number;
  apartmentBasis?: '공급' | '전용';
  otherBasis?: '공급' | '전용';
};
export type TelecrmAreaRuleDraft = { spec: TelecrmAreaRuleSpec; preview: string; examples: string[] };

export const SQM_PER_PYEONG = 3.305785;
const APT_EXCLUSIVE_RATIO = 0.76;
const MIXED_RATIO = 0.7;
const OFFICETEL_RATIO = 0.53;

const KNOWN_TYPES = [
  { sqm: 59, supply: 25, name: '59형' },
  { sqm: 84, supply: 34, name: '84형' },
] as const;

/** 단위 없이 적힌 대표 전용 ㎡. 예전 상담 화면과 같은 숫자이고, ±1도 ㎡로 본다. */
const REPRESENTATIVE_SQM = [39, 49, 59, 74, 84, 101, 114, 135] as const;

export type AreaLedgerGroup = { exclusiveSqm: number; supplyPyeong: number | null };

export type AreaCaseRow = {
  addressKey: string;
  customerValue: number;
  customerMark: string | null;
  supplyPyeong: number;
};

export type AreaResolveInput = {
  raw: string;
  buildingType?: string | null;
  address?: string | null;
  ledger?: AreaLedgerGroup[] | null;
  rules?: TelecrmAreaRuleSpec[];
  cases?: AreaCaseRow[];
};

type Reading = {
  value: number;
  unit: 'pyeong' | 'sqm';
  mark: '공급' | '전용' | null;
  /** 평·㎡ 글자 없이 숫자만 있는 경우 */
  bare: boolean;
  range: boolean;
  label: string;
};

function roundPyeong(n: number): number {
  return Math.round(n);
}

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

export function areaComplexKey(address: string | null | undefined): string {
  return String(address ?? '')
    .replace(/\d+\s*동(\s*\d+\s*호)?/g, ' ')
    .replace(/\d+\s*호/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function sameComplex(a: string, b: string): boolean {
  const left = areaComplexKey(a).replace(/\s/g, '');
  const right = areaComplexKey(b).replace(/\s/g, '');
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function isApartment(buildingType: string): boolean {
  return /아파트/.test(buildingType) && !/오피스텔|주상복합/.test(buildingType);
}

function typeName(supply: number): string | null {
  const hit = KNOWN_TYPES.find((row) => near(row.supply, supply, 0.2));
  return hit?.name ?? null;
}

function supplyFromExclusiveSqm(sqm: number): { pyeong: number; typeName: string | null } {
  const hit = KNOWN_TYPES.find((row) => Math.abs(row.sqm - sqm) <= 1.5);
  if (hit) return { pyeong: hit.supply, typeName: hit.name };
  return { pyeong: roundPyeong(sqm / APT_EXCLUSIVE_RATIO / SQM_PER_PYEONG), typeName: null };
}

function supplyFromExclusivePyeong(pyeong: number): { pyeong: number; typeName: string | null } {
  return supplyFromExclusiveSqm(pyeong * SQM_PER_PYEONG);
}

function exclusiveFromSupply(supplyPyeong: number, ratio: number): number {
  return roundPyeong(supplyPyeong * ratio);
}

export function parseAreaReading(raw: string): Reading | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const range = text.match(/(\d+(?:\.\d+)?)\s*평\s*대/);
  if (range) {
    const value = Number(range[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    return { value, unit: 'pyeong', mark: markNear(text, range.index ?? 0), bare: false, range: true, label: `${formatNum(value)}평대` };
  }
  const sqm = text.match(/(\d{1,4}(?:[.,]\d+)?)\s*(?:㎡|m²|m\^?2|제곱\s*미터|제곱m|평방\s*미터)/i);
  if (sqm) {
    const value = Number(sqm[1].replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      const mark = markNear(text, sqm.index ?? 0);
      const markLabel = mark ? `${mark} ` : '';
      return { value, unit: 'sqm', mark, bare: false, range: false, label: `${markLabel}${formatNum(value)}㎡` };
    }
  }
  const pyeong = text.match(/(\d{1,4}(?:\.\d+)?)\s*평/);
  const plain = text.match(/(?:^|\s)(\d{1,4}(?:\.\d+)?)(?:\s|$)/);
  const picked = pyeong ?? plain;
  if (!picked) return null;
  const value = Number(picked[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 500) return null;
  const mark = markNear(text, picked.index ?? 0);
  const markLabel = mark ? `${mark} ` : '';
  return { value, unit: 'pyeong', mark, bare: !pyeong, range: false, label: `${markLabel}${formatNum(value)}평` };
}

function looksLikeBareSqm(value: number): boolean {
  if (value >= 60) return true;
  return REPRESENTATIVE_SQM.some((sqm) => Math.abs(value - sqm) <= 1);
}

function bareSqmCandidates(value: number): TelecrmAreaCandidate[] {
  const converted = supplyFromExclusiveSqm(value);
  const exclusive = converted.typeName
    ? `전용 ${formatNum(value)}㎡ → 공급 ${formatNum(converted.pyeong)}평(${converted.typeName})`
    : `전용 ${formatNum(value)}㎡ → 공급 ${formatNum(converted.pyeong)}평`;
  const literal = { label: `${formatNum(value)}평`, pyeong: roundPyeong(value) };
  const first = { label: exclusive, pyeong: converted.pyeong };
  if (near(first.pyeong, literal.pyeong, 0.2)) return [first];
  return [first, literal];
}

function markNear(text: string, index: number): '공급' | '전용' | null {
  const before = text.slice(Math.max(0, index - 8), index);
  if (/전용|실평수/.test(before)) return '전용';
  if (/공급|분양/.test(before)) return '공급';
  return null;
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function buildingLabel(buildingType: string, apartment: boolean): string {
  const name = buildingType.trim();
  if (name) return name;
  return apartment ? '아파트' : '건물';
}

function done(
  pyeong: number | null,
  status: TelecrmAreaResolveResult['status'],
  candidates: TelecrmAreaCandidate[],
  reason: string,
  source: TelecrmAreaSource,
  reading: Reading | null,
): TelecrmAreaResolveResult {
  return {
    pyeong,
    status,
    candidates: candidates.slice(0, 3),
    reason,
    source,
    customerValue: reading?.value ?? null,
    customerMark: reading?.mark ?? null,
  };
}

function supplyLabel(pyeong: number, prefix: string): string {
  const name = typeName(pyeong);
  return name ? `${prefix}${formatNum(pyeong)}평(${name})` : `${prefix}${formatNum(pyeong)}평`;
}

function defaultConfirm(apartment: boolean, pyeong: number, rules: TelecrmAreaRuleSpec[], buildingType: string): boolean {
  if (!apartment) return false;
  let required = (pyeong >= 18 && pyeong <= 19) || (pyeong >= 25 && pyeong <= 26);
  for (const rule of rules) {
    if (rule.kind !== 'confirmBand' || !buildingMatches(rule.buildingType, buildingType, true)) continue;
    const min = rule.pyeongMin ?? rule.pyeongMax ?? pyeong;
    const max = rule.pyeongMax ?? rule.pyeongMin ?? pyeong;
    if (pyeong >= min && pyeong <= max) required = rule.requireConfirm !== false;
  }
  return required;
}

function buildingMatches(ruleType: string | undefined, buildingType: string, apartment: boolean): boolean {
  const want = (ruleType ?? '').trim();
  if (!want) return true;
  if (/아파트/.test(want) && apartment) return true;
  return buildingType.includes(want) || want.includes(buildingType);
}

function basisOf(rules: TelecrmAreaRuleSpec[]): { apartment: '공급' | '전용'; other: '공급' | '전용' } {
  const found = [...rules].reverse().find((rule) => rule.kind === 'basis');
  return {
    apartment: found?.apartmentBasis === '전용' ? '전용' : '공급',
    other: found?.otherBasis === '공급' ? '공급' : '전용',
  };
}

function ratioOf(buildingType: string, rules: TelecrmAreaRuleSpec[]): number | null {
  const learned = [...rules].reverse().find((rule) => rule.kind === 'ratio' && rule.exclusiveRatio && buildingMatches(rule.buildingType, buildingType, false));
  if (learned?.exclusiveRatio) return learned.exclusiveRatio;
  if (/오피스텔/.test(buildingType)) return OFFICETEL_RATIO;
  if (/주상복합/.test(buildingType)) return MIXED_RATIO;
  if (/아파트/.test(buildingType)) return APT_EXCLUSIVE_RATIO;
  return null;
}

function ambiguousCandidates(reading: Reading): TelecrmAreaCandidate[] {
  const asSupply = reading.value;
  const exclusive = supplyFromExclusivePyeong(reading.value);
  const supplyText = supplyLabel(asSupply, '공급 ');
  const exclusiveText = exclusive.typeName
    ? `전용 ${formatNum(reading.value)}평 → 공급 ${formatNum(exclusive.pyeong)}평(${exclusive.typeName})`
    : `전용 ${formatNum(reading.value)}평 → 공급 ${formatNum(exclusive.pyeong)}평`;
  if (near(asSupply, exclusive.pyeong, 0.2)) return [{ label: supplyText, pyeong: asSupply }];
  return [
    { label: supplyText, pyeong: asSupply },
    { label: exclusiveText, pyeong: exclusive.pyeong },
  ];
}

function matchLedger(reading: Reading, groups: AreaLedgerGroup[]): { supply: AreaLedgerGroup[]; exclusive: AreaLedgerGroup[] } {
  const supply: AreaLedgerGroup[] = [];
  const exclusive: AreaLedgerGroup[] = [];
  const asSupplyPyeong = reading.unit === 'pyeong' ? reading.value : reading.value / SQM_PER_PYEONG;
  const asExclusivePyeong = reading.unit === 'pyeong' ? reading.value : reading.value / SQM_PER_PYEONG;
  const asExclusiveSqm = reading.unit === 'sqm' ? reading.value : reading.value * SQM_PER_PYEONG;
  for (const group of groups) {
    if (group.supplyPyeong != null && near(group.supplyPyeong, asSupplyPyeong, 1.5)) supply.push(group);
    const exclusivePyeong = group.exclusiveSqm / SQM_PER_PYEONG;
    const exclusiveHit =
      reading.unit === 'sqm'
        ? near(group.exclusiveSqm, asExclusiveSqm, SQM_PER_PYEONG)
        : near(exclusivePyeong, asExclusivePyeong, 1);
    if (exclusiveHit && group.supplyPyeong != null) exclusive.push(group);
  }
  return { supply, exclusive };
}

function uniqueGroups(groups: AreaLedgerGroup[]): AreaLedgerGroup[] {
  const out: AreaLedgerGroup[] = [];
  for (const group of groups) {
    if (out.some((row) => row.supplyPyeong === group.supplyPyeong && near(row.exclusiveSqm, group.exclusiveSqm, 0.2))) continue;
    out.push(group);
  }
  return out;
}

export function resolveTelecrmArea(input: AreaResolveInput): TelecrmAreaResolveResult {
  const reading = parseAreaReading(input.raw);
  const buildingType = (input.buildingType ?? '').trim();
  const apartment = !buildingType || isApartment(buildingType) || (/아파트/.test(buildingType) && !/오피스텔|주상복합/.test(buildingType));
  const place = buildingLabel(buildingType, apartment);
  const rules = input.rules ?? [];
  if (!reading) {
    return done(null, '확인 필요', [], '면적 숫자를 못 찾았어요. 상담사가 확인해 주세요.', '기본 규칙', null);
  }

  const address = input.address ?? '';
  if (address.trim() && !reading.mark) {
    const hits = (input.cases ?? []).filter(
      (row) =>
        sameComplex(row.addressKey, address) &&
        near(row.customerValue, reading.value, 0.2) &&
        (row.customerMark ?? '') === (reading.mark ?? ''),
    );
    const counts = new Map<number, number>();
    for (const hit of hits) counts.set(hit.supplyPyeong, (counts.get(hit.supplyPyeong) ?? 0) + 1);
    const agreed = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
    if (agreed.length === 1) {
      const [pyeong, count] = agreed[0]!;
      return done(pyeong, '확정', [], `고객: ${reading.label} → ${place} ${formatNum(pyeong)}평 (사례 ${count}건)`, '사례', reading);
    }
    const complex = rules.find(
      (rule) =>
        rule.kind === 'complex' &&
        rule.address &&
        rule.customerValue != null &&
        rule.supplyPyeong != null &&
        sameComplex(rule.address, address) &&
        near(rule.customerValue, reading.value, 0.2),
    );
    if (complex?.supplyPyeong != null) {
      return done(
        complex.supplyPyeong,
        '확정',
        [],
        `고객: ${reading.label} → ${place} ${formatNum(complex.supplyPyeong)}평 (사장님 기준)`,
        '사장님 기준',
        reading,
      );
    }
  }

  if (reading.range) {
    return done(null, '확인 필요', [], `고객: ${reading.label}은 범위라 평수를 확정하지 않아요.`, '기본 규칙', reading);
  }

  const groups = input.ledger ?? [];
  if (groups.length) {
    const matched = matchLedger(reading, groups);
    const useSupply = reading.mark !== '전용';
    const useExclusive = reading.mark !== '공급';
    const picked = uniqueGroups([...(useSupply ? matched.supply : []), ...(useExclusive ? matched.exclusive : [])]);
    if (picked.length === 1 && picked[0]?.supplyPyeong != null) {
      const onlySupply = useSupply && matched.supply.some((row) => row === picked[0] || row.supplyPyeong === picked[0]?.supplyPyeong);
      const onlyExclusive = useExclusive && matched.exclusive.some((row) => row.supplyPyeong === picked[0]?.supplyPyeong);
      if ((onlySupply && !onlyExclusive) || (onlyExclusive && !onlySupply) || reading.mark) {
        const pyeong = picked[0].supplyPyeong;
        return done(
          pyeong,
          '확정',
          [],
          `고객: ${reading.label} → ${place} 공급 ${formatNum(pyeong)}평 (건축물대장)`,
          '건축물대장',
          reading,
        );
      }
    }
    const both =
      useSupply &&
      useExclusive &&
      matched.supply.length > 0 &&
      matched.exclusive.length > 0 &&
      matched.supply[0]?.supplyPyeong !== matched.exclusive[0]?.supplyPyeong;
    if (both) {
      const candidates = uniqueGroups([...matched.supply, ...matched.exclusive])
        .filter((row) => row.supplyPyeong != null)
        .map((row) => ({ label: supplyLabel(row.supplyPyeong!, '공급 '), pyeong: row.supplyPyeong! }));
      return done(null, '확인 필요', candidates, `고객: ${reading.label}이 공급·전용 둘 다 맞아서 확인해 주세요.`, '건축물대장', reading);
    }
    if (picked.length === 1 && picked[0]?.supplyPyeong != null) {
      const pyeong = picked[0].supplyPyeong;
      return done(pyeong, '확정', [], `고객: ${reading.label} → ${place} 공급 ${formatNum(pyeong)}평 (건축물대장)`, '건축물대장', reading);
    }
  }

  if (apartment && reading.bare && !reading.mark && looksLikeBareSqm(reading.value)) {
    return done(
      null,
      '확인 필요',
      bareSqmCandidates(reading.value),
      `고객: ${formatNum(reading.value)}은 ㎡일 수도 있고 평일 수도 있어요. 상담사가 확인해 주세요.`,
      '기본 규칙',
      reading,
    );
  }

  if (reading.mark === '공급' && apartment) {
    const pyeong = reading.unit === 'sqm' ? roundPyeong(reading.value / SQM_PER_PYEONG) : roundPyeong(reading.value);
    return done(
      pyeong,
      '확정',
      [],
      `고객: ${reading.label} → ${place} 공급 ${formatNum(pyeong)}평 (기본 규칙)`,
      '기본 규칙',
      reading,
    );
  }

  const assume =
    !reading.mark && !reading.bare
      ? [...rules].reverse().find(
          (rule) =>
            rule.kind === 'assume' &&
            buildingMatches(rule.buildingType, buildingType || '아파트', apartment) &&
            reading.unit === 'pyeong' &&
            reading.value >= (rule.pyeongMin ?? reading.value) &&
            reading.value <= (rule.pyeongMax ?? reading.value),
        )
      : undefined;
  if (assume) {
    const asExclusive = assume.assume !== '공급';
    const converted = asExclusive ? supplyFromExclusivePyeong(reading.value) : { pyeong: roundPyeong(reading.value), typeName: typeName(reading.value) };
    const target = apartment ? converted.pyeong : exclusiveFromSupply(reading.value, ratioOf(buildingType, rules) ?? 1);
    const quoted = apartment && asExclusive ? target : apartment ? roundPyeong(reading.value) : target;
    return done(
      quoted,
      '확정',
      [],
      `고객: ${reading.label} → ${place} ${apartment ? '공급' : '전용'} ${formatNum(quoted)}평 (사장님 기준)`,
      '사장님 기준',
      reading,
    );
  }

  if (reading.mark === '공급' && !apartment) {
    const ratio = ratioOf(buildingType, rules);
    if (ratio == null) {
      return done(null, '확인 필요', [], `고객: ${reading.label}. ${place}는 전용 비율이 없어 확인해 주세요.`, '기본 규칙', reading);
    }
    const exclusive = exclusiveFromSupply(reading.unit === 'sqm' ? reading.value / SQM_PER_PYEONG : reading.value, ratio);
    const learned = rules.some((rule) => rule.kind === 'ratio' && buildingMatches(rule.buildingType, buildingType, false));
    return done(
      exclusive,
      '확정',
      [],
      `고객: ${reading.label} → ${place} 전용 ${formatNum(exclusive)}평 (${learned ? '사장님 기준' : '기본 규칙'})`,
      learned ? '사장님 기준' : '기본 규칙',
      reading,
    );
  }

  if (reading.unit === 'sqm' || reading.mark === '전용') {
    const sqm = reading.unit === 'sqm' ? reading.value : reading.value * SQM_PER_PYEONG;
    if (apartment) {
      const converted = supplyFromExclusiveSqm(sqm);
      return done(
        converted.pyeong,
        '확정',
        [],
        `고객: ${reading.label} → ${place} 공급 ${formatNum(converted.pyeong)}평 (기본 규칙)`,
        '기본 규칙',
        reading,
      );
    }
    const exclusive = roundPyeong(sqm / SQM_PER_PYEONG);
    return done(exclusive, '확정', [], `고객: ${reading.label} → ${place} 전용 ${formatNum(exclusive)}평 (기본 규칙)`, '기본 규칙', reading);
  }

  const basis = basisOf(rules);
  const treatExclusive = apartment ? basis.apartment === '전용' : basis.other === '공급';
  if (apartment && !reading.mark && defaultConfirm(true, reading.value, rules, buildingType || '아파트') && basis.apartment === '공급') {
    return done(
      null,
      '확인 필요',
      ambiguousCandidates(reading),
      `고객: ${reading.label}은 공급인지 전용인지 헷갈려요. 상담사가 확인해 주세요.`,
      '기본 규칙',
      reading,
    );
  }
  if (apartment && treatExclusive) {
    const converted = supplyFromExclusivePyeong(reading.value);
    return done(
      converted.pyeong,
      '확정',
      [],
      `고객: ${reading.label} → ${place} 공급 ${formatNum(converted.pyeong)}평 (사장님 기준)`,
      '사장님 기준',
      reading,
    );
  }
  if (apartment) {
    return done(
      roundPyeong(reading.value),
      '확정',
      [],
      `고객: ${reading.label} → ${place} 공급 ${formatNum(reading.value)}평 (기본 규칙)`,
      '기본 규칙',
      reading,
    );
  }
  return done(
    roundPyeong(reading.value),
    '확정',
    [],
    `고객: ${reading.label} → ${place} 전용 ${formatNum(reading.value)}평 (기본 규칙)`,
    '기본 규칙',
    reading,
  );
}

function clip(text: string, max: number): string {
  return text.trim().slice(0, max);
}

/** 사장님 말을 면적 기준으로 바꾼다. 가격 말이면 null. */
export function draftAreaTeaching(text: string): { reply: string; rules: TelecrmAreaRuleDraft[] } | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const specs: TelecrmAreaRuleSpec[] = [];

  const assume = raw.match(/(아파트|오피스텔|빌라(?:\([^)]*\))?|주택|원룸|주상복합)(?:[^\d]{0,16})(\d+(?:\.\d+)?)\s*평[^\n]{0,24}?(전용|공급)/);
  if (assume && /라고|하면|이면|이야|예요|에요|봐/.test(raw)) {
    const pyeong = Number(assume[2]);
    specs.push({
      kind: 'assume',
      buildingType: assume[1].startsWith('빌라') ? '빌라(연립)' : assume[1],
      pyeongMin: pyeong,
      pyeongMax: pyeong,
      assume: assume[3] as '전용' | '공급',
      summary: `${assume[1]} ${formatNum(pyeong)}평은 ${assume[3]}`,
    });
  }

  const band = raw.match(/(\d+(?:\.\d+)?)\s*[~∼\-]\s*(\d+(?:\.\d+)?)\s*평/);
  if (band && /확인/.test(raw)) {
    specs.push({
      kind: 'confirmBand',
      buildingType: '아파트',
      pyeongMin: Number(band[1]),
      pyeongMax: Number(band[2]),
      requireConfirm: !/안\s*해도|빼|없애/.test(raw),
      summary: `${formatNum(Number(band[1]))}~${formatNum(Number(band[2]))}평 ${/안\s*해도|빼|없애/.test(raw) ? '확인 생략' : '확인'}`,
    });
  }
  const one = raw.match(/(\d+(?:\.\d+)?)\s*평[^\n]{0,16}?확인\s*안\s*해도/);
  if (one) {
    const pyeong = Number(one[1]);
    specs.push({
      kind: 'confirmBand',
      buildingType: '아파트',
      pyeongMin: pyeong,
      pyeongMax: pyeong,
      requireConfirm: false,
      summary: `${formatNum(pyeong)}평은 확인 생략`,
    });
  }

  const complex = raw.match(/([가-힣A-Za-z0-9]+(?:아파트|단지))에서[^\d]{0,24}(\d+(?:\.\d+)?)\s*평[^\d]{0,24}(\d+)\s*형/);
  if (complex) {
    const type = KNOWN_TYPES.find((row) => row.sqm === Number(complex[3]) || row.name.startsWith(complex[3]));
    const supply = type?.supply ?? Number(complex[3]);
    specs.push({
      kind: 'complex',
      address: complex[1],
      customerValue: Number(complex[2]),
      supplyPyeong: supply,
      summary: `${complex[1]} ${formatNum(Number(complex[2]))}평은 ${complex[3]}형`,
    });
  }

  const ratio = raw.match(/(빌라(?:\([^)]*\))?|오피스텔|주상복합|아파트)[^\d]{0,16}(\d+(?:\.\d+)?)\s*%/);
  if (ratio && /전용|공급/.test(raw)) {
    specs.push({
      kind: 'ratio',
      buildingType: ratio[1].startsWith('빌라') ? '빌라(연립)' : ratio[1],
      exclusiveRatio: Number(ratio[2]) / 100,
      summary: `${ratio[1]} 전용 비율 ${ratio[2]}%`,
    });
  }

  if (/아파트는\s*공급/.test(raw) && /전용/.test(raw)) {
    specs.push({
      kind: 'basis',
      apartmentBasis: '공급',
      otherBasis: '전용',
      summary: '아파트는 공급, 나머지는 전용',
    });
  } else if (/아파트.{0,8}전용/.test(raw) && /기준|바꿔|으로 봐/.test(raw)) {
    specs.push({
      kind: 'basis',
      apartmentBasis: '전용',
      otherBasis: '전용',
      summary: '아파트도 전용으로',
    });
  }

  if (!specs.length) return null;
  const rules = specs.map((spec) => decorateAreaDraft(spec));
  return { reply: rules.map((rule) => rule.preview).join('\n'), rules };
}

export function decorateAreaDraft(spec: TelecrmAreaRuleSpec): TelecrmAreaRuleDraft {
  const preview = previewLine(spec);
  return { spec: { ...spec, summary: spec.summary || preview }, preview, examples: exampleLines(spec) };
}

function previewLine(spec: TelecrmAreaRuleSpec): string {
  if (spec.kind === 'assume' && spec.assume === '전용') {
    const pyeong = spec.pyeongMin ?? 0;
    const supply = supplyFromExclusivePyeong(pyeong).pyeong;
    return `앞으로 ${spec.buildingType ?? '아파트'} 고객이 ${formatNum(pyeong)}평이라고 하면 → 전용으로 보고 공급 ${formatNum(supply)}평으로 견적할게요. 맞아요?`;
  }
  if (spec.kind === 'assume') {
    return `앞으로 ${spec.buildingType ?? '아파트'} 고객이 ${formatNum(spec.pyeongMin ?? 0)}평이라고 하면 → 공급으로 견적할게요. 맞아요?`;
  }
  if (spec.kind === 'confirmBand') {
    return spec.requireConfirm === false
      ? `${formatNum(spec.pyeongMin ?? 0)}평은 확인 질문 없이 견적할게요. 맞아요?`
      : `${formatNum(spec.pyeongMin ?? 0)}~${formatNum(spec.pyeongMax ?? 0)}평은 공급인지 전용인지 꼭 확인할게요. 맞아요?`;
  }
  if (spec.kind === 'complex') {
    return `${spec.address}에서 ${formatNum(spec.customerValue ?? 0)}평이라고 하면 → 공급 ${formatNum(spec.supplyPyeong ?? 0)}평으로 견적할게요. 맞아요?`;
  }
  if (spec.kind === 'ratio') {
    return `${spec.buildingType}는 공급의 ${Math.round((spec.exclusiveRatio ?? 0) * 100)}%를 전용으로 볼게요. 맞아요?`;
  }
  return '아파트는 공급평, 그 외는 전용평으로 볼게요. 맞아요?';
}

function exampleLines(spec: TelecrmAreaRuleSpec): string[] {
  if (spec.kind === 'assume' && spec.pyeongMin != null) {
    const supply = spec.assume === '전용' ? supplyFromExclusivePyeong(spec.pyeongMin).pyeong : spec.pyeongMin;
    const other = spec.pyeongMin + 3;
    return [
      `${spec.buildingType ?? '아파트'} ${formatNum(spec.pyeongMin)}평 → ${spec.assume === '전용' ? '공급' : '공급'} ${formatNum(supply)}평`,
      `${spec.buildingType ?? '아파트'} ${formatNum(other)}평 → 이 규칙은 적용 안 함`,
      `오피스텔 ${formatNum(spec.pyeongMin)}평 → 이 규칙은 적용 안 함`,
    ];
  }
  if (spec.kind === 'complex') {
    return [`${spec.address} ${formatNum(spec.customerValue ?? 0)}평 → 공급 ${formatNum(spec.supplyPyeong ?? 0)}평`];
  }
  if (spec.kind === 'ratio' && spec.exclusiveRatio) {
    const sample = exclusiveFromSupply(20, spec.exclusiveRatio);
    return [`${spec.buildingType} 공급 20평 → 전용 ${formatNum(sample)}평`, `${spec.buildingType} 공급 30평 → 전용 ${formatNum(exclusiveFromSupply(30, spec.exclusiveRatio))}평`];
  }
  if (spec.kind === 'confirmBand') {
    return [
      `아파트 ${formatNum(spec.pyeongMin ?? 0)}평 → ${spec.requireConfirm === false ? '확인 없이 진행' : '확인 필요'}`,
      `아파트 33평 → 이 구간이 아니면 그대로`,
    ];
  }
  return ['아파트 33평 → 공급 33평', '오피스텔 20평 → 전용 20평'];
}

export function normalizeAreaRuleSpec(raw: unknown): TelecrmAreaRuleSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = String(row.kind ?? '') as TelecrmAreaRuleSpec['kind'];
  if (!['assume', 'confirmBand', 'complex', 'ratio', 'basis'].includes(kind)) return null;
  const summary = clip(String(row.summary ?? ''), 200);
  const spec: TelecrmAreaRuleSpec = { kind, summary: summary || '면적 기준' };
  if (typeof row.buildingType === 'string') spec.buildingType = clip(row.buildingType, 40);
  if (typeof row.address === 'string') spec.address = clip(row.address, 80);
  const num = (key: keyof TelecrmAreaRuleSpec) => {
    const value = row[key as string];
    if (typeof value === 'number' && Number.isFinite(value)) (spec as Record<string, unknown>)[key] = value;
  };
  num('pyeongMin');
  num('pyeongMax');
  num('customerValue');
  num('supplyPyeong');
  num('exclusiveRatio');
  if (row.assume === '전용' || row.assume === '공급') spec.assume = row.assume;
  if (typeof row.requireConfirm === 'boolean') spec.requireConfirm = row.requireConfirm;
  if (row.apartmentBasis === '공급' || row.apartmentBasis === '전용') spec.apartmentBasis = row.apartmentBasis;
  if (row.otherBasis === '공급' || row.otherBasis === '전용') spec.otherBasis = row.otherBasis;
  if (kind === 'ratio' && (spec.exclusiveRatio == null || spec.exclusiveRatio <= 0 || spec.exclusiveRatio > 1)) return null;
  if (kind === 'complex' && (spec.supplyPyeong == null || spec.customerValue == null || !spec.address)) return null;
  if (kind === 'assume' && spec.pyeongMin == null) return null;
  return spec;
}
