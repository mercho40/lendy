import Anthropic from '@anthropic-ai/sdk';
import type { ConversationState, AgentContext } from './types';
import { getSystemPrompt } from './system-prompt';
import { getTools, handleTool } from './tools';

const MAX_ITERATIONS = 5;
const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic();

export type AgentMessage = Anthropic.MessageParam;

export interface AgentResult {
	reply: string;
	messages: AgentMessage[];
	newState?: ConversationState;
}

function extractText(content: Anthropic.ContentBlock[]): string {
	return content
		.filter((b): b is Anthropic.TextBlock => b.type === 'text')
		.map((b) => b.text)
		.join('\n')
		.trim();
}

export async function runAgent(
	messages: Anthropic.MessageParam[],
	ctx: AgentContext
): Promise<AgentResult> {
	const systemPrompt = getSystemPrompt(ctx.state, ctx);
	const tools = getTools(ctx.state);
	let newState: ConversationState | undefined;

	for (let i = 0; i < MAX_ITERATIONS; i++) {
		const response = await client.messages.create({
			model: MODEL,
			max_tokens: 1024,
			system: [
				{
					type: 'text',
					text: systemPrompt,
					cache_control: { type: 'ephemeral' }
				}
			],
			tools,
			messages
		});

		messages.push({ role: 'assistant', content: response.content });

		if (response.stop_reason !== 'tool_use') {
			return {
				reply: extractText(response.content) || 'Dale, contame.',
				messages,
				newState
			};
		}

		const toolResults: Anthropic.ToolResultBlockParam[] = [];
		for (const block of response.content) {
			if (block.type !== 'tool_use') continue;
			const result = await handleTool(block.name, block.input as Record<string, unknown>, ctx);
			if (result.newState) {
				newState = result.newState;
				ctx = { ...ctx, state: result.newState };
			}
			toolResults.push({
				type: 'tool_result',
				tool_use_id: block.id,
				content: JSON.stringify(result.data)
			});
		}
		messages.push({ role: 'user', content: toolResults });
	}

	return {
		reply: 'Uh, me perdí un poco. ¿Me lo repetís?',
		messages,
		newState
	};
}
