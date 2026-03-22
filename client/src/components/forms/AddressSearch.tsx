import { useDaumPostcodePopup } from 'react-daum-postcode';

interface AddressSearchProps {
  value: string;
  onChange: (address: string, detail?: string) => void;
  placeholder?: string;
  className?: string;
}

export function AddressSearch({ value, onChange, placeholder, className = '' }: AddressSearchProps) {
  const open = useDaumPostcodePopup();

  const handleClick = () => {
    open({
      onComplete: (data) => {
        const fullAddress = data.address || data.roadAddress || data.jibunAddress || '';
        const buildingName = data.buildingName ? ` ${data.buildingName}` : '';
        onChange(fullAddress + buildingName);
      },
    });
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={value}
        readOnly
        placeholder={placeholder ?? '주소 검색'}
        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
      />
      <button
        type="button"
        onClick={handleClick}
        className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
      >
        주소 검색
      </button>
    </div>
  );
}
