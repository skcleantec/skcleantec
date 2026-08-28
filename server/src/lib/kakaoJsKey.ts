/** Kakao SDK for JavaScript — 채널 채팅 등 클라이언트 init용 (도메인 제한은 Developers 콘솔) */
export function getKakaoJavaScriptKey(): string {
  return process.env.KAKAO_JAVASCRIPT_KEY?.trim() || '';
}
