import type { ReactNode } from 'react';
import {
  CustomerLinkHelpBrandSelect,
  CustomerLinkHelpInsertButton,
  CustomerLinkHelpMessageCopyHint,
  CustomerLinkHelpPlaceholderSelect,
  CustomerLinkHelpResetButton,
  CustomerLinkHelpSaveButton,
} from './CustomerLinkHelpUiParts';

export type CustomerLinkHelpActionRow = {
  sample: ReactNode;
  meaning: string;
  when?: string;
};

/** ① 편집 방법 */
export const CUSTOMER_LINK_EDIT_ACTIONS: readonly CustomerLinkHelpActionRow[] = [
  {
    sample: <CustomerLinkHelpBrandSelect />,
    meaning:
      '브랜드마다 다른 메시지를 저장합니다. 숨고·청소비서 등 영업 브랜드가 여러 개면 각각 편집·저장하세요.',
    when: '카드 상단',
  },
  {
    sample: (
      <>
        <CustomerLinkHelpPlaceholderSelect />
        <CustomerLinkHelpInsertButton />
      </>
    ),
    meaning:
      '치환코드를 고르고 「넣기」를 누르면 커서 위치에 `{{date}}` 같은 코드가 들어갑니다. 직접 타이핑해도 됩니다.',
    when: '메시지 본문 우측',
  },
  {
    sample: (
      <span className="block max-w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-fluid-2xs text-gray-500 pointer-events-none select-none">
        본문 textarea — 「청소일시:」 등 글자를 자유롭게 수정
      </span>
    ),
    meaning:
      '게시판 글처럼 전체 문장을 한 칸에서 편집합니다. 라벨·안내 문구는 여기서 바로 고치고, 바뀌는 숫자·날짜·링크만 치환코드로 둡니다.',
    when: '메시지 본문',
  },
  {
    sample: (
      <span className="block rounded-lg border border-violet-200/70 bg-white px-2 py-1.5 text-fluid-2xs text-gray-700 pointer-events-none select-none">
        샘플 미리보기 (치환 적용) — 아래에 실제 복사될 모양
      </span>
    ),
    meaning:
      '아래 「샘플 미리보기」는 예시 금액·일정으로 치환한 결과입니다. 발급 건마다 금액·링크는 달라집니다.',
    when: '본문 아래',
  },
  {
    sample: (
      <>
        <CustomerLinkHelpSaveButton />
        <CustomerLinkHelpResetButton />
      </>
    ),
    meaning:
      '「저장」 후 새로 발급하거나 「메시지 복사」하는 건부터 반영됩니다. 「기본 양식으로 다시 채우기」는 지금 편집 중인 내용을 지우고 권장 형식으로 되돌립니다.',
    when: '카드 하단',
  },
  {
    sample: <CustomerLinkHelpMessageCopyHint />,
    meaning:
      '발주서 발급 완료·발주서 목록·접수 목록에서 「메시지 복사」할 때 이 설정이 사용됩니다.',
    when: '발급·목록 화면',
  },
];
