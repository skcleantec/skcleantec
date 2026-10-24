/**
 * shared/soloOperator.ts 와 동일. 서버 tsc rootDir 때문에 복사본을 둔다.
 * 판별 규칙을 바꿀 때는 shared/soloOperator.ts 와 이 파일을 함께 고친다.
 */
export function isSoloOperatorTenant(enabledModules: readonly string[] | null | undefined): boolean {
  if (!enabledModules) return false;
  return !enabledModules.includes('core_assignments');
}
