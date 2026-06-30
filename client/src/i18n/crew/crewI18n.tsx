import { useCallback, type ReactNode } from 'react';
import { crewMessages, type CrewMessageId } from './crewMessages';
import { useCrewUiLang, type CrewUiLangKey } from './crewUiLanguageContext';

export type { CrewUiLangKey } from './crewUiLanguageContext';
export { crewUiLanguageToKey, CrewUiLanguageProvider } from './crewUiLanguageContext';

export function fillCrewTemplate(str: string, vars: Record<string, string>): string {
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

/** 레거시·관리 미리보기 — ko/th 둘 다 반환 */
export function crewT(id: CrewMessageId, vars?: Record<string, string>): { ko: string; th: string } {
  const row = crewMessages[id];
  if (!vars) return { ko: row.ko, th: row.th };
  return { ko: fillCrewTemplate(row.ko, vars), th: fillCrewTemplate(row.th, vars) };
}

/** 그룹 UI 언어 1종 문자열 */
export function crewText(id: CrewMessageId, lang: CrewUiLangKey, vars?: Record<string, string>): string {
  const row = crewMessages[id];
  if (lang === 'th') {
    const s = row.th;
    return vars ? fillCrewTemplate(s, vars) : s;
  }
  if (lang === 'mn') {
    const mn = (row as { mn?: string }).mn;
    const s = mn ?? row.ko;
    return vars ? fillCrewTemplate(s, vars) : s;
  }
  const s = row.ko;
  return vars ? fillCrewTemplate(s, vars) : s;
}

/** 크루 화면 — 현재 그룹 UI 언어로 문구 조회 (참조 안정 — effect·useCallback deps용) */
export function useCrewText(): (id: CrewMessageId, vars?: Record<string, string>) => string {
  const lang = useCrewUiLang();
  return useCallback((id, vars) => crewText(id, lang, vars), [lang]);
}

export function CrewUiLine({
  id,
  vars,
  className = '',
}: {
  id: CrewMessageId;
  vars?: Record<string, string>;
  className?: string;
}): ReactNode {
  const t = useCrewText();
  return <span className={className}>{t(id, vars)}</span>;
}

/** 그룹 UI 언어 1줄 (구 CrewBiLine — 병기 제거) */
export function CrewBiLine({
  id,
  vars,
  className = '',
  koClassName = '',
  thClassName: _thClassName = '',
}: {
  id: CrewMessageId;
  vars?: Record<string, string>;
  className?: string;
  koClassName?: string;
  /** @deprecated 단일 언어 표시 — 무시됨 */
  thClassName?: string;
}): ReactNode {
  const t = useCrewText();
  return (
    <span className={`block ${className}`.trim()}>
      <span className={`block ${koClassName}`.trim()}>{t(id, vars)}</span>
    </span>
  );
}

/** 인라인 1줄 */
export function CrewBiInline({
  id,
  vars,
  className = '',
}: {
  id: CrewMessageId;
  vars?: Record<string, string>;
  className?: string;
}): ReactNode {
  const t = useCrewText();
  return <span className={className}>{t(id, vars)}</span>;
}
