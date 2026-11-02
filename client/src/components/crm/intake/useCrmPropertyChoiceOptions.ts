import { useEffect, useState } from 'react';
import type { TelecrmPropertyChoiceOptions } from '@shared/telecrmQuoteCrewLearning';
import { fetchTelecrmPropertyChoiceOptions } from '../../../api/telecrmQuoteCrewLearning';
import { getToken } from '../../../stores/auth';

const EMPTY: TelecrmPropertyChoiceOptions = { propertyTypes: [], buildingTypes: [] };

let cache: { token: string; data: TelecrmPropertyChoiceOptions } | null = null;
let inflight: { token: string; promise: Promise<TelecrmPropertyChoiceOptions> } | null = null;

function load(token: string): Promise<TelecrmPropertyChoiceOptions> {
  if (cache?.token === token) return Promise.resolve(cache.data);
  if (inflight?.token === token) return inflight.promise;
  const promise = fetchTelecrmPropertyChoiceOptions(token)
    .then((data) => {
      const safe: TelecrmPropertyChoiceOptions = {
        propertyTypes: Array.isArray(data?.propertyTypes) ? data.propertyTypes : [],
        buildingTypes: Array.isArray(data?.buildingTypes) ? data.buildingTypes : [],
      };
      cache = { token, data: safe };
      return safe;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { token, promise };
  return promise;
}

/** 손님 발주서와 같은 건축물 유형·건물 형태 선택지 (한 번 불러오면 화면 전체에서 같이 씀) */
export function useCrmPropertyChoiceOptions(): TelecrmPropertyChoiceOptions {
  const token = getToken();
  const [options, setOptions] = useState<TelecrmPropertyChoiceOptions>(
    cache && token && cache.token === token ? cache.data : EMPTY,
  );
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void load(token)
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        /* 선택지 없이도 접수는 가능 */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return options;
}
