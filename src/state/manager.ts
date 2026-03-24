import { StateManager } from '@genesis/shared';
import type { z } from 'zod';
import { lineageBus } from '../events/bus.js';

export class LineageStateManager {
  private sm: StateManager;

  constructor(baseDir: string) {
    this.sm = new StateManager(baseDir);
  }

  async read<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
    const data = await this.sm.read(filePath, schema);
    lineageBus.emit('state:loaded', filePath);
    return data;
  }

  async write<T>(
    filePath: string,
    data: T,
    schema: z.ZodType<T>,
    configType: string,
  ): Promise<void> {
    await this.sm.write(filePath, data, schema, configType);
    lineageBus.emit('state:saved', filePath);
  }
}
