import { getToken } from '../../stores/auth';
import { BankDepositPanel } from '../../components/bank-deposit/BankDepositPanel';

export function AdminBankDepositPage() {
  const token = getToken();
  if (!token) return <p className="text-fluid-sm text-gray-500">로그인이 필요합니다.</p>;
  return <BankDepositPanel token={token} />;
}
