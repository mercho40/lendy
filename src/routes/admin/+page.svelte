<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import { pesos, formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();
	let s = $derived(data.stats);
	let r = $derived(data.recent);

	const pipelineLabels: Record<string, string> = {
		onboarding: 'Onboarding',
		verification: 'Verification',
		credit_decision: 'Decision',
		active_loan: 'Active loan'
	};
	const pipelineOrder: Array<keyof typeof s.pipeline> = [
		'onboarding',
		'verification',
		'credit_decision',
		'active_loan'
	];

	function pct(n: number): string {
		return `${Math.round(n * 100)}%`;
	}

	function go(path: string) {
		goto(path);
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Credit pipeline and key metrics</p>
	</div>

	<!-- Top stats -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Description>Users</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.users.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.users.onboarded} onboarded · {pct(s.conversionRate)} reached a loan
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>References</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.references.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.references.responded} responded ({pct(s.responseRate)}) · {s.references.positive} scored ≥ 70
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Loans</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.loans.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.loans.active} active · {s.loans.paid} paid
				{#if s.loans.overdue > 0}
					· <span class="font-medium text-destructive">{s.loans.overdue} overdue</span>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Total lent</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{pesos(s.lentCents)}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Collected {pesos(s.collectedCents)} ({pct(s.collectionRate)})
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Averages and ratios -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Description>Avg trust score</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{s.avgTrustScore ?? '—'}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Across {s.users.total} users
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Avg reference score</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{s.avgRefScore ?? '—'}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Across {s.references.total} references
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Avg loan</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{pesos(s.avgLoanCents)}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.payments.approved} of {s.payments.total} payments confirmed
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Default rate</Card.Description>
				<Card.Title class="text-2xl tabular-nums">
					<span class={cn(s.defaultRate > 0.2 && 'text-destructive')}>
						{pct(s.defaultRate)}
					</span>
				</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.loans.overdue} overdue out of {s.loans.active + s.loans.overdue} outstanding
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Pipeline -->
	<div>
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
			Pipeline
		</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each pipelineOrder as key, i (key)}
				<Card.Root>
					<Card.Header>
						<Card.Description class="flex items-center gap-2">
							<span
								class="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground"
								>{i + 1}</span
							>
							{pipelineLabels[key]}
						</Card.Description>
						<Card.Title class="text-3xl tabular-nums">{s.pipeline[key]}</Card.Title>
					</Card.Header>
					<Card.Content class="text-xs text-muted-foreground">
						{#if key === 'onboarding'}Collecting basic data{/if}
						{#if key === 'verification'}Polling references{/if}
						{#if key === 'credit_decision'}Evaluating offer{/if}
						{#if key === 'active_loan'}With live loan{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>

	<!-- References breakdown -->
	<div>
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
			References by status
		</h2>
		<div class="grid gap-2 sm:grid-cols-4">
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Pending</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{s.references.pending}</div>
			</div>
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Contacted</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{s.references.contacted}</div>
			</div>
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Responded</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{s.references.responded}</div>
			</div>
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Failed</div>
				<div class={cn('mt-1 text-2xl font-semibold tabular-nums', s.references.failed > 0 && 'text-destructive')}>
					{s.references.failed}
				</div>
			</div>
		</div>
	</div>

	<!-- Recent activity -->
	<div class="grid gap-6 lg:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Title>Recent users</Card.Title>
				<Card.Description>
					<a href="/admin/users" class="hover:text-foreground">View all →</a>
				</Card.Description>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Body>
						{#each r.users as u (u.id)}
							<Table.Row
								class="cursor-pointer transition-colors hover:bg-muted/60"
								onclick={() => go(`/admin/users/${u.id}`)}
							>
								<Table.Cell>
									<div class="font-medium">{u.name ?? u.phone}</div>
									<div class="font-mono text-xs text-muted-foreground">
										{formatDate(u.createdAt)}
									</div>
								</Table.Cell>
								<Table.Cell class="text-right">
									{#if u.onboardingComplete}
										<Badge variant="outline">OK</Badge>
									{:else}
										<Badge variant="secondary">·</Badge>
									{/if}
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell class="py-6 text-center text-muted-foreground">No data</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent loans</Card.Title>
				<Card.Description>
					<a href="/admin/loans" class="hover:text-foreground">View all →</a>
				</Card.Description>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Body>
						{#each r.loans as l (l.id)}
							<Table.Row
								class="cursor-pointer transition-colors hover:bg-muted/60"
								onclick={() => go(`/admin/loans/${l.id}`)}
							>
								<Table.Cell>
									<div class="font-medium">{l.userName ?? l.userPhone ?? '—'}</div>
									<div class="text-xs text-muted-foreground">
										{l.installmentsPaid}/{l.totalInstallments} · {formatDate(l.createdAt)}
									</div>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="tabular-nums">{pesos(l.amount)}</div>
									<div class="mt-0.5"><StatusBadge status={l.status} /></div>
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell class="py-6 text-center text-muted-foreground">No data</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent payments</Card.Title>
				<Card.Description>Processed installments</Card.Description>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Body>
						{#each r.payments as p (p.id)}
							<Table.Row
								class="cursor-pointer transition-colors hover:bg-muted/60"
								onclick={() => go(`/admin/loans/${p.loanId}`)}
							>
								<Table.Cell>
									<div class="font-medium">Loan #{p.loanId}</div>
									<div class="text-xs text-muted-foreground">{formatDate(p.createdAt)}</div>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="tabular-nums">{pesos(p.amount)}</div>
									<div class="mt-0.5"><StatusBadge status={p.status} /></div>
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell class="py-6 text-center text-muted-foreground">No data</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>
</div>
