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

	const filters = [
		{ key: null, label: 'Todos' },
		{ key: 'active', label: 'Activos' },
		{ key: 'overdue', label: 'En mora' },
		{ key: 'paid', label: 'Pagados' }
	] as const;

	function hrefFor(key: string | null) {
		return key ? `/admin/loans?status=${key}` : '/admin/loans';
	}

	let pendingId = $state<number | null>(null);
</script>

<div class="space-y-6">
	<div class="flex items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Préstamos</h1>
			<p class="text-muted-foreground">{data.loans.length} préstamos</p>
		</div>
		<div class="flex gap-1 rounded-md border bg-card p-1">
			{#each filters as f (f.key ?? 'all')}
				<a
					href={hrefFor(f.key)}
					class={cn(
						'rounded-sm px-3 py-1 text-sm font-medium transition-colors',
						data.filterStatus === f.key
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:text-foreground'
					)}
				>
					{f.label}
				</a>
			{/each}
		</div>
	</div>

	{#if form && 'success' in form && form.success}
		<div class="rounded-md border bg-muted/40 px-4 py-3 text-sm">
			Cobranza disparada{form.sentTo ? ` → WhatsApp a ${form.sentTo}` : ''}.
			{#if 'warning' in form && form.warning}
				<span class="text-destructive">{form.warning}</span>
			{/if}
		</div>
	{/if}

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Usuario</Table.Head>
						<Table.Head class="text-right">Score</Table.Head>
						<Table.Head class="text-right">Monto</Table.Head>
						<Table.Head class="text-right">Cuota</Table.Head>
						<Table.Head>Cuotas</Table.Head>
						<Table.Head>Estado</Table.Head>
						<Table.Head>Próx. vto.</Table.Head>
						<Table.Head class="text-right">Acciones</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.loans as l (l.id)}
						<Table.Row class={cn(l.status === 'overdue' && 'bg-destructive/5 hover:bg-destructive/10')}>
							<Table.Cell>
								<div class="font-medium">{l.userName ?? '—'}</div>
								<div class="font-mono text-xs text-muted-foreground">{l.userPhone ?? ''}</div>
							</Table.Cell>
							<Table.Cell class="text-right tabular-nums text-muted-foreground">
								{l.userTrustScore ?? '—'}
							</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(l.amount)}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(l.installmentAmount)}</Table.Cell>
							<Table.Cell class="tabular-nums">
								{l.installmentsPaid}/{l.totalInstallments}
							</Table.Cell>
							<Table.Cell><StatusBadge status={l.status} /></Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(l.nextDueDate)}</Table.Cell>
							<Table.Cell class="text-right">
								{#if l.status !== 'paid'}
									<form
										method="POST"
										action="?/simulateCollection"
										use:enhance={() => {
											pendingId = l.id;
											return async ({ update }) => {
												await update();
												pendingId = null;
											};
										}}
									>
										<input type="hidden" name="loanId" value={l.id} />
										<Button
											type="submit"
											size="sm"
											variant="outline"
											disabled={pendingId === l.id}
										>
											{pendingId === l.id ? 'Enviando…' : 'Forzar mora'}
										</Button>
									</form>
								{/if}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="text-center text-muted-foreground py-8">
								No hay préstamos en esta vista.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
