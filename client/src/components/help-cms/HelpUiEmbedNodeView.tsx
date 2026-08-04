import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { HelpUiEmbed } from '../help/ui/helpUiRegistry';
import { isHelpUiTokenId } from '@shared/helpUiTokens';

export function HelpUiEmbedNodeView({ node }: NodeViewProps) {
  const tokenId = String(node.attrs.tokenId ?? '').trim();

  return (
    <NodeViewWrapper className="help-cms-ui-embed-node my-3" contentEditable={false}>
      {isHelpUiTokenId(tokenId) ? (
        <HelpUiEmbed tokenId={tokenId} />
      ) : (
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-fluid-2xs text-amber-800">
          UI: {tokenId || '(없음)'}
        </span>
      )}
    </NodeViewWrapper>
  );
}
