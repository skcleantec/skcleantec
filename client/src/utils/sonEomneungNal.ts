import { toLunar } from 'kor-lunar';

/** 음력 일이 9·10·19·20·29·30인 날(민간 통설상 손없는날) */
const SON_EOMNEUNG_LUNAR_DAYS = new Set([9, 10, 19, 20, 29, 30]);

/**
 * 양력 기준 손없는날 여부(음력 날짜 끝자리 9·0에 해당하는 날).
 * kor-lunar 지원 범위(양력 약 1890~2050) 밖이면 false.
 */
export function isSonEomneungNal(solarYear: number, solarMonth: number, solarDay: number): boolean {
  if (solarYear < 1890 || solarYear > 2050) return false;
  try {
    const lun = toLunar(solarYear, solarMonth, solarDay);
    return SON_EOMNEUNG_LUNAR_DAYS.has(lun.day);
  } catch {
    return false;
  }
}

export const SON_EOMNEUNG_NAL_HELP =
  '전통 민간 통설상 음력 9·10·19·20·29·30일(끝자리 9·0)을 손없는날로 본 참고 표시입니다.';
