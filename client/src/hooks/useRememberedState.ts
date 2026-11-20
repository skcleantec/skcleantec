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
export function useRememberedState<T>(
  key: string,
  initial: T | (() => T),
  options?: {
    /**
     * 'back'(기본): 뒤로가기로 돌아올 때만 되살림.
     * 'sameDay': 메뉴로 다시 들어와도 오늘 고른 값이면 되살림(날짜가 바뀌면 처음 값).
     */
    restore?: 'back' | 'sameDay';
  },
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `cbiseo.remember.${key}`;
  const dayKey = `${storageKey}.__day`;
  const navigationType = useNavigationType();
  const restoreMode = options?.restore ?? 'back';
  const [value, setValue] = useState<T>(() => {
    const sameDay = restoreMode === 'sameDay' && readRaw(dayKey) === todayKst();
    if (navigationType === 'POP' || sameDay) {
      const saved = readSaved<T>(storageKey);
      if (saved !== undefined) return saved;
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
      if (restoreMode === 'sameDay') localStorage.setItem(dayKey, todayKst());
      if (restoreMode === 'sameDay') localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* 저장소가 막힌 환경 — 기억만 못 한다 */
    }
  }, [dayKey, restoreMode, storageKey, value]);

  return [value, setValue];
}

function todayKst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSaved<T>(storageKey: string): T | undefined {
  try {
    // 같은 날 다시 들어온 경우(앱을 껐다 켜도)는 localStorage에 남은 값을 쓴다
    const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
