<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils';
	import { formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();

	function scoreClass(s: number | null): string {
		if (s === null) return 'text-muted-foreground';
		if (s >= 70) return 'text-foreground';
		if (s < 40) return 'text-destructive';
		return 'text-foreground';
	}

	function responsesEntries(r: unknown): Array<[string, unknown]> {
		if (!r || typeof r !== 'object') return [];
		return Object.entries(r as Record<string, unknown>);
	}

	function messageText(m: unknown): string {
		if (!m || typeof m !== 'object') return '';
		const msg = m as { role?: string; content?: unknown };
		if (typeof msg.content === 'string') return msg.content;
		if (Array.isArray(msg.content)) {
			return msg.content
				.map((b) => {
					if (!b || typeof b !== 'object') return '';
					const block = b as { type?: string; text?: string; content?: unknown };
					if (block.type === 'text' && typeof block.text === 'string') return block.text;
					if (block.type === 'tool_use') return `[tool: ${(block as { name?: string }).name}]`;
					if (block.type === 'tool_result')
						return `[tool result: ${typeof block.content === 'string' ? block.content.slice(0, 100) : ''}]`;
					return '';
				})
				.filter(Boolean)
				.join('\n');
		}
		return '';
	}
</script>

<div class="space-y-6">
	<div>
		<div class="mb-2 text-sm text-muted-foreground">
			<a href="/admin/references" class="hover:text-foreground">← Back to references</a>
		</div>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">
					{data.reference.name ?? 'No name'}
				</h1>
				<p class="mt-1 font-mono text-sm text-muted-foreground">{data.reference.phone ?? "(hasn't written yet)"}</p>
			</div>
			<StatusBadge status={data.reference.status} />
		</div>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Reference</Card.Title>
			<Card.Description>
				Applicant:
				{#if data.applicant}
					<a
						href={`/admin/users/${data.applicant.id}`}
						class="font-medium text-foreground underline-offset-4 hover:underline"
					>
						{data.applicant.name ?? data.applicant.phone}
					</a>
				{:else}
					<span class="text-muted-foreground">(unknown)</span>
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<dt class="text-muted-foreground">Relationship</dt>
					<dd class="mt-1">{data.reference.relationship ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Score</dt>
					<dd class={cn('mt-1 text-lg font-semibold tabular-nums', scoreClass(data.reference.score))}>
						{data.reference.score ?? '—'}
					</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Created</dt>
					<dd class="mt-1">{formatDate(data.reference.createdAt)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Code</dt>
					<dd class="mt-1 font-mono text-xs">{data.reference.referenceCode ?? '—'}</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Responses</Card.Title>
			<Card.Description>What the reference replied to the bot</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if responsesEntries(data.reference.responses).length}
				<dl class="space-y-3 text-sm">
					{#each responsesEntries(data.reference.responses) as [key, value] (key)}
						<div class="grid grid-cols-[200px_1fr] gap-4 border-b pb-3 last:border-0">
							<dt class="text-muted-foreground">{key.replaceAll('_', ' ')}</dt>
							<dd>{String(value)}</dd>
						</div>
					{/each}
				</dl>
			{:else}
				<p class="text-sm text-muted-foreground">No responses yet.</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Conversation ({data.messages.length})</Card.Title>
			<Card.Description>
				Chat between reference and bot
				{#if data.convoState}
					· state <StatusBadge status={data.convoState} />
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.messages.length}
				<ol class="space-y-3 text-sm">
					{#each data.messages as m, i (i)}
						{@const text = messageText(m)}
						{#if text}
							<li class={cn('flex gap-3', (m as { role?: string }).role === 'user' ? '' : 'flex-row-reverse')}>
								<div
									class={cn(
										'max-w-[70%] whitespace-pre-wrap rounded-lg px-3 py-2',
										(m as { role?: string }).role === 'user'
											? 'bg-muted text-foreground'
											: 'bg-primary text-primary-foreground'
									)}
								>
									{text}
								</div>
							</li>
						{/if}
					{/each}
				</ol>
			{:else}
				<p class="text-sm text-muted-foreground">No messages yet.</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
