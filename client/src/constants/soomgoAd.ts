/** 숨고(채널명에 '숨고' 또는 soomgo 포함) 당일 광고비 단가 */
export const SOOMGO_WON_PER_RECEIVED_REQUEST = 3800;
export const SOOMGO_WON_PER_AUTO_ESTIMATE = 3500;

export function isSoomgoChannelName(name: string): boolean {
  const n = String(name).trim().toLowerCase();
  return n.includes('숨고') || n.includes('soomgo');
}
