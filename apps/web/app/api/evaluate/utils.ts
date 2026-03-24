export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

function getNgrams(tokens: string[], n: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i <= tokens.length - n; i += 1) {
    const gram = tokens.slice(i, i + n).join(" ");
    counts[gram] = (counts[gram] || 0) + 1;
  }
  return counts;
}

export function bleuScore(candidate: string, reference: string): number {
  const candTokens = candidate.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const refTokens = reference.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (candTokens.length === 0 || refTokens.length === 0) return 0;

  const maxN = Math.min(4, candTokens.length);
  const weights = Array(maxN).fill(1 / maxN);
  let logPrecSum = 0;

  for (let n = 1; n <= maxN; n += 1) {
    const candNgrams = getNgrams(candTokens, n);
    const refNgrams = getNgrams(refTokens, n);

    let match = 0;
    let total = 0;

    Object.entries(candNgrams).forEach(([gram, count]) => {
      const refCount = refNgrams[gram] || 0;
      match += Math.min(count, refCount);
      total += count;
    });

    if (total === 0) {
      return 0;
    }

    const precision = match / total;
    if (precision <= 0) {
      return 0;
    }

    logPrecSum += weights[n - 1] * Math.log(precision);
  }

  const candLen = candTokens.length;
  const refLen = refTokens.length;
  const brevityPenalty = candLen > refLen ? 1 : Math.exp(1 - refLen / candLen);

  return brevityPenalty * Math.exp(logPrecSum);
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
