import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { HelpCmsDesignedArticleView } from './HelpCmsDesignedArticleView';
import { useHelpCmsEditorUpload } from './helpCmsEditorUploadContext';

export function HelpCmsDesignedArticleNodeView({ node, updateAttributes }: NodeViewProps) {
  const html = String(node.attrs.html ?? '');
  const uploadImage = useHelpCmsEditorUpload();
  return (
    <NodeViewWrapper
      as="div"
      className="cbiseo-designed-article-host not-prose my-1"
      data-designed-article="1"
      contentEditable={false}
    >
      <HelpCmsDesignedArticleView
        html={html}
        editable
        onUploadImage={uploadImage ?? undefined}
        onHtmlChange={(next) => {
          if (next !== html) updateAttributes({ html: next });
        }}
      />
    </NodeViewWrapper>
  );
}
