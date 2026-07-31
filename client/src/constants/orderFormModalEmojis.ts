import { CLEANING_PROF_OPTION_EMOJIS } from './professionalOptionEmojis';

export type OrderFormModalEmojiGroup = {
  label: string;
  items: readonly string[];
};

/** 발주서 모달 문구 — 이모지 팔레트 (그룹별) */
export const ORDER_FORM_MODAL_EMOJI_GROUPS: readonly OrderFormModalEmojiGroup[] = [
  {
    label: '안내·표시',
    items: [
      '⚠️',
      '❗',
      '‼️',
      '✅',
      '❌',
      '⭕',
      '🔔',
      '📢',
      '💡',
      '📌',
      '⭐',
      '🌟',
      '✨',
      '🔴',
      '🟠',
      '🟡',
      '🟢',
      '🔵',
    ],
  },
  {
    label: '일정·연락',
    items: ['📅', '📆', '⏰', '🕐', '🕑', '🕒', '📞', '📱', '💬', '✉️', '📧', '📝'],
  },
  {
    label: '금액·서비스',
    items: ['💰', '💳', '💵', '🏦', '🎁', '🏷️', '🧾', '🤝', '🙏', '👍', '👎', '👌'],
  },
  {
    label: '표정',
    items: ['😊', '🙂', '😃', '😅', '😢', '😮', '😡', '🥲', '😇', '🤔', '😴', '🫡'],
  },
  {
    label: '청소·시공',
    items: CLEANING_PROF_OPTION_EMOJIS,
  },
];

export const ORDER_FORM_MODAL_SPECIAL_CHARS: readonly string[] = [
  '·',
  '•',
  '※',
  '→',
  '←',
  '↑',
  '↓',
  '「',
  '」',
  '『',
  '』',
  '【',
  '】',
  '…',
  '–',
  '—',
  '✓',
  '✗',
  '○',
  '●',
  '□',
  '■',
  '★',
  '☆',
  '§',
  '¶',
];
