import type { KeyboardEvent } from 'react';

const COMPOSER_MAX_HEIGHT_PX = 120;

/** 터치(휴대폰)에서는 Enter=줄바꿈. PC는 Enter=전송, Shift+Enter=줄바꿈. */
export function shouldStaffChatEnterSend(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return false;
  if (typeof window === 'undefined') return true;
  return !window.matchMedia('(pointer: coarse)').matches;
}

export function resizeStaffChatComposer(el: HTMLTextAreaElement, maxPx = COMPOSER_MAX_HEIGHT_PX): void {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
}

/** 대화 목록 한 줄 미리보기 — 줄바꿈을 공백으로 */
export function flattenStaffChatPreview(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
