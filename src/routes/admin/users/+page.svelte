<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { pesos, formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();

	function scoreColor(s: number | null): string {
		if (s === null) return 'text-muted-foreground';
		if (s >= 70) return 'text-foreground';
		if (s >= 40) return 'text-foreground';
		return 'text-destructive';
	}

	function openUser(id: number) {
		goto(`/admin/users/${id}`);
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Users</h1>
		<p class="text-muted-foreground">{data.users.length} registered</p>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Phone</Table.Head>
						<Table.Head>Name</Table.Head>
						<Table.Head>DNI</Table.Head>
						<Table.Head>Stage</Table.Head>
						<Table.Head class="text-right">Score</Table.Head>
						<Table.Head>Onboarding</Table.Head>
						<Table.Head>Active loan</Table.Head>
						<Table.Head>Registered</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.users as u (u.id)}
						<Table.Row
							class="cursor-pointer transition-colors hover:bg-muted/60"
							onclick={() => openUser(u.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openUser(u.id);
								}
							}}
							tabindex={0}
							role="link"
						>
							<Table.Cell class="font-mono text-xs">{u.phone}</Table.Cell>
							<Table.Cell class="font-medium">{u.name ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground">{u.dni ?? '—'}</Table.Cell>
							<Table.Cell><StatusBadge status={u.state} /></Table.Cell>
							<Table.Cell class="text-right tabular-nums {scoreColor(u.trustScore)}">
								{u.trustScore ?? '—'}
							</Table.Cell>
							<Table.Cell>
								{#if u.onboardingComplete}
									<Badge variant="outline">Complete</Badge>
								{:else}
									<Badge variant="secondary">Pending</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if u.activeLoan}
									<div class="flex items-center gap-2">
										<span class="tabular-nums">{pesos(u.activeLoan.amount)}</span>
										<StatusBadge status={u.activeLoan.status} />
										<span class="text-xs text-muted-foreground">
											{u.activeLoan.installmentsPaid}/{u.activeLoan.totalInstallments}
										</span>
									</div>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(u.createdAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="text-center text-muted-foreground py-8">
								No users yet.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
