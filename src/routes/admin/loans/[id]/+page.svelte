<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils';
	import { pesos, formatDate } from '$lib/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let pending = $state(false);

	function pct(a: number, b: number): string {
		if (!b) return '0%';
		return `${Math.round((a / b) * 100)}%`;
	}

	function termsEntries(t: unknown): Array<[string, unknown]> {
		if (!t || typeof t !== 'object') return [];
		return Object.entries(t as Record<string, unknown>);
	}
</script>

<div class="space-y-6">
	<div>
		<div class="mb-2 text-sm text-muted-foreground">
			<a href="/admin/loans" class="hover:text-foreground">← Back to loans</a>
		</div>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">Loan #{data.loan.id}</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					{#if data.borrower}
						<a
							href={`/admin/users/${data.borrower.id}`}
							class="font-medium text-foreground underline-offset-4 hover:underline"
						>
							{data.borrower.name ?? data.borrower.phone}
						</a>
					{:else}
						(unknown user)
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-3">
				<StatusBadge status={data.loan.status} />
				{#if data.loan.status !== 'paid'}
					<form
						method="POST"
						action="?/simulateCollection"
						use:enhance={() => {
							pending = true;
							return async ({ update }) => {
								await update();
								pending = false;
							};
						}}
					>
						<Button type="submit" size="sm" variant="outline" disabled={pending}>
							{pending ? 'Sending…' : 'Force overdue'}
						</Button>
					</form>
				{/if}
			</div>
		</div>
	</div>

	{#if form && 'success' in form && form.success}
		<div class="rounded-md border bg-muted/40 px-4 py-3 text-sm">
			Collection triggered{form.sentTo ? ` → WhatsApp to ${form.sentTo}` : ''}.
			{#if 'warning' in form && form.warning}
				<span class="text-destructive">{form.warning}</span>
			{/if}
		</div>
	{/if}

	<!-- Summary -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Details</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<dt class="text-muted-foreground">Amount</dt>
					<dd class="mt-1 text-lg font-semibold tabular-nums">{pesos(data.loan.amount)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Installment</dt>
					<dd class="mt-1 tabular-nums">{pesos(data.loan.installmentAmount)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Progress</dt>
					<dd class="mt-1 tabular-nums">
						{data.loan.installmentsPaid}/{data.loan.totalInstallments}
						<span class="text-muted-foreground">
							({pct(data.loan.installmentsPaid, data.loan.totalInstallments)})
						</span>
					</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Rate</dt>
					<dd class="mt-1 tabular-nums">{(data.loan.interestRate / 100).toFixed(2)}%</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Next due</dt>
					<dd class="mt-1">{formatDate(data.loan.nextDueDate)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Last reminder</dt>
					<dd class="mt-1">{formatDate(data.loan.lastReminderAt)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Created</dt>
					<dd class="mt-1">{formatDate(data.loan.createdAt)}</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>

	{#if termsEntries(data.loan.terms).length}
		<Card.Root>
			<Card.Header>
				<Card.Title>Credit terms</Card.Title>
				<Card.Description>Credit decision output</Card.Description>
			</Card.Header>
			<Card.Content>
				<dl class="space-y-2 text-sm">
					{#each termsEntries(data.loan.terms) as [k, v] (k)}
						<div class="grid grid-cols-[200px_1fr] gap-4 border-b pb-2 last:border-0">
							<dt class="text-muted-foreground">{k.replaceAll('_', ' ')}</dt>
							<dd class="tabular-nums">{String(v)}</dd>
						</div>
					{/each}
				</dl>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Payments ({data.payments.length})</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ID</Table.Head>
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
						<Table.Row class={cn(p.status === 'rejected' && 'bg-destructive/5')}>
							<Table.Cell class="font-mono text-xs">#{p.id}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(p.amount)}</Table.Cell>
							<Table.Cell><StatusBadge status={p.status} /></Table.Cell>
							<Table.Cell class="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
								{p.mpPreferenceId ?? '—'}
							</Table.Cell>
							<Table.Cell class="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
								{p.mpPaymentId ?? '—'}
							</Table.Cell>
							<Table.Cell>
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
							<Table.Cell colspan={7} class="py-6 text-center text-muted-foreground">
								No payments.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
