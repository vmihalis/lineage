import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock subsystems before imports
const mockAssignRoles = vi.fn();
vi.mock('../roles/role-assignment.js', () => ({
  assignRoles: (...args: unknown[]) => mockAssignRoles(...args),
}));

const mockBirthCitizen = vi.fn();
vi.mock('../mortality/citizen-lifecycle.js', () => ({
  birthCitizen: (...args: unknown[]) => mockBirthCitizen(...args),
}));

const mockRunTurns = vi.fn();
vi.mock('../interaction/turn-runner.js', () => ({
  runTurns: (...args: unknown[]) => mockRunTurns(...args),
}));

const mockBuildPeakTransmissionPrompt = vi.fn();
vi.mock('../transmission/peak-prompt.js', () => ({
  buildPeakTransmissionPrompt: (...args: unknown[]) => mockBuildPeakTransmissionPrompt(...args),
}));

const mockExecutePeakTransmission = vi.fn();
vi.mock('../transmission/transmission-executor.js', () => ({
  executePeakTransmission: (...args: unknown[]) => mockExecutePeakTransmission(...args),
}));

const mockWriteTransmission = vi.fn();
vi.mock('../transmission/transmission-writer.js', () => ({
  writeTransmission: (...args: unknown[]) => mockWriteTransmission(...args),
}));

const mockMutateTransmission = vi.fn();
vi.mock('../mutation/mutation-pipeline.js', () => ({
  mutateTransmission: (...args: unknown[]) => mockMutateTransmission(...args),
}));

const mockComposeInheritance = vi.fn();
vi.mock('../inheritance/inheritance-composer.js', () => ({
  composeInheritance: (...args: unknown[]) => mockComposeInheritance(...args),
}));

const mockStateManagerWrite = vi.fn();
vi.mock('../state/index.js', () => ({
  LineageStateManager: class MockLineageStateManager {
    write(...args: unknown[]) { return mockStateManagerWrite(...args); }
  },
}));

import { runGeneration } from './generation-runner.js';
import { runSimulation } from './simulation-runner.js';
import { CitizenConfigSchema, SimulationParametersSchema } from '../schemas/index.js';
import type { CitizenConfig, SimulationParameters, Transmission } from '../schemas/index.js';
import { TransmissionSchema } from '../schemas/index.js';
import { lineageBus } from '../events/index.js';

// --- Helper factories ---

function makeMockCitizen(overrides: Partial<CitizenConfig> = {}): CitizenConfig {
  return CitizenConfigSchema.parse({
    id: overrides.id ?? 'cit-1',
    name: overrides.name ?? 'citizen-test',
    type: 'lineage-citizen',
    systemPrompt: 'test prompt',
    role: overrides.role ?? 'builder',
    generationNumber: overrides.generationNumber ?? 1,
    deathProfile: overrides.deathProfile ?? 'old-age',
    contextBudget: 0,
    birthTimestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transmissions: [],
  });
}

function makeMockParams(overrides: Partial<SimulationParameters> = {}): SimulationParameters {
  return SimulationParametersSchema.parse({
    seedProblem: 'What is worth preserving?',
    generationSize: 2,
    maxGenerations: 2,
    ...overrides,
  });
}

function makeMockTransmission(citizenId: string, genNum: number, txId: string): Transmission {
  return TransmissionSchema.parse({
    id: txId,
    citizenId,
    generationNumber: genNum,
    role: 'builder',
    type: 'peak' as const,
    content: '[1] A claim worth preserving',
    anchorTokens: ['A claim worth preserving'],
    timestamp: new Date().toISOString(),
    mutated: false,
  });
}

// --- Configure default mock behaviors ---

