import { SelectWithChevron } from '../ui/SelectWithChevron';
import { EMAIL_DOMAIN_CUSTOM, KR_EMAIL_DOMAINS } from '../../constants/krEmailDomains';
import { joinOrderFormEmailSplit, parseOrderFormEmailSplit } from '../../utils/orderFormEmailSplit';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  inputClassName: string;
};

const selectCls =
  'min-h-11 rounded border border-gray-300 bg-white px-2 py-2 text-fluid-sm text-gray-900 hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

/**
 * 아이디 + 메이저 도메인 선택. 맨 아래 「직접 작성」.
 * 전체 주소를 붙여넣으면 @ 뒤에서 도메인을 나눈다.
 */
export function OrderFormEmailSplitField({ value, onChange, disabled, inputClassName }: Props) {
  const { local, domainKey, customDomain } = parseOrderFormEmailSplit(value);
  const isCustom = domainKey === EMAIL_DOMAIN_CUSTOM;

  const emit = (nextLocal: string, nextKey: string, nextCustom: string) => {
    onChange(joinOrderFormEmailSplit(nextLocal, nextKey, nextCustom));
  };

  const onLocalChange = (raw: string) => {
    if (raw.includes('@')) {
      const parsed = parseOrderFormEmailSplit(raw);
      emit(parsed.local, parsed.domainKey || domainKey, parsed.customDomain || customDomain);
      return;
    }
    emit(raw, domainKey, customDomain);
  };

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          type="text"
          inputMode="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`login-field-input min-w-0 flex-1 ${inputClassName}`}
          value={local}
          onChange={(e) => onLocalChange(e.target.value)}
          placeholder="아이디"
          disabled={disabled}
          aria-label="이메일 아이디"
        />
        <span className="shrink-0 text-fluid-sm font-medium text-gray-500" aria-hidden>
          @
        </span>
        <SelectWithChevron
          className={selectCls}
          wrapperClassName="w-[min(11.5rem,46%)] shrink-0"
          value={domainKey}
          disabled={disabled}
          aria-label="메일 주소"
          onChange={(e) => {
            const next = e.target.value;
            emit(local, next, next === EMAIL_DOMAIN_CUSTOM ? customDomain : '');
          }}
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
      {isCustom ? (
        <input
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`login-field-input ${inputClassName}`}
          value={customDomain}
          onChange={(e) => emit(local, EMAIL_DOMAIN_CUSTOM, e.target.value.replace(/^@+/, ''))}
          placeholder="예: company.co.kr"
          disabled={disabled}
          aria-label="메일 주소 직접 작성"
        />
      ) : null}
    </div>
  );
}
