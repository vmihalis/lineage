import { EventEmitter } from 'eventemitter3';
import type { LineageEvents } from './types.js';

export const lineageBus = new EventEmitter<LineageEvents>();