function setupDefaultMocks(params?: SimulationParameters) {
  const p = params ?? makeMockParams();

  mockAssignRoles.mockReturnValue(['builder', 'skeptic']);

  const cit1 = makeMockCitizen({ id: 'cit-1', role: 'builder' });
  const cit2 = makeMockCitizen({ id: 'cit-2', role: 'skeptic' });
  mockBirthCitizen
    .mockReturnValueOnce(cit1)
    .mockReturnValueOnce(cit2);

  mockRunTurns.mockResolvedValue({
    turns: [
      { citizenId: 'cit-1', output: 'turn 1 output', turnNumber: 1, usage: { inputTokens: 50, outputTokens: 100 } },
      { citizenId: 'cit-2', output: 'turn 2 output', turnNumber: 2, usage: { inputTokens: 50, outputTokens: 100 } },
    ],
    totalTokens: { input: 100, output: 200 },
  });

  mockBuildPeakTransmissionPrompt
    .mockReturnValueOnce('peak prompt for cit-1')
    .mockReturnValueOnce('peak prompt for cit-2');

  const tx1 = makeMockTransmission('cit-1', 1, 'tx-1');
  const tx2 = makeMockTransmission('cit-2', 1, 'tx-2');
  mockExecutePeakTransmission
    .mockResolvedValueOnce({ transmission: tx1, usage: { inputTokens: 50, outputTokens: 100 } })
    .mockResolvedValueOnce({ transmission: tx2, usage: { inputTokens: 50, outputTokens: 100 } });

  mockWriteTransmission
    .mockResolvedValueOnce('/output/transmissions/gen1/cit-1-peak.json')
    .mockResolvedValueOnce('/output/transmissions/gen1/cit-2-peak.json');

  mockMutateTransmission
    .mockResolvedValueOnce({ transmission: tx1, wasMutated: false })
    .mockResolvedValueOnce({ transmission: tx2, wasMutated: false });

  mockComposeInheritance.mockResolvedValue({
    targetGeneration: 1,
    seedLayer: null,
    recentLayer: null,
    seedTokens: [],
    recentTokens: [],
    composedAt: new Date().toISOString(),
  });

  return { cit1, cit2, tx1, tx2, params: p };
}

// --- runGeneration tests ---

