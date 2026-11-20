const EMBEDDING_MODEL = 'text-embedding-3-small';

function telecrmApiKey(): string {
  return (process.env.TELECRM_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

export function responseCardEmbedText(parts: {
  title: string;
  triggers: string[];
  intent: string;
}): string {
  return [parts.title, parts.triggers.join(' '), parts.intent].filter(Boolean).join('\n').slice(0, 4000);
}

/** 키 없으면 null. 호출 실패해도 예외를 올리지 않는다. */
export async function embedResponseCardTexts(texts: string[]): Promise<(number[] | null)[] | null> {
  const apiKey = telecrmApiKey();
  if (!apiKey || texts.length === 0) return null;
  const out: (number[] | null)[] = texts.map(() => null);
  try {
    for (let offset = 0; offset < texts.length; offset += 64) {
      const slice = texts.slice(offset, offset + 64);
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: slice }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.error('[telecrm-cards] embedding HTTP', res.status);
        return null;
      }
      const data = (await res.json()) as {
        data?: Array<{ index?: number; embedding?: number[] }>;
      };
      for (const row of data.data ?? []) {
        const index = typeof row.index === 'number' ? row.index : 0;
        if (Array.isArray(row.embedding)) out[offset + index] = row.embedding;
      }
    }
    return out;
  } catch (e) {
    console.error('[telecrm-cards] embedding failed', e instanceof Error ? e.name : 'unknown');
    return null;
  }
}
