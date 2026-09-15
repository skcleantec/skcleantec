/** 완성본 블로그 HTML을 공지·도움말에 넣을 때 — 페이지 전체가 리셋되지 않게 스코프 */
export const DESIGNED_ARTICLE_SCOPE_CLASS = 'cbiseo-notice-article';

/**
 * 타나클린 청소비서 장점 글 등 — class="lead" / .cta 가 있는데 &lt;style&gt;이 빠진 경우(브라우저에서 복사).
 * 선택자는 모두 `.cbiseo-notice-article` 아래만.
 */
export const DESIGNED_ARTICLE_FALLBACK_CSS = `
.${DESIGNED_ARTICLE_SCOPE_CLASS} {
  font-family: 'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 0 16px;
  color: #0b1220;
  line-height: 1.9;
  font-size: 15px;
  background: #fff;
}
.${DESIGNED_ARTICLE_SCOPE_CLASS} * { box-sizing: border-box; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .post-title { font-size: 23px; font-weight: 800; line-height: 1.45; margin-bottom: 8px; letter-spacing: -0.01em; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .post-title .accent { color: #2f6bff; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .post-meta { font-size: 13px; color: #6c7a96; margin-bottom: 18px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .lead { background: #f7f9fe; border-left: 4px solid #2f6bff; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 16px 0 22px; font-size: 14.5px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} h1 { font-size: 23px; font-weight: 800; line-height: 1.45; margin-bottom: 8px; letter-spacing: -0.01em; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} h2 { font-size: 18px; font-weight: 800; margin: 34px 0 10px; line-height: 1.5; letter-spacing: -0.01em; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} h2 .num { display: inline-block; min-width: 26px; height: 26px; line-height: 26px; text-align: center; background: #2f6bff; color: #fff; border-radius: 8px; font-size: 13px; margin-right: 8px; vertical-align: 2px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} p { margin: 9px 0; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .highlight { color: #2f6bff; font-weight: 700; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .warn { color: #e0574f; font-weight: 700; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} figure { margin: 16px 0 20px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} figure img,
.${DESIGNED_ARTICLE_SCOPE_CLASS} img { width: 100%; height: auto; border-radius: 12px; border: 1px solid #e9eef9; display: block; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} figcaption { font-size: 12.5px; color: #6c7a96; margin-top: 6px; text-align: center; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
@media (max-width: 480px) {
  .${DESIGNED_ARTICLE_SCOPE_CLASS} .before-after { grid-template-columns: 1fr; }
}
.${DESIGNED_ARTICLE_SCOPE_CLASS} .ba-box { border-radius: 12px; padding: 12px 16px; font-size: 14px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .ba-before { background: #f1f4fa; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .ba-before .t { color: #e0574f; font-weight: 800; display: block; margin-bottom: 4px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .ba-after { background: #eaf0ff; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .ba-after .t { color: #1b4fd8; font-weight: 800; display: block; margin-bottom: 4px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} ul.list { margin: 8px 0 8px 18px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} ul.list li { margin: 6px 0; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} ul.list li::marker { color: #2f6bff; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .tip { background: #eaf0ff; border-radius: 10px; padding: 12px 16px; margin: 12px 0; font-size: 14px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .tip b { color: #1b4fd8; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .faq { border: 1px solid #e9eef9; border-radius: 12px; padding: 6px 18px; margin: 12px 0; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .faq .q { font-weight: 800; margin: 10px 0 2px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .faq .a { color: #3a4761; margin: 0 0 10px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .cta { background: #f7f9fe; border: 2px solid #2f6bff; border-radius: 14px; padding: 22px 24px; margin: 30px 0 16px; text-align: center; line-height: 2; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .cta .btn { display: inline-block; background: #2f6bff; color: #fff; font-weight: 800; padding: 10px 22px; border-radius: 999px; text-decoration: none; margin: 8px 6px 0; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .cta .btn.sub { background: #fff; color: #1b4fd8; border: 2px solid #2f6bff; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .hashtag-box { background: #f5f5f5; border-radius: 8px; padding: 14px 18px; font-size: 14px; color: #2f6bff; line-height: 2.2; margin-top: 16px; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} a { color: #2f6bff; text-decoration: none; font-weight: 700; }
.${DESIGNED_ARTICLE_SCOPE_CLASS} .footer { text-align: center; margin-top: 40px; color: #9aa7c0; font-size: 13px; }
`.trim();

export const DESIGNED_ARTICLE_FONT_LINK =
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">';
