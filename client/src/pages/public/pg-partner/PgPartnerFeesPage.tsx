import { PgFeeLedgerView } from '../../../components/card-payment/PgFeeLedgerView';
import { readPgPartnerToken } from './pgPartnerSession';

export function PgPartnerFeesPage() {
  return (
    <PgFeeLedgerView
      basePath="/public/card-payment/pg-partner/fee-ledger"
      token={readPgPartnerToken}
      title="수수료"
    />
  );
}
