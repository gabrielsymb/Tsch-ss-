const MATH_TOKENS: Array<[RegExp, string | ((match: string) => string)]> = [
  [/\\(?:displaystyle)?int\b/gi, " integral "],
  [/\\(?:left|right|quad|qquad|,|;|!)/gi, " "],
  [/\\(?:cdot|times)/gi, " vezes "],
  [/\\(?:sin|cos|tan|cot|sec|csc|ln|log|sqrt|pi)\b/gi, (match) =>
    match.slice(1)],
  [/∫/g, " integral "],
  [/π/g, " pi "],
  [/√/g, " sqrt "],
  [/×|·/g, " vezes "],
  [/²/g, "^2"],
  [/³/g, "^3"],
];

export function normalizeSearchText(value: string): string {
  let normalized = value.toLocaleLowerCase("pt-BR");
  for (const [pattern, replacement] of MATH_TOKENS) {
    normalized = typeof replacement === "string"
      ? normalized.replace(pattern, replacement)
      : normalized.replace(pattern, (match) => replacement(match));
  }
  return normalized
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function trigramSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }

  const leftTrigrams = trigrams(left);
  const rightTrigrams = trigrams(right);
  let intersection = 0;
  for (const trigram of leftTrigrams) {
    if (rightTrigrams.has(trigram)) {
      intersection += 1;
    }
  }
  return (2 * intersection) / (leftTrigrams.size + rightTrigrams.size);
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const result = new Set<string>();
  for (let index = 0; index <= padded.length - 3; index += 1) {
    result.add(padded.slice(index, index + 3));
  }
  return result;
}
