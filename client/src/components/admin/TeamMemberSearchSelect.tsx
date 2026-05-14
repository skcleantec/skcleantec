import { useEffect, useRef, useState } from 'react';
import type { TeamMemberItem } from '../../api/teams';

function getHangulInitial(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return ch;
  const initials = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const idx = Math.floor((code - 0xac00) / 588);
  return initials[idx] ?? ch;
}

function normalizeForSearch(v: string): string {
  return v.toLowerCase().replace(/\s+/g, '');
}

function toInitials(v: string): string {
  return Array.from(v).map(getHangulInitial).join('');
}

interface Props {
  options: TeamMemberItem[];
  value: string;
  onChange: (v: string) => void;
  /** 현재 슬롯에서 선택 불가로 표시할 이름(이미 선택됐거나 해당 일자 다른 접수에 배정된 팀원 등). */
  disabledNames?: Set<string>;
  /**
   * 팀원 풀 `name` → 해당 접수 예약일·선택된 팀장 기준 「마지막 함께 근무한 예약일」까지의 순수 일수 차이.
   * null/omit은 과거 같은 조합 기록 없음(배지 생략). 0이면 같은 달력일까지 기록이 같은 날 포함.
   */
  crewSpacingDaysByMemberName?: Record<string, number | null>;
  placeholder?: string;
}

/**
 * 등록된 팀원 목록에서 이름 일부/초성으로 검색해 선택하는 드롭다운.
 * - `disabledNames`: 해당 이름은 회색 음영 + 클릭 불가(현재 선택값은 예외로 유지).
 * - `crewSpacingDaysByMemberName`(선택): 부모가 조회해 넘김 · 이름 옆 `+N일` 안내 (선택 제한 없음).
 * - 현재 선택된 이름은 비활성 목록 규칙에서 예외로 유지된다.
 */
export function TeamMemberSearchSelect({
  options,
  value,
  onChange,
  disabledNames,
  crewSpacingDaysByMemberName,
  placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedName = value.trim();
  const selected = options.find((o) => o.name === selectedName) ?? null;
  const effectiveQuery = query.trim();
  const qNorm = normalizeForSearch(effectiveQuery);
  const qInitial = toInitials(effectiveQuery);
  const filtered = options.filter((o) => {
    if (!qNorm) return true;
    const nameNorm = normalizeForSearch(o.name);
    if (nameNorm.includes(qNorm)) return true;
    const initialNorm = normalizeForSearch(toInitials(o.name));
    return initialNorm.includes(normalizeForSearch(qInitial));
  });

  const selectedGapRaw = crewSpacingDaysByMemberName?.[selectedName];
  const selectedGapSuffix =
    selectedName !== '' &&
    typeof selectedGapRaw === 'number' &&
    Number.isFinite(selectedGapRaw)
      ? ` +${selectedGapRaw}일`
      : '';
  const closedDisplay = `${selectedName}${selectedGapSuffix}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (evt: MouseEvent | TouchEvent) => {
      const t = evt.target as Node | null;
      if (!t) return;
      if (!boxRef.current?.contains(t)) setOpen(false);
    };
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        value={open ? query : closedDisplay}
        onFocus={() => {
          setOpen(true);
          setQuery(selectedName);
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        placeholder={placeholder ?? '팀원 검색 (초성 가능)'}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-44 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
              inputRef.current?.blur();
            }}
          >
            미선택
          </button>
          {filtered.map((m) => {
            const isDisabled = Boolean(disabledNames?.has(m.name) && m.name !== selectedName);
            const gap = crewSpacingDaysByMemberName?.[m.name];
            const gapSuffix =
              typeof gap === 'number' && Number.isFinite(gap) ? ` +${gap}일` : '';
            return (
              <button
                key={m.id}
                type="button"
                disabled={isDisabled}
                title={
                  gapSuffix
                    ? `선택된 팀장과 마지막으로 같은 접수 예약일이 있었던 날 기준 간격입니다. 선택은 어떤 간격에서도 가능합니다.`
                    : undefined
                }
                className={`block w-full px-3 py-2 text-left text-sm ${
                  isDisabled ? 'cursor-not-allowed opacity-45 bg-gray-50' : 'hover:bg-blue-50'
                } ${selected?.id === m.id ? 'bg-blue-50 text-blue-700' : 'text-gray-800'}`}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(m.name);
                  setQuery(m.name);
                  setOpen(false);
                  inputRef.current?.blur();
                }}
              >
                {m.name}
                {gapSuffix ? <span className="tabular-nums text-gray-600">{gapSuffix}</span> : null}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">일치하는 팀원이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
