import type { TelecrmSoomgoFollowupAutoMessages } from '@shared/telecrmSoomgoFollowupAuto';

export function TelecrmSoomgoFollowupAutoFields({
  value,
  onChange,
  disabled,
}: {
  value: TelecrmSoomgoFollowupAutoMessages;
  onChange: (next: TelecrmSoomgoFollowupAutoMessages) => void;
  disabled?: boolean;
}) {
  const slots: { key: 'absent' | 'hold'; label: string; hint: string }[] = [
    {
      key: 'absent',
      label: '부재',
      hint: '처리 구분 「부재」 저장 시 숨고 채팅으로 보낼 문구입니다.',
    },
    {
      key: 'hold',
      label: '보류·고민',
      hint: '처리 구분 「보류·고민」 저장 시 숨고 채팅으로 보낼 문구입니다.',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-fluid-sm text-gray-600">
        접수란에서 해당 처리 구분으로 <strong>저장</strong>할 때, 열려 있는 숨고 채팅방으로 아래
        문구를 자동 전송합니다. 숨고 연동·채팅창이 준비되지 않으면 저장만 되고 전송은 건너뜁니다.
      </p>
      <p className="text-[11px] text-gray-500">
        치환: <code className="rounded bg-gray-100 px-1">{'{고객명}'}</code>,{' '}
        <code className="rounded bg-gray-100 px-1">{'{닉네임}'}</code>
      </p>
      {slots.map((slot) => (
        <div key={slot.key} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-fluid-sm font-semibold text-gray-800">{slot.label}</span>
            <label className="flex items-center gap-2 text-fluid-sm text-gray-700">
              <input
                type="checkbox"
                checked={value[slot.key].enabled}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [slot.key]: { ...value[slot.key], enabled: e.target.checked },
                  })
                }
                className="rounded border-gray-300"
              />
              저장 시 숨고 채팅 자동 전송
            </label>
          </div>
          <p className="text-[11px] text-gray-500">{slot.hint}</p>
          <textarea
            value={value[slot.key].message}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...value,
                [slot.key]: { ...value[slot.key], message: e.target.value },
              })
            }
            rows={4}
            placeholder="예: {닉네임}님, 연락 드렸으나 부재중이라 메시지 남깁니다."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm disabled:opacity-60"
          />
        </div>
      ))}
    </div>
  );
}
