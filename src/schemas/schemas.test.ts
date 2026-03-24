import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { CitizenRoleSchema, RoleDistributionSchema } from './role.js';
import { DeathProfileSchema, DeathProfileDistributionSchema } from './death-profile.js';
import { CitizenConfigSchema } from './citizen.js';
import { SimulationParametersSchema } from './simulation.js';
import { GenerationPhaseSchema, GenerationSchema } from './generation.js';
import { TransmissionTypeSchema, TransmissionSchema } from './transmission.js';

describe('CitizenRoleSchema', () => {
  it('parses valid role "builder"', () => {
    expect(CitizenRoleSchema.parse('builder')).toBe('builder');
  });

  it('parses all valid roles', () => {
    const roles = ['builder', 'skeptic', 'archivist', 'elder-interpreter', 'observer'];
    for (const role of roles) {
      expect(CitizenRoleSchema.parse(role)).toBe(role);
    }
  });

  it('rejects invalid role', () => {
    expect(() => CitizenRoleSchema.parse('invalid-role')).toThrow(ZodError);
  });
});

describe('RoleDistributionSchema', () => {
  it('accepts distribution summing to ~1.0', () => {
    const dist = RoleDistributionSchema.parse({
      'builder': 0.3,
      'skeptic': 0.2,
      'archivist': 0.2,
      'elder-interpreter': 0.15,
      'observer': 0.15,
    });
    expect(dist.builder).toBe(0.3);
  });

  it('fills defaults summing to 1.0', () => {
    const dist = RoleDistributionSchema.parse({});
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });

  it('rejects distribution not summing to ~1.0', () => {
    expect(() =>
      RoleDistributionSchema.parse({
        'builder': 0.5,
        'skeptic': 0.5,
        'archivist': 0.5,
        'elder-interpreter': 0.15,
        'observer': 0.15,
      }),
    ).toThrow();
  });
});

describe('DeathProfileSchema', () => {
  it('parses valid death profile "old-age"', () => {
    expect(DeathProfileSchema.parse('old-age')).toBe('old-age');
  });

  it('parses "accident"', () => {
    expect(DeathProfileSchema.parse('accident')).toBe('accident');
  });

  it('rejects invalid death profile', () => {
    expect(() => DeathProfileSchema.parse('invalid')).toThrow(ZodError);
  });
});

describe('DeathProfileDistributionSchema', () => {
  it('accepts distribution summing to ~1.0', () => {
    const dist = DeathProfileDistributionSchema.parse({
      'old-age': 0.7,
      'accident': 0.3,
    });
    expect(dist['old-age']).toBe(0.7);
  });

  it('fills defaults summing to 1.0', () => {
    const dist = DeathProfileDistributionSchema.parse({});
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });

  it('rejects distribution not summing to ~1.0', () => {
    expect(() =>
      DeathProfileDistributionSchema.parse({
        'old-age': 0.5,
        'accident': 0.2,
      }),
    ).toThrow();
  });
});

