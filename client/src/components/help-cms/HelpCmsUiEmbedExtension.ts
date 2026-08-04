import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HelpUiEmbedNodeView } from './HelpUiEmbedNodeView';

/** {{ui:…}} — 편집·공개 동일 UI 목업 */
export const HelpCmsUiEmbed = Node.create({
  name: 'helpUiEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      tokenId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-help-ui'),
        renderHTML: (attributes) => ({
          'data-help-ui': attributes.tokenId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-help-ui]' }, { tag: 'span[data-help-ui]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'help-cms-ui-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HelpUiEmbedNodeView);
  },
});
