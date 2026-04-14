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
		verification: 'Verificación',
		credit_decision: 'Decisión',
		active_loan: 'Préstamo activo'
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
		<p class="text-muted-foreground">Pipeline de crédito y métricas clave</p>
	</div>

	<!-- Top stats -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Description>Usuarios</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.users.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.users.onboarded} con onboarding · {pct(s.conversionRate)} llegaron a préstamo
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Referencias</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.references.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.references.responded} respondieron ({pct(s.responseRate)}) · {s.references.positive} con score ≥ 70
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Préstamos</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{s.loans.total}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.loans.active} activos · {s.loans.paid} pagados
				{#if s.loans.overdue > 0}
					· <span class="font-medium text-destructive">{s.loans.overdue} en mora</span>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Prestado total</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{pesos(s.lentCents)}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Cobrado {pesos(s.collectedCents)} ({pct(s.collectionRate)})
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Promedios y ratios -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Description>Trust score promedio</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{s.avgTrustScore ?? '—'}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Sobre {s.users.total} usuarios
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Score de referencias</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{s.avgRefScore ?? '—'}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				Promedio de {s.references.total} referencias
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Préstamo promedio</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{pesos(s.avgLoanCents)}</Card.Title>
			</Card.Header>
			<Card.Content class="text-xs text-muted-foreground">
				{s.payments.approved} de {s.payments.total} pagos confirmados
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
				{s.loans.overdue} en mora sobre {s.loans.active + s.loans.overdue} vigentes
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
						{#if key === 'onboarding'}Recolectando datos básicos{/if}
						{#if key === 'verification'}Consultando referencias{/if}
						{#if key === 'credit_decision'}Evaluando oferta{/if}
						{#if key === 'active_loan'}Con préstamo vivo{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>

	<!-- Referencias breakdown -->
	<div>
		<h2 class="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
			Referencias por estado
		</h2>
		<div class="grid gap-2 sm:grid-cols-4">
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Pendientes</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{s.references.pending}</div>
			</div>
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Contactadas</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{s.references.contacted}</div>
			</div>
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Respondieron</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{s.references.responded}</div>
			</div>
			<div class="rounded-md border bg-card px-4 py-3">
				<div class="text-xs text-muted-foreground">Fallidas</div>
				<div class={cn('mt-1 text-2xl font-semibold tabular-nums', s.references.failed > 0 && 'text-destructive')}>
					{s.references.failed}
				</div>
			</div>
		</div>
	</div>

	<!-- Actividad reciente -->
	<div class="grid gap-6 lg:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Title>Últimos usuarios</Card.Title>
				<Card.Description>
					<a href="/admin/users" class="hover:text-foreground">Ver todos →</a>
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
								<Table.Cell class="py-6 text-center text-muted-foreground">Sin datos</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Últimos préstamos</Card.Title>
				<Card.Description>
					<a href="/admin/loans" class="hover:text-foreground">Ver todos →</a>
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
								<Table.Cell class="py-6 text-center text-muted-foreground">Sin datos</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Últimos pagos</Card.Title>
				<Card.Description>Cuotas procesadas</Card.Description>
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
									<div class="font-medium">Préstamo #{p.loanId}</div>
									<div class="text-xs text-muted-foreground">{formatDate(p.createdAt)}</div>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="tabular-nums">{pesos(p.amount)}</div>
									<div class="mt-0.5"><StatusBadge status={p.status} /></div>
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell class="py-6 text-center text-muted-foreground">Sin datos</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>
</div>
