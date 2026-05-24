import { useMemo, type ReactNode } from 'react';
import { AddressSearch } from '../forms/AddressSearch';
import {
  combineEContractSignerAddressValue,
  splitEContractSignerAddressValue,
} from './eContractSignerAddressValue';

type Props = {
  id: string;
  label: ReactNode;
  value: string;
  required?: boolean;
  onChange: (next: string) => void;
};

/** 전자계약 체결 — 카카오 주소 검색 + 상세주소(모바일 최적화) */
export function EContractSignerAddressInput({ id, label, value, required, onChange }: Props) {
  const { base, detail } = useMemo(() => splitEContractSignerAddressValue(value), [value]);

  const setBase = (nextBase: string) => {
    onChange(combineEContractSignerAddressValue(nextBase, detail));
  };

  const setDetail = (nextDetail: string) => {
    onChange(combineEContractSignerAddressValue(base, nextDetail));
  };

  return (
    <div>
      <div className="block text-fluid-xs font-medium text-gray-800">{label}</div>
      <p className="mt-1 text-fluid-2xs text-gray-500">「주소 검색」으로 도로명·지번을 선택한 뒤, 상세주소를 입력해 주세요.</p>
      <div className="mt-2">
        <AddressSearch
          value={base}
          onChange={(addr) => setBase(addr)}
          placeholder="주소 검색"
          mobilePreferred
          className="gap-2"
        />
      </div>
      <label htmlFor={`${id}-detail`} className="mt-3 block text-fluid-2xs font-medium text-gray-700">
        상세주소{required ? '' : ' (선택)'}
      </label>
      <input
        id={`${id}-detail`}
        type="text"
        value={detail}
        onChange={(ev) => setDetail(ev.target.value)}
        placeholder="동·호수, 층, 상호 등"
        autoComplete="address-line2"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-fluid-sm touch-manipulation"
        maxLength={500}
      />
    </div>
  );
}
