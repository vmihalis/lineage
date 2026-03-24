import { describe, it, expect } from 'vitest';
import { bus } from '@genesis/shared';
import { AgentConfigSchema } from '@genesis/shared';

describe('@genesis/shared Integration', () => {
  it('bus is an EventEmitter3 instance with eventNames method', () => {
    expect(bus).toBeDefined();
    expect(typeof bus.eventNames).toBe('function');
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.emit).toBe('function');
    expect(Array.isArray(bus.eventNames())).toBe(true);
  });

  it('AgentConfigSchema.parse() validates correct input', () => {
    const config = AgentConfigSchema.parse({
      id: 'citizen-001',
      name: 'First Citizen',
      type: 'lineage-citizen',
      systemPrompt: 'You are a citizen of the civilization.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(config.id).toBe('citizen-001');
    expect(config.name).toBe('First Citizen');
    expect(config.type).toBe('lineage-citizen');
    expect(config.status).toBe('idle');
    expect(config.maxTurns).toBe(10);
    expect(config.permissionMode).toBe('bypassPermissions');
  });

  it('AgentConfigSchema.parse() rejects missing required fields', () => {
    expect(() => AgentConfigSchema.parse({
      id: 'citizen-002',
      // missing: name, type, systemPrompt, createdAt, updatedAt
    })).toThrow();
  });

  it('AgentConfigSchema.parse() rejects invalid status value', () => {
    expect(() => AgentConfigSchema.parse({
      id: 'citizen-003',
      name: 'Bad Citizen',
      type: 'lineage-citizen',
      systemPrompt: 'Test',
      status: 'invalid-status',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })).toThrow();
  });
});
