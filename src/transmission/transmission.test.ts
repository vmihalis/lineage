import { describe, it, expect } from 'vitest';
import { extractAnchorTokens } from './anchor-parser.js';
import { buildPeakTransmissionPrompt } from './peak-prompt.js';
import { CitizenConfigSchema } from '../schemas/index.js';

function makeCitizen(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return CitizenConfigSchema.parse({
    id: 'citizen-001',
    name: 'citizen-gen1-alpha',
    type: 'lineage-citizen',
    systemPrompt: 'You are a builder citizen.',
    role: 'builder',
    generationNumber: 1,
    deathProfile: 'old-age',
    contextBudget: 0,
    birthTimestamp: now,
    createdAt: now,
    updatedAt: now,
    transmissions: [],
    ...overrides,
  });
}

describe('extractAnchorTokens', () => {
  it('parses two numbered claims into an array of two strings', () => {
    const result = extractAnchorTokens('[1] First claim\n[2] Second claim');
    expect(result).toEqual(['First claim', 'Second claim']);
  });

  it('parses a single numbered claim', () => {
    const result = extractAnchorTokens('[1] Single');
    expect(result).toEqual(['Single']);
  });

  it('handles double-digit numbers correctly', () => {
    const result = extractAnchorTokens('[10] Double digit\n[11] Also works');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Double digit');
    expect(result[1]).toBe('Also works');
  });

  it('returns full text as single-element array for prose without brackets', () => {
    const result = extractAnchorTokens('Plain prose without brackets');
    expect(result).toEqual(['Plain prose without brackets']);
  });

  it('returns empty array for empty string input', () => {
    const result = extractAnchorTokens('');
    expect(result).toEqual([]);
  });

  it('trims whitespace from extracted claims', () => {
    const result = extractAnchorTokens('[1]  Spaces  ');
    expect(result).toEqual(['Spaces']);
  });

  it('handles five numbered claims', () => {
    const input = '[1] Claim one\n[2] Claim two\n[3] Third claim\n[4] Fourth\n[5] Fifth';
    const result = extractAnchorTokens(input);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('Claim one');
    expect(result[4]).toBe('Fifth');
  });

  it('handles multi-line claims that span two lines before next anchor', () => {
    const input = '[1] Multi-line claim\nthat spans two lines\n[2] Next claim';
    const result = extractAnchorTokens(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Multi-line claim');
    expect(result[0]).toContain('that spans two lines');
    expect(result[1]).toBe('Next claim');
  });

  it('returns empty array for whitespace-only input', () => {
    const result = extractAnchorTokens('   \n  \n   ');
    expect(result).toEqual([]);
  });
});

describe('buildPeakTransmissionPrompt', () => {
  it('includes context percentage as an integer (42% for 0.42)', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.42);
    expect(prompt).toContain('42%');
  });

  it('contains [1] instruction example for numbered claims format', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.5);
    expect(prompt).toContain('[1]');
  });

  it('contains transmission and mortality language', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.75);
    expect(prompt).toContain('transmission');
    expect(prompt).toMatch(/survive|legacy|death/i);
  });

  it('contains 3-7 claims guidance for target count', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.8);
    expect(prompt).toContain('3-7 claims');
  });

  it('contains stand alone instruction for independent claims', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.6);
    expect(prompt).toContain('stand alone');
  });

  it('contains PEAK TRANSMISSION MOMENT header', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.5);
    expect(prompt).toContain('PEAK TRANSMISSION MOMENT');
  });

  it('rounds context percentage to nearest integer', () => {
    const citizen = makeCitizen();
    const prompt = buildPeakTransmissionPrompt(citizen, 0.876);
    expect(prompt).toContain('88%');
  });
});
