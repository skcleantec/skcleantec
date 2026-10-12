import { SelectWithChevron } from '../ui/SelectWithChevron';
import { EMAIL_DOMAIN_CUSTOM, KR_EMAIL_DOMAINS } from '../../constants/krEmailDomains';
import {
  joinOrderFormEmailSplit,
  normalizeOrderFormEmailInput,
  parseOrderFormEmailSplit,
} from '../../utils/orderFormEmailSplit';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  inputClassName: string;
};

const selectCls =
  'min-h-11 w-full rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm text-gray-900 hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

/**
 * 주소 전체를 한 칸에 적는다. 도메인 선택은 아이디만 적었을 때 뒤를 채워 주는 보조.
 * 아이디 칸에서 @를 지우면 이어서 친 도메인이 붙지 않아 형식 오류가 난다.
 */
export function OrderFormEmailSplitField({ value, onChange, disabled, inputClassName }: Props) {
  const parsed = parseOrderFormEmailSplit(value);

  const applyDomain = (nextKey: string) => {
    if (!nextKey) {
      onChange(parsed.local);
      return;
    }
    if (nextKey === EMAIL_DOMAIN_CUSTOM) {
      if (!normalizeOrderFormEmailInput(value).includes('@')) {
        onChange(parsed.local ? `${parsed.local}@` : '@');
      }
      return;
    }
    onChange(joinOrderFormEmailSplit(parsed.local, nextKey, ''));
  };

  return (
    <div className="space-y-2">
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`login-field-input w-full min-w-0 ${inputClassName}`}
        value={value}
        onChange={(e) => onChange(normalizeOrderFormEmailInput(e.target.value))}
        placeholder="name@naver.com"
        disabled={disabled}
        aria-label="이메일"
      />
      <SelectWithChevron
        className={selectCls}
        wrapperClassName="w-full"
        value={parsed.domainKey}
        disabled={disabled}
        aria-label="메일 주소 선택"
        onChange={(e) => applyDomain(e.target.value)}
      >
        <option value="">메일 선택</option>
        {KR_EMAIL_DOMAINS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
        <option value={EMAIL_DOMAIN_CUSTOM}>직접 작성</option>
      </SelectWithChevron>
    </div>
  );
}
