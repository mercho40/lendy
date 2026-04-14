<script lang="ts">
	import type { PageData } from './$types';
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

	function responsesText(r: unknown): string {
		if (!r || typeof r !== 'object') return '—';
		const entries = Object.entries(r as Record<string, unknown>);
		if (!entries.length) return '—';
		return entries
			.map(([k, v]) => `${k.replaceAll('_', ' ')}: ${String(v)}`)
			.join(' · ');
	}
</script>

<div class="space-y-6">
	<div>
		<div class="mb-2 text-sm text-muted-foreground">
			<a href="/admin/users" class="hover:text-foreground">← Volver a usuarios</a>
		</div>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">
					{data.user.name ?? 'Sin nombre'}
				</h1>
				<p class="mt-1 font-mono text-sm text-muted-foreground">{data.user.phone}</p>
			</div>
			<div class="flex items-center gap-2">
				<StatusBadge status={data.state} />
				{#if data.user.onboardingComplete}
					<Badge variant="outline">Onboarding OK</Badge>
				{:else}
					<Badge variant="secondary">Onboarding pendiente</Badge>
				{/if}
			</div>
		</div>
	</div>

	<!-- Perfil -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Perfil</Card.Title>
			<Card.Description>Datos recolectados durante el onboarding</Card.Description>
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<dt class="text-muted-foreground">DNI</dt>
					<dd class="mt-1 font-mono">{data.user.dni ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Ingreso mensual</dt>
					<dd class="mt-1 tabular-nums">{incomePesos(data.user.monthlyIncome)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Ocupación</dt>
					<dd class="mt-1">{data.user.occupation ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Trust score</dt>
					<dd class="mt-1 text-lg font-semibold tabular-nums">{data.user.trustScore ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Alta</dt>
					<dd class="mt-1">{formatDate(data.user.createdAt)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Mensajes en WA</dt>
					<dd class="mt-1 tabular-nums">{data.messageCount}</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>

	<!-- Referencias -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Referencias ({data.references.length})</Card.Title>
			<Card.Description>Contactos que dan fe del perfil financiero</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Nombre</Table.Head>
						<Table.Head>Teléfono</Table.Head>
						<Table.Head>Relación</Table.Head>
						<Table.Head>Estado</Table.Head>
						<Table.Head class="text-right">Score</Table.Head>
						<Table.Head>Respuestas</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.references as r (r.id)}
						<Table.Row
							class={cn(r.score !== null && r.score < 40 && 'bg-destructive/5')}
						>
							<Table.Cell class="font-medium">{r.name ?? '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{r.phone}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{r.relationship ?? '—'}</Table.Cell>
							<Table.Cell><StatusBadge status={r.status} /></Table.Cell>
							<Table.Cell class="text-right tabular-nums">{r.score ?? '—'}</Table.Cell>
							<Table.Cell class="max-w-md truncate text-xs text-muted-foreground">
								{responsesText(r.responses)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="py-6 text-center text-muted-foreground">
								Este usuario todavía no cargó referencias.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Préstamos -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Préstamos ({data.loans.length})</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ID</Table.Head>
						<Table.Head class="text-right">Monto</Table.Head>
						<Table.Head class="text-right">Cuota</Table.Head>
						<Table.Head>Cuotas</Table.Head>
						<Table.Head>Estado</Table.Head>
						<Table.Head>Próx. vto.</Table.Head>
						<Table.Head>Últ. recordatorio</Table.Head>
						<Table.Head>Alta</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.loans as l (l.id)}
						<Table.Row
							class={cn(l.status === 'overdue' && 'bg-destructive/5')}
						>
							<Table.Cell class="font-mono text-xs">#{l.id}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(l.amount)}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(l.installmentAmount)}</Table.Cell>
							<Table.Cell class="tabular-nums">
								{l.installmentsPaid}/{l.totalInstallments}
							</Table.Cell>
							<Table.Cell><StatusBadge status={l.status} /></Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(l.nextDueDate)}</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{formatDate(l.lastReminderAt)}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(l.createdAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="py-6 text-center text-muted-foreground">
								Sin préstamos.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Pagos -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Pagos ({data.payments.length})</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ID</Table.Head>
						<Table.Head>Préstamo</Table.Head>
						<Table.Head class="text-right">Monto</Table.Head>
						<Table.Head>Estado</Table.Head>
						<Table.Head>Link</Table.Head>
						<Table.Head>Fecha</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.payments as p (p.id)}
						<Table.Row>
							<Table.Cell class="font-mono text-xs">#{p.id}</Table.Cell>
							<Table.Cell class="font-mono text-xs">#{p.loanId}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{pesos(p.amount)}</Table.Cell>
							<Table.Cell><StatusBadge status={p.status} /></Table.Cell>
							<Table.Cell class="max-w-xs truncate">
								{#if p.paymentLink}
									<a
										href={p.paymentLink}
										class="text-primary underline-offset-4 hover:underline"
										target="_blank"
										rel="noopener"
									>
										abrir
									</a>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(p.createdAt)}</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="py-6 text-center text-muted-foreground">
								Sin pagos.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
