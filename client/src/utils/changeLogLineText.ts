/**
 * 변경 이력 한 줄을 사람이 읽는 말로 정리한다.
 * 예전 버그로 저장된 「[object Object]」, 「undefined」 같은 코드 글자가 화면에 나오지 않게 바꾼다.
 * (server/src/modules/inquiry-change-logs/inquiryChangeLogs.helpers.ts cleanChangeLogLine 과 같게 유지)
 */
export function cleanChangeLogLine(line: string): string {
  return line
    .replace(/\[object Object\](?:\s*,\s*\[object Object\])*/g, '(이전 기록)')
    .replace(/(^|[\s:→(,])(undefined|null|NaN)(?=$|[\s,)→])/g, '$1(없음)');
}
