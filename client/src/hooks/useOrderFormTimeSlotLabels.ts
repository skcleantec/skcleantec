import { useEffect, useMemo, useState } from 'react';
import { getOrderFormTimeSlotLabels } from '../api/orderform';
import { getToken } from '../stores/auth';
import {
  buildOrderTimeSlotOptions,
  resolveOrderTimeSlotLabels,
  type OrderTimeSlotLabels,
} from '@shared/orderFormTimeSlotLabels';
import { labelForTimeSlot, shortTimeSlotLabel } from '../constants/orderFormSchedule';

/** 테넌트 발주서 설정의 시간대 표시 라벨 — 관리·팀·마케터 공통 */
export function useOrderFormTimeSlotLabels() {
  const [labels, setLabels] = useState<OrderTimeSlotLabels>(() => resolveOrderTimeSlotLabels(null));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    getOrderFormTimeSlotLabels(token)
      .then((r) => {
        if (cancelled) return;
        setLabels(resolveOrderTimeSlotLabels(r.labels));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => buildOrderTimeSlotOptions(labels), [labels]);

  return {
    loaded,
    labels,
    options,
    labelFor: (value: string | null | undefined) => labelForTimeSlot(value, labels),
    shortLabelFor: (value: string | null | undefined) => shortTimeSlotLabel(value, labels),
  };
}
