import { useEffect, useState } from 'react';
import { getInquiryCreatorOptions, type UserItem } from '../api/users';

/** 발급·접수 입력 — 협업 마케터 드롭다운 옵션 */
export function useCollaborationMarketerOptions(token: string | null) {
  const [marketerOptions, setMarketerOptions] = useState<UserItem[]>([]);

  useEffect(() => {
    if (!token) {
      setMarketerOptions([]);
      return;
    }
    getInquiryCreatorOptions(token)
      .then(setMarketerOptions)
      .catch(() => setMarketerOptions([]));
  }, [token]);

  return marketerOptions;
}
