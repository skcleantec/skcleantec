import type { AiProductKey, QuickPasteAiOperation } from './aiProduct.constants.js';
import { prisma } from '../../lib/prisma.js';

export type AiUsageLogContext = {
  tenantId: string;
  userId?: string | null;
  inquiryId?: string | null;
  chatId?: string | null;
  source?: string | null;
  operation?: QuickPasteAiOperation | string | null;
};

export async function persistAiUsageLog(params: {
  product: AiProductKey;
  context: AiUsageLogContext;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsdMicros: number;
}): Promise<void> {
  const { product, context, model, promptTokens, completionTokens, estimatedCostUsdMicros } = params;
  if (product === 'telecrm_summary') {
    if (!context.userId) return;
    await prisma.telecrmAiUsageLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        chatId: context.chatId?.slice(0, 64) ?? null,
        inquiryId: context.inquiryId ?? null,
        source: (context.source || 'soomgo').slice(0, 20),
        productKey: 'telecrm_summary',
        model: model.slice(0, 64),
        promptTokens,
        completionTokens,
        estimatedCostUsdMicros,
      },
    });
    return;
  }

  await prisma.quickPasteAiUsageLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId ?? null,
      inquiryId: context.inquiryId ?? null,
      operation: (context.operation || 'understand').slice(0, 32),
      model: model.slice(0, 64),
      promptTokens,
      completionTokens,
      estimatedCostUsdMicros,
    },
  });
}
