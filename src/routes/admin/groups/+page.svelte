<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils';
	import { pesos } from '$lib/format';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Grupos</h1>
		<p class="text-muted-foreground">{data.groups.length} grupos</p>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Nombre</Table.Head>
						<Table.Head>Código</Table.Head>
						<Table.Head>Estado</Table.Head>
						<Table.Head>Miembros</Table.Head>
						<Table.Head>Préstamos activos</Table.Head>
						<Table.Head class="text-right">Prestado total</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.groups as g (g.id)}
						<Table.Row class={cn(g.hasOverdue && 'bg-destructive/5 hover:bg-destructive/10')}>
							<Table.Cell class="font-medium">{g.name}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{g.inviteCode}</Table.Cell>
							<Table.Cell>
								{#if g.hasOverdue}
									<StatusBadge status="overdue" label="Con mora" />
								{:else}
									<StatusBadge status={g.status} />
								{/if}
							</Table.Cell>
							<Table.Cell>
								<span class="tabular-nums">{g.members.length}</span>
								<span class="text-muted-foreground">/ {g.maxMembers}</span>
							</Table.Cell>
							<Table.Cell class="tabular-nums">{g.activeLoans}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(g.totalLent)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8">
								Todavía no hay grupos.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
