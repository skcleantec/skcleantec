/** 대응 카드 검색 점수. 띄어쓰기는 무시한다. */

export type ResponseCardSearchFields = {
  title: string;
  triggers: string[];
  intent: string;
  responseTexts: string[];
  avoid: string[];
  rule: string;
  wonInCall: boolean;
  embedding: number[] | null;
};

export function compactText(value: string): string {
  return value.toLowerCase().replace(/[\s\u00a0]+/g, '');
}

export function parseEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 8) return null;
  const nums: number[] = [];
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return null;
    nums.push(item);
  }
  return nums;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function fieldHit(text: string, queryCompact: string, words: string[], weight: number): number {
  const compact = compactText(text);
  if (!compact || !queryCompact) return 0;
  let score = 0;
  if (compact.includes(queryCompact)) score += weight;
  for (const word of words) {
    if (word.length >= 2 && compact.includes(word)) score += weight * 0.35;
  }
  return score;
}

export function scoreResponseCard(
  card: ResponseCardSearchFields,
  query: string,
  queryEmbedding: number[] | null,
): number {
  const queryCompact = compactText(query);
  const words = query
    .split(/\s+/)
    .map((part) => compactText(part))
    .filter((part) => part.length >= 2);

  let score = fieldHit(card.title, queryCompact, words, 4);
  for (const trigger of card.triggers) score += fieldHit(trigger, queryCompact, words, 3);
  score += fieldHit(card.intent, queryCompact, words, 2);
  score += fieldHit(card.rule, queryCompact, words, 2);
  for (const line of card.responseTexts) score += fieldHit(line, queryCompact, words, 2);
  for (const line of card.avoid) score += fieldHit(line, queryCompact, words, 1);

  if (queryEmbedding && card.embedding) {
    const cosine = cosineSimilarity(queryEmbedding, card.embedding);
    if (cosine >= 0.28) score += cosine * 5;
  }

  if (card.wonInCall && score > 0) score += 1.5;
  return score;
}
