import Anthropic from '@anthropic-ai/sdk';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { users, groups, loans } from '../db/schema';
import { buildSystemPrompt, type AgentContext } from './system-prompt';
import { TOOL_SCHEMAS, handleTool } from './tools';

const MAX_ITERATIONS = 5;
const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic();

async function buildCtx(userId: number): Promise<AgentContext> {
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	let group = null;
	let groupMemberCount = 0;
	if (user.groupId) {
		const [g] = await db.select().from(groups).where(eq(groups.id, user.groupId)).limit(1);
		group = g ?? null;
		if (g) {
			const members = await db.select().from(users).where(eq(users.groupId, g.id));
			groupMemberCount = members.length;
		}
	}
	const [activeLoan] = await db
		.select()
		.from(loans)
		.where(and(eq(loans.userId, user.id), ne(loans.status, 'paid')))
		.limit(1);
	return { user, group, groupMemberCount, activeLoan: activeLoan ?? null };
}

function extractText(content: Anthropic.ContentBlock[]): string {
	return content
		.filter((b): b is Anthropic.TextBlock => b.type === 'text')
		.map((b) => b.text)
		.join('\n')
		.trim();
}

export type AgentMessage = Anthropic.MessageParam;

export async function runAgent(
	userId: number,
	messages: AgentMessage[]
): Promise<{ reply: string; messages: AgentMessage[] }> {
	for (let i = 0; i < MAX_ITERATIONS; i++) {
		const ctx = await buildCtx(userId);
		const systemPrompt = buildSystemPrompt(ctx);

		const res = await client.messages.create({
			model: MODEL,
			max_tokens: 2048,
			system: [
				{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }
			],
			tools: TOOL_SCHEMAS,
			messages
		});

		messages.push({ role: 'assistant', content: res.content });

		if (res.stop_reason !== 'tool_use') {
			const reply = extractText(res.content) || 'Dale, contame.';
			return { reply, messages };
		}

		const toolResults: Anthropic.ToolResultBlockParam[] = [];
		for (const block of res.content) {
			if (block.type !== 'tool_use') continue;
			const out = await handleTool(
				block.name,
				block.input as Record<string, unknown>,
				{ userId }
			);
			toolResults.push({
				type: 'tool_result',
				tool_use_id: block.id,
				content: JSON.stringify(out)
			});
		}
		messages.push({ role: 'user', content: toolResults });
	}

	return {
		reply: 'Uh, me perdí un poco. ¿Me lo repetís?',
		messages
	};
}
