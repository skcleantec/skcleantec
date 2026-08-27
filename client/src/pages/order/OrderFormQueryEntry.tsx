import { Navigate, useSearchParams } from 'react-router-dom';
import {
  isValidOrderFormPublicToken,
  resolveOrderFormTokenFromLocation,
} from '../../utils/orderFormPublicRouteToken';

/**
 * 알림톡 템플릿 query 방식·hash 파싱 오류 대비 — `/order?t=…` → `/order/:token`
 */
export function OrderFormQueryEntry() {
  const [searchParams] = useSearchParams();
  const token = resolveOrderFormTokenFromLocation();

  if (!token || !isValidOrderFormPublicToken(token)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600">발주서를 찾을 수 없습니다.</p>
          <p className="text-sm text-gray-500 mt-2">링크가 만료되었거나 잘못된 주소일 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const next = new URLSearchParams(searchParams);
  next.delete('t');
  next.delete('token');
  const qs = next.toString();
  return (
    <Navigate
      to={`/order/${encodeURIComponent(token)}${qs ? `?${qs}` : ''}`}
      replace
    />
  );
}
