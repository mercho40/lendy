<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils';
	import { formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-semibold tracking-tight">Referencias</h1>
		<p class="text-muted-foreground">
			Contactos de los aplicantes — {data.references.length} en total
		</p>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Aplicante</Table.Head>
						<Table.Head>Referencia</Table.Head>
						<Table.Head>Teléfono</Table.Head>
						<Table.Head>Relación</Table.Head>
						<Table.Head>Estado</Table.Head>
						<Table.Head>Sentimiento</Table.Head>
						<Table.Head>Resumen</Table.Head>
						<Table.Head>Contactada</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.references as r (r.id)}
						<Table.Row class={cn(r.sentiment === 'negative' && 'bg-destructive/5 hover:bg-destructive/10')}>
							<Table.Cell>
								<div class="font-medium">{r.applicantName ?? '—'}</div>
								<div class="font-mono text-xs text-muted-foreground">
									{r.applicantPhone ?? ''}
								</div>
							</Table.Cell>
							<Table.Cell class="font-medium">{r.name}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{r.phone}</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{r.relationship ?? '—'}
							</Table.Cell>
							<Table.Cell><StatusBadge status={r.status} /></Table.Cell>
							<Table.Cell>
								{#if r.sentiment}
									<StatusBadge status={r.sentiment} />
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="max-w-xs truncate text-sm text-muted-foreground">
								{r.responseSummary ?? '—'}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(r.contactedAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="text-center text-muted-foreground py-8">
								Todavía no hay referencias registradas.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
