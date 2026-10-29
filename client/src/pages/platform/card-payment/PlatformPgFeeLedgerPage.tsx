import { PgFeeLedgerView } from '../../../components/card-payment/PgFeeLedgerView';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import { getPlatformToken } from '../../../stores/platformAuth';

export function PlatformPgFeeLedgerPage() {
  return (
    <div className="min-w-0 w-full max-w-6xl space-y-3 pb-8">
      <PlatformCardPaymentTabs />
      <PgFeeLedgerView
        basePath="/platform/card-payment/fee-ledger"
        token={() => getPlatformToken() ?? ''}
        title="PG 수수료"
      />
    </div>
  );
}
