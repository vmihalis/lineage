import { describe, it, expect } from 'vitest';
import {
  buildSmallMutationPrompt,
  buildLargeMutationPrompt,
  MUTATION_SYSTEM_PROMPT,
} from './mutation-prompts.js';
import {
  decideMutation,
  selectTokenIndex,
  reassembleContent,
} from './mutation-decider.js';
import { extractAnchorTokens } from '../transmission/anchor-parser.js';

function makeSequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++];
}

// --- buildSmallMutationPrompt tests (MUTN-01) ---

describe('buildSmallMutationPrompt', () => {
  it('returns string containing the original claim text', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result).toContain('Water boils at 100 degrees Celsius');
  });

  it('output contains drift instruction (imprecision or less precise or vague)', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result).toMatch(/imprecision|less precise|vague/i);
  });

  it('output contains "Return ONLY" (no-preamble instruction)', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result).toContain('Return ONLY');
  });

  it('output does NOT contain "invert" (wrong mutation type)', () => {
    const result = buildSmallMutationPrompt('Water boils at 100 degrees Celsius');
    expect(result.toLowerCase()).not.toContain('invert');
  });
});

// --- buildLargeMutationPrompt tests (MUTN-02) ---

describe('buildLargeMutationPrompt', () => {
  it('returns string containing the original claim text', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result).toContain('Never store passwords in plaintext');
  });

  it('output contains inversion instruction (invert or opposite)', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result).toMatch(/invert|opposite/i);
  });

  it('output contains "Return ONLY" (no-preamble instruction)', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result).toContain('Return ONLY');
  });

  it('output does NOT contain "imprecision" or "vague" (wrong mutation type)', () => {
    const result = buildLargeMutationPrompt('Never store passwords in plaintext');
    expect(result.toLowerCase()).not.toMatch(/imprecision|vague/);
  });
});

// --- MUTATION_SYSTEM_PROMPT tests ---

describe('MUTATION_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof MUTATION_SYSTEM_PROMPT).toBe('string');
    expect(MUTATION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('contains "transmission" or "medium" (role framing)', () => {
    expect(MUTATION_SYSTEM_PROMPT).toMatch(/transmission|medium/i);
  });
});

// --- decideMutation tests (MUTN-03, MUTN-04) ---

describe('decideMutation', () => {
  it('returns { mutate: false } when randomFn value >= mutationRate', () => {
    const result = decideMutation(0.3, 0.1, () => 0.5);
    expect(result).toEqual({ mutate: false });
  });

  it('returns { mutate: true, type: "small" } when first roll passes but second roll >= largeMutationProbability', () => {
    const result = decideMutation(0.3, 0.1, makeSequence([0.1, 0.5]));
    expect(result).toEqual({ mutate: true, type: 'small' });
  });

  it('returns { mutate: true, type: "large" } when both rolls pass', () => {
    const result = decideMutation(0.3, 0.5, makeSequence([0.1, 0.2]));
    expect(result).toEqual({ mutate: true, type: 'large' });
  });

  it('returns { mutate: false } when mutationRate is 0.0 (0.0 >= 0.0, strict <)', () => {
    const result = decideMutation(0.0, 0.1, () => 0.0);
    expect(result).toEqual({ mutate: false });
  });

  it('returns { mutate: true, type: "small" } when mutationRate is 1.0 and largeMutationProbability is 0.0', () => {
    const result = decideMutation(1.0, 0.0, () => 0.99);
    expect(result).toEqual({ mutate: true, type: 'small' });
  });

  it('returns { mutate: true, type: "large" } when both rates are 1.0', () => {
    const result = decideMutation(1.0, 1.0, () => 0.99);
    expect(result).toEqual({ mutate: true, type: 'large' });
  });
});

// --- selectTokenIndex tests ---

describe('selectTokenIndex', () => {
  it('returns 0 when randomFn returns 0.0', () => {
    expect(selectTokenIndex(5, () => 0.0)).toBe(0);
  });

  it('returns 4 when randomFn returns 0.99 for tokenCount 5', () => {
    expect(selectTokenIndex(5, () => 0.99)).toBe(4);
  });

  it('returns 0 when tokenCount is 1 regardless of randomFn value', () => {
    expect(selectTokenIndex(1, () => 0.5)).toBe(0);
  });
});

// --- reassembleContent tests ---

describe('reassembleContent', () => {
  it('rebuilds two tokens into [N] formatted text', () => {
    expect(reassembleContent(['First claim', 'Second claim'])).toBe(
      '[1] First claim\n[2] Second claim',
    );
  });

  it('handles a single token', () => {
    expect(reassembleContent(['Single'])).toBe('[1] Single');
  });

  it('returns empty string for empty array', () => {
    expect(reassembleContent([])).toBe('');
  });

  it('roundtrips with extractAnchorTokens for non-empty arrays', () => {
    const tokens = ['Knowledge compounds over time', 'Mortality creates urgency', 'Loss teaches value'];
    const reassembled = reassembleContent(tokens);
    const extracted = extractAnchorTokens(reassembled);
    expect(extracted).toEqual(tokens);
  });
});
