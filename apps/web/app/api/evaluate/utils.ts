export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

export function bleuScore(candidate: string, reference: string): number {
  // Placeholder: BLEU implementation requires additional setup
  return 0; // TODO: implement proper BLEU
}

export function rouge1(candidate: string, reference: string): number {
  const candTokens = candidate.toLowerCase().split(/\s+/);
  const refTokens = reference.toLowerCase().split(/\s+/);
  const candSet = new Set(candTokens);
  const refSet = new Set(refTokens);
  const intersection = new Set([...candSet].filter((x) => refSet.has(x)));
  const precision = intersection.size / candSet.size;
  const recall = intersection.size / refSet.size;
  return (2 * (precision * recall)) / (precision + recall) || 0;
}
