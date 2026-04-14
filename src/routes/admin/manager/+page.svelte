<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { formatDate } from '$lib/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let input = $state('');
	let sending = $state(false);
	let scroller: HTMLDivElement | null = $state(null);

	function messageText(m: unknown): string {
		if (!m || typeof m !== 'object') return '';
		const msg = m as { role?: string; content?: unknown };
		if (typeof msg.content === 'string') return msg.content;
		if (Array.isArray(msg.content)) {
			return msg.content
				.map((b) => {
					if (!b || typeof b !== 'object') return '';
					const block = b as {
						type?: string;
						text?: string;
						name?: string;
						content?: unknown;
					};
					if (block.type === 'text' && typeof block.text === 'string') return block.text;
					if (block.type === 'tool_use') return `→ ${block.name}`;
					if (block.type === 'tool_result') {
						const raw = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
						return `← ${raw.slice(0, 140)}${raw.length > 140 ? '…' : ''}`;
					}
					return '';
				})
				.filter(Boolean)
				.join('\n');
		}
		return '';
	}

	function messageRole(m: unknown): 'user' | 'assistant' | 'tool' {
		if (!m || typeof m !== 'object') return 'assistant';
		const msg = m as { role?: string; content?: unknown };
		if (msg.role === 'assistant') return 'assistant';
		// role: 'user' can be either the operator OR a tool_result block — detect by content
		if (Array.isArray(msg.content)) {
			const hasToolResult = msg.content.some(
				(b) => b && typeof b === 'object' && (b as { type?: string }).type === 'tool_result'
			);
			if (hasToolResult) return 'tool';
		}
		return 'user';
	}

	$effect(() => {
		// scroll to bottom when messages change
		void data.messages.length;
		tick().then(() => {
			if (scroller) scroller.scrollTop = scroller.scrollHeight;
		});
	});
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
	<!-- Chat -->
	<Card.Root class="flex h-[calc(100vh-180px)] flex-col">
		<Card.Header class="flex-row items-center justify-between gap-2 border-b">
			<div>
				<Card.Title>Manager</Card.Title>
				<Card.Description>Operations console · chat with the manager agent</Card.Description>
			</div>
			<div class="flex gap-2">
				<form method="POST" action="?/runAutopilot" use:enhance>
					<Button type="submit" size="sm" variant="outline">Run autopilot</Button>
				</form>
				<form method="POST" action="?/reset" use:enhance>
					<Button type="submit" size="sm" variant="ghost">Reset</Button>
				</form>
			</div>
		</Card.Header>
		<div bind:this={scroller} class="flex-1 overflow-y-auto px-6 py-4">
			{#if data.messages.length === 0}
				<div class="flex h-full items-center justify-center">
					<div class="max-w-sm text-center text-sm text-muted-foreground">
						<p class="font-medium text-foreground">Start a conversation.</p>
						<p class="mt-2">
							Try: "how are we doing today?", "what's going on with user 3?", "send Pedro a
							message saying we're lowering his installment".
						</p>
					</div>
				</div>
			{:else}
				<ol class="space-y-3 text-sm">
					{#each data.messages as m, i (i)}
						{@const role = messageRole(m)}
						{@const text = messageText(m)}
						{#if text && role !== 'tool'}
							<li class={cn('flex gap-2', role === 'user' ? 'justify-end' : 'justify-start')}>
								<div
									class={cn(
										'max-w-[75%] whitespace-pre-wrap rounded-lg px-3 py-2',
										role === 'user'
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-foreground'
									)}
								>
									{text}
								</div>
							</li>
						{:else if text && role === 'tool'}
							<li class="flex justify-start">
								<div
									class="max-w-[75%] whitespace-pre-wrap rounded-md border border-dashed bg-muted/30 px-3 py-1.5 font-mono text-xs text-muted-foreground"
								>
									{text}
								</div>
							</li>
						{/if}
					{/each}
				</ol>
			{/if}
		</div>
		<div class="border-t p-3">
			<form
				method="POST"
				action="?/send"
				use:enhance={() => {
					sending = true;
					return async ({ update }) => {
						await update({ reset: false });
						input = '';
						sending = false;
					};
				}}
				class="flex gap-2"
			>
				<input
					type="text"
					name="message"
					bind:value={input}
					placeholder="Ask the manager or request an action…"
					class="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
					disabled={sending}
					autocomplete="off"
				/>
				<Button type="submit" size="sm" disabled={sending || !input.trim()}>
					{sending ? 'Thinking…' : 'Send'}
				</Button>
			</form>
			{#if form && 'autopilot' in form && form.autopilot}
				<p class="mt-2 text-xs text-muted-foreground">
					Autopilot ran: {form.actions} actions · {form.summary}
				</p>
			{/if}
		</div>
	</Card.Root>

	<!-- Sidebar -->
	<div class="space-y-4">
		<Card.Root>
			<Card.Header>
				<Card.Title>Recent runs</Card.Title>
				<Card.Description>Autopilot + chat</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-2 text-sm">
				{#each data.recentRuns as r (r.id)}
					<div class="rounded border bg-card/50 px-3 py-2">
						<div class="flex items-center justify-between text-xs text-muted-foreground">
							<span>#{r.id} · {r.trigger}</span>
							<span>{formatDate(r.startedAt)}</span>
						</div>
						<div class="mt-1 tabular-nums">
							{r.actionsCount} actions
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground">No runs yet.</p>
				{/each}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent actions</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2 text-sm">
				{#each data.recentActions as a (a.id)}
					<div class="rounded border bg-card/50 px-3 py-2">
						<div class="flex items-center justify-between text-xs text-muted-foreground">
							<span class="uppercase tracking-wider">{a.kind}</span>
							<span>{formatDate(a.createdAt)}</span>
						</div>
						<div class="mt-1 text-xs">{a.summary}</div>
					</div>
				{:else}
					<p class="text-muted-foreground">No actions yet.</p>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</div>
