<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { pesos, formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Usuarios</h1>
		<p class="text-muted-foreground">{data.users.length} registrados</p>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Teléfono</Table.Head>
						<Table.Head>Nombre</Table.Head>
						<Table.Head>DNI</Table.Head>
						<Table.Head>Onboarding</Table.Head>
						<Table.Head>Grupo</Table.Head>
						<Table.Head>Préstamo activo</Table.Head>
						<Table.Head>Alta</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.users as u (u.id)}
						<Table.Row>
							<Table.Cell class="font-mono text-xs">{u.phone}</Table.Cell>
							<Table.Cell class="font-medium">{u.name ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground">{u.dni ?? '—'}</Table.Cell>
							<Table.Cell>
								{#if u.onboardingComplete}
									<Badge variant="outline">Completo</Badge>
								{:else}
									<Badge variant="secondary">Pendiente</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if u.groupName}
									<div class="flex items-center gap-2">
										<span>{u.groupName}</span>
										<StatusBadge status={u.groupStatus ?? 'forming'} />
									</div>
								{:else}
									<span class="text-muted-foreground">—</span>
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
							<Table.Cell colspan={7} class="text-center text-muted-foreground py-8">
								Todavía no hay usuarios.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
