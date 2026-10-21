import { useState } from 'react';
import { PgContractBook } from '../../../components/card-payment/pg-contract/PgContractBook';
import { PgContractDeskFrame } from '../../../components/card-payment/pg-contract/PgContractDeskFrame';

export function PlatformPgContractDeskPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const close = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    window.location.assign('/platform/card-payment/e-contract');
  };
  return (
    <PgContractDeskFrame
      notice="업체가 적는 창입니다. 여기서 적은 내용은 저장되지 않습니다."
      onClose={close}
    >
      <PgContractBook
        mode="preview"
        values={values}
        onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
      />
    </PgContractDeskFrame>
  );
}
