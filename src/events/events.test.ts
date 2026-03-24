import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { lineageBus } from './bus.js';
import type { LineageEvents } from './types.js';
import type { SimulationParameters } from '../schemas/simulation.js';

describe('lineageBus', () => {
  afterEach(() => {
    lineageBus.removeAllListeners();
  });

  it('is an instance of EventEmitter', () => {
    expect(lineageBus).toBeInstanceOf(EventEmitter);
  });

  it('emits citizen:born without throwing', () => {
    expect(() => {
      lineageBus.emit('citizen:born', 'cid-1', 'builder', 1);
    }).not.toThrow();
  });

  it('calls listener with correct args on citizen:born', () => {
    const listener = vi.fn();
    lineageBus.on('citizen:born', listener);
    lineageBus.emit('citizen:born', 'cid-1', 'builder', 1);
    expect(listener).toHaveBeenCalledWith('cid-1', 'builder', 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('calls listener with correct args on citizen:died', () => {
    const listener = vi.fn();
    lineageBus.on('citizen:died', listener);
    lineageBus.emit('citizen:died', 'cid-1', 'old-age', 1);
    expect(listener).toHaveBeenCalledWith('cid-1', 'old-age', 1);
  });

  it('calls listener with correct args on citizen:peak-transmission', () => {
    const listener = vi.fn();
    lineageBus.on('citizen:peak-transmission', listener);
    lineageBus.emit('citizen:peak-transmission', 'cid-1', 'tx-001');
    expect(listener).toHaveBeenCalledWith('cid-1', 'tx-001');
  });

  it('calls listener with correct args on generation:started', () => {
    const listener = vi.fn();
    lineageBus.on('generation:started', listener);
    lineageBus.emit('generation:started', 1, 5);
    expect(listener).toHaveBeenCalledWith(1, 5);
  });

  it('calls listener with correct args on generation:ended', () => {
    const listener = vi.fn();
    lineageBus.on('generation:ended', listener);
    lineageBus.emit('generation:ended', 1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it('calls listener with correct args on transmission:mutated', () => {
    const listener = vi.fn();
    lineageBus.on('transmission:mutated', listener);
    lineageBus.emit('transmission:mutated', 'tx-001', 'small');
    expect(listener).toHaveBeenCalledWith('tx-001', 'small');
  });

  it('calls listener with correct args on inheritance:composed', () => {
    const listener = vi.fn();
    lineageBus.on('inheritance:composed', listener);
    lineageBus.emit('inheritance:composed', 2, 3);
    expect(listener).toHaveBeenCalledWith(2, 3);
  });

  it('calls listener with correct args on simulation:started', () => {
    const listener = vi.fn();
    const mockConfig = { seedProblem: 'What is consciousness?' } as SimulationParameters;
    lineageBus.on('simulation:started', listener);
    lineageBus.emit('simulation:started', 'What is consciousness?', mockConfig);
    expect(listener).toHaveBeenCalledWith('What is consciousness?', mockConfig);
  });

  it('calls listener with correct args on simulation:ended', () => {
    const listener = vi.fn();
    lineageBus.on('simulation:ended', listener);
    lineageBus.emit('simulation:ended', 3);
    expect(listener).toHaveBeenCalledWith(3);
  });

  it('calls listener with correct args on state:saved', () => {
    const listener = vi.fn();
    lineageBus.on('state:saved', listener);
    lineageBus.emit('state:saved', '/path/to/file.json');
    expect(listener).toHaveBeenCalledWith('/path/to/file.json');
  });

  it('calls listener with correct args on state:loaded', () => {
    const listener = vi.fn();
    lineageBus.on('state:loaded', listener);
    lineageBus.emit('state:loaded', '/path/to/file.json');
    expect(listener).toHaveBeenCalledWith('/path/to/file.json');
  });

  it('does not cross-pollute listeners between events', () => {
    const bornListener = vi.fn();
    const diedListener = vi.fn();
    lineageBus.on('citizen:born', bornListener);
    lineageBus.on('citizen:died', diedListener);
    lineageBus.emit('citizen:born', 'cid-1', 'builder', 1);
    expect(bornListener).toHaveBeenCalledTimes(1);
    expect(diedListener).not.toHaveBeenCalled();
  });
});