describe('runGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStateManagerWrite.mockResolvedValue(undefined);
  });

  // GENM-02: State machine transitions
  describe('state machine transitions (GENM-02)', () => {
    it('transitions through INIT -> BIRTHING -> INTERACTING -> DYING -> TRANSMITTING -> COMPLETE', async () => {
      const { params } = setupDefaultMocks();

      const result = await runGeneration(1, params, null, null);

      expect(result.phase).toBe('COMPLETE');
    });

    it('emits generation:started event with correct generationNumber and citizenCount', async () => {
      const { params } = setupDefaultMocks();
      const emitSpy = vi.spyOn(lineageBus, 'emit');

      await runGeneration(1, params, null, null);

      expect(emitSpy).toHaveBeenCalledWith('generation:started', 1, 2);
      emitSpy.mockRestore();
    });

    it('emits generation:ended event with correct generationNumber', async () => {
      const { params } = setupDefaultMocks();
      const emitSpy = vi.spyOn(lineageBus, 'emit');

      await runGeneration(1, params, null, null);

      expect(emitSpy).toHaveBeenCalledWith('generation:ended', 1);
      emitSpy.mockRestore();
    });
  });

  // GENM-01: Full lifecycle orchestration
  describe('full lifecycle orchestration (GENM-01)', () => {
    it('calls assignRoles with params.generationSize and params.roleDistribution', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      expect(mockAssignRoles).toHaveBeenCalledWith(params.generationSize, params.roleDistribution);
    });

    it('calls birthCitizen once per role returned by assignRoles', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      expect(mockBirthCitizen).toHaveBeenCalledTimes(2);
      expect(mockBirthCitizen).toHaveBeenCalledWith('builder', 1, params);
      expect(mockBirthCitizen).toHaveBeenCalledWith('skeptic', 1, params);
    });

    it('calls runTurns with config containing seedProblem and citizens array', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      expect(mockRunTurns).toHaveBeenCalledTimes(1);
      const callArgs = mockRunTurns.mock.calls[0][0];
      expect(callArgs.seedProblem).toBe('What is worth preserving?');
      expect(callArgs.citizens).toHaveLength(2);
    });

    it('calls executePeakTransmission once per citizen with buildPeakTransmissionPrompt output', async () => {
      const { params, cit1, cit2 } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      expect(mockExecutePeakTransmission).toHaveBeenCalledTimes(2);
      expect(mockExecutePeakTransmission).toHaveBeenCalledWith(cit1, 'peak prompt for cit-1');
      expect(mockExecutePeakTransmission).toHaveBeenCalledWith(cit2, 'peak prompt for cit-2');
    });

    it('calls writeTransmission once per transmission result (after mutation)', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      expect(mockWriteTransmission).toHaveBeenCalledTimes(2);
    });

    it('calls mutateTransmission once per original transmission with params.mutationRate and params.largeMutationProbability', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      expect(mockMutateTransmission).toHaveBeenCalledTimes(2);
      for (const call of mockMutateTransmission.mock.calls) {
        expect(call[1]).toBe(params.mutationRate);
        expect(call[2]).toBe(params.largeMutationProbability);
      }
    });

    it('emits citizen:died event for each citizen after their transmission', async () => {
      const { params } = setupDefaultMocks();
      const emitSpy = vi.spyOn(lineageBus, 'emit');

      await runGeneration(1, params, null, null);

      const diedCalls = emitSpy.mock.calls.filter(c => c[0] === 'citizen:died');
      expect(diedCalls).toHaveLength(2);
      expect(diedCalls[0]).toEqual(['citizen:died', 'cit-1', 'old-age', 1]);
      expect(diedCalls[1]).toEqual(['citizen:died', 'cit-2', 'old-age', 1]);
      emitSpy.mockRestore();
    });
  });

  // GENM-03: Generation size
  describe('generation size (GENM-03)', () => {
    it('with generationSize=3 births 3 citizens, runs turns with 3 citizens, produces 3 transmissions', async () => {
      vi.clearAllMocks();
      const params = makeMockParams({ generationSize: 3 });
      mockAssignRoles.mockReturnValue(['builder', 'skeptic', 'archivist']);

      const cit1 = makeMockCitizen({ id: 'c1', role: 'builder' });
      const cit2 = makeMockCitizen({ id: 'c2', role: 'skeptic' });
      const cit3 = makeMockCitizen({ id: 'c3', role: 'archivist' });
      mockBirthCitizen.mockReturnValueOnce(cit1).mockReturnValueOnce(cit2).mockReturnValueOnce(cit3);

      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');

      const tx1 = makeMockTransmission('c1', 1, 'tx-1');
      const tx2 = makeMockTransmission('c2', 1, 'tx-2');
      const tx3 = makeMockTransmission('c3', 1, 'tx-3');
      mockExecutePeakTransmission
        .mockResolvedValueOnce({ transmission: tx1, usage: { inputTokens: 50, outputTokens: 100 } })
        .mockResolvedValueOnce({ transmission: tx2, usage: { inputTokens: 50, outputTokens: 100 } })
        .mockResolvedValueOnce({ transmission: tx3, usage: { inputTokens: 50, outputTokens: 100 } });

      mockMutateTransmission
        .mockResolvedValueOnce({ transmission: tx1, wasMutated: false })
        .mockResolvedValueOnce({ transmission: tx2, wasMutated: false })
        .mockResolvedValueOnce({ transmission: tx3, wasMutated: false });

      mockWriteTransmission.mockResolvedValue('/output/path.json');

      const result = await runGeneration(1, params, null, null);

      expect(mockBirthCitizen).toHaveBeenCalledTimes(3);
      expect(mockRunTurns.mock.calls[0][0].citizens).toHaveLength(3);
      expect(result.transmissionIds).toHaveLength(3);
    });

    it('with generationSize=1 births 1 citizen, runs 1 turn, produces 1 transmission', async () => {
      vi.clearAllMocks();
      const params = makeMockParams({ generationSize: 1 });
      mockAssignRoles.mockReturnValue(['builder']);

      const cit1 = makeMockCitizen({ id: 'c1', role: 'builder' });
      mockBirthCitizen.mockReturnValueOnce(cit1);

      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');

      const tx1 = makeMockTransmission('c1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValueOnce({
        transmission: tx1,
        usage: { inputTokens: 50, outputTokens: 100 },
      });

      mockMutateTransmission.mockResolvedValueOnce({ transmission: tx1, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      const result = await runGeneration(1, params, null, null);

      expect(mockBirthCitizen).toHaveBeenCalledTimes(1);
      expect(result.transmissionIds).toHaveLength(1);
    });
  });

  // Inheritance injection into prompts
  describe('inheritance injection into prompts', () => {
    it('when seedLayer and recentLayer are provided, enriched seed problem prepends them to the original seedProblem', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(2, params, 'ANCESTRAL KNOWLEDGE: preserved', 'INHERITANCE FROM GEN 1: recent');

      const callArgs = mockRunTurns.mock.calls[0][0];
      expect(callArgs.seedProblem).toContain('ANCESTRAL KNOWLEDGE: preserved');
      expect(callArgs.seedProblem).toContain('INHERITANCE FROM GEN 1: recent');
      expect(callArgs.seedProblem).toContain('What is worth preserving?');
    });

    it('when both layers are null (gen 1), enrichedSeedProblem equals the original seedProblem', async () => {
      const { params } = setupDefaultMocks();

      await runGeneration(1, params, null, null);

      const callArgs = mockRunTurns.mock.calls[0][0];
      expect(callArgs.seedProblem).toBe('What is worth preserving?');
    });
  });

  // State persistence
  describe('state persistence', () => {
    it('persists generation state to disk at COMPLETE phase', async () => {
      const params = makeMockParams();
      setupDefaultMocks(params);

      await runGeneration(1, params, null, null);

      expect(mockStateManagerWrite).toHaveBeenCalledOnce();
      // Verify path contains 'generations/gen1.json'
      const [filePath, data, _schema, configType] = mockStateManagerWrite.mock.calls[0];
      expect(filePath).toContain('generations/gen1.json');
      expect(data.phase).toBe('COMPLETE');
      expect(configType).toBe('generation');
    });
  });
});

