import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HelpCmsDesignedArticleNodeView } from './HelpCmsDesignedArticleNodeView';

/** TipTap 스키마 밖 레이아웃(style·class·div 그리드)을 한 블록으로 유지 */
export const HelpCmsDesignedArticle = Node.create({
  name: 'designedArticle',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      html: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.cbiseo-notice-article',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const root = el.closest('[data-designed-pack]') ?? el.parentElement;
          const pack =
            root instanceof HTMLElement && root.getAttribute('data-designed-pack') === '1'
              ? root.innerHTML
              : el.outerHTML;
          return { html: pack };
        },
      },
      {
        tag: 'div[data-designed-article="1"]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const stored = el.getAttribute('data-html');
          if (stored) {
            try {
              return { html: decodeURIComponent(stored) };
            } catch {
              return { html: stored };
            }
          }
          return { html: el.innerHTML };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const html = String(node.attrs.html ?? '');
    return ['div', { 'data-designed-article': '1', 'data-html': encodeURIComponent(html) }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HelpCmsDesignedArticleNodeView, {
      ignoreMutation: () => true,
      stopEvent: ({ event }) => {
        const target = event.target;
        return target instanceof Element && Boolean(target.closest('.cbiseo-notice-article'));
      },
    });
  },
});
