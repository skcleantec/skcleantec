import { FeatureGate } from '../../../components/auth/FeatureGate';
import { CardPaymentLedger } from '../../../components/admin/card-payment/CardPaymentLedger';

export function AdminCardPaymentPage() {
  return (
    <FeatureGate module="mod_card_payment">
      <CardPaymentLedger />
    </FeatureGate>
  );
}
