<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils';
	import { pesos, formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();

	function incomePesos(n: number | null | undefined): string {
		if (!n) return '—';
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS',
			maximumFractionDigits: 0
		}).format(n);
	}

	function objEntries(r: unknown): Array<[string, unknown]> {
		if (!r || typeof r !== 'object') return [];
		return Object.entries(r as Record<string, unknown>);
	}

	function fmtJsonValue(v: unknown): string {
		if (v === null || v === undefined) return '—';
		if (typeof v === 'boolean') return v ? 'yes' : 'no';
		return String(v);
	}

	function messageText(m: unknown): string {
		if (!m || typeof m !== 'object') return '';
		const msg = m as { role?: string; content?: unknown };
		if (typeof msg.content === 'string') return msg.content;
		if (Array.isArray(msg.content)) {
			return msg.content
				.map((b) => {
					if (!b || typeof b !== 'object') return '';
					const block = b as { type?: string; text?: string; content?: unknown; name?: string };
					if (block.type === 'text' && typeof block.text === 'string') return block.text;
					if (block.type === 'tool_use') return `→ tool: ${block.name}`;
					if (block.type === 'tool_result')
						return `← tool result: ${typeof block.content === 'string' ? block.content.slice(0, 200) : ''}`;
					return '';
				})
				.filter(Boolean)
				.join('\n');
		}
		return '';
	}

	function openRef(id: number) {
		goto(`/admin/references/${id}`);
	}
	function openLoan(id: number) {
		goto(`/admin/loans/${id}`);
	}
</script>

