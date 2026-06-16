/** 메일·서버 생성 공개 링크의 canonical origin — `PUBLIC_URL` 우선 */
export function getPublicAppBaseUrl(): string {
  const explicit = (process.env.PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const domain = (process.env.RAILWAY_PUBLIC_DOMAIN ?? '').trim();
  if (domain) return `https://${domain}`;

  return `http://localhost:${process.env.PORT || 3000}`;
}
