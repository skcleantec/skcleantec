import { useCallback, useEffect, useState } from 'react';
import {
  getAllProfessionalOptions,
  type ProfessionalSpecialtyOptionDto,
} from '../api/orderform';

/** 접수 수정·스케줄 — 전문 시공 옵션 카탈로그 (실패 시 재시도 가능) */
export function useProfessionalOptionsCatalog(token: string | null | undefined) {
  const [catalog, setCatalog] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(() => {
    if (!token) {
      setCatalog([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    getAllProfessionalOptions(token)
      .then((items) => {
        setCatalog(items);
        setLoadError(false);
      })
      .catch(() => {
        setCatalog([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { catalog, loadError, loading, refetch };
}
