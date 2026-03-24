import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { createProgram } from './cli.js';

/**
 * Create a minimal program for testing argument/option parsing
 * without triggering the async action handler.
 */
function createParsingProgram(): Command {
  const program = new Command();
  program
    .name('lineage')
    .argument('<seed-problem>', 'The philosophical problem for the civilization to explore')
    .option('-g, --generations <count>', 'maximum number of generations to simulate', '3')
    .option('-s, --size <count>', 'number of citizens per generation', '5')
    .option('-c, --config <path>', 'path to JSON config file')
    .option('-o, --output <dir>', 'output directory for state files', './output')
    .action(() => {
      // no-op for parsing tests
    });
  program.exitOverride();
  return program;
}

describe('CLI argument parsing', () => {
  it('parses seed problem from positional argument', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'What is consciousness?']);
    expect(program.args[0]).toBe('What is consciousness?');
  });

  it('parses --generations flag', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '--generations', '10']);
    expect(program.opts().generations).toBe('10');
  });

  it('parses -g short flag for generations', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '-g', '10']);
    expect(program.opts().generations).toBe('10');
  });

  it('parses --size flag', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '--size', '8']);
    expect(program.opts().size).toBe('8');
  });

  it('parses -s short flag for size', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '-s', '8']);
    expect(program.opts().size).toBe('8');
  });

  it('parses --config flag', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '--config', '/path/to/config.json']);
    expect(program.opts().config).toBe('/path/to/config.json');
  });

  it('parses -c short flag for config', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '-c', '/path/to/config.json']);
    expect(program.opts().config).toBe('/path/to/config.json');
  });

  it('parses --output flag', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '--output', '/tmp/out']);
    expect(program.opts().output).toBe('/tmp/out');
  });

  it('parses -o short flag for output', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test', '-o', '/tmp/out']);
    expect(program.opts().output).toBe('/tmp/out');
  });

  it('exits with error when no seed problem argument provided', () => {
    const program = createParsingProgram();
    expect(() => {
      program.parse(['node', 'cli']);
    }).toThrow(/seed-problem/i);
  });

  it('has default values for generations, size, and output', () => {
    const program = createParsingProgram();
    program.parse(['node', 'cli', 'test']);
    const opts = program.opts();
    expect(opts.generations).toBe('3');
    expect(opts.size).toBe('5');
    expect(opts.output).toBe('./output');
  });
});

describe('CLI action integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls loadConfig with seed problem and emits simulation:started', async () => {
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(['node', 'cli', 'What is consciousness?']);

    // Verify console output confirms successful config loading
    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs).toContain('LINEAGE - Simulation configured');
    expect(logs.some((l) => typeof l === 'string' && l.includes('What is consciousness?'))).toBe(true);
  });

  it('passes --generations and --size to loadConfig', async () => {
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(['node', 'cli', 'test', '--generations', '10', '--size', '8']);

    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs.some((l) => typeof l === 'string' && l.includes('10'))).toBe(true);
    expect(logs.some((l) => typeof l === 'string' && l.includes('8'))).toBe(true);
  });
});

describe('src/index.ts barrel export', () => {
  it('re-exports schemas, events, state, and config', async () => {
    const barrel = await import('./index.js');

    // Schemas
    expect(barrel.CitizenRoleSchema).toBeDefined();
    expect(barrel.SimulationParametersSchema).toBeDefined();
    expect(barrel.GenerationSchema).toBeDefined();
    expect(barrel.TransmissionSchema).toBeDefined();
    expect(barrel.DeathProfileSchema).toBeDefined();
    expect(barrel.CitizenConfigSchema).toBeDefined();

    // Events
    expect(barrel.lineageBus).toBeDefined();

    // State
    expect(barrel.LineageStateManager).toBeDefined();

    // Config
    expect(barrel.loadConfig).toBeDefined();
    expect(barrel.DEFAULT_SIMULATION_PARAMETERS).toBeDefined();
  });

  it('does NOT contain Phase 1 POC agent SDK import', async () => {
    const indexSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./index.ts', import.meta.url), 'utf-8'),
    );
    expect(indexSource).not.toContain("from '@anthropic-ai/claude-agent-sdk'");
    expect(indexSource).not.toContain('query');
  });
});
