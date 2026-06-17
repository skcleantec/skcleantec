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
    <section className="space-y-3">
      <h2 className="font-medium text-gray-900">상대방 정보</h2>
      <label className="block text-sm">
        <span className="text-gray-700">이름 *</span>
        <input
          className="mt-1 w-full border rounded px-2 py-1.5"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-gray-700">연락처</span>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">이메일</span>
          <input
            type="email"
            className="mt-1 w-full border rounded px-2 py-1.5"
            value={customerEmail}
            onChange={(e) => onCustomerEmailChange(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-gray-700">주소</span>
        <input
          className="mt-1 w-full border rounded px-2 py-1.5"
          value={customerAddress}
          onChange={(e) => onCustomerAddressChange(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700">유효기간</span>
        <input
          type="date"
          className="mt-1 w-full border rounded px-2 py-1.5"
          value={validUntil}
          onChange={(e) => onValidUntilChange(e.target.value)}
        />
      </label>
    </section>
  );
}