<div class="space-y-6">
	<div>
		<div class="mb-2 text-sm text-muted-foreground">
			<a href="/admin/users" class="hover:text-foreground">← Back to users</a>
		</div>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">{data.user.name ?? 'No name'}</h1>
				<p class="mt-1 font-mono text-sm text-muted-foreground">
					{data.user.phone} · ID #{data.user.id}
				</p>
			</div>
			<div class="flex items-center gap-2">
				<StatusBadge status={data.conversation?.state ?? 'onboarding'} />
				{#if data.user.onboardingComplete}
					<Badge variant="outline">Onboarding complete</Badge>
				{:else}
					<Badge variant="secondary">Onboarding pending</Badge>
				{/if}
			</div>
		</div>
	</div>

	<!-- Profile -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Profile</Card.Title>
			<Card.Description>Data collected during onboarding</Card.Description>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<dt class="text-muted-foreground">ID</dt>
					<dd class="mt-1 font-mono">#{data.user.id}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">DNI</dt>
					<dd class="mt-1 font-mono">{data.user.dni ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Monthly income</dt>
					<dd class="mt-1 tabular-nums">{incomePesos(data.user.monthlyIncome)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Occupation</dt>
					<dd class="mt-1">{data.user.occupation ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Trust score</dt>
					<dd class="mt-1 text-lg font-semibold tabular-nums">
						{data.user.trustScore ?? '—'}
					</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Registered</dt>
					<dd class="mt-1">{formatDate(data.user.createdAt)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Last activity</dt>
					<dd class="mt-1">{formatDate(data.conversation?.updatedAt)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Conversation</dt>
					<dd class="mt-1 tabular-nums">
						{#if data.conversation}
							#{data.conversation.id} · {data.conversation.messages.length} msgs
						{:else}
							— no conversation
						{/if}
					</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>

	<!-- References -->
	<Card.Root>
		<Card.Header>
			<Card.Title>References ({data.references.length})</Card.Title>
			<Card.Description>
				Contacts vouching for the applicant — click for detail
			</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Phone</Table.Head>
						<Table.Head>Relationship</Table.Head>
						<Table.Head>Code</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="text-right">Score</Table.Head>
						<Table.Head>Responses</Table.Head>
						<Table.Head>Created</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.references as r (r.id)}
						<Table.Row
							class={cn(
								'cursor-pointer transition-colors hover:bg-muted/60',
								r.score !== null && r.score < 40 && 'bg-destructive/5 hover:bg-destructive/10'
							)}
							onclick={() => openRef(r.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openRef(r.id);
								}
							}}
							tabindex={0}
							role="link"
						>
							<Table.Cell class="font-medium">{r.name ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{r.phone ?? '—'}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{r.relationship ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground">
								{r.referenceCode ?? '—'}
							</Table.Cell>
							<Table.Cell><StatusBadge status={r.status} /></Table.Cell>
							<Table.Cell class="text-right tabular-nums">{r.score ?? '—'}</Table.Cell>
							<Table.Cell class="max-w-md truncate text-xs text-muted-foreground">
								{#if objEntries(r.responses).length}
									{objEntries(r.responses)
										.map(([k, v]) => `${k.replaceAll('_', ' ')}: ${fmtJsonValue(v)}`)
										.join(' · ')}
								{:else}
									—
								{/if}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(r.createdAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="py-6 text-center text-muted-foreground">
								This user hasn't added references yet.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Loans -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Loans ({data.loans.length})</Card.Title>
			<Card.Description>Click to see detail and payments</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ID</Table.Head>
						<Table.Head class="text-right">Amount</Table.Head>
						<Table.Head class="text-right">Installment</Table.Head>
						<Table.Head>Installments</Table.Head>
						<Table.Head class="text-right">Rate</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Next due</Table.Head>
						<Table.Head>Last reminder</Table.Head>
						<Table.Head>Created</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.loans as l (l.id)}
						<Table.Row
							class={cn(
								'cursor-pointer transition-colors hover:bg-muted/60',
								l.status === 'overdue' && 'bg-destructive/5 hover:bg-destructive/10'
							)}
							onclick={() => openLoan(l.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openLoan(l.id);
								}
							}}
							tabindex={0}
							role="link"
						>
							<Table.Cell class="font-mono text-xs">#{l.id}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(l.amount)}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">
								{pesos(l.installmentAmount)}
							</Table.Cell>
							<Table.Cell class="tabular-nums">
								{l.installmentsPaid}/{l.totalInstallments}
							</Table.Cell>
							<Table.Cell class="text-right tabular-nums text-muted-foreground">
								{(l.interestRate / 100).toFixed(2)}%
							</Table.Cell>
							<Table.Cell><StatusBadge status={l.status} /></Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(l.nextDueDate)}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(l.lastReminderAt)}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(l.createdAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={9} class="py-6 text-center text-muted-foreground">
								No loans.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Payments -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Payments ({data.payments.length})</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ID</Table.Head>
						<Table.Head>Loan</Table.Head>
						<Table.Head class="text-right">Amount</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>MP preference</Table.Head>
						<Table.Head>MP payment</Table.Head>
						<Table.Head>Link</Table.Head>
						<Table.Head>Date</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.payments as p (p.id)}
						<Table.Row
							class={cn(
								'cursor-pointer transition-colors hover:bg-muted/60',
								p.status === 'rejected' && 'bg-destructive/5'
							)}
							onclick={() => openLoan(p.loanId)}
						>
							<Table.Cell class="font-mono text-xs">#{p.id}</Table.Cell>
							<Table.Cell class="font-mono text-xs">#{p.loanId}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(p.amount)}</Table.Cell>
							<Table.Cell><StatusBadge status={p.status} /></Table.Cell>
							<Table.Cell class="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
								{p.mpPreferenceId ?? '—'}
							</Table.Cell>
							<Table.Cell class="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
								{p.mpPaymentId ?? '—'}
							</Table.Cell>
							<Table.Cell onclick={(e) => e.stopPropagation()}>
								{#if p.paymentLink}
									<a
										href={p.paymentLink}
										class="text-primary underline-offset-4 hover:underline"
										target="_blank"
										rel="noopener"
									>
										open
									</a>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(p.createdAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="py-6 text-center text-muted-foreground">
								No payments.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Conversation -->
	<Card.Root>
		<Card.Header>
			<Card.Title>
				Conversation {data.conversation ? `#${data.conversation.id}` : ''}
			</Card.Title>
			<Card.Description>
				{#if data.conversation}
					{data.conversation.messages.length} messages · updated {formatDate(
						data.conversation.updatedAt
					)}
				{:else}
					No conversation started
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.conversation && data.conversation.messages.length}
				<ol class="space-y-3 text-sm">
					{#each data.conversation.messages as m, i (i)}
						{@const text = messageText(m)}
						{@const role = (m as { role?: string }).role}
						{#if text}
							<li class={cn('flex gap-3', role === 'user' ? '' : 'flex-row-reverse')}>
								<div
									class={cn(
										'max-w-[70%] whitespace-pre-wrap rounded-lg px-3 py-2',
										role === 'user'
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
				<p class="text-sm text-muted-foreground">
					{data.conversation ? 'No messages yet.' : "This user hasn't written to the bot yet."}
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
