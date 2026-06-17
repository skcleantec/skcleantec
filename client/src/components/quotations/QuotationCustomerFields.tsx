import { qUi } from './quotationUi';

type Props = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  validUntil: string;
  onCustomerNameChange: (v: string) => void;
  onCustomerPhoneChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onCustomerAddressChange: (v: string) => void;
  onValidUntilChange: (v: string) => void;
};

export function QuotationCustomerFields({
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  validUntil,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  onCustomerAddressChange,
  onValidUntilChange,
}: Props) {
  return (
    <section className={`${qUi.cardBody} space-y-4`}>
      <div>
        <h2 className={qUi.sectionTitle}>상대방 정보</h2>
        <p className={`${qUi.sectionSubtitle} mt-0.5`}>견적서에 표시될 고객·거래처 정보입니다.</p>
      </div>

      <label className="block">
        <span className={qUi.label}>이름 *</span>
        <input
          className={qUi.input}
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={qUi.label}>연락처</span>
          <input
            className={qUi.input}
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={qUi.label}>이메일</span>
          <input
            type="email"
            className={qUi.input}
            value={customerEmail}
            onChange={(e) => onCustomerEmailChange(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className={qUi.label}>주소</span>
        <input
          className={qUi.input}
          value={customerAddress}
          onChange={(e) => onCustomerAddressChange(e.target.value)}
        />
      </label>

      <label className="block sm:max-w-xs">
        <span className={qUi.label}>유효기간</span>
        <input
          type="date"
          className={qUi.input}
          value={validUntil}
          onChange={(e) => onValidUntilChange(e.target.value)}
        />
      </label>
    </section>
  );
}
