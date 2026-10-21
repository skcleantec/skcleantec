import { FeatureGate } from '../../../components/auth/FeatureGate';
import { CardPaymentLedger } from '../../../components/admin/card-payment/CardPaymentLedger';
import { PageTitleWithFavorite } from '../../../components/layout/NavFavoritePageTitle';

export function AdminCardPaymentPage() {
  return (
    <FeatureGate module="mod_card_payment">
      <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
        <PageTitleWithFavorite label="결제 내역">
          <h1>결제 내역</h1>
        </PageTitleWithFavorite>
        <CardPaymentLedger />
      </div>
    </FeatureGate>
  );
}
