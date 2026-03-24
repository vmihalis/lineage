import { query } from '@anthropic-ai/claude-agent-sdk';

const systemPrompt = `You are a citizen of a civilization.
You have been given a problem to think about.
Respond with your thoughts on the matter — be concise but thoughtful.`;

const seedProblem = 'What is worth preserving across generations?';

async function main(): Promise<void> {
  console.log('LINEAGE - Starting agent...');
  console.log(`Seed problem: ${seedProblem}`);
  console.log('---');

  const agentQuery = query({
    prompt: seedProblem,
    options: {
      systemPrompt,
      maxTurns: 1,
      permissionMode: 'dontAsk',
      tools: [],
      persistSession: false,
    },
  });

  for await (const message of agentQuery) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block && typeof block.text === 'string') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      console.log('---');
      console.log(`Completed: ${message.subtype}`);
      if ('usage' in message && message.usage) {
        const usage = message.usage as { input_tokens: number; output_tokens: number };
        console.log(`Tokens: input=${usage.input_tokens}, output=${usage.output_tokens}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error('LINEAGE agent failed:', error);
  process.exit(1);
});
