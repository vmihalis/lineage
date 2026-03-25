import { describe, it, expect } from 'vitest';
import { assignRole, assignRoles } from './role-assignment.js';
import { ROLE_PROMPTS } from './system-prompts.js';
import { buildSystemPrompt } from './prompt-builder.js';
import type { PromptContext } from './prompt-builder.js';
import { CitizenRoleSchema, RoleDistributionSchema } from '../schemas/index.js';
import type { RoleDistribution } from '../schemas/index.js';

describe('assignRole', () => {
  it('returns builder when distribution is 100% builder', () => {
    const dist = RoleDistributionSchema.parse({
      builder: 1.0,
      skeptic: 0.0,
      archivist: 0.0,
      'elder-interpreter': 0.0,
      observer: 0.0,
    });
    for (let i = 0; i < 20; i++) {
      expect(assignRole(dist)).toBe('builder');
    }
  });

  it('returns skeptic when distribution is 100% skeptic', () => {
    const dist = RoleDistributionSchema.parse({
      builder: 0.0,
      skeptic: 1.0,
      archivist: 0.0,
      'elder-interpreter': 0.0,
      observer: 0.0,
    });
    for (let i = 0; i < 20; i++) {
      expect(assignRole(dist)).toBe('skeptic');
    }
  });

  it('always returns a valid CitizenRole from the 5-value enum', () => {
    const dist = RoleDistributionSchema.parse({
      builder: 0.3,
      skeptic: 0.2,
      archivist: 0.2,
      'elder-interpreter': 0.15,
      observer: 0.15,
    });
    const validRoles = CitizenRoleSchema.options;
    for (let i = 0; i < 100; i++) {
      const role = assignRole(dist);
      expect(validRoles).toContain(role);
    }
  });
});

describe('assignRoles', () => {
  it('returns array of length matching generationSize', () => {
    const dist = RoleDistributionSchema.parse({
      builder: 0.3,
      skeptic: 0.2,
      archivist: 0.2,
      'elder-interpreter': 0.15,
      observer: 0.15,
    });
    const roles = assignRoles(5, dist);
    expect(roles).toHaveLength(5);
  });

  it('returns empty array when generationSize is 0', () => {
    const dist = RoleDistributionSchema.parse({
      builder: 0.3,
      skeptic: 0.2,
      archivist: 0.2,
      'elder-interpreter': 0.15,
      observer: 0.15,
    });
    const roles = assignRoles(0, dist);
    expect(roles).toHaveLength(0);
  });
});

describe('ROLE_PROMPTS', () => {
  it('has exactly 5 keys matching CitizenRoleSchema values', () => {
    const keys = Object.keys(ROLE_PROMPTS);
    expect(keys).toHaveLength(5);
    for (const role of CitizenRoleSchema.options) {
      expect(keys).toContain(role);
    }
  });

  it('builder prompt contains "Builder" and mentions solving/building/ideas', () => {
    expect(ROLE_PROMPTS.builder).toContain('Builder');
    expect(ROLE_PROMPTS.builder.toLowerCase()).toMatch(/solv|build|idea/);
  });

  it('skeptic prompt contains "Skeptic" and mentions questioning/stress-test/challenge', () => {
    expect(ROLE_PROMPTS.skeptic).toContain('Skeptic');
    expect(ROLE_PROMPTS.skeptic.toLowerCase()).toMatch(/question|stress.test|challeng/);
  });

  it('archivist prompt contains "Archivist" and mentions preserving/protecting/memory', () => {
    expect(ROLE_PROMPTS.archivist).toContain('Archivist');
    expect(ROLE_PROMPTS.archivist.toLowerCase()).toMatch(/preserv|protect|memory/);
  });

  it('elder-interpreter prompt contains "Elder Interpreter" and mentions understanding/interpreting/teaching', () => {
    expect(ROLE_PROMPTS['elder-interpreter']).toContain('Elder Interpreter');
    expect(ROLE_PROMPTS['elder-interpreter'].toLowerCase()).toMatch(/understand|interpret|teach/);
  });

  it('observer prompt contains "Observer" and mentions watching/recording/history', () => {
    expect(ROLE_PROMPTS.observer).toContain('Observer');
    expect(ROLE_PROMPTS.observer.toLowerCase()).toMatch(/watch|record|history/);
  });

  it('each prompt is under 2000 characters', () => {
    for (const [role, prompt] of Object.entries(ROLE_PROMPTS)) {
      expect(prompt.length, `${role} prompt exceeds 2000 chars`).toBeLessThan(2000);
    }
  });
});

describe('buildSystemPrompt', () => {
  const context: PromptContext = {
    seedProblem: 'What is worth preserving?',
    generationNumber: 3,
    citizenName: 'citizen-gen3-abc123',
  };

  it('includes role prompt text, seed problem, generation number, and citizen name', () => {
    const prompt = buildSystemPrompt('builder', context);
    expect(prompt).toContain('Builder');
    expect(prompt).toContain('What is worth preserving?');
    expect(prompt).toContain('3');
    expect(prompt).toContain('citizen-gen3-abc123');
  });

  it('contains "mortal" for mortality awareness', () => {
    const prompt = buildSystemPrompt('builder', context);
    expect(prompt.toLowerCase()).toContain('mortal');
  });

  it('all 5 roles produce distinct prompts given identical context', () => {
    const prompts = new Set<string>();
    for (const role of CitizenRoleSchema.options) {
      prompts.add(buildSystemPrompt(role, context));
    }
    expect(prompts.size).toBe(5);
  });

  it('includes "Seed Problem: \\"What is worth preserving?\\"" when that is the seedProblem', () => {
    const prompt = buildSystemPrompt('builder', context);
    expect(prompt).toContain('Seed Problem: "What is worth preserving?"');
  });
});

describe('roles barrel exports', () => {
  it('exports assignRole, assignRoles, buildSystemPrompt, ROLE_PROMPTS from index', async () => {
    const barrel = await import('./index.js');
    expect(barrel.assignRole).toBe(assignRole);
    expect(barrel.assignRoles).toBe(assignRoles);
    expect(barrel.buildSystemPrompt).toBe(buildSystemPrompt);
    expect(barrel.ROLE_PROMPTS).toBe(ROLE_PROMPTS);
  });
});
