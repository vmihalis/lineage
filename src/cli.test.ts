import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

describe('CLI', () => {
  let program: Command;

  beforeEach(async () => {
    // Re-import to get a fresh program instance each time
    // We import the module to get the program export
    const mod = await import('./cli.js');
    program = mod.program;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses seed problem from positional argument', () => {
    // Commander stores the parsed argument
    program.parse(['node', 'cli', 'What is consciousness?'], { from: 'user' });
    const seedProblem = program.args[0];
    expect(seedProblem).toBe('What is consciousness?');
  });

  it('parses --generations flag', () => {
    program.parse(['node', 'cli', 'test', '--generations', '10'], { from: 'user' });
    expect(program.opts().generations).toBe('10');
  });

  it('parses -g short flag for generations', () => {
    program.parse(['node', 'cli', 'test', '-g', '10'], { from: 'user' });
    expect(program.opts().generations).toBe('10');
  });

  it('parses --size flag', () => {
    program.parse(['node', 'cli', 'test', '--size', '8'], { from: 'user' });
    expect(program.opts().size).toBe('8');
  });

  it('parses -s short flag for size', () => {
    program.parse(['node', 'cli', 'test', '-s', '8'], { from: 'user' });
    expect(program.opts().size).toBe('8');
  });

  it('parses --config flag', () => {
    program.parse(['node', 'cli', 'test', '--config', '/path/to/config.json'], { from: 'user' });
    expect(program.opts().config).toBe('/path/to/config.json');
  });

  it('parses -c short flag for config', () => {
    program.parse(['node', 'cli', 'test', '-c', '/path/to/config.json'], { from: 'user' });
    expect(program.opts().config).toBe('/path/to/config.json');
  });

  it('parses --output flag', () => {
    program.parse(['node', 'cli', 'test', '--output', '/tmp/out'], { from: 'user' });
    expect(program.opts().output).toBe('/tmp/out');
  });

  it('parses -o short flag for output', () => {
    program.parse(['node', 'cli', 'test', '-o', '/tmp/out'], { from: 'user' });
    expect(program.opts().output).toBe('/tmp/out');
  });

  it('exits with error when no seed problem argument provided', () => {
    program.exitOverride();
    expect(() => {
      program.parse(['node', 'cli'], { from: 'user' });
    }).toThrow();
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
