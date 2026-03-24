import { bus } from '@genesis/shared';
import type { GenesisEvents } from '@genesis/shared';
import { AgentConfigSchema } from '@genesis/shared';

// Verify bus is an EventEmitter3 instance
console.log('Genesis shared - Event bus loaded');
console.log('Bus event names:', bus.eventNames());

// Verify AgentConfigSchema (Zod 4) parses correctly
const testConfig = AgentConfigSchema.parse({
  id: 'test-citizen-001',
  name: 'Test Citizen',
  type: 'lineage-citizen',
  systemPrompt: 'You are a test citizen of the civilization.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

console.log('AgentConfig parsed successfully:');
console.log(`  id: ${testConfig.id}`);
console.log(`  name: ${testConfig.name}`);
console.log(`  type: ${testConfig.type}`);
console.log(`  status: ${testConfig.status}`);

// Verify the type system works (compile-time check)
type VerifyGenesisEvents = GenesisEvents;
const _typeCheck: VerifyGenesisEvents = {} as GenesisEvents;
void _typeCheck;

console.log('---');
console.log('@genesis/shared imports verified successfully');
