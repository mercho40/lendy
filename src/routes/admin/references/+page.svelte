<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils';
	import { formatDate } from '$lib/format';

	let { data }: { data: PageData } = $props();

	function openRef(id: number) {
		goto(`/admin/references/${id}`);
	}

	function scoreClass(s: number | null): string {
		if (s === null) return 'text-muted-foreground';
		if (s >= 70) return 'text-foreground';
		if (s >= 40) return 'text-foreground';
		return 'text-destructive';
	}

	function responsesPreview(r: unknown): string {
		if (!r || typeof r !== 'object') return '—';
		const entries = Object.entries(r as Record<string, unknown>);
		if (!entries.length) return '—';
		return entries.map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
	}
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
						<Table.Head class="text-right">Score</Table.Head>
						<Table.Head>Respuestas</Table.Head>
						<Table.Head>Creada</Table.Head>
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
							<Table.Cell>
								<div class="font-medium">{r.applicantName ?? '—'}</div>
								<div class="font-mono text-xs text-muted-foreground">
									{r.applicantPhone ?? ''}
								</div>
							</Table.Cell>
							<Table.Cell class="font-medium">{r.name ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{r.phone}</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{r.relationship ?? '—'}
							</Table.Cell>
							<Table.Cell><StatusBadge status={r.status} /></Table.Cell>
							<Table.Cell class="text-right tabular-nums {scoreClass(r.score)}">
								{r.score ?? '—'}
							</Table.Cell>
							<Table.Cell class="max-w-xs truncate text-sm text-muted-foreground">
								{responsesPreview(r.responses)}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(r.createdAt)}</Table.Cell>
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
