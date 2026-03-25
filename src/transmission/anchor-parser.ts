/**
 * Extracts anchor tokens from agent output text.
 *
 * Parses numbered claims in the format [N] claim text where N is a positive integer.
 * Returns an array of trimmed claim strings. If no numbered claims are found and the
 * input is non-empty, returns the full trimmed text as a single-element array.
 * Returns an empty array only for empty or whitespace-only input.
 */
export function extractAnchorTokens(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const pattern = /\[(\d+)\]\s*(.+?)(?=\n\[\d+\]|\s*$)/gs;
  const tokens: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const claim = match[2].trim();
    if (claim.length > 0) {
      tokens.push(claim);
    }
  }

  // Fallback: if no [N] patterns found, return the full text as a single token
  if (tokens.length === 0) {
    return [text.trim()];
  }

  return tokens;
}
