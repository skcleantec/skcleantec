import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigationType } from 'react-router-dom';

/**
 * 목록 필터처럼 「다른 화면에 갔다가 뒤로가기로 돌아오면 그대로 남아야 하는」 값.
 *
 * - 뒤로가기·앞으로가기(POP)로 들어오면 마지막 값을 되살린다.
 * - 메뉴를 눌러 새로 들어오면(PUSH·REPLACE) 처음 값으로 시작한다 — 며칠 지난 필터가 남지 않게.
 * - 같은 창(탭·앱) 안에서만 기억한다(sessionStorage).
 *
 * @param key 화면별로 겹치지 않는 이름 (예: 'followup.datePreset')
 */
export function useRememberedState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `cbiseo.remember.${key}`;
  const navigationType = useNavigationType();
  const [value, setValue] = useState<T>(() => {
    if (navigationType === 'POP') {
      const saved = readSaved<T>(storageKey);
      if (saved !== undefined) return saved;
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* 저장소가 막힌 환경 — 기억만 못 한다 */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

function readSaved<T>(storageKey: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