// --- runSimulation tests ---

describe('runSimulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStateManagerWrite.mockResolvedValue(undefined);
  });

  // GENM-04: Max generations
  describe('max generations (GENM-04)', () => {
    it('with maxGenerations=3 calls runGeneration exactly 3 times', async () => {
      const params = makeMockParams({ maxGenerations: 3 });

      // Setup mocks for 3 generations
      mockComposeInheritance.mockResolvedValue({
        targetGeneration: 1,
        seedLayer: null,
        recentLayer: null,
        seedTokens: [],
        recentTokens: [],
        composedAt: new Date().toISOString(),
      });

      // Each generation needs its own set of mocks
      mockAssignRoles.mockReturnValue(['builder', 'skeptic']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      const result = await runSimulation(params);

      expect(result).toHaveLength(3);
      // assignRoles called once per generation
      expect(mockAssignRoles).toHaveBeenCalledTimes(3);
    });

    it('with maxGenerations=1 calls runGeneration exactly 1 time', async () => {
      const params = makeMockParams({ maxGenerations: 1 });

      mockComposeInheritance.mockResolvedValue({
        targetGeneration: 1,
        seedLayer: null,
        recentLayer: null,
        seedTokens: [],
        recentTokens: [],
        composedAt: new Date().toISOString(),
      });

      mockAssignRoles.mockReturnValue(['builder', 'skeptic']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      const result = await runSimulation(params);

      expect(result).toHaveLength(1);
      expect(mockAssignRoles).toHaveBeenCalledTimes(1);
    });

    it('emits simulation:started at start and simulation:ended with correct count', async () => {
      const params = makeMockParams({ maxGenerations: 2 });
      const emitSpy = vi.spyOn(lineageBus, 'emit');

      mockComposeInheritance.mockResolvedValue({
        targetGeneration: 1,
        seedLayer: null,
        recentLayer: null,
        seedTokens: [],
        recentTokens: [],
        composedAt: new Date().toISOString(),
      });

      mockAssignRoles.mockReturnValue(['builder', 'skeptic']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      await runSimulation(params);

      expect(emitSpy).toHaveBeenCalledWith('simulation:started', 'What is worth preserving?', params);
      expect(emitSpy).toHaveBeenCalledWith('simulation:ended', 2);
      emitSpy.mockRestore();
    });
  });

  // GENM-05: Inheritance at boundary
  describe('inheritance at boundary (GENM-05)', () => {
    it('calls composeInheritance before each generation with targetGeneration = current gen number', async () => {
      const params = makeMockParams({ maxGenerations: 3 });

      mockComposeInheritance.mockResolvedValue({
        targetGeneration: 1,
        seedLayer: null,
        recentLayer: null,
        seedTokens: [],
        recentTokens: [],
        composedAt: new Date().toISOString(),
      });

      mockAssignRoles.mockReturnValue(['builder', 'skeptic']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      await runSimulation(params);

      expect(mockComposeInheritance).toHaveBeenCalledTimes(3);
      expect(mockComposeInheritance.mock.calls[0][0]).toBe(1);
      expect(mockComposeInheritance.mock.calls[1][0]).toBe(2);
      expect(mockComposeInheritance.mock.calls[2][0]).toBe(3);
    });

    it('passes composeInheritance result (seedLayer, recentLayer) to runGeneration', async () => {
      const params = makeMockParams({ maxGenerations: 2 });

      // Gen 1: null layers, Gen 2: non-null layers
      mockComposeInheritance
        .mockResolvedValueOnce({
          targetGeneration: 1,
          seedLayer: null,
          recentLayer: null,
          seedTokens: [],
          recentTokens: [],
          composedAt: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          targetGeneration: 2,
          seedLayer: 'ANCESTRAL KNOWLEDGE: compressed',
          recentLayer: 'INHERITANCE FROM GENERATION 1: recent data',
          seedTokens: ['compressed'],
          recentTokens: ['recent data'],
          composedAt: new Date().toISOString(),
        });

      mockAssignRoles.mockReturnValue(['builder', 'skeptic']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      await runSimulation(params);

      // Gen 1: enriched seed problem should just be the original seedProblem
      const gen1Call = mockRunTurns.mock.calls[0][0];
      expect(gen1Call.seedProblem).toBe('What is worth preserving?');

      // Gen 2: enriched seed problem should include inheritance layers
      const gen2Call = mockRunTurns.mock.calls[1][0];
      expect(gen2Call.seedProblem).toContain('ANCESTRAL KNOWLEDGE: compressed');
      expect(gen2Call.seedProblem).toContain('INHERITANCE FROM GENERATION 1: recent data');
      expect(gen2Call.seedProblem).toContain('What is worth preserving?');
    });

    it('generation 1 receives null seedLayer and null recentLayer from composeInheritance without error', async () => {
      const params = makeMockParams({ maxGenerations: 1 });

      mockComposeInheritance.mockResolvedValue({
        targetGeneration: 1,
        seedLayer: null,
        recentLayer: null,
        seedTokens: [],
        recentTokens: [],
        composedAt: new Date().toISOString(),
      });

      mockAssignRoles.mockReturnValue(['builder']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      const result = await runSimulation(params);

      expect(result).toHaveLength(1);
      expect(result[0].phase).toBe('COMPLETE');
    });

    it('generation 2+ receives non-null layers when composeInheritance returns them', async () => {
      const params = makeMockParams({ maxGenerations: 2 });

      mockComposeInheritance
        .mockResolvedValueOnce({
          targetGeneration: 1,
          seedLayer: null,
          recentLayer: null,
          seedTokens: [],
          recentTokens: [],
          composedAt: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          targetGeneration: 2,
          seedLayer: 'ANCESTRAL KNOWLEDGE: the truth',
          recentLayer: 'INHERITANCE FROM GEN 1: details',
          seedTokens: ['the truth'],
          recentTokens: ['details'],
          composedAt: new Date().toISOString(),
        });

      mockAssignRoles.mockReturnValue(['builder', 'skeptic']);
      const cit = makeMockCitizen();
      mockBirthCitizen.mockReturnValue(cit);
      mockRunTurns.mockResolvedValue({ turns: [], totalTokens: { input: 0, output: 0 } });
      mockBuildPeakTransmissionPrompt.mockReturnValue('peak prompt');
      const tx = makeMockTransmission('cit-1', 1, 'tx-1');
      mockExecutePeakTransmission.mockResolvedValue({ transmission: tx, usage: { inputTokens: 50, outputTokens: 100 } });
      mockMutateTransmission.mockResolvedValue({ transmission: tx, wasMutated: false });
      mockWriteTransmission.mockResolvedValue('/output/path.json');

      const result = await runSimulation(params);

      expect(result).toHaveLength(2);
      // The gen 2 call should have the inheritance layers prepended
      const gen2RunTurnsCall = mockRunTurns.mock.calls[1][0];
      expect(gen2RunTurnsCall.seedProblem).toContain('ANCESTRAL KNOWLEDGE');
      expect(gen2RunTurnsCall.seedProblem).toContain('INHERITANCE FROM GEN 1');
    });
  });
});