describe('CitizenConfigSchema', () => {
  const validCitizen = {
    id: 'citizen-001',
    name: 'Test Citizen',
    type: 'lineage-citizen',
    systemPrompt: 'You are a test citizen.',
    role: 'builder',
    generationNumber: 1,
    deathProfile: 'old-age',
    contextBudget: 0.5,
    birthTimestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('parses valid citizen with all AgentConfig base fields', () => {
    const result = CitizenConfigSchema.parse(validCitizen);
    // AgentConfig base fields
    expect(result.id).toBe('citizen-001');
    expect(result.name).toBe('Test Citizen');
    expect(result.type).toBe('lineage-citizen');
    expect(result.systemPrompt).toBe('You are a test citizen.');
    expect(result.status).toBe('idle'); // default from AgentConfig
    // Lineage-specific fields
    expect(result.role).toBe('builder');
    expect(result.generationNumber).toBe(1);
    expect(result.deathProfile).toBe('old-age');
    expect(result.contextBudget).toBe(0.5);
    expect(result.birthTimestamp).toBeDefined();
  });

  it('rejects empty object (missing required fields)', () => {
    expect(() => CitizenConfigSchema.parse({})).toThrow(ZodError);
  });

  it('includes transmissions array default', () => {
    const result = CitizenConfigSchema.parse(validCitizen);
    expect(result.transmissions).toEqual([]);
  });
});

describe('SimulationParametersSchema', () => {
  it('fills defaults when only seedProblem provided', () => {
    const result = SimulationParametersSchema.parse({
      seedProblem: 'What is consciousness?',
    });
    expect(result.seedProblem).toBe('What is consciousness?');
    expect(result.generationSize).toBe(5);
    expect(result.maxGenerations).toBe(3);
    expect(result.mutationRate).toBe(0.3);
    expect(result.largeMutationProbability).toBe(0.1);
    expect(result.gen1Protection).toBe(true);
    expect(result.peakTransmissionWindow.min).toBe(0.4);
    expect(result.peakTransmissionWindow.max).toBe(0.5);
    expect(result.inheritanceStagingRates.seedLayerAtBirth).toBe(true);
    expect(result.inheritanceStagingRates.recentLayerThreshold).toBe(0.25);
    expect(result.outputDir).toBe('./output');
  });

  it('rejects empty object (seedProblem is required)', () => {
    expect(() => SimulationParametersSchema.parse({})).toThrow(ZodError);
  });

  it('rejects empty seedProblem string', () => {
    expect(() =>
      SimulationParametersSchema.parse({ seedProblem: '' }),
    ).toThrow(ZodError);
  });

  it('contains all CONF-02 parameters', () => {
    const result = SimulationParametersSchema.parse({
      seedProblem: 'test',
    });
    expect(result).toHaveProperty('generationSize');
    expect(result).toHaveProperty('maxGenerations');
    expect(result).toHaveProperty('deathProfileDistribution');
    expect(result).toHaveProperty('mutationRate');
    expect(result).toHaveProperty('largeMutationProbability');
    expect(result).toHaveProperty('roleDistribution');
    expect(result).toHaveProperty('gen1Protection');
    expect(result).toHaveProperty('peakTransmissionWindow');
    expect(result).toHaveProperty('inheritanceStagingRates');
  });
});

describe('GenerationPhaseSchema', () => {
  it('parses "INIT"', () => {
    expect(GenerationPhaseSchema.parse('INIT')).toBe('INIT');
  });

  it('parses all valid phases', () => {
    const phases = ['INIT', 'BIRTHING', 'INTERACTING', 'DYING', 'TRANSMITTING', 'COMPLETE'];
    for (const phase of phases) {
      expect(GenerationPhaseSchema.parse(phase)).toBe(phase);
    }
  });

  it('rejects invalid phase', () => {
    expect(() => GenerationPhaseSchema.parse('INVALID')).toThrow(ZodError);
  });
});

describe('GenerationSchema', () => {
  it('parses valid generation object', () => {
    const validGen = {
      id: 'gen-001',
      number: 1,
      phase: 'INIT',
      citizenIds: ['c-1', 'c-2'],
      transmissionIds: [],
      startedAt: new Date().toISOString(),
    };
    const result = GenerationSchema.parse(validGen);
    expect(result.id).toBe('gen-001');
    expect(result.number).toBe(1);
    expect(result.phase).toBe('INIT');
    expect(result.citizenIds).toEqual(['c-1', 'c-2']);
  });

  it('fills default phase and arrays', () => {
    const result = GenerationSchema.parse({ id: 'gen-002', number: 2 });
    expect(result.phase).toBe('INIT');
    expect(result.citizenIds).toEqual([]);
    expect(result.transmissionIds).toEqual([]);
  });
});

describe('TransmissionSchema', () => {
  it('parses valid transmission', () => {
    const validTransmission = {
      id: 'tx-001',
      citizenId: 'citizen-001',
      generationNumber: 1,
      role: 'builder',
      type: 'peak',
      content: 'The key insight about consciousness is...',
      timestamp: new Date().toISOString(),
    };
    const result = TransmissionSchema.parse(validTransmission);
    expect(result.id).toBe('tx-001');
    expect(result.citizenId).toBe('citizen-001');
    expect(result.generationNumber).toBe(1);
    expect(result.role).toBe('builder');
    expect(result.type).toBe('peak');
    expect(result.content).toBe('The key insight about consciousness is...');
    expect(result.mutated).toBe(false); // default
    expect(result.anchorTokens).toEqual([]); // default
  });

  it('rejects empty object', () => {
    expect(() => TransmissionSchema.parse({})).toThrow(ZodError);
  });

  it('parses transmission type values', () => {
    expect(TransmissionTypeSchema.parse('peak')).toBe('peak');
    expect(TransmissionTypeSchema.parse('elder')).toBe('elder');
    expect(TransmissionTypeSchema.parse('accident')).toBe('accident');
  });

  it('rejects invalid transmission type', () => {
    expect(() => TransmissionTypeSchema.parse('invalid')).toThrow(ZodError);
  });
});
