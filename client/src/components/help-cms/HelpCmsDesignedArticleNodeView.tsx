import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export function HelpCmsDesignedArticleNodeView({ node }: NodeViewProps) {
  const html = String(node.attrs.html ?? '');
  return (
    <NodeViewWrapper
      as="div"
      className="cbiseo-designed-article-host not-prose my-1"
      data-designed-article="1"
      contentEditable={false}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
}
